import {z} from 'zod';
import {validateContent,type Session} from './engine';
const id=z.string().min(1).max(128),ix=z.number().int().nonnegative().safe();
const rank=z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]);
const submission=z.strictObject({
 answers:z.array(z.string().trim().max(300)).max(3),
 mapped:z.array(rank.nullable()).max(3),
});
const source=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('illustrative')}),
 z.strictObject({kind:z.literal('observed'),source:z.string().min(3),
  population:z.string().min(3),method:z.string().min(3),collectedOn:z.string().min(10),
  limitations:z.string().min(3),reviewed:z.literal(true)}),
]);
const category=z.strictObject({
 label:z.string().min(1).max(100),synonyms:z.array(z.string().min(1).max(100)).max(15),
});
const survey=z.strictObject({id,format:z.enum(['popular','top3']),prompt:z.string().trim().min(1).max(3000),
 categories:z.tuple([category,category,category,category,category]),
 source});
const state=z.strictObject({
 id,ownerId:id,epoch:z.number().int().positive(),revision:ix,
 profile:z.enum(['kurz','standard','lang']),
 teams:z.array(z.strictObject({id,name:z.string().trim().min(1).max(40),order:ix})).min(3).max(5),
 surveys:z.array(survey).min(4).max(10),index:ix,
 phase:z.enum(['setup','ready','open','closed','revealed','graded','complete']),
 paused:z.boolean(),submissions:z.record(id,submission),
 awards:z.array(z.strictObject({surveyId:id,teamId:id,points:ix,annulled:z.boolean()})),
 audit:z.array(z.strictObject({revision:ix,commandId:id,action:z.string(),at:ix})),
}).superRefine((s,ctx)=>{
 try{
  validateContent(s.teams,s.profile,s.surveys);
  if(s.index>s.surveys.length||(s.phase==='complete')!==(s.index===s.surveys.length))
   throw Error('Unzulässige Aufgabe oder Endphase');
  if(Object.keys(s.submissions).some(k=>!s.teams.some(t=>t.id===k)))
   throw Error('Antwort eines unbekannten Teams');
  if(s.awards.some(a=>!s.teams.some(t=>t.id===a.teamId)||
     !s.surveys.some(q=>q.id===a.surveyId)||a.points>30))
   throw Error('Ungültige Wertung');
  if(new Set(s.awards.map(a=>a.surveyId+':'+a.teamId)).size!==s.awards.length)
   throw Error('Doppelte Aufgabenwertung');
  if(s.awards.some(a=>a.surveyId===s.surveys[s.index]?.id&&s.phase!=='graded'))
   throw Error('Wertung vor Abschluss');
 }catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid UD snapshot'});}
});
export const udSessionSchema=z.custom<Session>(raw=>state.safeParse(raw).success,'Ungültige Umfrageduell-Sitzung');
export const udActionSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('START')}),z.strictObject({type:z.literal('PUBLISH')}),
 z.strictObject({type:z.literal('CLOSE')}),
 z.strictObject({type:z.literal('RECORD'),teamId:id,submission}),
 z.strictObject({type:z.literal('REVEAL')}),z.strictObject({type:z.literal('CONFIRM')}),
 z.strictObject({type:z.literal('CORRECT'),teamId:id,submission,
  reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('ANNUL'),reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('NEXT')}),z.strictObject({type:z.literal('PAUSE')}),
 z.strictObject({type:z.literal('RESUME')}),
]);
