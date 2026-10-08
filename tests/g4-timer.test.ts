import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createEvent} from '../src/domain/event/transition';
import {createSession} from '../src/games/rundenquiz/engine';
import {RQ_TRIAL_BANK} from '../src/games/rundenquiz/trial-bank';
import {timerScopeMatches,newTimerSnapshot} from '../src/games/rundenquiz/timer';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import type {EventRecord} from '../src/domain/event/schemas';
function initial():EventRecord {
 const rq=createSession({
  id:'rq-timer-session',ownerId:'host-timer',profile:'kurz',bank:RQ_TRIAL_BANK,
  teams:[0,1,2].map(n=>({id:'t-'+n,name:'Team '+n,order:n})),
 });
 return createEvent({id:rq.id,hostId:rq.ownerId,at:123,
  teams:rq.teams.map(t=>({...t,colorToken:'blue'})),
  program:[{id:'rq-game-1',type:'rundenquiz',profile:'kurz',order:0,rulesVersion:'trial-v1'}],
  frozenTasks:rq.questions.map(q=>({taskId:q.id,gameType:'rundenquiz' as const,
   publicPrompt:q.prompt,publicClues:[...(q.clues??[])],privateAnswers:[q.answer],
   sourceContentId:q.id,sourceHash:'trial-v1'})),
  rundenquiz:rq,
 });
}
async function submit(repo:EventRepository,event:EventRecord,action:'START'|'PUBLISH'|'CLOSE') {
 await repo.dispatch({
  protocolVersion:1,eventId:event.id,commandId:'timer-'+action,hostId:event.hostId,
  hostEpoch:event.hostEpoch,expectedRevision:event.revision,issuedAtEpochMs:Date.now(),
  actor:'host',payload:{type:'RQ_ACTION',action:{type:action}},
 });
 const current=await repo.get(event.id);if(!current)throw new Error('missing');return current;
}
describe('G4 persisted optional timer',()=>{
 it('round-trips snapshot, preserves saved remaining time, rejects another host and closed question',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'timer-'+crypto.randomUUID());
  try{
   let event=initial();await repo.create(event);
   event=await submit(repo,event,'START');
   event=await submit(repo,event,'PUBLISH');
   const rq=event.rundenquiz!;
   const snap=newTimerSnapshot(rq,17);
   expect(timerScopeMatches(rq,snap)).toBe(true);
   await repo.saveTimer(snap);
   expect(await repo.getTimer(event.id)).toMatchObject({remainingSeconds:17,questionId:rq.questions[0]?.id});
   await expect(repo.saveTimer({...snap,ownerId:'other'})).rejects.toMatchObject({code:'STALE_HOST'});
   await expect(repo.saveTimer({...snap,ownerEpoch:9})).rejects.toMatchObject({code:'STALE_HOST'});
   event=await submit(repo,event,'CLOSE');
   await expect(repo.saveTimer(snap)).rejects.toMatchObject({code:'STALE_HOST'});
   expect(timerScopeMatches(event.rundenquiz!,snap)).toBe(false);
  }finally{await repo.close();}
 });
 it('rejects invalid, future question and oversized snapshots',()=>{
  const rq=initial().rundenquiz!;
  expect(timerScopeMatches(rq,{eventId:rq.id,ownerId:rq.ownerId,ownerEpoch:1,questionId:'other',remainingSeconds:10,updatedAt:1})).toBe(false);
  expect(()=>newTimerSnapshot(rq,10)).toThrow();
 });
 it('migrates an existing G2 database to v2 without losing sessions',async()=>{
  const name='legacy-g2-migration-'+crypto.randomUUID();
  const opened=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=fakeIndexedDB.open(name,1);
   request.onupgradeneeded=()=>{
    const db=request.result;
    db.createObjectStore('events',{keyPath:'id'});
    db.createObjectStore('commands',{keyPath:['eventId','commandId']});
    db.createObjectStore('outcomes',{keyPath:['eventId','outcomeId']}).createIndex('byEvent','eventId');
    db.createObjectStore('checkpoints',{keyPath:['eventId','revision']}).createIndex('byEvent','eventId');
    db.createObjectStore('audit',{keyPath:['eventId','revision']}).createIndex('byEvent','eventId');
   };
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  opened.close();
  const repo=new EventRepository(fakeIndexedDB,name);
  try{
   const seed=initial();
   await repo.create(seed);
   const stored=await repo.get(seed.id);
   expect(stored?.id).toBe(seed.id);
   expect(await repo.getTimer(seed.id)).toBeNull();
   expect((await repo.getCheckpoints(seed.id)).map(c=>c.revision)).toEqual([0]);
  }finally{await repo.close();}
 });
});
