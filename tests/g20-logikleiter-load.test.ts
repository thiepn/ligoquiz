import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {HostSessionController} from '../src/application/host-controller/host-session';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedLogikleiter,newSetupDraft} from '../src/features/experience/model';
import {loadSafelyPausedLogikleiter} from '../src/features/host/logikleiter-load';
describe('G20 inherited Logikleiter restart race repair',()=>{
 it('two concurrent same-host crash/reload pauses converge to a single safe stopped state',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g20-ll-recovery-'+crypto.randomUUID());
  try{
   const id=await createPreparedLogikleiter(repo,newSetupDraft());
   const controller=new HostSessionController(repo,id.eventId,id.hostId);
   const seed=await controller.load();
   await controller.submit({type:'LL_ACTION',action:{type:'START'}},seed,crypto.randomUUID());
   const [a,b]=await Promise.all([loadSafelyPausedLogikleiter(controller),loadSafelyPausedLogikleiter(controller)]);
   const current=await controller.load();
   for(const value of [a,b,current]){
    expect(value.lifecycle).toBe('paused');
    expect(value.logikleiter?.paused).toBe(true);
    expect(value.hostId).toBe(id.hostId);
    expect(value.hostEpoch).toBe(seed.hostEpoch);
   }
  }finally{await repo.close();}
 });
 it('revoked owner cannot reconcile, resume or take over a recovered ladder',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g20-ll-revoked-'+crypto.randomUUID());
  try{
   const id=await createPreparedLogikleiter(repo,newSetupDraft());
   const controller=new HostSessionController(repo,id.eventId,id.hostId);
   const seed=await controller.load();
   await repo.takeover({eventId:seed.id,commandId:crypto.randomUUID(),newHostId:crypto.randomUUID(),
    expectedRevision:seed.revision,expectedEpoch:seed.hostEpoch,at:Date.now(),
    reason:'Explicit manual host transfer',acknowledged:true});
   await expect(loadSafelyPausedLogikleiter(controller)).rejects.toMatchObject({code:'STALE_HOST'});
  }finally{await repo.close();}
 });
});
