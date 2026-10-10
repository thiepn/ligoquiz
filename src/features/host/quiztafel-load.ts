import type {EventRecord} from '../../domain/event/schemas';
import {HostSessionController} from '../../application/host-controller/host-session';
import {StoreError} from '../../infrastructure/db/event-repository';

/** Fail closed for stale host/ownership. Retry only a bounded concurrent revision race. */
export async function loadSafelyPausedQuiztafel(controller:HostSessionController):Promise<EventRecord>{
 for(let attempt=0;attempt<3;attempt++){
  const current=await controller.load();
  if(!current.quiztafel||current.hostId!==controller.hostId)
   throw new StoreError('STALE_HOST','Quiztafel gehört zu einer anderen Spielleitung');
  if(current.lifecycle!=='active'||current.quiztafel.paused)return current;
  try{
   const result=await controller.submit({type:'QT_ACTION',action:{type:'PAUSE'}},current,crypto.randomUUID());
   if(!result.quiztafel||result.hostId!==controller.hostId)
    throw new StoreError('STALE_HOST','Quiztafel-Host-Berechtigung entzogen');
   if(result.lifecycle==='active'&&!result.quiztafel.paused)continue;
   return result;
  }catch(error){
   if(error instanceof StoreError&&error.code==='STALE_REVISION')continue;
   throw error;
  }
 }
 throw new StoreError('STALE_REVISION','Quiztafel gleichzeitig geändert; erneut laden');
}
