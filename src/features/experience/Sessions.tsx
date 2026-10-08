import { useEffect, useState } from 'react';
import { EventRepository } from '../../infrastructure/db/event-repository';
import type { EventRecord } from '../../domain/event/schemas';
import { readHostIdentity, writeHostIdentity, reportFor, safeFileName, readSetupDraft } from './model';

type Directory = { items: EventRecord[]; invalidCount: number };
function statusFor(event: EventRecord): string {
  if (event.lifecycle==='complete') return 'Abgeschlossen';
  if (event.recoveryRequired) return 'Überprüfung erforderlich';
  if (event.lifecycle==='paused' || event.rundenquiz?.paused) return 'Pausiert';
  if (event.lifecycle==='active') return 'Läuft';
  return 'Vorbereitung';
}
function eventProgress(event:EventRecord):string {
  const rq=event.rundenquiz;
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
 const outstanding=dir?.items.filter(e=>e.lifecycle!=='complete'&&e.lifecycle!=='abandoned')??[];
 const latest=outstanding[0];
 const draft=readSetupDraft();
 return <section className="exp-page">
  <div className="exp-heading"><div><p className="eyebrow">SPIELEN</p><h1>Quizabend organisieren</h1>
    <p>Teams zusammenstellen, Beamer vorbereiten, gemeinsam spielen.</p></div></div>
  <div className="exp-home-choices">
   <a className="exp-primary exp-start" href="#/setup"><span>Quizabend starten</span><span aria-hidden="true">↗</span></a>
   <a className="exp-secondary exp-demo-action" href="#/demo">Demo ausprobieren <span aria-hidden="true">↗</span></a>
  </div>
  {draft&&<div className="exp-resume-note"><div><strong>Vorbereitung fortsetzen</strong>
    <p>{draft.count} Teams · Rundenquiz {draft.profile} · Schritt {draft.step+1} von 3</p></div>
    <a className="exp-secondary" href="#/setup">Fortsetzen</a></div>}
  {latest&&<div className="exp-active">
    <div><span className="eyebrow">ZULETZT GESPEICHERT</span><h2>{statusFor(latest)}</h2>
      <p>{eventProgress(latest)}</p><small>Letzte Änderung: {new Date(latest.updatedAt).toLocaleString('de-DE')}</small></div>
    <ResumeButton event={latest} onError={setActionError}/>
  </div>}
  {outstanding.length>1&&<div className="exp-session-list">
    <h2>Weitere Spielstände</h2>
    {outstanding.slice(1,8).map(e=><div className="exp-session-row" key={e.id}>
      <div><strong>{statusFor(e)}</strong><p>{eventProgress(e)}</p></div>
      <ResumeButton event={e} onError={setActionError}/>
    </div>)}
  </div>}
  {actionError&&<p role="alert" className="exp-error">{actionError}</p>}
  {error&&<p role="alert" className="exp-error">{error}</p>}
  {dir?.invalidCount ? <p role="alert" className="exp-error">{dir.invalidCount} beschädigte Spielstände wurden erkannt und nicht verändert. Wiederherstellung erfordert eine gesonderte Prüfung.</p> : null}
  <div className="exp-utility-line"><a href="#/technik">Beamer / Technikcheck</a>
   <a href="#/einstellungen">Einstellungen</a><a href="#/verlauf">Vergangene Abende</a></div>
  <p className="exp-footnote">Aktuell spielbar: Rundenquiz mit Probeinhalten. Weitere Spiele und die geprüfte Inhaltsbibliothek folgen.</p>
 </section>;
}

export function SessionHistory({eventId}:{eventId:string|null}) {
 const {dir,error}=useDirectory();
 const [audit,setAudit]=useState<{kind:string;detail:string;revision:number}[]>([]);
 const selected=dir?.items.find(e=>e.id===eventId);
 const completed=dir?.items.filter(e=>e.lifecycle==='complete'&&!!reportFor(e))??[];
 const report=selected?reportFor(selected):null;
 useEffect(()=>{
  if(!eventId){setAudit([]);return;}
  let disposed=false;
  const repo=new EventRepository();
  void repo.getAudit(eventId).then(rows=>{if(!disposed)setAudit(rows.map(r=>({
    kind:r.kind,detail:r.detail,revision:r.revision,
  })));}).catch(()=>{if(!disposed)setAudit([]);}).finally(()=>{void repo.close();});
  return ()=>{disposed=true;};
 },[eventId]);
 function download(){
  if(!report)return;
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const uri=URL.createObjectURL(blob);
  try{
    const anchor=document.createElement('a');
    anchor.href=uri;anchor.download=safeFileName(report.id);
    anchor.click();
  } finally {window.setTimeout(()=>URL.revokeObjectURL(uri),1000);}
 }
 if(eventId)return <section className="exp-page">
  <div className="exp-heading"><div><p className="eyebrow">VERLAUF / BERICHT</p><h1>Abendbericht</h1>
   <p>Ergebnisse aus der abgeschlossenen, lokal gespeicherten Sitzung.</p></div>
   <a href="#/verlauf" className="exp-quiet">Zurück</a></div>
  {!dir?<p role="status">Spielbericht wird geladen …</p>:!report?<p className="exp-error" role="alert">Kein abgeschlossener Bericht für diese Sitzung vorhanden.</p>:
   <div className="exp-report">
    <div className="exp-summary">
      <div><span>Spiel</span><strong>Rundenquiz</strong><p>{report.profile}</p></div>
      <div><span>Aufgaben</span><strong>{report.questionCount}</strong></div>
      <div><span>Datum</span><strong>{new Date(report.finishedAt).toLocaleDateString('de-DE')}</strong></div>
    </div>
    <h2>Endstand</h2>
    <div className="exp-score-table">{report.teams.map(team=>{
      const rank=1+report.teams.filter(t=>t.rawPoints>team.rawPoints).length;
      return <div key={team.id}><b>{rank}.</b><span>{team.name}</span><strong>{team.rawPoints} Spielpunkte</strong><small>{team.eveningHalfPoints/2} Abendpunkte</small></div>;
    })}</div>
    <button className="exp-secondary" onClick={download}>Bericht als JSON exportieren</button>
    <details><summary>Änderungsprotokoll ({audit.length})</summary>
      <div className="exp-audit">{audit.map(entry=><p key={entry.revision}>#{entry.revision} · {entry.kind} · {entry.detail}</p>)}</div>
    </details>
    <p className="exp-footnote">{report.sourceLabel}. Der Export enthält Ergebnisse, keine unveröffentlichten Lösungsdaten.</p>
   </div>}
  {error&&<p role="alert" className="exp-error">{error}</p>}
 </section>;
 return <section className="exp-page">
   <div className="exp-heading"><div><p className="eyebrow">VERLAUF</p><h1>Vergangene Abende</h1>
    <p>Abgeschlossene Sitzungen aus diesem Browser. Laufende Abende sind unter Spielen.</p></div></div>
   {!dir?<p role="status">Lokaler Verlauf wird geladen …</p>:completed.length===0?
     <div className="exp-empty"><h2>Noch kein abgeschlossener Quizabend</h2>
      <p>Der erste vollständige Abend erscheint hier nach dem Abschluss.</p>
      <a className="exp-secondary" href="#/setup">Quizabend vorbereiten</a></div>:
     <div className="exp-session-list">{completed.map(e=><a className="exp-session-row" key={e.id}
        href={'#/bericht?event='+encodeURIComponent(e.id)}>
       <div><strong>Rundenquiz · {e.rundenquiz?.profile}</strong><p>{e.teams.length} Teams · {e.rundenquiz?.questions.length} Aufgaben</p>
       <small>{new Date(e.updatedAt).toLocaleString('de-DE')}</small></div><span>Bericht ansehen ↗</span></a>)}</div>}
   {dir?.invalidCount ? <p className="exp-error" role="alert">{dir.invalidCount} beschädigte Sitzungen wurden nicht verändert.</p> : null}
   {error&&<p role="alert" className="exp-error">{error}</p>}
 </section>;
}
