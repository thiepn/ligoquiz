import {useEffect,useRef,useState} from 'react';
import {EventRepository} from '../../infrastructure/db/event-repository';
import {HostSessionController} from '../../application/host-controller/host-session';
import {BrowserStagePort,stageUrl} from '../stage/protocol';
import {HostStagePublisher} from '../stage/host-publisher';
import type {EventRecord} from '../../domain/event/schemas';
import {currentRung,orderedTeams,rungSeconds,rungValue,scores,eveningHalfPoints,type Action} from '../../games/logikleiter/engine';
import {readHostIdentity} from '../experience/model';
const errorText=(e:unknown)=>e instanceof Error?e.message:'Aktion fehlgeschlagen';

export function LogikleiterHost(){
 const identity=readHostIdentity();
 const [event,setEvent]=useState<EventRecord|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[viewers,setViewers]=useState(0);
 const controllerRef=useRef<HostSessionController|null>(null);
 const [seconds,setSeconds]=useState(60),[clock,setClock]=useState(false);
 const lastTick=useRef(Date.now());
 const ll=event?.logikleiter;
 const rung=ll&&ll.phase!=='complete'?currentRung(ll):null;
 const limit=rungSeconds(ll?.index??0);
 useEffect(()=>{
  if(!identity)return;
  const db=new EventRepository();let disposed=false;
  let publisher:HostStagePublisher;
  try{
   publisher=new HostStagePublisher(identity.eventId,identity.hostId,db,
    new BrowserStagePort(identity.eventId),status=>{
     if(!disposed&&status==='revoked'){
      setReady(false);setError('Die Host-Berechtigung wurde von einer anderen Spielleitung übernommen.');
     }
    },count=>{if(!disposed)setViewers(count);});
   publisher.start();
  }catch(e){setError(errorText(e));void db.close();return;}
  const controller=new HostSessionController(db,identity.eventId,identity.hostId,
   ()=>{void publisher.refresh();});
  controllerRef.current=controller;
  void controller.load().then(async saved=>{
   if(!saved.logikleiter||saved.hostId!==identity.hostId)
    throw Error('Keine Logikleiter-Sitzung für diese Spielleitung');
   if(saved.lifecycle==='active'&&!saved.logikleiter.paused)
    saved=await controller.submit({type:'LL_ACTION',action:{type:'PAUSE'}},saved,crypto.randomUUID());
   if(!disposed){setEvent(saved);setReady(true);}
  }).catch(e=>{if(!disposed)setError(errorText(e));});
  const interval=window.setInterval(()=>{void publisher.refresh();},1600);
  return ()=>{disposed=true;controllerRef.current=null;window.clearInterval(interval);publisher.stop();void db.close();};
 },[identity?.eventId,identity?.hostId]);
 useEffect(()=>{setClock(false);setSeconds(limit);},[ll?.index,ll?.phase,ll?.paused,limit]);
 useEffect(()=>{
  if(!clock||ll?.paused||seconds===0)return;
  lastTick.current=Date.now();
  const t=window.setInterval(()=>{
   const now=Date.now(),delta=Math.floor((now-lastTick.current)/1000);
   if(delta<1)return;lastTick.current+=delta*1000;
   setSeconds(v=>Math.max(0,v-delta));
  },250);
  return ()=>window.clearInterval(t);
 },[clock,ll?.paused,ll?.index,ll?.phase,seconds===0]);
 useEffect(()=>{if(seconds===0)setClock(false);},[seconds]);
 async function send(action:Action){
  if(!ready||busy||!event||event.recoveryRequired)return;
  const controller=controllerRef.current;if(!controller)return;
  if(['HINT','CLOSE','REVEAL','CONFIRM','PAUSE','NEXT'].includes(action.type))setClock(false);
  setBusy(true);setError('');
  try{setEvent(await controller.submit({type:'LL_ACTION',action},event,crypto.randomUUID()));}
  catch(e){
   setError(errorText(e));
   try{setEvent(await controller.load());}catch{/* Preserve original error */}
  }finally{setBusy(false);}
 }
 async function reviewRecovery(){
  if(!event?.recoveryRequired||!ready||busy)return;
  if(!window.confirm('Hinweiszustand, Abgabesperren und Wertungen geprüft? Danach bleibt die Sitzung pausiert.'))return;
  const controller=controllerRef.current;if(!controller)return;
  setBusy(true);setError('');
  try{setEvent(await controller.submit({type:'RECOVERY_CONFIRM'},event,crypto.randomUUID()));}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 function reasoned(type:'ANNUL'|'FAIR_HINT'){
  const text=window.prompt(type==='ANNUL'?'Grund für Stufenannullierung:':'Grund für faire Hinweisbehandlung:');
  if(text&&text.trim().length>=3)void send({type,reason:text.trim()});
 }
 if(!identity)return <section className="exp-empty"><h2>Keine Spielleitung gewählt</h2><a href="#/spielen">Zu Spielen</a></section>;
 const teams=ll?orderedTeams(ll):[],totals=ll?scores(ll):{};
 const disabled=!ready||busy||ll?.paused||event?.recoveryRequired;
 const canConfirm=ll?.phase==='revealed'&&teams.every(t=>Boolean(ll.grades[t.id]));
 return <section className="ll-host" aria-label="Logikleiter Spielleitung">
  <header className="ll-host-head">
   <div><span className="eyebrow">G8 · SPIELMODUS IM TEST</span><h2>Logikleiter</h2>
    <p>Alle Teams lösen dieselbe Aufgabe. Frühe Abgabe = volle Punktzahl; Abgabe nach Hinweis = halbe Punktzahl.</p></div>
   <span className="g3-tech-tag">PROBEINHALTE</span>
  </header>
  <div className="ll-toolbar">
   <a className="g3-tech-link" href={stageUrl(identity.eventId)} target="_blank" rel="noopener noreferrer">Beamer öffnen ↗</a>
   <span>{viewers} Beamer bestätigt</span><span>Revision {event?.revision??0}</span>
   <a href="#/spielen">Übersicht</a>
  </div>
  {!ll?<p role="status">Sitzung wird geprüft …</p>:<>
   <div className="ll-scorebar">{teams.map(t=><div key={t.id}><span>{t.name}</span><strong>{totals[t.id]??0}</strong></div>)}</div>
   <div className="ll-rung-strip">{ll.rungs.map((r,i)=><div key={r.id} className={i<ll.index?'done':i===ll.index?'current':''}>
    <span>STUFE {i+1}</span><strong>{rungValue(i)}</strong></div>)}</div>
   <div className="ll-status"><span>STUFE {Math.min(ll.index+1,ll.rungs.length)} / {ll.rungs.length}</span>
    <strong>{ll.paused?'PAUSIERT':ll.phase.toUpperCase()}</strong></div>
   {event?.recoveryRequired&&<div className="rq-recovery" role="alert">
    <h3>Wiederhergestellte Sitzung prüfen</h3>
    <p>Hinweis und Abgaben bleiben gespeichert. Der Beamer bleibt bis zur Bestätigung ausgeblendet.</p>
    <button className="g3-tech-primary" disabled={!ready||busy} onClick={()=>void reviewRecovery()}>Wiederherstellung bestätigen</button>
   </div>}
   {ll.phase!=='setup'&&ll.phase!=='complete'&&<div className="ll-pause">
    {ll.paused?<button disabled={!ready||busy||event?.recoveryRequired}
      onClick={()=>void send({type:'RESUME'})}>Spiel ausdrücklich fortsetzen</button>:
     <button disabled={disabled} onClick={()=>void send({type:'PAUSE'})}>Pausieren</button>}
   </div>}
   {ll.phase==='setup'&&<div className="ll-card"><h3>Leiter vorbereiten</h3>
    <p>{ll.rungs.length} gemeinsam gespielte Stufen mit 10 bis {rungValue(ll.rungs.length-1)} Punkten.</p>
    <button className="g3-tech-primary" disabled={!ready||busy} onClick={()=>void send({type:'START'})}>Stufenfolge bestätigen</button>
   </div>}
   {rung&&ll.phase!=='setup'&&<div className="ll-card">
    <div className="eyebrow">STUFE {ll.index+1} · {rungValue(ll.index)} PUNKTE · {rung.kind.toUpperCase()}</div>
    <h3>{rung.prompt}</h3>
    <div className="ll-private"><small>NUR SPIELLEITUNG · LÖSUNG</small><strong>{rung.answer}</strong>
     <p>{rung.explanation}</p><small>{rung.reference}</small></div>
    {ll.phase==='ready'&&<button className="g3-tech-primary" disabled={disabled}
      onClick={()=>void send({type:'PUBLISH'})}>Aufgabe veröffentlichen</button>}
    {ll.phase==='open'&&<>
     <div className="ll-clock"><div><span>OPTIONALER TIMER</span><strong>{seconds} s</strong>
       <small>Kein automatischer Abschluss, keine automatische Enthüllung.</small></div>
       <button disabled={disabled||clock||seconds===0} onClick={()=>setClock(true)}>Start</button>
       <button disabled={!clock} onClick={()=>setClock(false)}>Stopp</button>
       <button disabled={disabled} onClick={()=>{setClock(false);setSeconds(limit);}}>Zurücksetzen</button>
     </div>
     <div className="ll-lock-panel"><h4>Abgaben sperren</h4>
      <p>Jede frühe Abgabe einzeln erfassen, bevor ein Hinweis veröffentlicht wird. Bereits gesperrte Abgaben bleiben unverändert.</p>
      {teams.map(t=><div className="ll-team-row" key={t.id}><span>{t.name}</span>
       <strong>{ll.locks[t.id]?(ll.locks[t.id].hintRevision===0?'VOR HINWEIS':'NACH HINWEIS'):'OFFEN'}</strong>
       <button disabled={disabled||Boolean(ll.locks[t.id])} onClick={()=>void send({type:'LOCK',teamId:t.id})}>
        {ll.locks[t.id]?'Gesperrt':'Abgabe jetzt sperren'}</button></div>)}
     </div>
     {ll.hintShown?<div className="ll-hint"><small>VERÖFFENTLICHTER HINWEIS</small><p>{rung.hint}</p></div>:
      <button disabled={disabled} onClick={()=>void send({type:'HINT'})}>Hinweis bewusst veröffentlichen</button>}
     {ll.hintShown&&!ll.fairHint&&<button disabled={disabled} onClick={()=>reasoned('FAIR_HINT')}>
      Hinweis versehentlich früh gezeigt – alle richtigen Antworten voll werten</button>}
     {ll.fairHint&&<p className="ll-notice">Faire Hinweisbehandlung: alle korrekten Abgaben zählen voll.</p>}
     <button className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'CLOSE'})}>Alle Antworten schließen</button>
    </>}
    {ll.phase==='closed'&&<p>Antworten sind geschlossen. Keine Teamabgabe kann mehr geändert werden.</p>}
    {ll.phase==='closed'&&<button className="g3-tech-primary" disabled={disabled}
     onClick={()=>void send({type:'REVEAL'})}>Lösung und Begründung veröffentlichen</button>}
    {ll.phase==='revealed'&&<>
      <h4>Teamwertungen bestätigen</h4><p>Richtige Abgaben ohne dokumentierte Sperre werden nicht akzeptiert.</p>
      <div className="ll-lock-panel">{teams.map(t=><div className="ll-team-row" key={t.id}>
       <span>{t.name} <small>{ll.locks[t.id]?.hintRevision===0?'Vor Hinweis':ll.locks[t.id]?.hintRevision===1?'Nach Hinweis':'Keine Sperre'}</small></span>
       <div className="ll-grades">{(['correct','wrong','absent'] as const).map(value=><button key={value}
        disabled={disabled||(value==='correct'&&!ll.locks[t.id])} aria-pressed={ll.grades[t.id]===value}
        onClick={()=>void send({type:'GRADE',teamId:t.id,value})}>
        {value==='correct'?'Richtig':value==='wrong'?'Falsch':'Keine Antwort'}</button>)}</div>
      </div>)}</div>
      <button className="g3-tech-primary" disabled={disabled||!canConfirm}
       onClick={()=>void send({type:'CONFIRM'})}>Alle Wertungen verbindlich bestätigen</button>
    </>}
    {ll.phase==='graded'&&<>
     <div className="ll-awards">{ll.awards.filter(a=>a.rungId===rung.id).map(a=><p key={a.teamId}>
       {teams.find(t=>t.id===a.teamId)?.name}: <strong>{a.points} Punkte</strong>{a.annulled?' · Annulliert':''}</p>)}</div>
     {!ll.awards.some(a=>a.rungId===rung.id&&a.annulled)&&<button disabled={disabled}
       onClick={()=>void send({type:'CORRECT'})}>Letzte Wertung korrigieren</button>}
     <button className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'NEXT'})}>
      {ll.index===ll.rungs.length-1?'Logikleiter abschließen':'Nächste Stufe'}</button>
    </>}
    {ll.phase!=='graded'&&<button className="ll-annul" disabled={disabled}
      onClick={()=>reasoned('ANNUL')}>Stufe begründet annullieren</button>}
   </div>}
   {ll.phase==='complete'&&<div className="ll-card ll-final">
    <h3>Logikleiter abgeschlossen</h3>
    {teams.map(t=><p key={t.id}>{t.name}: <b>{totals[t.id]??0} Spielpunkte</b> · {(eveningHalfPoints(ll)[t.id]??0)/2} Abendpunkte</p>)}
    <a className="exp-primary" href="#/verlauf">Abendbericht ansehen</a>
   </div>}
  </>}
  {error&&<p className="g3-tech-error" role="alert">{error}</p>}
  <p className="exp-footnote">G8 ist ein Testmodus mit ungeprüften Beispielaufgaben. Wertungen, Abgaben und Hinweise sind Bestandteil der gespeicherten Sitzung.</p>
 </section>;
}
