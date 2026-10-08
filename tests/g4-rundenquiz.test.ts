import { describe,it,expect } from 'vitest';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { createSession, currentQuestion, transition, estimateAwards, PROFILE_COUNTS,
 scores, type Profile, type Session, type Action } from '../src/games/rundenquiz/engine';
import { parseEstimateInput } from '../src/games/rundenquiz/decimal';
import { RQ_TRIAL_BANK } from '../src/games/rundenquiz/trial-bank';
import { createEvent } from '../src/domain/event/transition';
import { derivePublicStage } from '../src/domain/event/public-projection';
import { EventRepository } from '../src/infrastructure/db/event-repository';
import type { EventRecord } from '../src/domain/event/schemas';
const names=(n:number)=>Array.from({length:n},(_,i)=>({id:'team-'+i,name:'Team '+i,order:i}));
const local=(n:number,p:Profile)=>createSession({id:'event-demo',ownerId:'host-demo',teams:names(n),profile:p,bank:RQ_TRIAL_BANK});
function run(s:Session,a:Action):Session{return transition(s,{id:'command-'+s.revision,ownerId:s.ownerId,epoch:s.epoch,expectedRevision:s.revision,at:100+s.revision,action:a});}
function seed():EventRecord{
 const rq=local(3,'kurz');
 return createEvent({
  id:rq.id,hostId:rq.ownerId,at:101,
  teams:rq.teams.map(t=>({...t,colorToken:'neutral'})),
  program:[{id:'rq-game-1',type:'rundenquiz',profile:rq.profile,order:0,rulesVersion:'rq-v1'}],
  frozenTasks:rq.questions.map(q=>({taskId:q.id,gameType:'rundenquiz' as const,
   publicPrompt:q.prompt,publicClues:[...(q.clues??[])],privateAnswers:[q.answer],
   sourceContentId:q.id,sourceHash:'trial-hash'})),rundenquiz:rq,
 });
}
function envelope(s:EventRecord,a:Action,id:string){
 return {protocolVersion:1,eventId:s.id,commandId:id,hostEpoch:s.hostEpoch,hostId:s.hostId,
  expectedRevision:s.revision,issuedAtEpochMs:Date.now(),actor:'host',
  payload:{type:'RQ_ACTION',action:a}};
}
describe('G4 profiles and deterministic Rundenquiz engine',()=>{
 for(const profile of ['kurz','standard','lang'] as const){
  for(const teams of [3,4,5])it('plays '+profile+' with '+teams+' teams from setup to standings',()=>{
   let s=local(teams,profile);
   expect(s.questions.length).toBe(Object.values(PROFILE_COUNTS[profile]).reduce((a,b)=>a+b,0));
   s=run(s,{type:'START'});
   for(let i=0;i<s.questions.length;i++){
    const q=currentQuestion(s)!;s=run(s,{type:'PUBLISH'});
    if(q.round==='hinweise')for(const t of s.teams)s=run(s,{type:'LOCK_HINT',teamId:t.id});
    if(q.round==='schaetzen')for(const t of s.teams)s=run(s,{type:'ESTIMATE',teamId:t.id,value:q.truth!});
    s=run(s,{type:'CLOSE'});s=run(s,{type:'REVEAL'});
    if(q.round!=='schaetzen')for(const t of s.teams)s=run(s,{type:'JUDGE',teamId:t.id,value:'richtig'});
    s=run(s,{type:'CONFIRM'});
    s=run(s,i===s.questions.length-1?{type:'FINISH'}:{type:'NEXT'});
   }
   expect(s.phase).toBe('complete');
   expect(s.awards).toHaveLength(teams*s.questions.length);
   expect(new Set(s.awards.map(a=>a.questionId+'-'+a.teamId)).size).toBe(s.awards.length);
  });
 }
 it('computes exact decimal and metric estimates with competition ties',()=>{
  expect(parseEstimateInput('1,8 km','Meter').value).toBe('1800');
  expect(parseEstimateInput('90 s','Minuten').value).toBe('1.5');
  expect(estimateAwards({A:'42.194',B:'42.196',C:'42.199'},'42.195'))
    .toEqual({A:{rank:1,points:15},B:{rank:1,points:15},C:{rank:3,points:9}});
 });
 it('keeps solutions private until the host reveals',()=>{
  const session=seed(), initial=JSON.stringify(derivePublicStage(session));
  expect(initial).not.toContain('Josua');
  let s=session.rundenquiz!;
  s=run(s,{type:'START'});s=run(s,{type:'PUBLISH'});
  expect(JSON.stringify(derivePublicStage({...session,rundenquiz:s,lifecycle:'active'}))).not.toContain('Josua');
  s=run(s,{type:'CLOSE'});s=run(s,{type:'REVEAL'});
  expect(JSON.stringify(derivePublicStage({...session,rundenquiz:s,lifecycle:'active'}))).toContain('Josua');
 });
});
describe('G4 transactional integration',()=>{
 it('commits team awards as one G2 revision and reverses/reconfirms them with audit',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g4-test-'+crypto.randomUUID());
  try{
   let e=seed();await db.create(e);
   const send=async(a:Action,id:string)=>{
    await db.dispatch(envelope(e,a,id));
    const updated=await db.get(e.id);if(!updated)throw new Error('event missing');e=updated;
   };
   await send({type:'START'},'start');
   await send({type:'PUBLISH'},'publish');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('Josua');
   await send({type:'CLOSE'},'close');
   await send({type:'REVEAL'},'reveal');
   for(const t of e.teams)await send({type:'JUDGE',teamId:t.id,value:'richtig'},'judge-'+t.id);
   const commit=envelope(e,{type:'CONFIRM'},'confirm-once');
   const receipt=await db.dispatch(commit);
   expect(receipt.effect).toBe('committed');
   expect((await db.dispatch(commit)).effect).toBe('already-committed');
   e=(await db.get(e.id))!;
   expect(await db.getScores(e.id)).toEqual({'team-0':10,'team-1':10,'team-2':10});
   expect((await db.getOutcomes(e.id)).filter(x=>x.status==='active')).toHaveLength(3);
   await send({type:'CORRECT'},'correct');
   expect(await db.getScores(e.id)).toEqual({'team-0':0,'team-1':0,'team-2':0});
   await send({type:'JUDGE',teamId:'team-0',value:'falsch'},'rejudge');
   await send({type:'CONFIRM'},'reconfirm');
   expect(await db.getScores(e.id)).toEqual({'team-0':0,'team-1':10,'team-2':10});
   expect((await db.getOutcomes(e.id)).filter(x=>x.status==='void')).toHaveLength(3);
   expect((await db.getAudit(e.id)).some(x=>x.kind==='RQ_ACTION')).toBe(true);
   expect(e.rundenquiz && scores(e.rundenquiz)['team-1']).toBe(10);
  }finally{await db.close();}
 });
 it('fences previous RQ owner after explicit host takeover',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g4-takeover-'+crypto.randomUUID());
  try{
   let e=seed();await db.create(e);
   await db.dispatch(envelope(e,{type:'START'},'start'));
   e=(await db.get(e.id))!;
   await db.takeover({eventId:e.id,commandId:'takeover',newHostId:'replacement-host',
    expectedRevision:e.revision,expectedEpoch:e.hostEpoch,at:1000,reason:'Original window closed',acknowledged:true});
   const newer=(await db.get(e.id))!;
   expect(newer.rundenquiz?.ownerId).toBe('replacement-host');
   expect(newer.rundenquiz?.epoch).toBe(2);
   expect(newer.rundenquiz?.paused).toBe(true);
   await expect(db.dispatch({...envelope(newer,{type:'RESUME'},'obsolete'),hostId:e.hostId}))
    .rejects.toMatchObject({code:'STALE_HOST'});
   await db.dispatch(envelope(newer,{type:'RESUME'},'new-host-resume'));
   expect((await db.get(e.id))?.lifecycle).toBe('active');
  }finally{await db.close();}
 });
});
