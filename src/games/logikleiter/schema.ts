import {z} from 'zod';
import {createSession,validateContent,type Session} from './engine';
const id=z.string().min(1).max(128);
const ix=z.number().int().nonnegative().safe();
const rung=z.strictObject({
 id,difficulty:z.number().int().min(1).max(7),kind:z.enum(['deduction','numeric','ordering','constraint']),
 prompt:z.string().min(1).max(3000),hint:z.string().min(1).max(2000),
 answer:z.string().min(1).max(2000),explanation:z.string().min(1).max(3000),
 reference:z.string().min(1).max(1000),
});
const team=z.strictObject({id,name:z.string().trim().min(1).max(40),order:ix});
const award=z.strictObject({rungId:id,teamId:id,points:ix,annulled:z.boolean()});
const state=z.strictObject({
 id,ownerId:id,epoch:z.number().int().positive(),revision:ix,
 profile:z.enum(['kurz','standard','lang']),
 teams:z.array(team).min(3).max(5),rungs:z.array(rung).min(3).max(7),
 index:ix,phase:z.enum(['setup','ready','open','closed','revealed','graded','complete']),
 paused:z.boolean(),hintShown:z.boolean(),fairHint:z.boolean(),
 locks:z.record(id,z.strictObject({hintRevision:z.union([z.literal(0),z.literal(1)])})),
 grades:z.record(id,z.enum(['correct','wrong','absent'])),
 awards:z.array(award),audit:z.array(z.strictObject({revision:ix,commandId:id,action:z.string(),at:ix})),
}).superRefine((s,ctx)=>{
 try{
  validateContent(s.teams,s.profile,s.rungs);
  if(s.index>s.rungs.length||(s.phase==='complete')!==(s.index===s.rungs.length))
   throw Error('Unzulässige Stufe oder Endphase');
  if(!s.hintShown&&Object.values(s.locks).some(x=>x.hintRevision===1))
   throw Error('Sperre nach unveröffentlichtem Hinweis');
  if(s.fairHint&&!s.hintShown)throw Error('Hinweis-Ausgleich ohne Hinweis');
  if(Object.keys(s.locks).some(k=>!s.teams.some(t=>t.id===k))||
     Object.keys(s.grades).some(k=>!s.teams.some(t=>t.id===k)))
   throw Error('Antwort mit unbekanntem Team');
  if(s.awards.some(a=>!s.teams.some(t=>t.id===a.teamId)||
      !s.rungs.some(r=>r.id===a.rungId)||a.points>70||a.points%5!==0))
   throw Error('Ungültige Wertung');
  if(new Set(s.awards.map(a=>a.rungId+':'+a.teamId)).size!==s.awards.length)
   throw Error('Doppelte Stufenwertung');
  if(s.awards.some(a=>a.rungId===s.rungs[s.index]?.id&&s.phase!=='graded'))
   throw Error('Wertung vor Abschluss');
 }catch(error){ctx.addIssue({code:'custom',message:error instanceof Error?error.message:'Invalid LL snapshot'});}
});
export const llSessionSchema=z.custom<Session>(raw=>state.safeParse(raw).success,'Ungültige Logikleiter-Sitzung');
export const llActionSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('START')}),z.strictObject({type:z.literal('PUBLISH')}),
 z.strictObject({type:z.literal('LOCK'),teamId:id}),
 z.strictObject({type:z.literal('HINT')}),
 z.strictObject({type:z.literal('FAIR_HINT'),reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('CLOSE')}),z.strictObject({type:z.literal('REVEAL')}),
 z.strictObject({type:z.literal('GRADE'),teamId:id,value:z.enum(['correct','wrong','absent'])}),
 z.strictObject({type:z.literal('CONFIRM')}),
 z.strictObject({type:z.literal('CORRECT'),reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('ANNUL'),reason:z.string().trim().min(3).max(500)}),
 z.strictObject({type:z.literal('NEXT')}),z.strictObject({type:z.literal('PAUSE')}),
 z.strictObject({type:z.literal('RESUME')}),
]);
export {createSession};