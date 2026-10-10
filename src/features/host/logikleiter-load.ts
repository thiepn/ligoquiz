import type {EventRecord} from '../../domain/event/schemas';
import {HostSessionController} from '../../application/host-controller/host-session';
import {StoreError} from '../../infrastructure/db/event-repository';

/** A second same-owner startup may already have paused this event.
 * Reconcile only concurrent revision races, never a revoked host or a restore approval. */
export async function loadSafelyPausedLogikleiter(controller:HostSessionController):Promise<EventRecord>{
 for(let attempt=0;attempt<3;attempt++){
  const current=await controller.load();
  if(!current.logikleiter||current.hostId!==controller.hostId)
   throw new StoreError('STALE_HOST','Logikleiter gehört zu einer anderen Spielleitung');
  if(current.lifecycle!=='active'||current.logikleiter.paused)return current;
  try{
   const result=await controller.submit({type:'LL_ACTION',action:{type:'PAUSE'}},current,crypto.randomUUID());
   if(!result.logikleiter||result.hostId!==controller.hostId)
    throw new StoreError('STALE_HOST','Logikleiter Host-Berechtigung entzogen');
   if(result.lifecycle==='active'&&!result.logikleiter.paused)continue;
   return result;
  }catch(e){
   if(e instanceof StoreError&&e.code==='STALE_REVISION')continue;
   throw e;
  }
 }
 throw new StoreError('STALE_REVISION','Logikleiter gleichzeitig geändert; manuell neu laden');
}
