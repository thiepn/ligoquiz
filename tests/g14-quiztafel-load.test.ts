import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {HostSessionController} from '../src/application/host-controller/host-session';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedQuiztafel,newSetupDraft} from '../src/features/experience/model';
import {loadSafelyPausedQuiztafel} from '../src/features/host/quiztafel-load';

describe('G14 Quiztafel recovery startup',()=>{
 it('two concurrent restart pauses converge on one safe paused state',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g14-qt-race-'+crypto.randomUUID());
  try{
   const identity=await createPreparedQuiztafel(repo,newSetupDraft());
   const ctl=new HostSessionController(repo,identity.eventId,identity.hostId);
   const seed=await ctl.load();
   await ctl.submit({type:'QT_ACTION',action:{type:'START'}},seed,crypto.randomUUID());
   const [one,two]=await Promise.all([loadSafelyPausedQuiztafel(ctl),loadSafelyPausedQuiztafel(ctl)]);
   const saved=await ctl.load();
   for(const event of [one,two,saved]){
    expect(event.lifecycle).toBe('paused');
    expect(event.quiztafel?.paused).toBe(true);
    expect(event.hostId).toBe(identity.hostId);
    expect(event.hostEpoch).toBe(seed.hostEpoch);
   }
  }finally{await repo.close();}
 });
 it('never accepts an old host after explicit takeover',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g14-qt-fence-'+crypto.randomUUID());
  try{
   const identity=await createPreparedQuiztafel(repo,newSetupDraft());
   const old=new HostSessionController(repo,identity.eventId,identity.hostId);
   const seed=await old.load();
   await repo.takeover({eventId:seed.id,commandId:crypto.randomUUID(),newHostId:crypto.randomUUID(),
    expectedRevision:seed.revision,expectedEpoch:seed.hostEpoch,at:Date.now(),
    reason:'Explicit control transfer',acknowledged:true});
   await expect(loadSafelyPausedQuiztafel(old)).rejects.toMatchObject({code:'STALE_HOST'});
  }finally{await repo.close();}
 });
});
