import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {HostSessionController} from '../src/application/host-controller/host-session';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedVerbindungen,newSetupDraft} from '../src/features/experience/model';
import {loadSafelyPausedVerbindungen} from '../src/features/host/verbindungen-load';

describe('G15 Verbindungen reload recovery',()=>{
 it('simultaneous reload attempts converge to a paused, same-owner state',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g15-vb-race-'+crypto.randomUUID());
  try{
   const id=await createPreparedVerbindungen(repo,newSetupDraft());
   const controller=new HostSessionController(repo,id.eventId,id.hostId);
   const seed=await controller.load();
   await controller.submit({type:'VB_ACTION',action:{type:'START'}},seed,crypto.randomUUID());
   const [first,second]=await Promise.all([
    loadSafelyPausedVerbindungen(controller),loadSafelyPausedVerbindungen(controller),
   ]);
   const saved=await controller.load();
   for(const event of [first,second,saved]){
    expect(event.verbindungen?.paused).toBe(true);
    expect(event.lifecycle).toBe('paused');
    expect(event.hostId).toBe(id.hostId);
    expect(event.hostEpoch).toBe(seed.hostEpoch);
   }
  }finally{await repo.close();}
 });
 it('revoked host cannot load or control a recovered Verbindungen session',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g15-vb-revoked-'+crypto.randomUUID());
  try{
   const id=await createPreparedVerbindungen(repo,newSetupDraft());
   const old=new HostSessionController(repo,id.eventId,id.hostId);
   const initial=await old.load();
   await repo.takeover({eventId:initial.id,commandId:crypto.randomUUID(),
    newHostId:crypto.randomUUID(),expectedRevision:initial.revision,
    expectedEpoch:initial.hostEpoch,at:Date.now(),reason:'Independent host takeover',acknowledged:true});
   await expect(loadSafelyPausedVerbindungen(old)).rejects.toMatchObject({code:'STALE_HOST'});
  }finally{await repo.close();}
 });
});
