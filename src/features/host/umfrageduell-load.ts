import type {EventRecord} from '../../domain/event/schemas';
import {HostSessionController} from '../../application/host-controller/host-session';
import {StoreError} from '../../infrastructure/db/event-repository';

/** Fail closed on revoked ownership. Only retry a same-host concurrent revision pause. */
export async function loadSafelyPausedUmfrageduell(controller:HostSessionController):Promise<EventRecord>{
 for(let attempt=0;attempt<3;attempt++){
  const current=await controller.load();
  if(!current.umfrageduell||current.hostId!==controller.hostId)
   throw new StoreError('STALE_HOST','Umfrageduell gehört zu einer anderen Spielleitung');
  if(current.lifecycle!=='active'||current.umfrageduell.paused)return current;
  try{
   const result=await controller.submit({type:'UD_ACTION',action:{type:'PAUSE'}},current,crypto.randomUUID());
   if(!result.umfrageduell||result.hostId!==controller.hostId)
    throw new StoreError('STALE_HOST','Umfrageduell Host-Berechtigung entzogen');
   if(result.lifecycle==='active'&&!result.umfrageduell.paused)continue;
   return result;
  }catch(error){
   if(error instanceof StoreError&&error.code==='STALE_REVISION')continue;
   throw error;
  }
 }
 throw new StoreError('STALE_REVISION','Umfrageduell gleichzeitig geändert; manuell neu laden');
}
