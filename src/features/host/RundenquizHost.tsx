import {ScoreDecisionPanel} from './ScoreDecisionPanel';
import {HostModerationGuide} from './HostModerationGuide';
import { useEffect, useRef, useState } from 'react';
import { createEvent } from '../../domain/event/transition';
import { EventRepository } from '../../infrastructure/db/event-repository';
import { HostSessionController } from '../../application/host-controller/host-session';
import { BrowserStagePort, stageUrl } from '../stage/protocol';
import { HostStagePublisher } from '../stage/host-publisher';
import { createSession, currentQuestion, taskAwards, scores, eveningHalfPoints,
 type Action, type Profile, type Session } from '../../games/rundenquiz/engine';
import { parseEstimateInput } from '../../games/rundenquiz/decimal';
import { timerScopeMatches, newTimerSnapshot } from '../../games/rundenquiz/timer';
import { RQ_TRIAL_BANK } from '../../games/rundenquiz/trial-bank';
import type { EventRecord } from '../../domain/event/schemas';
import { HOST_IDENTITY_KEY, readPreferences } from '../experience/model';

const IDENTITY_KEY=HOST_IDENTITY_KEY;
type Identity={eventId:string;hostId:string};
function savedIdentity():Identity|null{
 try{
  const parsed:unknown=JSON.parse(sessionStorage.getItem(IDENTITY_KEY)??'null');
  if(parsed && typeof parsed==='object' && 'eventId' in parsed && 'hostId' in parsed &&
   typeof parsed.eventId==='string' && typeof parsed.hostId==='string' &&
   /^[a-zA-Z0-9_-]{8,128}$/.test(parsed.eventId) && /^[a-zA-Z0-9_-]{8,128}$/.test(parsed.hostId))
   return {eventId:parsed.eventId,hostId:parsed.hostId};
 }catch{/* blocked or invalid sessionStorage */}
 return null;
}
const errorMessage=(e:unknown)=>e instanceof Error?e.message:'Aktion fehlgeschlagen';

export function RundenquizHost(){
 const [identity,setIdentity]=useState<Identity|null>(savedIdentity);
 const [event,setEvent]=useState<EventRecord|null>(null);
 const [count,setCount]=useState<number>(()=>readPreferences().defaultTeams);
 const [names,setNames]=useState(['Team 1','Team 2','Team 3','Team 4','Team 5']);
 const [profile,setProfile]=useState<Profile>(()=>readPreferences().defaultProfile);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [viewers,setViewers]=useState(0);
 const [estimateInput,setEstimateInput]=useState<Record<string,string>>({});
 const [sourceReady,setSourceReady]=useState(false);
 const controllerRef=useRef<HostSessionController|null>(null);
 const repoRef=useRef<EventRepository|null>(null);
 const [timerRemaining,setTimerRemaining]=useState<number|null>(null);
 const [timerRunning,setTimerRunning]=useState(false);
 const timerLastTick=useRef<number>(Date.now());
 const currentTimerQuestion=event?.rundenquiz?.phase==='open'
   ? currentQuestion(event.rundenquiz)?.id ?? null : null;
 useEffect(()=>{
   setTimerRunning(false);
   if(!identity||!event?.rundenquiz||!currentTimerQuestion){setTimerRemaining(null);return;}
   let cancelled=false;
   const repo=repoRef.current;
   if(!repo)return;
   void repo.getTimer(identity.eventId).then(snapshot=>{
     if(cancelled)return;
     const rq=event.rundenquiz;
     if(rq && snapshot && timerScopeMatches(rq,snapshot))
       setTimerRemaining(snapshot.remainingSeconds);
     else setTimerRemaining(currentQuestion(rq!)?.durationSeconds??30);
   }).catch(e=>{if(!cancelled)setError(errorMessage(e));});
   return ()=>{cancelled=true;};
 },[identity?.eventId,currentTimerQuestion,event?.hostEpoch,event?.rundenquiz?.paused]);
 function persistTimer(seconds:number){
   const rq=event?.rundenquiz,repo=repoRef.current;
   if(!rq||!repo||rq.phase!=='open')return;
   try{
     const snap=newTimerSnapshot(rq,seconds);
     void repo.saveTimer(snap).catch(e=>setError('Timer konnte nicht gesichert werden: '+errorMessage(e)));
   }catch(e){setError(errorMessage(e));}
 }
 useEffect(()=>{
   if(!timerRunning||timerRemaining===null||!currentTimerQuestion||event?.rundenquiz?.paused)return;
   timerLastTick.current=Date.now();
   const tick=window.setInterval(()=>{
     const now=Date.now(),elapsed=Math.floor((now-timerLastTick.current)/1000);
     if(elapsed<1)return;
     timerLastTick.current+=elapsed*1000;
     setTimerRemaining(prev=>{
       if(prev===null)return null;
       const next=Math.max(0,prev-elapsed);
       if(next!==prev)persistTimer(next);
       return next;
     });
   },250);
   return ()=>window.clearInterval(tick);
 },[timerRunning,currentTimerQuestion,event?.rundenquiz?.paused]);
 useEffect(()=>{if(timerRemaining===0)setTimerRunning(false);},[timerRemaining]);
 useEffect(()=>{
  if(!identity)return;
  let disposed=false;
  const repo=new EventRepository();
  repoRef.current=repo;
  const onStatus=(status:string)=>{
   if(!disposed && status==='revoked'){
    setSourceReady(false);
    setError('Eine andere Spielleitung hat übernommen. Dieses Fenster darf nicht mehr steuern.');
   }
  };
  let publisher:HostStagePublisher;
  try{
   publisher=new HostStagePublisher(identity.eventId,identity.hostId,repo,
    new BrowserStagePort(identity.eventId),onStatus,
    n=>{if(!disposed)setViewers(n);});
   publisher.start();
  }catch(e){setError(errorMessage(e));void repo.close();return;}
  const controller=new HostSessionController(repo,identity.eventId,identity.hostId,
   ()=>{void publisher.refresh();});
  controllerRef.current=controller;
  void controller.load().then(async loaded=>{
   if(disposed)return;
   if(!loaded.rundenquiz || loaded.hostId!==identity.hostId){
    setError('Die gespeicherte Sitzung kann von diesem Fenster nicht übernommen werden.');
    return;
   }
   // A refreshed live host is conservatively paused; no timer or answer advances.
   if(loaded.lifecycle==='active' && !loaded.rundenquiz.paused){
    loaded=await controller.submit({type:'RQ_ACTION',action:{type:'PAUSE'}},loaded,crypto.randomUUID());
   }
   if(!disposed){setEvent(loaded);setSourceReady(true);}
  }).catch(e=>{if(!disposed)setError(errorMessage(e));});
  const heartbeat=window.setInterval(()=>{void publisher.refresh();},1600);
  return ()=>{
   disposed=true;controllerRef.current=null;repoRef.current=null;
   window.clearInterval(heartbeat);publisher.stop();void repo.close();
  };
 },[identity]);

 async function prepare(){
  if(busy)return;
  setBusy(true);setError(null);
  const next:Identity={eventId:crypto.randomUUID(),hostId:crypto.randomUUID()};
  const teams=names.slice(0,count).map((name,i)=>({
   id:'rq-team-'+(i+1),name:name.trim(),order:i,colorToken:'team-'+(i+1),
  }));
  const repo=new EventRepository();
  try{
   const rq=createSession({
    id:next.eventId,ownerId:next.hostId,profile,
    teams:teams.map(({id,name,order})=>({id,name,order})),
    bank:RQ_TRIAL_BANK,
   });
   const seed=createEvent({
    id:next.eventId,hostId:next.hostId,at:Date.now(),
    teams,program:[{id:'rq-game-1',type:'rundenquiz',profile,order:0,rulesVersion:'rq-trial-1'}],
    frozenTasks:rq.questions.map(q=>({
     taskId:q.id,gameType:'rundenquiz',publicPrompt:q.prompt,
     publicClues:[...(q.clues??[])],privateAnswers:[q.answer],
     moderatorNotes:'Nur redaktionell unbestätigtes G4-Testmaterial. Quelle: '+q.reference,
     sourceContentId:q.id,sourceHash:'g4-trial-v1',
    })),rundenquiz:rq,
   });
   await repo.create(seed);
   sessionStorage.setItem(IDENTITY_KEY,JSON.stringify(next));
   setEvent(seed);setIdentity(next);
   setSourceReady(false);
  }catch(e){setError(errorMessage(e));}finally{await repo.close();setBusy(false);}
 }
 async function confirmRecovery(){
  if(!event?.recoveryRequired||busy||!sourceReady)return;
  const controller=controllerRef.current;if(!controller)return;
  if(!window.confirm('Wiederhergestellten Spielstand bestätigen? Bitte zuerst die Punktetabelle, aktuelle Aufgabe und den Beamer prüfen. Der Abend bleibt danach pausiert.'))return;
  setBusy(true);setError(null);setTimerRunning(false);
  try{
    const next=await controller.submit({type:'RECOVERY_CONFIRM'},event,crypto.randomUUID());
    setEvent(next);
  }catch(failure){
    setError(errorMessage(failure));
    try{setEvent(await controller.load());}catch{/* Keep the actionable error visible */}
  }finally{setBusy(false);}
 }
 async function action(nextAction:Action){
  if(busy||!event||!sourceReady)return;
  if(['CLOSE','REVEAL','NEXT','FINISH','PAUSE'].includes(nextAction.type))
    setTimerRunning(false);
  const controller=controllerRef.current;if(!controller)return;
  setBusy(true);setError(null);
  try{
   const updated=await controller.submit({type:'RQ_ACTION',action:nextAction},event,crypto.randomUUID());
   setEvent(updated);
  }catch(e){
   setError(errorMessage(e));
   try{setEvent(await controller.load());}catch{/* Preserve original error */}
  }finally{setBusy(false);}
 }
 function submitEstimate(teamId:string,unit:string){
  try{
   const parsed=parseEstimateInput(estimateInput[teamId]??'',unit);
   if(parsed.converted && !window.confirm('Umrechnung übernehmen? '+parsed.original+' → '+parsed.value+' '+parsed.canonicalUnit))return;
   void action({type:'ESTIMATE',teamId,value:parsed.value});
  }catch(e){setError(errorMessage(e));}
 }
 function newEvent(){
  if(!window.confirm('Neuen Quizabend vorbereiten? Die bisherige Sitzung bleibt in der lokalen Datenbank archiviert.'))return;
  try{sessionStorage.removeItem(IDENTITY_KEY);}catch{/* Can use temporary state only */}
  setIdentity(null);setEvent(null);setSourceReady(false);setViewers(0);setError(null);
  window.location.hash='#/setup';
 }
 const rq:Session|undefined=event?.rundenquiz;
 const q=rq?currentQuestion(rq):null;
 const computed=rq?scores(rq):{};
 const preview=rq?.phase==='revealed' ? (() => {
   try { return taskAwards(rq); } catch { return null; }
 })() : null;
 const isPaused=Boolean(event?.lifecycle==='paused'||rq?.paused);
 const disabled=busy||!sourceReady||!event||event.recoveryRequired;
 const title=(round:string)=>({wissen:'Wissen',hinweise:'Hinweise',schaetzen:'Schätzen',finale:'Finale'} as Record<string,string>)[round]??round;

 return <section className="rq-host" data-host-game="rundenquiz" aria-label="Rundenquiz Spielleitung">
  <div className="rq-head"><div><div className="eyebrow">G4 · SPIELMODUS IM TEST</div>
   <h2>Rundenquiz</h2><p>Quizabend mit Teams, vier Runden und separater Beameransicht.</p></div>
   <span className="g3-tech-tag">PROBEINHALTE</span>
  </div>
  {!identity?<div className="rq-setup">
   <label>Spielumfang <select value={profile} onChange={e=>setProfile(e.target.value as Profile)}>
    <option value="kurz">Kurz · 7 Aufgaben</option><option value="standard">Standard · 11 Aufgaben</option>
    <option value="lang">Lang · 16 Aufgaben</option>
   </select></label>
   <label>Teams <select value={count} onChange={e=>setCount(Number(e.target.value))}>
    {[3,4,5].map(n=><option key={n} value={n}>{n} Teams</option>)}
   </select></label>
   <div className="rq-teamfields">{names.slice(0,count).map((name,i)=><label key={i}>
    Team {i+1} <input value={name} maxLength={40} onChange={e=>setNames(prev=>prev.map((v,j)=>i===j?e.target.value:v))}/>
   </label>)}</div>
   <button data-host-next className="g3-tech-primary" disabled={busy} onClick={()=>void prepare()}>Quizabend vorbereiten</button>
   <p className="g3-tech-footnote">G4 verwendet vorläufige Übungsfragen; diese sind nicht als redaktionell freigegebener Fragenkatalog gekennzeichnet.</p>
  </div>:<div className="rq-live">
   <div className="rq-utility">
    <span>Revision {event?.revision??0} · {rq?.profile??profile} · {viewers} Beamer verbunden</span>
    <a href={stageUrl(identity.eventId)} target="_blank" rel="noopener noreferrer" className="g3-tech-link">Beamer öffnen ↗</a>
    <button onClick={newEvent}>Neuer Quizabend</button>
   </div>
   {rq&&<HostModerationGuide game="rundenquiz" phase={rq.phase} paused={isPaused}
     recovery={Boolean(event?.recoveryRequired)} completed={rq.phase==='complete'?rq.questions.length:rq.index}
     total={rq.questions.length} viewers={viewers} ready={sourceReady} busy={busy}/>}
   {rq&&<ScoreDecisionPanel source={{game:'rundenquiz',session:rq}} blocked={isPaused||!sourceReady||Boolean(event?.recoveryRequired)}/>}
   {rq&&<div className="rq-status">
    <strong>{rq.phase==='complete'?'Quizabend beendet':q?title(q.round)+' · Aufgabe '+(rq.index+1)+'/'+rq.questions.length:'Vorbereitung'}</strong>
    <span>{isPaused?'Pausiert':rq.phase} · {rq.profile}</span>
   </div>}
   {rq && !sourceReady && <p role="status">Sitzung wird geladen bzw. überprüft …</p>}
   {event?.recoveryRequired && <div className="rq-recovery" role="alert">
      <strong>Wiederherstellung prüfen</strong>
      <p>Die Sitzung wurde aus einem gesicherten Stand wiederhergestellt. Die Beameransicht bleibt ausgeblendet. Kontrolliere Teamnamen, Punktestand und aktuelle Frage, bevor du die Wiederherstellung bestätigst.</p>
      <button data-host-next className="g3-tech-primary" disabled={busy||!sourceReady} onClick={()=>void confirmRecovery()}>
        Spielstand geprüft — weiterhin pausiert übernehmen
      </button>
   </div>}
   {rq && <div className="rq-scoreboard" aria-label="Punktestand">
    {rq.teams.map(t=><div key={t.id}><span>{t.name}</span><strong>{computed[t.id]??0}</strong></div>)}
   </div>}
   {rq && rq.phase==='complete'&&<div className="rq-end">
    <h3>Endstand</h3>{rq.teams.map(t=><p key={t.id}>{t.name}: {computed[t.id]??0} Punkte · Abendpunkte {(eveningHalfPoints(rq)[t.id]??0)/2}</p>)}
   </div>}
   {rq && rq.phase!=='complete'&&<div className="rq-control">
    {q&&<div className="rq-question">
     <small>{title(q.round)} · {q.durationSeconds} Sekunden empfohlene Zeit</small>
     <h3>{q.prompt}</h3>
     <div className="rq-private">Private Lösung: <strong>{q.answer}</strong> · Quelle: {q.reference}</div>
     {q.round==='hinweise'&&rq.phase!=='ready'&&<div className="rq-clue-list">
      {(q.clues??[]).slice(0,rq.clueCount).map((clue,i)=><p key={i}><b>{i+1}.</b> {clue}</p>)}
     </div>}
    </div>}
    {rq.phase==='open'&&<div className="rq-timer" aria-label="Optionale Uhr">
      <div><span>OPTIONALER TIMER</span><strong>{timerRemaining===null?'–':String(timerRemaining)+' s'}</strong></div>
      <button disabled={disabled||isPaused||timerRemaining===null||timerRunning||timerRemaining===0}
        onClick={()=>{timerLastTick.current=Date.now();setTimerRunning(true);}}>Start</button>
      <button disabled={disabled||!timerRunning} onClick={()=>{setTimerRunning(false);if(timerRemaining!==null)persistTimer(timerRemaining);}}>Stopp</button>
      <button disabled={disabled||isPaused||timerRemaining===null} onClick={()=>{
        const next=Math.min(300,(timerRemaining??0)+15);setTimerRemaining(next);persistTimer(next);
      }}>+15 s</button>
      <small>Nach Neuladen pausiert. Keine automatische Enthüllung.</small>
     </div>}
    {isPaused ? <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void action({type:'RESUME'})}>Spiel fortsetzen</button>
    :<div className="rq-actions">
      {rq.phase==='setup' && <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void action({type:'START'})}>Teams bestätigen</button>}
      {rq.phase==='ready' && <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void action({type:'PUBLISH'})}>Frage auf Beamer zeigen</button>}
      {rq.phase==='open' && <>
        {q?.round==='hinweise'&&<>
         <div className="rq-teamfields">{rq.teams.map(t=><button key={t.id} disabled={disabled||Boolean(rq.entries[t.id])}
           onClick={()=>void action({type:'LOCK_HINT',teamId:t.id})}>{t.name}: {rq.entries[t.id]?'Abgegeben':'Antwort abgegeben'}</button>)}</div>
         {rq.clueCount<4&&<button disabled={disabled} onClick={()=>void action({type:'NEXT_CLUE'})}>Nächsten Hinweis zeigen</button>}
        </>}
        {q?.round==='schaetzen'&&<div className="rq-teamfields">{rq.teams.map(t=><div key={t.id}>
          <label>{t.name} ({q.unit}) <input value={estimateInput[t.id]??''}
            onChange={e=>setEstimateInput(v=>({...v,[t.id]:e.target.value}))} placeholder="z. B. 1,8 km"/></label>
          <button disabled={disabled} onClick={()=>submitEstimate(t.id,q.unit??'')}>Übernehmen</button>
          <button disabled={disabled} onClick={()=>void action({type:'ESTIMATE',teamId:t.id,value:null})}>Keine Antwort</button>
          <span>{Object.hasOwn(rq.entries[t.id]??{},'estimate') ? ' Erfasst' : ' Offen'}</span>
         </div>)}</div>}
        <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void action({type:'CLOSE'})}>Antwortphase schließen</button>
      </>}
      {rq.phase==='closed' && <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void action({type:'REVEAL'})}>Lösung auf Beamer zeigen</button>}
      {rq.phase==='revealed' && <>
        {q?.round!=='schaetzen'&&<div className="rq-teamfields">{rq.teams.map(t=><div key={t.id} className="rq-judge">
         <span>{t.name}{rq.entries[t.id]?.judgement?' · '+rq.entries[t.id]?.judgement:''}</span>
         {(['richtig','falsch','keine'] as const).map(v=><button key={v} disabled={disabled||v==='richtig'&&q?.round==='hinweise'&&!rq.entries[t.id]?.lockLevel}
           onClick={()=>void action({type:'JUDGE',teamId:t.id,value:v})}>{v}</button>)}
        </div>)}</div>}
        {q?.round==='schaetzen'&&<p>Schätzungen werden nach Abstand zur Zielzahl gewertet; exakte Gleichstände behalten denselben Rang.</p>}
        <div className="rq-preview" aria-label="Punktevorschau">
          <h4>Punkte vor Bestätigung</h4>
          {!preview?<p>Bitte zuerst alle Teamantworten bewerten bzw. Schätzungen erfassen.</p>
          :<div>{preview.map(award=>{
            const team=rq.teams.find(t=>t.id===award.teamId);
            return <div key={award.teamId}>
              <span>{team?.name??award.teamId}{q?.round==='schaetzen'?
                ' · '+(rq.entries[award.teamId]?.estimate??'keine Antwort'):''}</span>
              <strong>{award.points} Pkt.{award.rank?' · Platz '+award.rank:''}</strong>
            </div>;
          })}</div>}
        </div>
        <button data-host-next className="g3-tech-primary" disabled={disabled||!preview}
          onClick={()=>void action({type:'CONFIRM'})}>Punkte verbindlich bestätigen</button>
      </>}
      {rq.phase==='graded'&&<>
        <button data-host-next className="g3-tech-primary" disabled={disabled}
          onClick={()=>void action(rq.index===rq.questions.length-1?{type:'FINISH'}:{type:'NEXT'})}>
            {rq.index===rq.questions.length-1?'Endstand zeigen':'Nächste Aufgabe'}
        </button>
        <button disabled={disabled} onClick={()=>void action({type:'CORRECT'})}>Letzte Wertung korrigieren</button>
      </>}
      {(rq.phase==='open'||rq.phase==='closed'||rq.phase==='revealed'||rq.phase==='graded')&&
        <button disabled={disabled} onClick={()=>{
         if(window.confirm('Diese Frage für alle Teams mit 0 Punkten annullieren?'))void action({type:'ANNUL'});
        }}>Frage annullieren</button>}
      {rq.phase!=='setup'&&<button disabled={disabled} onClick={()=>void action({type:'PAUSE'})}>Pausieren</button>}
    </div>}
   </div>}
  </div>}
  {error&&<p role="alert" className="g3-tech-error">{error}</p>}
 </section>;
}
