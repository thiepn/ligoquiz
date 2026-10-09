import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createSession,transition,selector,eligibleStealer,publicScene,scores,
 eveningHalfPoints,verifyBoard,DEPTH,type Session,type Profile,type Action} from '../src/games/quiztafel/engine';
import {sampleQuiztafel} from '../src/games/quiztafel/trial-bank';
import {createEvent} from '../src/domain/event/transition';
import {derivePublicStage} from '../src/domain/event/public-projection';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import type {EventRecord} from '../src/domain/event/schemas';
const fixture=(n=4,profile:Profile='kurz')=>{
 const teams=Array.from({length:n},(_,i)=>({id:'team-'+i,name:'Team '+i,order:i}));
 return createSession({id:'qt-event',ownerId:'host-qt',teams,profile,...sampleQuiztafel(profile,teams)});
};
const step=(s:Session,action:Action)=>transition(s,{
 id:'command-'+s.revision,ownerId:s.ownerId,epoch:s.epoch,expectedRevision:s.revision,
 at:100+s.revision,action,
});
const opened=(n=4)=>{
 let s=fixture(n);s=step(s,{type:'START'});
 s=step(s,{type:'PICK',tileId:s.tiles[0]!.id});return step(s,{type:'PUBLISH'});
};
const eventFor=(qt:Session):EventRecord=>createEvent({
 id:qt.id,hostId:qt.ownerId,at:100,quiztafel:qt,
 teams:qt.teams.map(t=>({...t,colorToken:'color'})),
 program:[{id:'qt-game',type:'quiztafel',profile:qt.profile,order:0,rulesVersion:'qt-1'}],
 frozenTasks:qt.tiles.map(t=>({taskId:t.id,gameType:'quiztafel' as const,
  publicPrompt:t.prompt,publicClues:[],privateAnswers:[t.answer],
  sourceContentId:t.id,sourceHash:'trial',moderatorNotes:'SECRET NOTES'})),
});
const envelope=(e:EventRecord,a:Action,id:string)=>({
 protocolVersion:1,eventId:e.id,commandId:id,hostId:e.hostId,hostEpoch:e.hostEpoch,
 expectedRevision:e.revision,issuedAtEpochMs:Date.now(),actor:'host',
 payload:{type:'QT_ACTION',action:a},
});
describe('G6 board fairness and scoring rules',()=>{
 for(const profile of ['kurz','standard','lang'] as const)
  for(const n of [3,4,5])
   it('fully plays '+profile+' with '+n+' teams',()=>{
    let s=fixture(n,profile);
    expect(s.tiles).toHaveLength(n*DEPTH[profile]);
    expect(s.categories).toHaveLength(n);
    const turns:Record<string,number>=Object.fromEntries(s.teams.map(t=>[t.id,0]));
    s=step(s,{type:'START'});
    for(let i=0;i<s.tiles.length;i++){
     const captain=selector(s);turns[captain.id]=(turns[captain.id]??0)+1;
     const tile=s.tiles.find(t=>!s.usedTileIds.includes(t.id))!;
     s=step(s,{type:'PICK',tileId:tile.id});
     s=step(s,{type:'PUBLISH'});
     if(i%3===0)s=step(s,{type:'PRIMARY',result:'correct'});
     else {
      s=step(s,{type:'PRIMARY',result:i%3===1?'wrong':'none'});
      s=step(s,{type:'OFFER_STEAL'});
      s=step(s,{type:'STEAL',result:i%3===1?'correct':'declined'});
     }
     s=step(s,{type:'REVEAL'});
     s=step(s,{type:'CONFIRM'});
     expect(s.outcomes.at(-1)?.points).toBe(i%3===2?0:tile.value);
     s=step(s,{type:'NEXT'});
    }
    expect(s.phase).toBe('complete');
    expect(s.outcomes).toHaveLength(n*DEPTH[profile]);
    expect(Object.values(turns)).toEqual(Array(n).fill(DEPTH[profile]));
    expect(new Set(s.usedTileIds).size).toBe(s.tiles.length);
   });
 it('preflight rejects missing categories and mismatched tile values',()=>{
  const s=fixture();
  expect(()=>verifyBoard({...s,tiles:s.tiles.slice(1)})).toThrow();
  expect(()=>verifyBoard({...s,tiles:s.tiles.map((t,i)=>i===0?{...t,value:900}:t)})).toThrow();
 });
 it('does not disclose a privately selected or unrevealed tile answer',()=>{
  let s=fixture();
  const tile=s.tiles[0]!;
  s=step(s,{type:'START'});s=step(s,{type:'PICK',tileId:tile.id});
  expect(JSON.stringify(publicScene(s))).not.toContain(tile.prompt);
  s=step(s,{type:'UNPICK'});expect(s.selectedTileId).toBeNull();
  s=step(s,{type:'PICK',tileId:tile.id});s=step(s,{type:'PUBLISH'});
  expect(JSON.stringify(publicScene(s))).toContain(tile.prompt);
  expect(JSON.stringify(publicScene(s))).not.toContain(tile.answer);
  s=step(s,{type:'PRIMARY',result:'wrong'});
  expect(JSON.stringify(publicScene(s))).not.toContain(tile.answer);
  s=step(s,{type:'OFFER_STEAL'});
  expect(eligibleStealer(s).id).toBe('team-1');
  s=step(s,{type:'STEAL',result:'declined'});
  expect(()=>step(s,{type:'OFFER_STEAL'})).toThrow();
  s=step(s,{type:'REVEAL'});
  expect(JSON.stringify(publicScene(s))).toContain(tile.answer);
 });
 it('steal never changes who owns next tile selection',()=>{
  let s=opened(5);s=step(s,{type:'PRIMARY',result:'wrong'});
  s=step(s,{type:'OFFER_STEAL'});s=step(s,{type:'STEAL',result:'correct'});
  s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});
  expect(s.outcomes[0]).toMatchObject({winnerId:'team-1',selectorId:'team-0',points:100});
  s=step(s,{type:'NEXT'});
  expect(selector(s).id).toBe('team-1');
 });
 it('cannot award a declined steal by overriding adjudication',()=>{
  let s=opened();s=step(s,{type:'PRIMARY',result:'wrong'});
  s=step(s,{type:'OFFER_STEAL'});
  s=step(s,{type:'STEAL',result:'declined'});
  s=step(s,{type:'REVEAL'});
  expect(()=>step(s,{type:'ADJUST',winner:'stealer'})).toThrow();
  s=step(s,{type:'CONFIRM'});
  expect(s.outcomes[0]?.points).toBe(0);
 });
 it('allows auditable correction without reopening a scored tile',()=>{
  let s=opened();s=step(s,{type:'PRIMARY',result:'correct'});
  s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});
  expect(s.usedTileIds).toHaveLength(1);
  s=step(s,{type:'CORRECT'});expect(s.outcomes).toHaveLength(0);
  s=step(s,{type:'ADJUST',winner:'none'});s=step(s,{type:'CONFIRM'});
  s=step(s,{type:'NEXT'});expect(s.turn).toBe(1);
  expect(()=>step(s,{type:'PICK',tileId:s.usedTileIds[0]!})).toThrow();
 });
 it('annuls a privately selected tile without revealing its private answer',()=>{
  let s=fixture();s=step(s,{type:'START'});
  s=step(s,{type:'PICK',tileId:s.tiles[0]!.id});
  s=step(s,{type:'ANNUL',reason:'Question is invalid'});
  expect(s.outcomes[0]).toMatchObject({annulled:true,points:0});
  expect(JSON.stringify(publicScene(s))).not.toContain(s.tiles[0]!.answer);
  expect(()=>step(s,{type:'CORRECT'})).toThrow();
 });
 it('pauses without changing public question and rejects wrong owner',()=>{
  let s=opened();s=step(s,{type:'PAUSE'});
  expect(publicScene(s).kind).toBe('paused');
  expect(()=>step(s,{type:'REVEAL'})).toThrow();
  expect(()=>transition(s,{id:'bad',ownerId:'other',epoch:1,
   expectedRevision:s.revision,at:101,action:{type:'RESUME'}})).toThrow();
  s=step(s,{type:'RESUME'});expect(s.phase).toBe('question');
 });
 it('awards tied evening ranks in integer half-points',()=>{
  let s=opened();s=step(s,{type:'PRIMARY',result:'correct'});
  s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});
  expect(scores(s)['team-0']).toBe(100);
  expect(eveningHalfPoints(s)).toEqual({'team-0':8,'team-1':4,'team-2':4,'team-3':4});
 });
});
describe('G6 integrated G2 ledger and G3 privacy',()=>{
 it('commits once, then voids and reissues a corrected tile award',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'qt-db-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture());
   await repo.create(e);
   const send=async(a:Action,id:string)=>{
    await repo.dispatch(envelope(e,a,id));
    e=(await repo.get(e.id))!;
   };
   await send({type:'START'},'start');
   const tile=e.quiztafel!.tiles[0]!;
   await send({type:'PICK',tileId:tile.id},'pick');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain(tile.prompt);
   await send({type:'PUBLISH'},'publish');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain(tile.answer);
   await send({type:'PRIMARY',result:'correct'},'judge');
   await send({type:'REVEAL'},'reveal');
   const cmd=envelope(e,{type:'CONFIRM'},'award');
   expect((await repo.dispatch(cmd)).effect).toBe('committed');
   expect((await repo.dispatch(cmd)).effect).toBe('already-committed');
   e=(await repo.get(e.id))!;
   expect((await repo.getScores(e.id))['team-0']).toBe(100);
   await send({type:'CORRECT'},'correct');
   expect((await repo.getScores(e.id))['team-0']).toBe(0);
   await send({type:'ADJUST',winner:'none'},'adjust');
   await send({type:'CONFIRM'},'reconfirm');
   expect((await repo.getOutcomes(e.id)).filter(o=>o.status==='void')).toHaveLength(1);
   expect((await repo.getOutcomes(e.id)).filter(o=>o.status==='active')).toHaveLength(1);
   expect((await repo.getScores(e.id))['team-0']).toBe(0);
  }finally{await repo.close();}
 });
 it('fences original selector after host takeover and pauses without publication',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'qt-takeover-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture(3));await repo.create(e);
   await repo.dispatch(envelope(e,{type:'START'},'start'));
   e=(await repo.get(e.id))!;
   await repo.takeover({eventId:e.id,commandId:'handoff',newHostId:'new-owner',
    expectedRevision:e.revision,expectedEpoch:e.hostEpoch,
    at:300,reason:'Host window lost',acknowledged:true});
   const next=(await repo.get(e.id))!;
   expect(next.quiztafel).toMatchObject({epoch:2,ownerId:'new-owner',paused:true});
   await expect(repo.dispatch({...envelope(next,{type:'RESUME'},'old'),hostId:e.hostId}))
    .rejects.toMatchObject({code:'STALE_HOST'});
   await repo.dispatch(envelope(next,{type:'RESUME'},'resumed'));
   expect((await repo.get(e.id))?.lifecycle).toBe('active');
  }finally{await repo.close();}
 });
});
