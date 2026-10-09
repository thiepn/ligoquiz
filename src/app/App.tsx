import { useEffect, useState } from 'react';
import '../styles/umfrageduell.css';
import { parseRoute, routeHref, currentEventId, type Route } from './routes';
import { StageView } from '../features/stage/StageView';
import { ProjectorTechCheck } from '../features/host/ProjectorTechCheck';
import { RundenquizHost } from '../features/host/RundenquizHost';
import { QuiztafelHost } from '../features/host/QuiztafelHost';
import { VerbindungenHost } from '../features/host/VerbindungenHost';
import {LogikleiterHost} from '../features/host/LogikleiterHost';
import {UmfrageduellHost} from '../features/host/UmfrageduellHost';
import { EventRepository } from '../infrastructure/db/event-repository';
import { OrganizerHome, SessionHistory } from '../features/experience/Sessions';
import { SetupWizard } from '../features/experience/SetupWizard';
import { DisposableDemo } from '../features/experience/DisposableDemo';
import { ExperienceSettings } from '../features/experience/ExperienceSettings';
import { applyMotionPreference, readPreferences, readHostIdentity } from '../features/experience/model';

const NAV: readonly {id:Route; label:string; symbol:string}[] = [
  {id:'spielen',label:'Spielen',symbol:'▶'},
  {id:'inhalte',label:'Inhalte',symbol:'▤'},
  {id:'verlauf',label:'Verlauf',symbol:'◷'},
];
function useCurrentHash(){
  const [hash,setHash]=useState(() => window.location.hash);
  useEffect(()=>{
    const handler=()=>setHash(window.location.hash);
    window.addEventListener('hashchange',handler);
    return ()=>window.removeEventListener('hashchange',handler);
  },[]);
  return hash;
}
function ContentPlaceholder(){
 return <section className="exp-page">
   <div className="exp-heading"><div><p className="eyebrow">INHALTE</p><h1>Inhaltsbibliothek</h1>
     <p>Die redaktionelle Inhaltsverwaltung und der geprüfte Import folgen in G10.</p></div></div>
   <div className="exp-empty">
     <h2>Fragenbibliothek im Aufbau</h2>
     <p>Vorläufige Rundenquiz-, Quiztafel-, Verbindungen-, Logikleiter- und Umfrageduell-Fragen liegen ausschließlich im Probeprogramm. Die bisherigen Fragen von v1.14 bleiben unverändert.</p>
     <a href="#/spielen" className="exp-secondary">Zurück zu Spielen</a>
   </div>
 </section>;
}
function HostSurface(){
 const activeIdentity=readHostIdentity();
 const [mode,setMode]=useState<'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell'|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
   setMode(null);setError('');
   if(!activeIdentity)return;
   let cancelled=false;
   const repo=new EventRepository();
   void repo.get(activeIdentity.eventId).then(event=>{
     if(cancelled)return;
     if(!event||event.hostId!==activeIdentity.hostId)
       throw new Error('Die Spielleitung gehört zu einer anderen Sitzung.');
     setMode(event.umfrageduell?'umfrageduell':event.logikleiter?'logikleiter':event.verbindungen?'verbindungen':event.quiztafel?'quiztafel':event.rundenquiz?'rundenquiz':null);
   }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Sitzung ungültig');})
     .finally(()=>{void repo.close();});
   return ()=>{cancelled=true;};
 },[activeIdentity?.eventId,activeIdentity?.hostId]);
 return <section className="exp-host-wrapper" aria-label="Spielleitung">
   <div className="exp-host-header"><a href="#/spielen">← Spielen</a>
     <div><strong>Spielleitung</strong><small>GESPEICHERTER SPIELSTAND · NUR HOST</small></div>
     <a href="#/technik">Technikcheck</a></div>
   {error&&<div role="alert" className="exp-error">{error} <a href="#/spielen">Zur Übersicht</a></div>}
   {activeIdentity&&!error&&mode==='umfrageduell'?<UmfrageduellHost/>:
    activeIdentity&&!error&&mode==='logikleiter'?<LogikleiterHost/>:
    activeIdentity&&!error&&mode==='verbindungen'?<VerbindungenHost/>:
    activeIdentity&&!error&&mode==='quiztafel'?<QuiztafelHost/>:
    activeIdentity&&!error&&mode==='rundenquiz'?<RundenquizHost/>:
    activeIdentity&&!error?<div role="status" className="exp-page">Sitzung wird geladen …</div>:
    <div className="exp-page exp-empty">
     <h2>Keine Spielleitung in diesem Fenster</h2>
     <p>Öffne einen gespeicherten Spielstand aus Spielen oder bereite einen neuen Quizabend vor. Das Beamerfenster benötigt keine Hostanmeldung.</p>
     <a className="exp-primary" href="#/spielen">Spielstände ansehen</a>
   </div>}
 </section>;
}
export function App(){
 const currentHash=useCurrentHash();
 const route=parseRoute(currentHash);
 useEffect(()=>{applyMotionPreference(readPreferences().motion);},[]);
 useEffect(()=>{document.title=route==='stage'?'LiGoQuiz — Beamer':
  route==='host'?'LiGoQuiz — Spielleitung':'LiGoQuiz — '+(route==='spielen'?'Spielen':route);},[route]);
 if(route==='stage')return <StageView/>;
 if(route==='host')return <HostSurface/>;
 if(route==='demo')return <div className="exp-focused"><DisposableDemo/></div>;
 return <div className="app-shell">
   <aside className="sidebar">
     <a href={routeHref('spielen')} className="brand" aria-label="LiGoQuiz Startseite">
       <span className="brand-symbol" aria-hidden="true">L<span>.</span></span>
       <span className="brand-text">LiGo<span>Quiz</span><small>GAME NIGHT SYSTEM</small></span>
     </a>
     <div className="nav-group-title">NAVIGATION</div>
     <nav className="main-nav" aria-label="Hauptnavigation">
       {NAV.map(item=><a key={item.id} href={routeHref(item.id)}
         className={'nav-item'+(route===item.id||(route==='setup'&&item.id==='spielen')||(route==='bericht'&&item.id==='verlauf')?' active':'')}
         aria-current={route===item.id?'page':undefined}>
         <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>{item.label}
       </a>)}
     </nav>
     <div className="sidebar-bottom">
       <a className="exp-sidebar-link" href="#/technik">Beamer / Technikcheck</a>
       <a className="exp-sidebar-link" href="#/einstellungen">Einstellungen</a>
       <div className="version-info">VERSION 2.0 · G9 ENTWICKLUNG</div>
     </div>
   </aside>
   <main className="workspace" id="main-content">
     {route==='spielen'&&<OrganizerHome/>}
     {route==='setup'&&<SetupWizard/>}
     {route==='inhalte'&&<ContentPlaceholder/>}
     {route==='verlauf'&&<SessionHistory eventId={null}/>}
     {route==='bericht'&&<SessionHistory eventId={currentEventId(currentHash)}/>}
     {route==='einstellungen'&&<ExperienceSettings/>}
     {route==='technik'&&<section className="exp-page">
       <div className="exp-heading"><div><p className="eyebrow">GERÄTE</p><h1>Technikcheck</h1>
       <p>Hostfenster auf dem Laptop, öffentliche Beameransicht auf dem erweiterten Bildschirm.</p></div></div>
       <ProjectorTechCheck/>
       <p className="exp-footnote">Für einen echten Quizabend verbinde den Beamer über die Spielleitung des aktiven Spiels.</p>
     </section>}
   </main>
 </div>;
}
