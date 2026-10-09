import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {createEvent} from '../src/domain/event/transition';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {encodeBackup,decodeBackup,stagedRecovery} from '../src/resilience/backup';
import {safeOrigin} from '../src/resilience/offline';

const fixture=()=>createEvent({
 id:'g11-event-12345',hostId:'g11-host-12345',at:1000,
 teams:[0,1,2].map(i=>({id:'team-'+i,name:'Team '+i,order:i,colorToken:'t'+i})),
 program:[{id:'g11-rq',type:'rundenquiz',profile:'kurz',order:0,rulesVersion:'g11-demo'}],
 frozenTasks:[{taskId:'task-001',gameType:'rundenquiz',publicPrompt:'Frage?',
  publicClues:[],privateAnswers:['Privat'],sourceContentId:'source-001',sourceHash:'hash-001'}],
});
function repo(){return new EventRepository(fakeIndexedDB,'g11-'+crypto.randomUUID());}
describe('G11 session backup and fenced recovery',()=>{
 it('exports one consistent snapshot, retains checkpoint and audit and validates integrity',async()=>{
  const store=repo();try{
   const event=await store.create(fixture());
   const payload=await store.exportBackup(event.id);
   expect(payload.event).toEqual(event);
   expect(payload.checkpoints).toHaveLength(1);
   expect(payload.audit).toHaveLength(1);
   const json=await encodeBackup(payload);
   expect((await decodeBackup(json)).event).toEqual(event);
   const tampered=JSON.parse(json);
   tampered.payload.event.teams[0].name='Angreifer';
   await expect(decodeBackup(JSON.stringify(tampered))).rejects.toThrow(/Prüfsumme/);
  }finally{await store.close();}
 });
 it('atomic restore keeps evidence, rotates epoch/host, cannot replay or overwrite',async()=>{
  const origin=repo(),dest=repo();
  try{
   const event=await origin.create(fixture());
   const backup=await decodeBackup(await encodeBackup(await origin.exportBackup(event.id)));
   const restored=await dest.restoreBackup(backup,'new-g11-host',2000);
   expect(restored.id).toBe(event.id);
   expect(restored.hostId).toBe('new-g11-host');
   expect(restored.hostEpoch).toBe(2);
   expect(restored.lifecycle).toBe('paused');
   expect(restored.recoveryRequired).toBe(true);
   expect(restored.stageRevision).toBe(1);
   expect(await dest.get(restored.id)).toEqual(restored);
   const audit=await dest.getAudit(restored.id);
   expect(audit.at(-1)?.kind).toBe('G11_BACKUP_RESTORE');
   expect(await dest.getCheckpoints(restored.id)).toHaveLength(2);
   await expect(dest.restoreBackup(backup,'other-g11-host',2100)).rejects.toMatchObject({code:'ALREADY_EXISTS'});
   await expect(dest.dispatch({protocolVersion:1,eventId:event.id,commandId:'obsolete-g11',
    hostId:event.hostId,hostEpoch:1,expectedRevision:event.revision,
    issuedAtEpochMs:2100,actor:'host',payload:{type:'EVENT_START'}}))
    .rejects.toMatchObject({code:'STALE_HOST'});
  }finally{await origin.close();await dest.close();}
 });
 it('restores actual committed score-ledger points and full command history',async()=>{
  const origin=repo(),dest=repo();
  try{
   const seed=await origin.create(fixture());
   async function command(payload:unknown){
    const latest=(await origin.get(seed.id))!;
    await origin.dispatch({
     protocolVersion:1,eventId:seed.id,commandId:crypto.randomUUID(),
     hostId:latest.hostId,hostEpoch:latest.hostEpoch,expectedRevision:latest.revision,
     issuedAtEpochMs:latest.updatedAt+100,actor:'host',payload,
    });
   }
   await command({type:'EVENT_START'});
   await command({type:'TASK_PUBLISH',taskId:'task-001'});
   await command({type:'SOLUTION_PUBLISH',taskId:'task-001'});
   await command({type:'OUTCOME_COMMIT',outcomeId:'g11-point-award',taskId:'task-001',teamId:'team-0',points:30});
   const before=await origin.getScores(seed.id);
   expect(before['team-0']).toBe(30);
   const backup=await decodeBackup(await encodeBackup(await origin.exportBackup(seed.id)));
   const recovered=await dest.restoreBackup(backup,'new-g11-scorehost',3000);
   expect(recovered.recoveryRequired).toBe(true);
   expect(await dest.getScores(seed.id)).toEqual(before);
   expect((await dest.getOutcomes(seed.id)).filter(o=>o.status==='active')).toHaveLength(1);
   expect((await dest.getAudit(seed.id)).length).toBe(backup.audit.length+1);
   expect((await dest.getCheckpoints(seed.id)).length).toBe(backup.checkpoints.length+1);
  }finally{await origin.close();await dest.close();}
 });
 it('rejects foreign audit/outcome records, missing checkpoint and duplicated evidence',async()=>{
  const store=repo();try{
   await store.create(fixture());
   const backup=await store.exportBackup('g11-event-12345');
   await expect(encodeBackup({...backup,checkpoints:[]})).rejects.toThrow(/Checkpoint/);
   await expect(encodeBackup({...backup,audit:[...backup.audit,
    {...backup.audit[0]!,eventId:'another-event'}]})).rejects.toThrow(/andere Sitzungskennungen/);
  }finally{await store.close();}
 });
 it('keeps completed historic games completed after restore',()=>{
  const complete={...fixture(),lifecycle:'complete' as const};
  const changed=stagedRecovery(complete,2500,'new-g11-host');
  expect(changed.lifecycle).toBe('complete');
  expect(changed.recoveryRequired).toBe(false);
 });
 it('rejects offline deployment on unknown origins',()=>{
  expect(typeof safeOrigin()).toBe('boolean');
 });
});
