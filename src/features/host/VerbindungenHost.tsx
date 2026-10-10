import {CorrectionProvenance,SafeErrorRecovery} from './CorrectionProvenance';
import {ScoreDecisionPanel} from './ScoreDecisionPanel';
import {loadSafelyPausedVerbindungen} from './verbindungen-load';
import {HostModerationGuide} from './HostModerationGuide';
import {useEffect,useRef,useState} from 'react';
import {EventRepository} from '../../infrastructure/db/event-repository';
import {HostSessionController} from '../../application/host-controller/host-session';
import {BrowserStagePort,stageUrl} from '../stage/protocol';
import {HostStagePublisher} from '../stage/host-publisher';
import type {EventRecord} from '../../domain/event/schemas';
import {
 active,teamsInOrder,wallAwards,scores,eveningHalfPoints,NEEDS,
 type Action
} from '../../games/verbindungen/engine';
import {readHostIdentity} from '../experience/model';

const errorText=(error:unknown)=>error instanceof Error?error.message:'Aktion fehlgeschlagen';
export function VerbindungenHost(){
 const identity=readHostIdentity();
 const [event,setEvent]=useState<EventRecord|null>(null);
 const [error,setError]=useState('');
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[viewers,setViewers]=useState(0);
 const controllerRef=useRef<HostSessionController|null>(null);
 const [seconds,setSeconds]=useState(0),[clock,setClock]=useState(false);
 const lastTick=useRef(Date.now());
 const vb=event?.verbindungen;
 const task=vb?.phase==='complete'?null:vb?active(vb):null;
 const timerLimit=task?.puzzle.kind==='wall'?180:task?.puzzle.kind==='sequence'?45:30;

 useEffect(()=>{
  if(!identity)return;
  const db=new EventRepository();let disposed=false;
  let publisher:HostStagePublisher;
  try{
   publisher=new HostStagePublisher(identity.eventId,identity.hostId,db,
    new BrowserStagePort(identity.eventId),status=>{
      if(!disposed&&status==='revoked'){
       setReady(false);setError('Andere Spielleitung hat die Host-Berechtigung übernommen.');
      }
    },count=>{if(!disposed)setViewers(count);});
   publisher.start();
  }catch(e){setError(errorText(e));void db.close();return;}
  const controller=new HostSessionController(db,identity.eventId,identity.hostId,
   ()=>{void publisher.refresh();});
  controllerRef.current=controller;
  void loadSafelyPausedVerbindungen(controller).then(record=>{
   if(!disposed){setEvent(record);setReady(true);}
  }).catch(e=>{if(!disposed)setError(errorText(e));});
  const interval=window.setInterval(()=>{void publisher.refresh();},1600);
  return ()=>{disposed=true;controllerRef.current=null;window.clearInterval(interval);publisher.stop();void db.close();};
 },[identity?.eventId,identity?.hostId]);

 useEffect(()=>{setClock(false);setSeconds(timerLimit);},[vb?.index,vb?.phase,vb?.clueIndex,vb?.paused,timerLimit]);
 useEffect(()=>{
  if(!clock||vb?.paused||seconds===0)return;
  lastTick.current=Date.now();
  const timer=window.setInterval(()=>{
   const now=Date.now(),delta=Math.floor((now-lastTick.current)/1000);
   if(delta<1)return;lastTick.current+=delta*1000;
   setSeconds(n=>Math.max(0,n-delta));
  },250);
  return ()=>window.clearInterval(timer);
 },[clock,vb?.paused,vb?.index,vb?.phase,seconds===0]);
 useEffect(()=>{if(seconds===0)setClock(false);},[seconds]);

 async function send(action:Action){
  if(!ready||busy||!event||event.recoveryRequired)return;
  const controller=controllerRef.current;if(!controller)return;
  if(['JUDGE','CLOSE_WALL','REVEAL_WALL_GROUP','REVEAL','CONFIRM','PAUSE','NEXT'].includes(action.type))
   setClock(false);
  setBusy(true);setError('');
  try{
   const result=await controller.submit({type:'VB_ACTION',action},event,crypto.randomUUID());
   setEvent(result);
  }catch(e){
   setError(errorText(e));
   try{setEvent(await controller.load());}catch{/* Original error retained */}
  }finally{setBusy(false);}
 }
 async function reviewRecovery(){
  if(!event?.recoveryRequired||!ready||busy)return;
  if(!window.confirm('Aufgabe, Wertungen und Beamerzustand geprüft? Die Sitzung bleibt danach pausiert.'))return;
  const controller=controllerRef.current;if(!controller)return;
  setBusy(true);setError('');
  try{setEvent(await controller.submit({type:'RECOVERY_CONFIRM'},event,crypto.randomUUID()));}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 function annul(){
  const reason=window.prompt('Grund für die Annullierung:');
  if(reason&&reason.trim().length>=3)void send({type:'ANNUL',reason:reason.trim()});
 }
 if(!identity)return <div className="exp-empty"><h2>Kein Quizabend gewählt</h2><a href="#/spielen">Zu Spielen</a></div>;
 const teams=vb?teamsInOrder(vb):[],totals=vb?scores(vb):{};
 const disabled=!ready||busy||vb?.paused||event?.recoveryRequired;
 const wall=task?.puzzle.kind==='wall'?task.puzzle:null;
 const canRevealNext=!vb||!wall||vb.revealedGroups===0||
   teams.every(t=>Boolean(vb.wallMarks[t.id]?.[wall.groups[vb.revealedGroups-1]?.id??'']));
 const canConfirmWall=vb&&wall&&vb.revealedGroups===4&&(()=>{
  try{wallAwards(vb);return true;}catch{return false;}
 })();
 const sectionName=task?.puzzle.kind==='clues'?'Vier Hinweise':
   task?.puzzle.kind==='sequence'?'Folge ergänzen':'Verbindungswand';
 const activeTeam=teams.find(t=>t.id===task?.assignment.teamId);
 return <section className="vb-host" data-host-game="verbindungen" aria-label="Verbindungen Spielleitung">
  <header className="vb-host-head"><div><span className="eyebrow">G7 · SPIELMODUS IM TEST</span>
   <h2>Verbindungen</h2><p>Gemeinsam Zusammenhänge erkennen – mit fairen Teamaufgaben und einer Verbindungswand.</p></div>
   <span className="g3-tech-tag">PROBEINHALTE</span></header>
  <div className="vb-host-toolbar">
   <a href={stageUrl(identity.eventId)} className="g3-tech-link" target="_blank" rel="noopener noreferrer">Beamer öffnen ↗</a>
   <span>{viewers} Beamer bestätigt</span><span>Revision {event?.revision??0}</span>
   <a href="#/spielen">Zur Übersicht</a></div>
  {!vb?<p role="status">Sitzung wird geprüft …</p>:<>
   <HostModerationGuide game="verbindungen" phase={vb.phase} paused={vb.paused}
      recovery={Boolean(event?.recoveryRequired)} completed={vb.phase==='complete'?vb.assignments.length:vb.index} total={vb.assignments.length}
      viewers={viewers} ready={ready} busy={busy}/>
    {event&&<CorrectionProvenance event={event}/>}
    <ScoreDecisionPanel source={{game:'verbindungen',session:vb}} blocked={Boolean(disabled)}/>
    <div className="vb-scorebar">{teams.map(t=><div key={t.id}><span>{t.name}</span>
    <strong>{totals[t.id]??0}</strong></div>)}</div>
   <div className="vb-active-row"><div><small>TEIL / AUFGABE</small><strong>{task?sectionName:'Endstand'} · {Math.min(vb.index+1,vb.assignments.length)}/{vb.assignments.length}</strong></div>
    <div><small>AKTIVES TEAM</small><strong>{activeTeam?.name??'Alle Teams'}</strong></div>
    <div><small>SPIELSTATUS</small><strong>{vb.paused?'PAUSIERT':vb.phase.toUpperCase()}</strong></div></div>
   {event?.recoveryRequired&&<div className="rq-recovery" role="alert"><strong>Wiederhergestellten Spielstand prüfen</strong>
    <p>Kontrolliere Wertungen, Hinweise und Gruppen. Die Projektion bleibt bis zur Bestätigung ausgeblendet.</p>
    <button disabled={!ready||busy} data-host-next className="g3-tech-primary" onClick={()=>void reviewRecovery()}>Prüfung bestätigen — pausiert bleiben</button>
   </div>}
   {vb.phase!=='complete'&&vb.phase!=='setup'&&<div className="vb-pause">
    {vb.paused?<button data-host-resume disabled={!ready||busy||event?.recoveryRequired} onClick={()=>void send({type:'RESUME'})}>Spiel ausdrücklich fortsetzen</button>
      :<button disabled={disabled} onClick={()=>void send({type:'PAUSE'})}>Pausieren</button>}
   </div>}
   {vb.phase==='setup'&&<div className="vb-card"><h3>Verbindungen vorbereiten</h3>
    <p>{NEEDS[vb.profile].clues}× Vier Hinweise und {NEEDS[vb.profile].sequences}× Folge ergänzen pro Team; anschließend eine gemeinsame Wand.</p>
    <button data-host-next className="g3-tech-primary" disabled={!ready||busy} onClick={()=>void send({type:'START'})}>Aufgabenreihenfolge bestätigen</button></div>}
   {task&&vb.phase!=='setup'&&vb.phase!=='complete'&&<div className="vb-card">
    <div className="eyebrow">{sectionName} · {task.assignment.teamId?activeTeam?.name:'Alle Teams'}</div>
    {task.puzzle.kind==='clues'&&<>
     <h3>Welche Person ist gesucht?</h3>
     <div className="vb-private"><small>PRIVATE LÖSUNG</small><strong>{task.puzzle.target}</strong><span>{task.puzzle.reference}</span></div>
     {vb.phase!=='ready'&&<div className="vb-clues">{task.puzzle.clues.slice(0,vb.clueIndex).map((clue,i)=>
       <p key={i}><b>{i+1}.</b> {clue}</p>)}</div>}
     {vb.phase==='clue-open'&&<p className="vb-potential">Punktwert bei sofort richtiger Antwort: <strong>{(5-vb.clueIndex)*10}</strong></p>}
    </>}
    {task.puzzle.kind==='sequence'&&<>
     <h3>{task.puzzle.prompt}</h3>
     <div className="vb-sequence-items">{task.puzzle.items.map((item,i)=><span key={i}>{item}</span>)}<b>?</b></div>
     <div className="vb-private"><small>PRIVATE LÖSUNG</small><strong>{task.puzzle.answer}</strong><span>{task.puzzle.explanation} · {task.puzzle.reference}</span></div>
    </>}
    {wall&&<>
     <h3>Verbindungswand</h3>
     <p>Alle Teams ordnen 16 Begriffe in vier Vierergruppen und benennen die jeweilige Verbindung (je 5 + 5 Punkte).</p>
     <div className="vb-wall-grid">{wall.tiles.map(tile=>{
      const solved=wall.groups.find((g,i)=>i<vb.revealedGroups&&g.tileIds.includes(tile.id));
      return <div key={tile.id} className={solved?'solved':''}><strong>{tile.label}</strong>
       {solved&&<small>{solved.link}</small>}</div>;
     })}</div>
     {vb.phase==='wall-reveal'&&vb.revealedGroups>0&&wall.groups.slice(0,vb.revealedGroups).map((group,groupIndex)=>
      <div className="vb-marking" key={group.id}>
       <h4>Gruppe {groupIndex+1}: {group.link}</h4>
       <p>{group.tileIds.map(id=>wall.tiles.find(t=>t.id===id)?.label??id).join(' · ')}</p>
       {teams.map(t=>{
        const mark=vb.wallMarks[t.id]?.[group.id];
        return <div className="vb-mark-row" key={t.id}>
         <strong>{t.name}</strong>
         <button disabled={disabled} aria-pressed={mark?.group===true}
          onClick={()=>void send({type:'MARK_GROUP',teamId:t.id,groupId:group.id,correct:true})}>Vierergruppe richtig</button>
         <button disabled={disabled} aria-pressed={mark?.group===false}
          onClick={()=>void send({type:'MARK_GROUP',teamId:t.id,groupId:group.id,correct:false})}>Nicht richtig</button>
         {mark?.group&&<>
           <button disabled={disabled} aria-pressed={mark.link}
            onClick={()=>void send({type:'MARK_LINK',teamId:t.id,groupId:group.id,correct:true})}>Verbindung richtig</button>
           <button disabled={disabled} aria-pressed={!mark.link}
            onClick={()=>void send({type:'MARK_LINK',teamId:t.id,groupId:group.id,correct:false})}>Verbindung nicht richtig</button>
         </>}
        </div>;
       })}
      </div>
     )}
    </>}
    {(vb.phase==='clue-open'||vb.phase==='sequence-open'||vb.phase==='wall-open')&&<div className="vb-timer">
     <div><small>OPTIONALER TIMER</small><strong>{seconds} s</strong>
      <span>Keine automatische Abgabe oder Enthüllung.</span></div>
     <button disabled={disabled||clock||seconds===0} onClick={()=>setClock(true)}>Start</button>
     <button disabled={!clock} onClick={()=>setClock(false)}>Stopp</button>
     <button disabled={disabled} onClick={()=>{setClock(false);setSeconds(timerLimit);}}>Zurücksetzen</button>
    </div>}
    <div className="vb-actions">
     {vb.phase==='ready'&&<button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'PUBLISH'})}>Aufgabe veröffentlichen</button>}
     {vb.phase==='clue-open'&&<>
      {!vb.judgement&&vb.clueIndex<4&&<button disabled={disabled} onClick={()=>void send({type:'NEXT_CLUE'})}>Nächster Hinweis</button>}
      {!vb.judgement&&<><button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'correct'})}>Richtige Antwort</button>
       <button disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'wrong'})}>Falsche Antwort</button>
       <button disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'none'})}>Keine Antwort</button></>}
      {vb.judgement&&<button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'REVEAL'})}>Lösung veröffentlichen</button>}
     </>}
     {vb.phase==='sequence-open'&&<>
      {!vb.judgement&&<><button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'correct'})}>Richtig (+20)</button>
       <button disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'wrong'})}>Falsch (0)</button>
       <button disabled={disabled} onClick={()=>void send({type:'JUDGE',value:'none'})}>Keine Antwort (0)</button></>}
      {vb.judgement&&<button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'REVEAL'})}>Lösung veröffentlichen</button>}
     </>}
     {vb.phase==='wall-open'&&<button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'CLOSE_WALL'})}>Alle Antworten schließen</button>}
     {(vb.phase==='wall-closed'||vb.phase==='wall-reveal')&&vb.revealedGroups<4&&
       <button data-host-next className="g3-tech-primary" disabled={disabled||!canRevealNext} onClick={()=>void send({type:'REVEAL_WALL_GROUP'})}>
        Gruppe {vb.revealedGroups+1} bewusst auflösen
       </button>}
     {vb.phase==='revealed'&&<><p>Antwort: {task.puzzle.kind==='clues'?task.puzzle.target:task.puzzle.kind==='sequence'?task.puzzle.answer:''}</p>
      <p>Punktevorschau: {vb.judgement==='correct'?(task.puzzle.kind==='clues'?(5-vb.clueIndex)*10:20):0} Punkte.</p>
      <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'CONFIRM'})}>Wertung verbindlich bestätigen</button></>}
     {vb.phase==='wall-reveal'&&vb.revealedGroups===4&&<>
      <div className="vb-preview">{teams.map(t=>{
       const marks=vb.wallMarks[t.id]??{};
       const pts=wall?.groups.reduce((sum,g)=>sum+(marks[g.id]?.group?5+(marks[g.id]?.link?5:0):0),0)??0;
       return <span key={t.id}>{t.name}: {pts} / 40</span>;
      })}</div>
      <button data-host-next className="g3-tech-primary" disabled={disabled||!canConfirmWall}
       onClick={()=>void send({type:'CONFIRM'})}>Alle Gruppenwertungen bestätigen</button>
      {!canConfirmWall&&<small>Für jedes Team und jede Gruppe eine Wertung erfassen.</small>}
     </>}
     {vb.phase==='graded'&&<>
      {!vb.awards.some(a=>a.puzzleId===task.puzzle.id&&a.annulled)&&<button disabled={disabled} onClick={()=>void send({type:'CORRECT'})}>Letzte Wertung korrigieren</button>}
      <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'NEXT'})}>
        {vb.index===vb.assignments.length-1?'Verbindungen abschließen':'Nächste Aufgabe'}
      </button>
     </>}
     {!['graded'].includes(vb.phase)&&<button disabled={disabled} className="vb-annul" onClick={annul}>Aufgabe begründet annullieren</button>}
    </div>
   </div>}
   {vb.phase==='complete'&&<div className="vb-final"><h3>Verbindungen abgeschlossen</h3>
    {teams.map(t=><p key={t.id}>{t.name}: {totals[t.id]??0} Spielpunkte · {(eveningHalfPoints(vb)[t.id]??0)/2} Abendpunkte</p>)}
    <a href="#/verlauf" className="exp-primary">Abendbericht ansehen</a></div>}
  </>}
  {error&&<p className="g3-tech-error" role="alert">{error}</p>}
   {error&&<SafeErrorRecovery message={String(error)}/>}
  <p className="exp-footnote">G7 Probeinhalte. Keine automatische Wertung, keine unbegrenzten Rateversuche und keine teilrichtigen Vierergruppen.</p>
 </section>;
}
