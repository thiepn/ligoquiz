import {CorrectionProvenance,SafeErrorRecovery} from './CorrectionProvenance';
import {ScoreDecisionPanel} from './ScoreDecisionPanel';
import {loadSafelyPausedQuiztafel} from './quiztafel-load';
import {HostModerationGuide} from './HostModerationGuide';
import { useEffect, useRef, useState } from 'react';
import { EventRepository } from '../../infrastructure/db/event-repository';
import { HostSessionController } from '../../application/host-controller/host-session';
import { BrowserStagePort, stageUrl } from '../stage/protocol';
import { HostStagePublisher } from '../stage/host-publisher';
import type { EventRecord } from '../../domain/event/schemas';
import {
  DEPTH, orderedTeams, selector, eligibleStealer, selectedTile, scores,
  eveningHalfPoints, type Action,
} from '../../games/quiztafel/engine';
import { readHostIdentity } from '../experience/model';

const errorText=(v:unknown)=>v instanceof Error?v.message:'Aktion fehlgeschlagen';

export function QuiztafelHost(){
  const identity=readHostIdentity();
  const [event,setEvent]=useState<EventRecord|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [connected,setConnected]=useState(0);
  const [ready,setReady]=useState(false);
  const controllerRef=useRef<HostSessionController|null>(null);
  const [timeLeft,setTimeLeft]=useState(20);
  const [clockRunning,setClockRunning]=useState(false);
  const timerNow=useRef(Date.now());
  const qt=event?.quiztafel;
  const timePhase=qt?.phase==='question'?'first':qt?.phase==='steal'?'steal':'idle';

  useEffect(()=>{
    if(!identity)return;
    let disposed=false;
    const db=new EventRepository();
    let publisher:HostStagePublisher;
    try{
      publisher=new HostStagePublisher(identity.eventId,identity.hostId,db,
        new BrowserStagePort(identity.eventId),
        status=>{if(!disposed&&status==='revoked'){
          setReady(false);setError('Die Hostberechtigung wurde von einem anderen Fenster übernommen.');
        }},
        count=>{if(!disposed)setConnected(count);});
      publisher.start();
    }catch(e){setError(errorText(e));void db.close();return;}
    const controller=new HostSessionController(db,identity.eventId,identity.hostId,
      ()=>{void publisher.refresh();});
    controllerRef.current=controller;
    void loadSafelyPausedQuiztafel(controller).then(current=>{
      if(!disposed){setEvent(current);setReady(true);}
    }).catch(e=>{if(!disposed)setError(errorText(e));});
    const ticker=window.setInterval(()=>{void publisher.refresh();},1600);
    return ()=>{
      disposed=true;controllerRef.current=null;
      window.clearInterval(ticker);publisher.stop();void db.close();
    };
  },[identity?.eventId,identity?.hostId]);

  useEffect(()=>{
    setClockRunning(false);
    setTimeLeft(timePhase==='steal'?10:20);
  },[timePhase,qt?.selectedTileId,qt?.paused]);
  useEffect(()=>{
    if(!clockRunning||qt?.paused||timePhase==='idle')return;
    timerNow.current=Date.now();
    const timer=window.setInterval(()=>{
      const now=Date.now(),elapsed=Math.floor((now-timerNow.current)/1000);
      if(elapsed<1)return;
      timerNow.current+=elapsed*1000;
      setTimeLeft(prev=>Math.max(0,prev-elapsed));
    },250);
    return ()=>window.clearInterval(timer);
  },[clockRunning,qt?.paused,timePhase]);
  useEffect(()=>{if(timeLeft===0)setClockRunning(false);},[timeLeft]);

  async function send(action:Action){
    if(!ready||busy||!event||event.recoveryRequired)return;
    const controller=controllerRef.current;if(!controller)return;
    if(['PRIMARY','STEAL','PAUSE','REVEAL','ANNUL','NEXT'].includes(action.type))
      setClockRunning(false);
    setBusy(true);setError('');
    try{
      const updated=await controller.submit({type:'QT_ACTION',action},event,crypto.randomUUID());
      setEvent(updated);
    }catch(e){
      setError(errorText(e));
      try{setEvent(await controller.load());}catch{/* Show original error */}
    }finally{setBusy(false);}
  }
  async function acceptRecovery(){
    if(!event?.recoveryRequired||busy||!ready)return;
    if(!window.confirm('Spielstand, geschlossene Felder und Punkte geprüft? Das Spiel bleibt nach Bestätigung pausiert.'))return;
    const controller=controllerRef.current;if(!controller)return;
    setBusy(true);
    try{setEvent(await controller.submit({type:'RECOVERY_CONFIRM'},event,crypto.randomUUID()));}
    catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  function annul(){
    const reason=window.prompt('Grund für die Annullierung des aktuellen Feldes:');
    if(reason?.trim() && reason.trim().length>=3)
      void send({type:'ANNUL',reason:reason.trim()});
  }
  const tile=qt?selectedTile(qt):null;
  const teams=qt?orderedTeams(qt):[];
  const tally=qt?scores(qt):{};
  const playing=qt&&!qt.paused&&!event?.recoveryRequired;
  const disabled=busy||!ready||!playing;
  const selectorTeam=qt?selector(qt):null;
  const stealer=qt?eligibleStealer(qt):null;
  const currentCategory=qt?.categories.find(c=>c.id===tile?.categoryId);
  const awardee=qt?.candidate==='selector'?selectorTeam:qt?.candidate==='stealer'?stealer:null;
  const inPrivateSelection=qt?.phase==='prepared';

  if(!identity)return <div className="qt-host exp-empty">
    <h2>Keine Sitzung ausgewählt</h2><a href="#/spielen" className="exp-secondary">Spielstände</a>
  </div>;
  return <section className="qt-host" data-host-game="quiztafel" aria-label="Quiztafel Spielleitung">
    <header className="qt-host-header">
      <div><span className="eyebrow">G6 · SPIELMODUS IM TEST</span><h2>Quiztafel</h2>
        <p>Jedes Team wählt reihum ein Feld. Genau eine Übernahmechance bei einem Fehlversuch.</p></div>
      <span className="g3-tech-tag">PROBEINHALTE</span>
    </header>
    <div className="qt-host-toolbar">
      <a className="g3-tech-link" href={stageUrl(identity.eventId)} target="_blank" rel="noopener noreferrer">
        Beamer öffnen ↗
      </a>
      <span>{connected} Beamer bestätigt</span>
      {event&&<span>Revision {event.revision} · {qt?.profile}</span>}
      <a href="#/spielen">Zur Übersicht</a>
    </div>
    {!qt&&<p role="status">Quiztafel-Sitzung wird geprüft …</p>}
    {qt&&<>
      <HostModerationGuide game="quiztafel" phase={qt.phase} paused={qt.paused}
      recovery={Boolean(event?.recoveryRequired)} completed={qt.usedTileIds.length} total={qt.tiles.length}
      viewers={connected} ready={ready} busy={busy}/>
    {event&&<CorrectionProvenance event={event}/>}
    <ScoreDecisionPanel source={{game:'quiztafel',session:qt}} blocked={disabled}/>
    <div className="qt-scorebar">{teams.map(team=><div key={team.id}>
        <span>{team.name}</span><strong>{tally[team.id]??0}</strong></div>)}</div>
      <div className="qt-active-row">
        <div><small>AKTUELLES WAHLRECHT</small><strong>{selectorTeam?.name}</strong></div>
        <div><small>FELDER ABGESCHLOSSEN</small><strong>{qt.usedTileIds.length} / {qt.tiles.length}</strong></div>
        <div><small>SPIELPHASE</small><strong>{qt.paused?'PAUSIERT':qt.phase.toUpperCase()}</strong></div>
      </div>
      {event?.recoveryRequired&&<div className="rq-recovery" role="alert">
        <strong>Wiederhergestellten Spielstand prüfen</strong>
        <p>Bitte prüfe Felder, Punkte und die aktuelle Frage. Der Beamer bleibt bis zur ausdrücklichen Bestätigung ausgeblendet.</p>
        <button data-host-next className="g3-tech-primary" disabled={!ready||busy} onClick={()=>void acceptRecovery()}>
          Prüfung bestätigen — pausiert bleiben
        </button>
      </div>}
      {qt.phase!=='complete'&&qt.phase!=='setup'&&<div className="qt-pauser">
        {qt.paused?<button data-host-resume disabled={!ready||busy||event?.recoveryRequired}
          onClick={()=>void send({type:'RESUME'})}>Spiel ausdrücklich fortsetzen</button>:
          <button disabled={disabled} onClick={()=>void send({type:'PAUSE'})}>Spielleitung pausieren</button>}
      </div>}
      {(qt.phase==='board'||qt.phase==='prepared'||qt.phase==='setup')&&<div className="qt-board-host">
        <div className="qt-board-title"><h3>Spieltafel</h3>
          <p>{inPrivateSelection?'Feld nur für die Spielleitung ausgewählt – noch nicht veröffentlicht.':
            'Nur ein offenes Feld wählen. Vergebene Felder bleiben geschlossen.'}</p></div>
        <div className="qt-grid" style={{gridTemplateColumns:'repeat('+qt.categories.length+',minmax(0,1fr))'}}>
          {qt.categories.map(category=><div className="qt-column" key={category.id}>
            <h4>{category.name}</h4>
            {Array.from({length:DEPTH[qt.profile]},(_,index)=>{
              const cell=qt.tiles.find(t=>t.categoryId===category.id&&t.row===index+1);
              if(!cell)return null;
              const played=qt.usedTileIds.includes(cell.id),selected=cell.id===qt.selectedTileId;
              return <button key={cell.id} className={'qt-cell'+(played?' used':'')+(selected?' selected':'')}
                disabled={disabled||played||qt.phase!=='board'} onClick={()=>void send({type:'PICK',tileId:cell.id})}
                title={played?'Bereits abgeschlossen':cell.value+' Punkte'}>
                {played?'—':cell.value}
              </button>;
            })}
          </div>)}
        </div>
        {qt.phase==='setup'&&<button data-host-next className="g3-tech-primary" disabled={!ready||busy}
          onClick={()=>void send({type:'START'})}>Quiztafel auf dem Beamer vorbereiten</button>}
        {qt.phase==='prepared'&&<div className="qt-decision">
          <div><span className="eyebrow">PRIVATE FELDAUSWAHL</span>
            <h3>{currentCategory?.name} / {tile?.value} Punkte</h3>
            <p>{tile?.prompt}</p><p className="qt-internal">Private Lösung: <b>{tile?.answer}</b></p></div>
          <button disabled={disabled} onClick={()=>void send({type:'UNPICK'})}>Auswahl zurücknehmen</button>
          <button data-host-next className="g3-tech-primary" disabled={disabled}
            onClick={()=>void send({type:'PUBLISH'})}>Frage ausdrücklich veröffentlichen</button>
        </div>}
      </div>}
      {tile&&!['prepared','board','setup','complete'].includes(qt.phase)&&<div className="qt-question-host">
        <div className="qt-question-meta"><span>{currentCategory?.name} · {tile.value} Punkte</span>
          <strong>{qt.phase==='steal'?'Übernahme: '+stealer?.name:'Erstantwort: '+selectorTeam?.name}</strong></div>
        <h3>{tile.prompt}</h3>
        <div className="qt-solution-private"><small>PRIVATE LÖSUNG</small><strong>{tile.answer}</strong>
          <span>{tile.reference}</span></div>
        {(qt.phase==='question'||qt.phase==='steal')&&<div className="qt-clock">
          <div><small>OPTIONALE ZEIT</small><strong>{timeLeft} s</strong>
            <span>Nach Ablauf keine automatische Aktion.</span></div>
          <button disabled={disabled||clockRunning||timeLeft===0}
            onClick={()=>setClockRunning(true)}>Start</button>
          <button disabled={!clockRunning} onClick={()=>setClockRunning(false)}>Stopp</button>
          <button disabled={disabled} onClick={()=>{setClockRunning(false);setTimeLeft(qt.phase==='steal'?10:20);}}>Zurücksetzen</button>
        </div>}
        {qt.phase==='question'&&<div className="qt-decisions">
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'PRIMARY',result:'correct'})}>Erstantwort richtig</button>
          <button disabled={disabled} onClick={()=>void send({type:'PRIMARY',result:'wrong'})}>Erstantwort falsch</button>
          <button disabled={disabled} onClick={()=>void send({type:'PRIMARY',result:'none'})}>Keine Antwort</button>
        </div>}
        {qt.phase==='steal-offer'&&<div className="qt-decision">
          <h3>Einmalige Übernahme: {stealer?.name}</h3>
          <p>Dieses Team erhält die einzige Übernahmechance. Kein weiteres Team darf antworten.</p>
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'OFFER_STEAL'})}>Übernahme anbieten</button>
        </div>}
        {qt.phase==='steal'&&<div className="qt-decisions">
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'STEAL',result:'correct'})}>Übernahme richtig</button>
          <button disabled={disabled} onClick={()=>void send({type:'STEAL',result:'wrong'})}>Übernahme falsch</button>
          <button disabled={disabled} onClick={()=>void send({type:'STEAL',result:'none'})}>Keine Antwort</button>
          <button disabled={disabled} onClick={()=>void send({type:'STEAL',result:'declined'})}>Team verzichtet</button>
        </div>}
        {qt.phase==='adjudicated'&&<div className="qt-decision">
          <p>Antwortversuche abgeschlossen. Noch keine Punkte verbucht.</p>
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'REVEAL'})}>Lösung ausdrücklich zeigen</button>
        </div>}
        {qt.phase==='revealed'&&<div className="qt-decision">
          <h3>Punktevorschau</h3>
          <p>{awardee?awardee.name+' erhält +'+tile.value+' Punkte.':'Kein Team erhält Punkte.'}</p>
          <p>Richtige Antwort: {tile.answer}</p>
          <div className="qt-decisions">
            <button disabled={disabled} onClick={()=>void send({type:'ADJUST',winner:'selector'})}>Wertung: Erstantwort</button>
            {qt.stealResult!==null&&<button disabled={disabled}
              onClick={()=>void send({type:'ADJUST',winner:'stealer'})}>Wertung: Übernahme</button>}
            <button disabled={disabled} onClick={()=>void send({type:'ADJUST',winner:'none'})}>Wertung: 0 Punkte</button>
          </div>
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'CONFIRM'})}>Punkte verbindlich bestätigen</button>
        </div>}
        {qt.phase==='awarded'&&<div className="qt-decision">
          <h3>Feld abgeschlossen</h3>
          <p>{qt.annulled?'Aufgabe annulliert: 0 Punkte.':
            (qt.outcomes.find(o=>o.tileId===tile.id)?.winnerId?
              'Punkte vergeben.':'Kein Team erhält Punkte.')}</p>
          {!qt.annulled&&<button disabled={disabled} onClick={()=>void send({type:'CORRECT'})}>Wertung auditiert korrigieren</button>}
          <button data-host-next className="g3-tech-primary" disabled={disabled} onClick={()=>void send({type:'NEXT'})}>
            {qt.usedTileIds.length===qt.tiles.length?'Quiztafel abschließen':'Zurück zur Tafel · nächstes Wahlrecht'}
          </button>
        </div>}
        {qt.phase!=='awarded'&&<button className="qt-annul" disabled={disabled} onClick={annul}>Feld begründet annullieren</button>}
      </div>}
      {qt.phase==='complete'&&<div className="qt-final">
        <h3>Quiztafel beendet</h3>
        {teams.map(team=><p key={team.id}>{team.name}: <b>{tally[team.id]??0}</b> Punkte · Abendpunkte <b>{(eveningHalfPoints(qt)[team.id]??0)/2}</b></p>)}
        <a href="#/verlauf" className="exp-primary">Abendbericht ansehen</a>
      </div>}
    </>}
    {error&&<p role="alert" className="g3-tech-error">{error}</p>}
   {error&&<SafeErrorRecovery message={String(error)}/>}
    <p className="g3-tech-footnote">Quiztafel G6 verwendet vorläufige Übungsinhalte. Keine automatische Enthüllung, Benotung oder Übernahme. Nur gleiche Browser-Origin für Beamer.</p>
  </section>;
}
