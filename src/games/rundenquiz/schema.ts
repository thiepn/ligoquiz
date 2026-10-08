import { z } from 'zod';
import type { Session } from './engine';
const id=z.string().min(1).max(128);
const idx=z.number().int().nonnegative().safe();
const judgement=z.enum(['richtig','falsch','keine']);
const question=z.strictObject({
 id,round:z.enum(['wissen','hinweise','schaetzen','finale']),
 prompt:z.string().min(1).max(3000),answer:z.string().min(1).max(2000),
 reference:z.string().min(1).max(2000),choices:z.array(z.string()).optional(),
 clues:z.array(z.string()).optional(),
 truth:z.union([z.number().int().safe(),z.string()]).optional(),
 unit:z.string().optional(),durationSeconds:z.number().int().min(5).max(300),
});
const entry=z.strictObject({estimate:z.string().nullable().optional(),lockLevel:idx.optional(),judgement:judgement.optional()});
const award=z.strictObject({teamId:id,questionId:id,points:idx,judgement,rank:idx.optional()});
const audit=z.strictObject({revision:idx,commandId:id,action:z.string().min(1),issuedAt:idx});
const shape=z.strictObject({
 id,ownerId:id,epoch:z.number().int().positive(),revision:idx,
 profile:z.enum(['kurz','standard','lang']),teams:z.array(z.strictObject({id,name:z.string().min(1).max(40),order:idx})).min(3).max(5),
 questions:z.array(question).min(1).max(16),
 phase:z.enum(['setup','ready','open','closed','revealed','graded','complete']),
 paused:z.boolean(),index:idx,clueCount:idx,entries:z.record(id,entry),
 awards:z.array(award),audit:z.array(audit),
}).superRefine((s,ctx)=>{
 if(s.index>=s.questions.length)ctx.addIssue({code:'custom',path:['index'],message:'Question index out of range'});
 if(new Set(s.questions.map(q=>q.id)).size!==s.questions.length)ctx.addIssue({code:'custom',path:['questions'],message:'Duplicate question'});
 if(new Set(s.teams.map(t=>t.id)).size!==s.teams.length)ctx.addIssue({code:'custom',path:['teams'],message:'Duplicate team'});
 if(new Set(s.awards.map(a=>a.teamId+':'+a.questionId)).size!==s.awards.length)ctx.addIssue({code:'custom',path:['awards'],message:'Repeated award'});
 if(s.awards.some(a=>!s.teams.some(t=>t.id===a.teamId)||!s.questions.some(q=>q.id===a.questionId)))ctx.addIssue({code:'custom',path:['awards'],message:'Unknown award target'});
});
/** Parse actual properties; no unchecked z.any() RQ state inside persistent snapshots. */
export const rqSessionSchema=z.custom<Session>(value=>shape.safeParse(value).success,'Invalid Rundenquiz session');
const action=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('START')}),z.strictObject({type:z.literal('PUBLISH')}),
 z.strictObject({type:z.literal('NEXT_CLUE')}),z.strictObject({type:z.literal('LOCK_HINT'),teamId:id}),
 z.strictObject({type:z.literal('ESTIMATE'),teamId:id,value:z.union([z.string(),z.number().int().safe(),z.null()])}),
 z.strictObject({type:z.literal('CLOSE')}),z.strictObject({type:z.literal('REVEAL')}),
 z.strictObject({type:z.literal('JUDGE'),teamId:id,value:judgement}),
 z.strictObject({type:z.literal('CONFIRM')}),z.strictObject({type:z.literal('CORRECT')}),
 z.strictObject({type:z.literal('ANNUL')}),z.strictObject({type:z.literal('NEXT')}),
 z.strictObject({type:z.literal('FINISH')}),z.strictObject({type:z.literal('PAUSE')}),
 z.strictObject({type:z.literal('RESUME')}),
]);
export const rqActionSchema=action;
