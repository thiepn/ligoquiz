import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createSession,transition,currentRung,publicScene,awardsFor,rungValue,
  eveningHalfPoints,scores,LENGTH,type Session,type Profile,type Action} from '../src/games/logikleiter/engine';
import {trialLogikleiter} from '../src/games/logikleiter/trial-bank';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createEvent} from '../src/domain/event/transition';
import {derivePublicStage} from '../src/domain/event/public-projection';
import type {EventRecord} from '../src/domain/event/schemas';

const fixture=(n=4,profile:Profile='standard')=>{
 const teams=Array.from({length:n},(_,i)=>({id:'ll-team-'+i,name:'Team '+i,order:i}));
 return createSession({id:'ll-event-1234',ownerId:'ll-host-1234',profile,teams,rungs:trialLogikleiter(profile)});
};
const step=(s:Session,action:Action)=>transition(s,{
 id:'ll-command-'+s.revision,ownerId:s.ownerId,epoch:s.epoch,
 expectedRevision:s.revision,at:100+s.revision,action,
});
const eventFor=(ll:Session):EventRecord=>createEvent({
 id:ll.id,hostId:ll.ownerId,at:100,logikleiter:ll,
 teams:ll.teams.map(t=>({...t,colorToken:'neutral'})),
 program:[{id:'ll-game',type:'logikleiter',profile:ll.profile,order:0,rulesVersion:'ll-trial-1'}],
 frozenTasks:ll.rungs.map(r=>({
  taskId:r.id,gameType:'logikleiter' as const,publicPrompt:r.prompt,
  publicClues:[r.hint],privateAnswers:[r.answer],
  moderatorNotes:'PRIVATE '+r.explanation,sourceContentId:r.id,sourceHash:'ll-trial',
 })),
});
const envelope=(e:EventRecord,a:Action,id:string)=>({
 protocolVersion:1,eventId:e.id,commandId:id,hostId:e.hostId,hostEpoch:e.hostEpoch,
 expectedRevision:e.revision,issuedAtEpochMs:Date.now(),actor:'host',
 payload:{type:'LL_ACTION',action:a},
});

describe('G8 shared ladder fairness',()=>{
 for(const n of [3,4,5])for(const profile of ['kurz','standard','lang'] as const)
  it('completes '+n+' teams / '+profile+' without elimination',()=>{
   let s=fixture(n,profile);
   expect(s.rungs).toHaveLength(LENGTH[profile]);
   s=step(s,{type:'START'});
   for(let rung=0;rung<LENGTH[profile];rung++){
    expect(currentRung(s).difficulty).toBe(rung+1);
    s=step(s,{type:'PUBLISH'});
    const open=publicScene(s);
    expect(open.kind).toBe('ladder');
    // A candidate answer can occur in the publicly stated premises; the stage must
    // not carry a private answer or explanation field before reveal.
    expect(open.kind==='ladder'&&'answer' in open).toBe(false);
    expect(open.kind==='ladder'&&'explanation' in open).toBe(false);
    for(const t of s.teams)s=step(s,{type:'LOCK',teamId:t.id});
    s=step(s,{type:'CLOSE'});s=step(s,{type:'REVEAL'});
    for(const t of s.teams)s=step(s,{type:'GRADE',teamId:t.id,value:'correct'});
    expect(awardsFor(s).every(a=>a.points===rungValue(rung))).toBe(true);
    s=step(s,{type:'CONFIRM'});s=step(s,{type:'NEXT'});
   }
   expect(s.phase).toBe('complete');
   const sum=Array.from({length:LENGTH[profile]},(_,i)=>rungValue(i)).reduce((a,b)=>a+b,0);
   expect(Object.values(scores(s))).toEqual(Array(n).fill(sum));
   const points=eveningHalfPoints(s);
   expect(Object.values(points)).toEqual(Array(n).fill(n+1));
  });
 it('locks pre-hint and post-hint answers against retroactive repricing',()=>{
  let s=fixture(3,'kurz');
  s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'LOCK',teamId:'ll-team-0'});
  expect(()=>step(s,{type:'LOCK',teamId:'ll-team-0'})).toThrow();
  s=step(s,{type:'HINT'});
  expect(()=>step(s,{type:'HINT'})).toThrow();
  s=step(s,{type:'LOCK',teamId:'ll-team-1'});
  expect(s.locks['ll-team-0']?.hintRevision).toBe(0);
  expect(s.locks['ll-team-1']?.hintRevision).toBe(1);
  expect(JSON.stringify(publicScene(s))).toContain(currentRung(s).hint);
  expect(JSON.stringify(publicScene(s))).not.toContain(currentRung(s).answer);
  s=step(s,{type:'CLOSE'});
  expect(()=>step(s,{type:'LOCK',teamId:'ll-team-2'})).toThrow();
  s=step(s,{type:'REVEAL'});
  s=step(s,{type:'GRADE',teamId:'ll-team-0',value:'correct'});
  s=step(s,{type:'GRADE',teamId:'ll-team-1',value:'correct'});
  s=step(s,{type:'GRADE',teamId:'ll-team-2',value:'absent'});
  s=step(s,{type:'CONFIRM'});
  expect(scores(s)).toEqual({'ll-team-0':10,'ll-team-1':5,'ll-team-2':0});
 });
 it('conservative hint fairness must be reasoned and is only available after hint',()=>{
  let s=fixture(3,'kurz');
  s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  expect(()=>step(s,{type:'FAIR_HINT',reason:'Premature exposure'})).toThrow();
  s=step(s,{type:'HINT'});s=step(s,{type:'LOCK',teamId:'ll-team-1'});
  s=step(s,{type:'FAIR_HINT',reason:'Hinweis versehentlich zu früh gezeigt'});
  s=step(s,{type:'CLOSE'});s=step(s,{type:'REVEAL'});
  for(const t of s.teams)s=step(s,{type:'GRADE',teamId:t.id,value:t.id==='ll-team-1'?'correct':'absent'});
  s=step(s,{type:'CONFIRM'});
  expect(scores(s)['ll-team-1']).toBe(10);
 });
 it('annuls without ever publishing an unopened answer',()=>{
  let s=fixture(3,'kurz');
  s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'ANNUL',reason:'Unklare Aufgabenstellung'});
  expect(s.awards.every(a=>a.points===0&&a.annulled)).toBe(true);
  expect(JSON.stringify(publicScene(s))).not.toContain(currentRung(s).answer);
  expect(()=>step(s,{type:'CORRECT',reason:'Wertung irrtümlich eingetragen'})).toThrow();
 });
 it('corrects a confirmed outcome with an auditable replacement',()=>{
  let s=fixture(3,'kurz');
  s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'LOCK',teamId:'ll-team-0'});
  s=step(s,{type:'CLOSE'});s=step(s,{type:'REVEAL'});
  for(const t of s.teams)s=step(s,{type:'GRADE',teamId:t.id,value:'absent'});
  s=step(s,{type:'CONFIRM'});expect(scores(s)['ll-team-0']).toBe(0);
  s=step(s,{type:'CORRECT',reason:'Wertung irrtümlich eingetragen'});
  s=step(s,{type:'GRADE',teamId:'ll-team-0',value:'correct'});
  s=step(s,{type:'CONFIRM'});expect(scores(s)['ll-team-0']).toBe(10);
  expect(s.audit.map(a=>a.action)).toContain('CORRECT');
 });
 it('rejects malformed content, duplicate teams and invalid grading',()=>{
  const s=fixture(3,'kurz');
  expect(()=>createSession({...s,rungs:s.rungs.slice(1)})).toThrow();
  expect(()=>createSession({...s,teams:[s.teams[0]!,s.teams[0]!,s.teams[1]!]})).toThrow();
  let t=step(s,{type:'START'});t=step(t,{type:'PUBLISH'});
  t=step(t,{type:'CLOSE'});t=step(t,{type:'REVEAL'});
  expect(()=>step(t,{type:'GRADE',teamId:'ll-team-0',value:'correct'})).toThrow();
 });
 it('pauses and resumes without publicly disclosing the answer',()=>{
  let s=fixture(3,'kurz');s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'PAUSE'});
  expect(publicScene(s).kind).toBe('paused');
  expect(()=>step(s,{type:'HINT'})).toThrow();
  s=step(s,{type:'RESUME'});expect(publicScene(s).kind).toBe('ladder');
 });
});
describe('G8 G2 atomic ledger and host epoch',()=>{
 it('stores exact point awards, idempotent retries and voids corrected outcomes',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'ll-db-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture(3,'kurz'));await repo.create(e);
   const send=async(a:Action,id:string)=>{
    const result=await repo.dispatch(envelope(e,a,id));
    e=(await repo.get(e.id))!;
    return result;
   };
   await send({type:'START'},'start');await send({type:'PUBLISH'},'publish');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('Nein');
   await send({type:'LOCK',teamId:'ll-team-0'},'lock0');
   await send({type:'HINT'},'hint');
   await send({type:'LOCK',teamId:'ll-team-1'},'lock1');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('explanation');
   await send({type:'CLOSE'},'close');await send({type:'REVEAL'},'reveal');
   for(const team of e.teams)await send({type:'GRADE',teamId:team.id,value:team.id!=='ll-team-2'?'correct':'absent'},'grade-'+team.id);
   const cmd=envelope(e,{type:'CONFIRM'},'commit');
   expect((await repo.dispatch(cmd)).effect).toBe('committed');
   expect((await repo.dispatch(cmd)).effect).toBe('already-committed');
   e=(await repo.get(e.id))!;
   expect(await repo.getScores(e.id)).toEqual({'ll-team-0':10,'ll-team-1':5,'ll-team-2':0});
   await send({type:'CORRECT',reason:'Teamwertung falsch erfasst'},'correct');
   expect(await repo.getScores(e.id)).toEqual({'ll-team-0':0,'ll-team-1':0,'ll-team-2':0});
   await send({type:'GRADE',teamId:'ll-team-0',value:'absent'},'remark');
   await send({type:'CONFIRM'},'reconfirm');
   expect(await repo.getScores(e.id)).toEqual({'ll-team-0':0,'ll-team-1':5,'ll-team-2':0});
   expect((await repo.getOutcomes(e.id)).filter(o=>o.status==='void')).toHaveLength(3);
  }finally{await repo.close();}
 });
 it('revokes old host and preserves locked hint revisions during takeover',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'ll-takeover-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture(3,'kurz'));await repo.create(e);
   await repo.dispatch(envelope(e,{type:'START'},'start'));e=(await repo.get(e.id))!;
   await repo.dispatch(envelope(e,{type:'PUBLISH'},'publish'));e=(await repo.get(e.id))!;
   await repo.dispatch(envelope(e,{type:'LOCK',teamId:'ll-team-0'},'lock'));e=(await repo.get(e.id))!;
   await repo.takeover({eventId:e.id,commandId:'takeover',newHostId:'second-host',
    expectedRevision:e.revision,expectedEpoch:e.hostEpoch,at:300,
    reason:'Spielleitung ersetzt',acknowledged:true});
   const changed=(await repo.get(e.id))!;
   expect(changed.logikleiter).toMatchObject({ownerId:'second-host',epoch:2,paused:true,
    locks:{'ll-team-0':{hintRevision:0}}});
   await expect(repo.dispatch({...envelope(changed,{type:'RESUME'},'stale'),hostId:e.hostId}))
    .rejects.toMatchObject({code:'STALE_HOST'});
   await repo.dispatch(envelope(changed,{type:'RESUME'},'resume'));
   expect((await repo.get(e.id))?.lifecycle).toBe('active');
  }finally{await repo.close();}
 });
});
