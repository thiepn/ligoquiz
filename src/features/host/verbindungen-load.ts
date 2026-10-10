import type {EventRecord} from '../../domain/event/schemas';
import {HostSessionController} from '../../application/host-controller/host-session';
import {StoreError} from '../../infrastructure/db/event-repository';

/**
 * Verbindungen can have concurrent StrictMode/same-host reload pauses.
 * Reconcile only a stale revision; never retry revoked host ownership,
 * never acknowledge recovery or automatically resume a live question.
 */
export async function loadSafelyPausedVerbindungen(controller:HostSessionController):Promise<EventRecord>{
 for(let attempt=0;attempt<3;attempt++){
  const current=await controller.load();
  if(!current.verbindungen||current.hostId!==controller.hostId)
   throw new StoreError('STALE_HOST','Verbindungen gehört zu einer anderen Spielleitung');
  if(current.lifecycle!=='active'||current.verbindungen.paused)return current;
  try{
   const result=await controller.submit({type:'VB_ACTION',action:{type:'PAUSE'}},current,crypto.randomUUID());
   if(!result.verbindungen||result.hostId!==controller.hostId)
    throw new StoreError('STALE_HOST','Verbindungen Host-Berechtigung entzogen');
   if(result.lifecycle==='active'&&!result.verbindungen.paused)continue;
   return result;
  }catch(error){
   if(error instanceof StoreError&&error.code==='STALE_REVISION')continue;
   throw error;
  }
 }
 throw new StoreError('STALE_REVISION','Verbindungen gleichzeitig geändert; manuell neu laden');
}
