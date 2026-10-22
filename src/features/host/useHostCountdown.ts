import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';

export function countdownAfterElapsed(remaining:number,elapsedMs:number):{
 remaining:number;consumedMs:number;
}{
 if(!Number.isInteger(remaining)||remaining<0||!Number.isFinite(elapsedMs)||elapsedMs<0)
  throw Error('Ungültige Moderationszeit');
 const elapsed=Math.floor(elapsedMs/1000);
 return {remaining:Math.max(0,remaining-elapsed),consumedMs:elapsed*1000};
}
/** One task/phase clock identity; pause is intentionally excluded from scope. */
export function countdownScope(eventId:string|undefined,epoch:number|undefined,
 task:string|undefined,phase:string|undefined,segment?:number):string{
 return [eventId??'unloaded',epoch??0,task??'unloaded',phase??'idle',segment??0].join(':');
}
export type HostCountdown={
 seconds:number;clock:boolean;setClock:Dispatch<SetStateAction<boolean>>;
 setSeconds:Dispatch<SetStateAction<number>>;
};
/**
 * Original optional timekeeper, shared by four existing hosts.
 * Host pause/recovery/owner loss STOPS the clock but NEVER gifts extra time.
 * No persistent timer, game transition, scheduled action or score authority.
 */
export function useHostCountdown(scope:string,limit:number,blocked:boolean):HostCountdown{
 const [seconds,setSeconds]=useState(limit);
 const [clock,setClock]=useState(false);
 const lastTick=useRef(Date.now());
 useEffect(()=>{
  setClock(false);setSeconds(limit);lastTick.current=Date.now();
 },[scope,limit]);
 useEffect(()=>{if(blocked)setClock(false);},[blocked]);
 useEffect(()=>{
  if(!clock||blocked||seconds===0)return;
  lastTick.current=Date.now();
  const interval=window.setInterval(()=>{
   const now=Date.now();
   const elapsed=countdownAfterElapsed(0,now-lastTick.current).consumedMs;
   if(elapsed===0)return;
   lastTick.current+=elapsed;
   setSeconds(prev=>Math.max(0,prev-elapsed/1000));
  },250);
  return ()=>window.clearInterval(interval);
 },[clock,blocked,seconds===0]);
 useEffect(()=>{if(seconds===0)setClock(false);},[seconds]);
 return {seconds,clock,setClock,setSeconds};
}
