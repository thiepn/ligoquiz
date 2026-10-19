import { useEffect, useState } from 'react';
import { EventRepository } from '../../infrastructure/db/event-repository';
import type { EventRecord } from '../../domain/event/schemas';
import { readHostIdentity, writeHostIdentity, reportFor, safeFileName, readSetupDraft } from './model';
import { filterSessions, reportCsv, csvFileName } from './session-tools';
import {BackstageDesk} from './BackstageDesk';
import {BackstageAudit} from './BackstageAudit';
import {backupHref,safeBackstageAudit,type BackstageAuditItem} from './backstage-model';
import '../../styles/g13-organizer.css';
import {GameTile} from '../../design-system/StudioPop';
import {GAME_ORDER,GAME_VISUALS} from '../../design-system/theme';
import type {GameType} from '../../domain/game/contracts';
import {newSetupDraft,readPreferences,saveSetupDraft} from './model';
import './u03-lobby.css';
import {ResultsSpotlight} from './ResultsSpotlight';

type Directory = { items: EventRecord[]; invalidCount: number };
function statusFor(event: EventRecord): string {
  if (event.lifecycle==='complete') return 'Abgeschlossen';
  if (event.recoveryRequired) return 'Überprüfung erforderlich';
  if (event.lifecycle==='paused' || event.rundenquiz?.paused || event.quiztafel?.paused || event.verbindungen?.paused || event.logikleiter?.paused || event.umfrageduell?.paused) return 'Pausiert';
  if (event.lifecycle==='active') return 'Läuft';
  return 'Vorbereitung';
}
function eventProgress(event:EventRecord):string {
  const rq=event.rundenquiz,qt=event.quiztafel,vb=event.verbindungen,ll=event.logikleiter,ud=event.umfrageduell;
  if(ud)return 'Umfrageduell · '+Math.min(ud.index+1,ud.surveys.length)+'/'+ud.surveys.length+' Aufgaben · '+event.teams.length+' Teams';
  if(ll)return 'Logikleiter · '+Math.min(ll.index+1,ll.rungs.length)+'/'+ll.rungs.length+' Stufen · '+event.teams.length+' Teams';
  if(vb)return 'Verbindungen · '+vb.index+'/'+vb.assignments.length+' Aufgaben · '+event.teams.length+' Teams';
  if(qt)return 'Quiztafel · '+qt.usedTileIds.length+'/'+qt.tiles.length+' Felder · '+event.teams.length+' Teams';
  return rq ? 'Rundenquiz · '+(rq.index+1)+'/'+rq.questions.length+' Aufgaben · '+event.teams.length+' Teams' :
    event.program.length+' Spiele · '+event.teams.length+' Teams';
}
function useDirectory(){
  const [dir,setDir]=useState<Directory|null>(null);
  const [error,setError]=useState('');
  const refresh=async()=>{
    const repo=new EventRepository();
    try { setDir(await repo.listSessions()); setError(''); }
    catch(e){setError(e instanceof Error?e.message:'Spielstände konnten nicht geladen werden.');}
    finally{await repo.close();}
  };
  useEffect(()=>{void refresh();},[]);
  return {dir,error,refresh};
}

function ResumeButton({event,onError}:{event:EventRecord;onError:(s:string)=>void}){
 const [busy,setBusy]=useState(false);
 async function resume(){
  if(busy)return;
  setBusy(true);
  const existing=readHostIdentity();
  const matched=existing?.eventId===event.id&&existing?.hostId===event.hostId;
  try {
    if(!matched){
      const answer=window.confirm(
        'Diese Sitzung wird von einer anderen oder verlorenen Spielleitung kontrolliert. Die Übernahme pausiert das Spiel und sperrt frühere Hostfenster. Wirklich übernehmen?'
      );
      if(!answer)return;
      const repo=new EventRepository();
      try {
        const latest=await repo.get(event.id);
        if(!latest||latest.lifecycle==='complete')throw new Error('Sitzung ist abgeschlossen oder nicht verfügbar.');
        const newHostId=crypto.randomUUID();
        await repo.takeover({
          eventId:event.id,commandId:crypto.randomUUID(),newHostId,
          expectedRevision:latest.revision,expectedEpoch:latest.hostEpoch,
          at:Date.now(),reason:'Explizite Wiederaufnahme durch die Spielleitung',acknowledged:true,
        });
        writeHostIdentity({eventId:event.id,hostId:newHostId});
      } finally {await repo.close();}
    } else if(existing) {
      writeHostIdentity(existing);
    }
    window.location.hash='#/host';
  }catch(e){onError(e instanceof Error?e.message:'Wiederaufnahme fehlgeschlagen.');}
  finally{setBusy(false);}
 }
 return <button className="exp-primary" disabled={busy} onClick={()=>void resume()}>
  {event.lifecycle==='draft'?'Vorbereitung fortsetzen':'Spielstand prüfen und fortsetzen'}</button>;
}

export function OrganizerHome() {
 const {dir,error}=useDirectory();
 const [actionError,setActionError]=useState('');
 const [query,setQuery]=useState('');
 const outstanding=dir?.items.filter(e=>e.lifecycle!=='complete'&&e.lifecycle!=='abandoned')??[];
 const matching=filterSessions(outstanding,query);
 const latest=matching[0];
 const draft=readSetupDraft();

 function chooseGame(game:GameType) {
  const current=readSetupDraft();
  if(current && current.game!==game && current.step>0 &&
   !window.confirm('Eine angefangene Vorbereitung ist gespeichert. Nur die Spielauswahl ändern und die Vorbereitung erneut prüfen?'))return;
  try {
   const base=current??newSetupDraft(readPreferences());
   // Selection is an explicit user action. Reuse the existing draft schema;
   // never create or modify a live event from the lobby.
   saveSetupDraft({...base,game,step:current && current.game!==game && current.step===2?1:base.step});
   window.location.hash='#/setup';
  }catch(e){setActionError(e instanceof Error?e.message:'Spielauswahl konnte nicht gespeichert werden.');}
 }

 return <section className="sp-lobby" aria-label="LiGoQuiz Spielwelt">
  <section className="sp-lobby-hero" aria-labelledby="sp-lobby-title">
   <div className="sp-lobby-hero-copy">
    <h1 id="sp-lobby-title">Spielen</h1>
    <div className="sp-lobby-actions">
     <a className="sp-lobby-cta" href="#/setup">Neuen Quizabend vorbereiten <span aria-hidden="true">↗</span></a>
     <a className="sp-lobby-demo" href="#/demo">Demo ansehen <span aria-hidden="true">▷</span></a>
    </div>
   </div>
   <div className="sp-lobby-poster" aria-hidden="true">
    <span className="sp-lobby-halo"/><span className="sp-lobby-poster-mark">?</span>
    <span className="sp-lobby-poster-star">★</span><span className="sp-lobby-poster-burst">✳</span>
   </div>
  </section>

  {draft&&<aside className="sp-lobby-draft" aria-label="Gespeicherte Vorbereitung">
   <div className="sp-lobby-draft-mark" aria-hidden="true">↗</div>
   <div><h2>Gespeicherte Vorbereitung</h2>
    <p>{draft.count} Teams · {GAME_VISUALS[draft.game].label} · {draft.profile} · Schritt {draft.step+1} von 3</p>
   </div>
   <a href="#/setup" className="sp-lobby-draft-link">Weiter vorbereiten <span aria-hidden="true">→</span></a>
  </aside>}

  <section className="sp-lobby-games" aria-labelledby="sp-lobby-games-heading">
   <div className="sp-lobby-section-head">
    <div><h2 id="sp-lobby-games-heading">Spiele</h2>
    </div>
   </div>
   <div className="sp-lobby-game-grid">
    {GAME_ORDER.map((game,index)=><GameTile key={game} game={game}
      number={String(index+1).padStart(2,'0')+' / 05'} onSelect={()=>chooseGame(game)}/>)}
   </div>
  </section>

  <section className="sp-lobby-sessions" aria-labelledby="sp-lobby-sessions-heading">
   <div className="sp-lobby-section-head">
    <div><h2 id="sp-lobby-sessions-heading">Offene Spielstände</h2>
</div>
    {dir&&<span className="sp-lobby-session-count">{outstanding.length} {outstanding.length===1?'offener Abend':'offene Abende'}</span>}
   </div>
   {!dir&&!error&&<div className="sp-lobby-empty" role="status">Lokale Spielstände werden geladen …</div>}
   {dir&&outstanding.length===0&&<div className="sp-lobby-empty">
    <div><h3>Keine offenen Spielstände</h3></div>
    <a href="#/setup">Ersten Abend vorbereiten <span aria-hidden="true">→</span></a>
   </div>}
   {outstanding.length>1&&<div className="sp-lobby-search">
    <label htmlFor="sp-lobby-session-search">Spielstände suchen</label>
    <input id="sp-lobby-session-search" type="search" value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Spiel, Team oder Status" aria-label="Spielstände durchsuchen"/>
    <span aria-live="polite">{matching.length} von {outstanding.length}</span>
   </div>}
   {dir&&outstanding.length>0&&matching.length===0&&
    <p className="sp-lobby-empty" role="status">Keine passenden Spielstände gefunden.</p>}
   {latest&&<article className="sp-lobby-featured">
    <div className="sp-lobby-featured-copy">
     <h3>{statusFor(latest)}</h3>
     <p className="sp-lobby-session-progress">{eventProgress(latest)}</p>
     <p className="sp-lobby-team-names">{latest.teams.map(t=>t.name).join(' · ')}</p>
     <small>Letzte Änderung: {new Date(latest.updatedAt).toLocaleString('de-DE')}</small>
    </div>
    <div className="sp-lobby-resume">
     <ResumeButton event={latest} onError={setActionError}/>
     <a className="sp-backstage-backup-link" href={backupHref(latest.id)}>Sitzung sichern ↗</a>
    </div>
   </article>}
   {matching.length>1&&<div className="sp-lobby-other-sessions">
    <h3>Weitere Spielstände</h3>
    {matching.slice(1).map(e=><article className="sp-lobby-session-row" key={e.id}>
      <div><strong>{statusFor(e)}</strong><p>{eventProgress(e)}</p>
       <p className="sp-lobby-team-names">{e.teams.map(t=>t.name).join(' · ')}</p>
       <small>{new Date(e.updatedAt).toLocaleString('de-DE')}</small>
      </div>
      <div className="sp-backstage-row-actions">
       <ResumeButton event={e} onError={setActionError}/>
       <a href={backupHref(e.id)}>Sichern ↗</a>
      </div>
     </article>)}
   </div>}
  </section>

  {dir&&<BackstageDesk items={dir.items} invalid={dir.invalidCount}/>}

  {actionError&&<p role="alert" className="exp-error">{actionError}</p>}
  {error&&<p role="alert" className="exp-error">{error}</p>}
  {!!dir?.invalidCount&&<p role="alert" className="exp-error">{dir.invalidCount} beschädigte Spielstände wurden erkannt und nicht verändert. Wiederherstellung erfordert eine gesonderte Prüfung.</p>}

  <nav className="sp-lobby-links" aria-label="Weitere Werkzeuge">
   <a href="#/technik"><span aria-hidden="true">▣</span> Beamer & Technikcheck</a>
   <a href="#/inhalte"><span aria-hidden="true">▦</span> Inhalte prüfen</a>
   <a href="#/verlauf"><span aria-hidden="true">◷</span> Vergangene Abende</a>
   <a href="#/einstellungen"><span aria-hidden="true">⚙</span> Einstellungen & Sicherungen</a>
  </nav>
 </section>;
}

export function SessionHistory({eventId}:{eventId:string|null}) {
 const {dir,error}=useDirectory();
 const [audit,setAudit]=useState<BackstageAuditItem[]>([]);
 const [query,setQuery]=useState('');
 const selected=dir?.items.find(e=>e.id===eventId);
 const completed=dir?.items.filter(e=>e.lifecycle==='complete'&&!!reportFor(e))??[];
 const matching=filterSessions(completed,query);
 const report=selected?reportFor(selected):null;
 useEffect(()=>{
  if(!eventId){setAudit([]);return;}
  let disposed=false;
  const repo=new EventRepository();
  void repo.getAudit(eventId).then(rows=>{if(!disposed)setAudit(safeBackstageAudit(rows));})
   .catch(()=>{if(!disposed)setAudit([]);}).finally(()=>{void repo.close();});
  return ()=>{disposed=true;};
 },[eventId]);
 function downloadText(filename:string,content:string,mime:string){
  const blob=new Blob([content],{type:mime});
  const uri=URL.createObjectURL(blob);
  try{
    const anchor=document.createElement('a');
    anchor.href=uri;anchor.download=filename;
    anchor.click();
  } finally {window.setTimeout(()=>URL.revokeObjectURL(uri),1000);}
 }
 function download(){
  if(report)downloadText(safeFileName(report.id),JSON.stringify(report,null,2),'application/json');
 }
 function downloadCsv(){
  if(report)downloadText(csvFileName(report.id),reportCsv(report),'text/csv;charset=utf-8');
 }
 if(eventId)return <section className="exp-page sp-backstage-report">
  <div className="exp-heading sp-backstage-report-head"><div>
    <p className="eyebrow">VERLAUF / REGIEPROTOKOLL</p><h1>Abendbericht</h1>
</div>
   <a href="#/verlauf" className="exp-quiet">Alle Abende ←</a></div>
  {!dir?<p role="status">Spielbericht wird geladen …</p>:!report?<p className="exp-error" role="alert">Kein abgeschlossener Bericht für diese Sitzung vorhanden.</p>:
   <div className="exp-report">
    <div className="exp-summary">
      <div><span>Spiel</span><strong>{report.gameLabel}</strong><p>{report.profile}</p></div>
      <div><span>Aufgaben</span><strong>{report.questionCount}</strong></div>
      <div><span>Datum</span><strong>{new Date(report.finishedAt).toLocaleDateString('de-DE')}</strong></div>
    </div>
    <ResultsSpotlight report={report}/>
    <h2>Ausführliche Punkteübersicht</h2>
    <p className="exp-report-source">{report.sourceLabel}</p>
    <div className="exp-score-table">{report.teams.map(team=>{
      const rank=1+report.teams.filter(t=>t.rawPoints>team.rawPoints).length;
      return <div key={team.id}><b>{rank}.</b><span>{team.name}</span><strong>{team.rawPoints} Spielpunkte</strong><small>{team.eveningHalfPoints/2} Abendpunkte</small></div>;
    })}</div>
    <div className="exp-report-actions sp-backstage-report-actions">
     <button className="exp-secondary" onClick={download}>Bericht als JSON exportieren</button>
     <button className="exp-secondary" onClick={downloadCsv}>Ergebnisse als CSV exportieren</button>
     <button className="exp-secondary" onClick={()=>window.print()}>Ergebnisliste drucken / PDF</button>
     <a className="exp-secondary" href={backupHref(report.id)}>Originalsicherung öffnen ↗</a>
    </div>
    {selected&&<BackstageAudit event={selected} entries={audit}/>}
    <p className="exp-footnote">Ergebnisexporte sind keine vollständigen Sitzungsbackups.</p>
   </div>}
  {error&&<p role="alert" className="exp-error">{error}</p>}
 </section>;
 return <section className="exp-page sp-backstage-history">
   <div className="exp-heading sp-backstage-history-head"><div><p className="eyebrow">BACKSTAGE / ARCHIV</p>
    <h1>Vergangene Abende</h1>
</div>
    <a className="exp-quiet" href="#/spielen">← Zur Spielwelt</a></div>
   <div className="sp-backstage-archive-summary"><strong>{completed.length}</strong><span>abgeschlossene lokale Abende</span>
     <a href="#/einstellungen">Backup & Wiederherstellung ↗</a></div>
   {completed.length>1&&<div className="exp-search">
     <label>Abende durchsuchen<input type="search" value={query} onChange={e=>setQuery(e.target.value)}
       placeholder="Spiel oder Team" aria-label="Abende durchsuchen"/></label>
     <small aria-live="polite">{matching.length} von {completed.length} Abenden</small>
   </div>}
   {!dir?<p role="status">Lokaler Verlauf wird geladen …</p>:completed.length===0?
     <div className="exp-empty"><h2>Noch kein abgeschlossener Quizabend</h2>
      <a className="exp-secondary" href="#/setup">Quizabend vorbereiten</a></div>:
     matching.length===0?<p role="status" className="exp-search-empty">Keine passenden Abende gefunden.</p>:
     <div className="exp-session-list sp-backstage-archive-list">{matching.map(e=><article className="exp-session-row sp-backstage-archive-row" key={e.id}>
       <div><strong>{e.umfrageduell?'Umfrageduell':e.logikleiter?'Logikleiter':e.verbindungen?'Verbindungen':e.quiztafel?'Quiztafel':'Rundenquiz'} · {e.umfrageduell?.profile??e.logikleiter?.profile??e.verbindungen?.profile??e.quiztafel?.profile??e.rundenquiz?.profile}</strong><p>{e.teams.length} Teams · {e.umfrageduell?.surveys.length??e.logikleiter?.rungs.length??e.verbindungen?.assignments.length??e.quiztafel?.tiles.length??e.rundenquiz?.questions.length} {e.quiztafel?'Felder':'Aufgaben'}</p>
       <p className="exp-team-names">{e.teams.map(t=>t.name).join(' · ')}</p>
       <small>{new Date(e.updatedAt).toLocaleString('de-DE')}</small></div>
       <nav aria-label="Abendaktionen">
        <a href={'#/bericht?event='+encodeURIComponent(e.id)} aria-label={'Bericht '+(e.umfrageduell?'Umfrageduell':e.logikleiter?'Logikleiter':e.verbindungen?'Verbindungen':e.quiztafel?'Quiztafel':'Rundenquiz')+' ansehen'}>Bericht ansehen ↗</a>
        <a href={backupHref(e.id)}>Vollständiges Backup ↗</a>
       </nav></article>)}</div>}
   {dir?.invalidCount ? <p className="exp-error" role="alert">{dir.invalidCount} beschädigte Sitzungen wurden nicht verändert.</p> : null}
   {error&&<p role="alert" className="exp-error">{error}</p>}
 </section>;
}
