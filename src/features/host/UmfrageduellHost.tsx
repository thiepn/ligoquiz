import {CorrectionProvenance,SafeErrorRecovery} from './CorrectionProvenance';
import {ScoreDecisionPanel} from './ScoreDecisionPanel';
import {loadSafelyPausedUmfrageduell} from './umfrageduell-load';
import {HostModerationGuide} from './HostModerationGuide';
import {useEffect,useRef,useState} from 'react';
import {EventRepository} from '../../infrastructure/db/event-repository';
import {HostSessionController} from '../../application/host-controller/host-session';
import {BrowserStagePort,stageUrl} from '../stage/protocol';
import {HostStagePublisher} from '../stage/host-publisher';
import type {EventRecord} from '../../domain/event/schemas';
import {currentSurvey,orderedTeams,taskSeconds,scores,eveningHalfPoints,
  pointsFor,suggestMatch,type Action,type Submission,type Rank} from '../../games/umfrageduell/engine';
import {readHostIdentity} from '../experience/model';
const errorText=(e:unknown)=>e instanceof Error?e.message:'Aktion fehlgeschlagen';
const empty=(n:number):Submission=>({answers:Array(n).fill('') as string[],mapped:Array(n).fill(null) as (Rank|null)[]});
export function UmfrageduellHost(){
 const identity=readHostIdentity();
 const [event,setEvent]=useState<EventRecord|null>(null);
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[viewers,setViewers]=useState(0);
 const [drafts,setDrafts]=useState<Record<string,Submission>>({});
 const draftsRef=useRef<Record<string,Submission>>({});
 const controllerRef=useRef<HostSessionController|null>(null);
 const queueRef=useRef<Promise<void>>(Promise.resolve());
 const [seconds,setSeconds]=useState(30),[clock,setClock]=useState(false);
 const lastTick=useRef(Date.now());
 const ud=event?.umfrageduell;
 const task=ud&&ud.phase!=='complete'?currentSurvey(ud):null;
 const count=task?.format==='top3'?3:1,limit=taskSeconds(task?.format??'popular');
 useEffect(()=>{
  if(!identity)return;
  const db=new EventRepository();let disposed=false;let publisher:HostStagePublisher;
  try{
   publisher=new HostStagePublisher(identity.eventId,identity.hostId,db,
    new BrowserStagePort(identity.eventId),status=>{
     if(!disposed&&status==='revoked'){
      setReady(false);setError('Eine andere Spielleitung hat diese Sitzung übernommen.');
     }
    },n=>{if(!disposed)setViewers(n);});
   publisher.start();
  }catch(e){setError(errorText(e));void db.close();return;}
  const controller=new HostSessionController(db,identity.eventId,identity.hostId,
   ()=>{void publisher.refresh();});
  controllerRef.current=controller;
  void loadSafelyPausedUmfrageduell(controller).then(saved=>{
   if(!disposed){setEvent(saved);setReady(true);}
  }).catch(e=>{if(!disposed)setError(errorText(e));});
  const interval=window.setInterval(()=>{void publisher.refresh();},1600);
  return ()=>{disposed=true;controllerRef.current=null;window.clearInterval(interval);publisher.stop();void db.close();};
 },[identity?.eventId,identity?.hostId]);
 useEffect(()=>{
  if(ud){const prepared:Record<string,Submission>={};
   const n=ud.surveys[ud.index]?.format==='top3'?3:1;
   for(const t of ud.teams){
    const response=ud.submissions[t.id];
    prepared[t.id]=response&&response.answers.length>0?
      {answers:[...response.answers],mapped:[...response.mapped]}:empty(n);
   }
   draftsRef.current=prepared;
   setDrafts(prepared);
  }
 },[ud?.index,ud?.surveys,ud?.phase==='setup']);
 useEffect(()=>{setClock(false);setSeconds(limit);},[ud?.index,ud?.phase,ud?.paused,limit]);
 useEffect(()=>{
  if(!clock||ud?.paused||seconds===0)return;
  lastTick.current=Date.now();
  const timer=window.setInterval(()=>{
   const now=Date.now(),delta=Math.floor((now-lastTick.current)/1000);
   if(delta<1)return;lastTick.current+=delta*1000;
   setSeconds(v=>Math.max(0,v-delta));
  },250);
  return ()=>window.clearInterval(timer);
 },[clock,ud?.paused,ud?.index,ud?.phase,seconds===0]);
 useEffect(()=>{if(seconds===0)setClock(false);},[seconds]);
 function send(action:Action):Promise<void>{
  if(!ready||!event||event.recoveryRequired)return Promise.resolve();
  const ctrl=controllerRef.current;if(!ctrl)return Promise.resolve();
  // A rapidly submitted host click must never disappear behind a busy-state
  // rerender. Serialize commands and fence each against the LATEST IDB revision.
  const job=queueRef.current.then(async()=>{
   if(['CLOSE','REVEAL','CONFIRM','NEXT','PAUSE'].includes(action.type))setClock(false);
   setBusy(true);setError('');
   try{
    const latest=await ctrl.load();
    if(!latest.umfrageduell||latest.recoveryRequired)
     throw Error('Sitzung erfordert zuerst eine Überprüfung');
    setEvent(await ctrl.submit({type:'UD_ACTION',action},latest,crypto.randomUUID()));
   }catch(e){
    setError(errorText(e));
    try{setEvent(await ctrl.load());}catch{/* keep original error */}
   }finally{setBusy(false);}
  });
  queueRef.current=job;
  return job;
 }
 async function reviewRecovery(){
  if(!event?.recoveryRequired||!ready||busy)return;
  if(!window.confirm('Alle Teamantworten, Zuordnungen und Wertungen überprüft? Danach bleibt die Sitzung pausiert.'))return;
  const ctrl=controllerRef.current;if(!ctrl)return;
  setBusy(true);setError('');
  try{setEvent(await ctrl.submit({type:'RECOVERY_CONFIRM'},event,crypto.randomUUID()));}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 function revise(teamId:string,position:number,kind:'answers'|'mapped',value:string){
  const current=draftsRef.current[teamId]??empty(count);
  const next={answers:[...current.answers],mapped:[...current.mapped]};
  if(kind==='answers'){
   next.answers[position]=value;
   next.mapped[position]=task?suggestMatch(task,value):null;
  }else next.mapped[position]=value===''?null:Number(value) as Rank;
  // Ref updates synchronously during input events, before a rapid Save click.
  const updated={...draftsRef.current,[teamId]:next};
  draftsRef.current=updated;
  setDrafts(updated);
 }
 function collect(tid:string):Submission{
  const value=draftsRef.current[tid]??empty(count);
  if(value.answers.every(x=>!x.trim()))return {answers:[],mapped:[]};
  return {answers:[...value.answers],mapped:[...value.mapped]};
 }
 function saveTeam(tid:string){
  const submission=collect(tid);
  if(submission.answers.length>0&&submission.answers.some(x=>!x.trim())){
   setError('Bitte alle '+count+' Antworten ausfüllen oder das Team als „Keine Antwort“ erfassen.');return;
  }
  if(ud?.phase==='graded'){
   const reason=window.prompt('Grund für diese Wertungskorrektur:');
   if(reason?.trim()&&reason.trim().length>=3)void send({type:'CORRECT',teamId:tid,submission,reason:reason.trim()});
  }else void send({type:'RECORD',teamId:tid,submission});
 }
 function annul(){
  const reason=window.prompt('Grund für das Annullieren dieser Aufgabe:');
  if(reason?.trim()&&reason.trim().length>=3)void send({type:'ANNUL',reason:reason.trim()});
 }
 if(!identity)return <section className="exp-empty"><h2>Keine Spielleitung</h2><a href="#/spielen">Spielen öffnen</a></section>;
 const teams=ud?orderedTeams(ud):[],raw=ud?scores(ud):{};
 const blocked=!ready||busy||ud?.paused||event?.recoveryRequired;
 const readyToReveal=Boolean(ud?.phase==='closed'&&teams.every(t=>ud.submissions[t.id]));
 return <section className="ud-host" data-host-game="umfrageduell" aria-label="Umfrageduell Spielleitung">
  <header className="ud-host-head"><div><span className="eyebrow">G9 · SPIELMODUS IM TEST</span>
   <h2>Umfrageduell</h2><p>Alle Teams antworten. Die Spielleitung ordnet Antworten den festgelegten Kategorien zu.
    Die Beameransicht verrät keine Rangfolge vor der Auflösung.</p></div>
   <span className="g3-tech-tag">PROBEINHALTE</span></header>
  <div className="ud-toolbar"><a href={stageUrl(identity.eventId)} target="_blank" rel="noopener noreferrer">Beamer öffnen ↗</a>
   <span>{viewers} Beamer bestätigt</span><span>Revision {event?.revision??0}</span><a href="#/spielen">Übersicht</a></div>
  {!ud?<p role="status">Sitzung wird geladen …</p>:<>
   <HostModerationGuide game="umfrageduell" phase={ud.phase} paused={ud.paused}
      recovery={Boolean(event?.recoveryRequired)} completed={ud.phase==='complete'?ud.surveys.length:ud.index} total={ud.surveys.length}
      viewers={viewers} ready={ready} busy={busy}/>
    {event&&<CorrectionProvenance event={event}/>}
    <ScoreDecisionPanel source={{game:'umfrageduell',session:ud}} blocked={Boolean(blocked)}/>
    <div className="ud-scorebar">{teams.map(t=><div key={t.id}><span>{t.name}</span><strong>{raw[t.id]??0}</strong></div>)}</div>
   <div className="ud-progress">{ud.surveys.map((item,i)=><span key={item.id}
    className={i<ud.index?'done':i===ud.index?'current':''}>{i+1}<small>{item.format==='top3'?'TOP 3':'TOP 1'}</small></span>)}</div>
   <div className="ud-phase"><span>AUFGABE {Math.min(ud.index+1,ud.surveys.length)} / {ud.surveys.length}</span>
    <strong>{ud.paused?'PAUSIERT':ud.phase.toUpperCase()}</strong></div>
   {event?.recoveryRequired&&<div role="alert" className="rq-recovery">
    <h3>Wiederhergestellte Sitzung prüfen</h3><p>Antworten und Zuordnungen sind erhalten. Der Beamer bleibt gesperrt.</p>
    <button disabled={!ready||busy} onClick={()=>void reviewRecovery()}>Wiederherstellung bestätigen</button></div>}
   {ud.phase!=='setup'&&ud.phase!=='complete'&&<div className="ud-pause">
    {ud.paused?<button data-host-resume disabled={!ready||busy||event?.recoveryRequired}
     onClick={()=>void send({type:'RESUME'})}>Spiel ausdrücklich fortsetzen</button>:
     <button disabled={blocked} onClick={()=>void send({type:'PAUSE'})}>Pausieren</button>}</div>}
   {ud.phase==='setup'&&<div className="ud-card"><h3>Umfragen vorbereiten</h3>
    <p>Alle enthaltenen Verteilungen sind frei erfundene Spieldaten, keine Umfrageergebnisse realer Personen.</p>
    <p>{ud.surveys.length} Aufgaben: {ud.surveys.filter(q=>q.format==='popular').length} × Beliebteste Antwort,
     {' '}{ud.surveys.filter(q=>q.format==='top3').length} × Top 3.</p>
    <button data-host-next className="g3-tech-primary" disabled={!ready||busy} onClick={()=>void send({type:'START'})}>Aufgabenfolge bestätigen</button></div>}
   {task&&ud.phase!=='setup'&&<div className="ud-card">
    <div className="eyebrow">{task.format==='popular'?'BELIEBTESTE ANTWORT':'TOP 3'} · {ud.index+1} / {ud.surveys.length}</div>
    <div className="ud-origin">{task.source.kind==='illustrative'?'BEISPIELDATEN – KEINE ECHTE UMFRAGE':
      'Echte Umfrage: '+task.source.source+' · '+task.source.population}</div>
    <h3>{task.prompt}</h3>
    <div className="ud-private"><small>NUR SPIELLEITUNG · FESTE MUSTERRANGFOLGE</small>
     {task.categories.map((c,i)=><div key={c.label}><b>{i+1}. {c.label}</b>
      <small>Synonyme: {c.synonyms.join(', ')||'keine'}</small></div>)}
    </div>
    {ud.phase==='ready'&&<button data-host-next className="g3-tech-primary" disabled={blocked}
     onClick={()=>void send({type:'PUBLISH'})}>Aufgabe veröffentlichen</button>}
    {ud.phase==='open'&&<>
     <div className="ud-clock"><div><span>OPTIONALER TIMER</span><strong>{seconds} s</strong>
      <small>Keine automatische Schließung oder Enthüllung.</small></div>
      <button disabled={blocked||clock||seconds===0} onClick={()=>setClock(true)}>Start</button>
      <button disabled={!clock} onClick={()=>setClock(false)}>Stopp</button>
      <button disabled={blocked} onClick={()=>{setClock(false);setSeconds(limit);}}>Zurücksetzen</button>
     </div>
     <p>Teams diskutieren und notieren ihre Antwort. Erst nach dem bewussten Schließen werden die Zuordnungen erfasst.</p>
     <button data-host-next className="g3-tech-primary" disabled={blocked}
      onClick={()=>void send({type:'CLOSE'})}>Alle Antworten schließen</button>
    </>}
    {(ud.phase==='closed'||ud.phase==='graded')&&<div className="ud-judging">
     <h4>{ud.phase==='closed'?'Teamantworten und Kategorien zuordnen':'Auditierte Wertungskorrektur'}</h4>
     <p>{task.format==='popular'?'Eine Antwort pro Team – Rang 1 bis 5 oder außerhalb.':
       'Drei geordnete Antworten – doppelte Kategorien erhalten nur bei erster Nennung Punkte.'}
      {' '}Die App schlägt genaue Synonym-Treffer vor; die Spielleitung entscheidet.</p>
     {teams.map(t=>{
      const draft=drafts[t.id]??empty(count),prior=ud.submissions[t.id];
      const value=prior??{answers:[],mapped:[]},points=prior?pointsFor(task,value):null;
      const previousAward=ud.awards.find(a=>a.surveyId===task.id&&a.teamId===t.id);
      return <div key={t.id} className="ud-team">
       <div className="ud-team-head"><strong>{t.name}</strong>
        <span>{ud.phase==='graded'?'Bestätigt: '+(previousAward?.points??0)+' Punkte':
         prior?'Erfasst: '+points+' Punkte':'Noch nicht erfasst'}</span></div>
       {Array.from({length:count},(_,i)=><div key={i} className="ud-entry">
        <label>Antwort {i+1}
         <input value={draft.answers[i]??''} onChange={e=>revise(t.id,i,'answers',e.target.value)}
          disabled={blocked||(ud.phase==='graded'&&Boolean(previousAward?.annulled))}
          placeholder="Antwort des Teams"/></label>
        <label>Zuordnung
         <select value={draft.mapped[i]??''} onChange={e=>revise(t.id,i,'mapped',e.target.value)}
          disabled={blocked||(ud.phase==='graded'&&Boolean(previousAward?.annulled))}>
          <option value="">Nicht in den Top 5</option>
          {task.categories.map((cat,idx)=><option key={cat.label} value={idx+1}>
           {idx+1}. {cat.label}</option>)}</select></label>
       </div>)}
       <div className="ud-team-footer">
        <small>Alle Felder leer = Keine Antwort · {prior?'Bereits gespeichert':'Ausstehend'}</small>
        <button disabled={blocked||(ud.phase==='graded'&&Boolean(previousAward?.annulled))}
         onClick={()=>saveTeam(t.id)}>{ud.phase==='graded'?'Begründet korrigieren':'Antwort erfassen'}</button>
       </div>
      </div>;
     })}
     {ud.phase==='closed'&&<button data-host-next className="g3-tech-primary" disabled={blocked||!readyToReveal}
      onClick={()=>void send({type:'REVEAL'})}>Kategorien und Rangfolge veröffentlichen</button>}
    </div>}
    {ud.phase==='revealed'&&<div className="ud-reveal-preview"><h4>Rangfolge ist öffentlich</h4>
     {task.categories.map((cat,i)=><p key={cat.label}>{i+1}. {cat.label}</p>)}
     <button data-host-next className="g3-tech-primary" disabled={blocked}
      onClick={()=>void send({type:'CONFIRM'})}>Teamwertungen verbindlich bestätigen</button>
    </div>}
    {ud.phase==='graded'&&<>
     <div className="ud-awards">{ud.awards.filter(a=>a.surveyId===task.id).map(a=><p key={a.teamId}>
      {teams.find(t=>t.id===a.teamId)?.name}: <b>{a.points} Punkte</b>{a.annulled?' · Annulliert':''}</p>)}</div>
     <button data-host-next className="g3-tech-primary" disabled={blocked} onClick={()=>void send({type:'NEXT'})}>
      {ud.index===ud.surveys.length-1?'Umfrageduell abschließen':'Nächste Aufgabe'}</button>
    </>}
    {ud.phase!=='graded'&&<button className="ud-annul" disabled={blocked} onClick={annul}>
     Aufgabe begründet annullieren</button>}
   </div>}
   {ud.phase==='complete'&&<div className="ud-card ud-final"><h3>Umfrageduell abgeschlossen</h3>
    {teams.map(t=><p key={t.id}>{t.name}: <b>{raw[t.id]??0} Spielpunkte</b>
     {' '}· {(eveningHalfPoints(ud)[t.id]??0)/2} Abendpunkte</p>)}
    <a href="#/verlauf" className="exp-primary">Abendbericht ansehen</a>
   </div>}
  </>}
  {error&&<p role="alert" className="g3-tech-error">{error}</p>}
   {error&&<SafeErrorRecovery message={String(error)}/>}
  <p className="exp-footnote">G9 bleibt ein Testmodus. Daten und Rangfolgen des Probeprogramms wurden nicht durch echte Befragungen ermittelt.</p>
 </section>;
}
