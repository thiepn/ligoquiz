import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {HostSessionController} from '../src/application/host-controller/host-session';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedUmfrageduell,newSetupDraft} from '../src/features/experience/model';
import {loadSafelyPausedUmfrageduell} from '../src/features/host/umfrageduell-load';

describe('G15 Umfrageduell concurrent reload',()=>{
 it('same-host parallel reloads result in one safe paused session',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g15-ud-race-'+crypto.randomUUID());
  try{
   const identity=await createPreparedUmfrageduell(repo,newSetupDraft());
   const ctl=new HostSessionController(repo,identity.eventId,identity.hostId);
   const start=await ctl.load();
   await ctl.submit({type:'UD_ACTION',action:{type:'START'}},start,crypto.randomUUID());
   const [a,b]=await Promise.all([loadSafelyPausedUmfrageduell(ctl),loadSafelyPausedUmfrageduell(ctl)]);
   const saved=await ctl.load();
   for(const v of [a,b,saved]){
    expect(v.umfrageduell?.paused).toBe(true);
    expect(v.lifecycle).toBe('paused');
    expect(v.hostId).toBe(identity.hostId);
    expect(v.hostEpoch).toBe(start.hostEpoch);
   }
  }finally{await repo.close();}
 });
 it('revoked host is rejected instead of being silently reassigned',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'g15-ud-fence-'+crypto.randomUUID());
  try{
   const identity=await createPreparedUmfrageduell(repo,newSetupDraft());
   const old=new HostSessionController(repo,identity.eventId,identity.hostId);
   const seed=await old.load();
   await repo.takeover({eventId:seed.id,commandId:crypto.randomUUID(),
    newHostId:crypto.randomUUID(),expectedRevision:seed.revision,
    expectedEpoch:seed.hostEpoch,at:Date.now(),reason:'Owner controlled transfer',acknowledged:true});
   await expect(loadSafelyPausedUmfrageduell(old)).rejects.toMatchObject({code:'STALE_HOST'});
  }finally{await repo.close();}
 });
});
