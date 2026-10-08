import { z } from 'zod';
import {createSession,validateContent,type Session} from './engine';
const id=z.string().min(1).max(128);
const ix=z.number().int().nonnegative().safe();
const group=z.strictObject({
 id,tileIds:z.tuple([id,id,id,id]),link:z.string().min(1).max(500),
 acceptedLinks:z.array(z.string().min(1).max(500)).min(1),
});
const clue=z.strictObject({
 id,kind:z.literal('clues'),target:z.string().min(1).max(500),
 clues:z.tuple([z.string().min(1),z.string().min(1),z.string().min(1),z.string().min(1)]),
 reference:z.string().min(1),
});
const sequence=z.strictObject({
 id,kind:z.literal('sequence'),prompt:z.string().min(1),
 items:z.tuple([z.string().min(1),z.string().min(1),z.string().min(1)]),
 answer:z.string().min(1),explanation:z.string().min(1),reference:z.string().min(1),
});
const wall=z.strictObject({
 id,kind:z.literal('wall'),tiles:z.array(z.strictObject({id,label:z.string().min(1)})).length(16),
 groups:z.array(group).length(4),reference:z.string().min(1),
});
const puzzle=z.discriminatedUnion('kind',[clue,sequence,wall]);
const award=z.strictObject({puzzleId:id,teamId:id,points:ix,annulled:z.boolean()});
const mark=z.strictObject({group:z.boolean(),link:z.boolean()});
const state=z.strictObject({
 id,ownerId:id,epoch:z.number().int().positive(),revision:ix,
 profile:z.enum(['kurz','standard','lang']),
 teams:z.array(z.strictObject({id,name:z.string().min(1).max(40),order:ix})).min(3).max(5),
 puzzles:z.array(puzzle).min(4).max(16),
 assignments:z.array(z.strictObject({puzzleId:id,kind:z.enum(['clues','sequence','wall']),teamId:id.nullable()})).min(4).max(16),
 index:ix,phase:z.enum(['setup','ready','clue-open','sequence-open','wall-open','wall-closed','wall-reveal','revealed','graded','complete']),
 paused:z.boolean(),clueIndex:ix,judgement:z.enum(['correct','wrong','none']).nullable(),
 revealedGroups:z.number().int().min(0).max(4),
 wallMarks:z.record(id,z.record(id,mark)),
 awards:z.array(award),audit:z.array(z.strictObject({revision:ix,commandId:id,action:z.string(),at:ix})),
}).superRefine((s,ctx)=>{
 try {
  validateContent(s.teams,s.profile,s.puzzles);
  const planned=createSession({id:s.id,ownerId:s.ownerId,teams:s.teams,profile:s.profile,puzzles:s.puzzles}).assignments;
  if(JSON.stringify(planned)!==JSON.stringify(s.assignments))throw new Error('Changed preassigned puzzle order');
  if(s.index>planned.length||(s.index===planned.length&&s.phase!=='complete'))throw new Error('Invalid task index');
  if(s.phase==='complete'&&s.index!==planned.length)throw new Error('Incomplete game ended');
  if(s.clueIndex>4)throw new Error('Invalid revealed clue count');
  if(new Set(s.awards.map(x=>x.puzzleId+':'+x.teamId)).size!==s.awards.length)throw new Error('Duplicate team awards');
  if(s.awards.some(a=>!s.puzzles.some(p=>p.id===a.puzzleId)||!s.teams.some(t=>t.id===a.teamId)||
    a.points>40||a.points%5!==0))throw new Error('Invalid award');
  if(s.awards.some(a=>a.puzzleId===s.assignments[s.index]?.puzzleId&&s.phase!=='graded'))throw new Error('Scores before finalized task');
  if(s.revealedGroups>0&&s.assignments[s.index]?.kind!=='wall')throw new Error('Wall reveals outside wall');
  for(const [teamId,groups] of Object.entries(s.wallMarks)){
   if(!s.teams.some(t=>t.id===teamId))throw new Error('Unknown wall team');
   const w=s.puzzles.find(p=>p.kind==='wall');
   for(const [groupId,m] of Object.entries(groups))
    if(!w||w.kind!=='wall'||!w.groups.some(g=>g.id===groupId)||m.link&&!m.group)
     throw new Error('Invalid group grading');
  }
 }catch(e){ctx.addIssue({code:'custom',path:['puzzles'],message:e instanceof Error?e.message:'Invalid VB aggregate'});}
});
export const vbSessionSchema=z.custom<Session>(value=>state.safeParse(value).success,'Invalid Verbindungen session');
export const vbActionSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('START')}),z.strictObject({type:z.literal('PUBLISH')}),
 z.strictObject({type:z.literal('NEXT_CLUE')}),
 z.strictObject({type:z.literal('JUDGE'),value:z.enum(['correct','wrong','none'])}),
 z.strictObject({type:z.literal('CLOSE_WALL')}),
 z.strictObject({type:z.literal('REVEAL_WALL_GROUP')}),
 z.strictObject({type:z.literal('MARK_GROUP'),teamId:id,groupId:id,correct:z.boolean()}),
 z.strictObject({type:z.literal('MARK_LINK'),teamId:id,groupId:id,correct:z.boolean()}),
 z.strictObject({type:z.literal('REVEAL')}),z.strictObject({type:z.literal('CONFIRM')}),
 z.strictObject({type:z.literal('CORRECT')}),
 z.strictObject({type:z.literal('ANNUL'),reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('NEXT')}),
 z.strictObject({type:z.literal('PAUSE')}),z.strictObject({type:z.literal('RESUME')}),
]);
