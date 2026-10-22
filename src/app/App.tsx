import {TechWorkflowNavigation} from '../features/experience/TechWorkflowNavigation';
import {PhysicalCustodyReview} from '../features/experience/PhysicalCustodyReview';
import {IndependentReleaseDryRun} from '../features/experience/IndependentReleaseDryRun';
import {CustodyHandoffReview} from '../features/experience/CustodyHandoffReview';
import {WitnessEvidenceReview} from '../features/experience/WitnessEvidenceReview';
import {EventTrialReadiness} from '../features/experience/EventTrialReadiness';
import {ReleaseCandidateDesk} from '../features/experience/ReleaseCandidateDesk';
import {CutoverPreflight} from '../features/experience/CutoverPreflight';
import {VisualEvidenceReview} from '../features/experience/VisualEvidenceReview';
import { useEffect, useState } from 'react';
import type {EventRecord} from '../domain/event/schemas';
import {HostCockpit} from '../features/host/HostCockpit';
import '../styles/umfrageduell.css';
import { parseRoute, currentEventId } from './routes';
import { AppShell } from './AppShell';
import { StageView } from '../features/stage/StageView';
import { AudiencePlayalong } from '../features/stage/AudiencePlayalong';
import { ProjectorTechCheck } from '../features/host/ProjectorTechCheck';
import { RundenquizHost } from '../features/host/RundenquizHost';
import { QuiztafelHost } from '../features/host/QuiztafelHost';
import { VerbindungenHost } from '../features/host/VerbindungenHost';
import {LogikleiterHost} from '../features/host/LogikleiterHost';
import {UmfrageduellHost} from '../features/host/UmfrageduellHost';
import {ContentStudio} from '../features/content/ContentStudio';
import {OfflinePreflight} from '../features/resilience/ResilienceCenter';
import { EventRepository } from '../infrastructure/db/event-repository';
import { OrganizerHome, SessionHistory } from '../features/experience/Sessions';
import { SetupWizard } from '../features/experience/SetupWizard';
import { DisposableDemo } from '../features/experience/DisposableDemo';
import { ExperienceSettings } from '../features/experience/ExperienceSettings';
import { applyMotionPreference, readPreferences, readHostIdentity } from '../features/experience/model';

function useCurrentHash(){
  const [hash,setHash]=useState(() => window.location.hash);
  useEffect(()=>{
    const handler=()=>setHash(window.location.hash);
    window.addEventListener('hashchange',handler);
    return ()=>window.removeEventListener('hashchange',handler);
  },[]);
  return hash;
}
function HostSurface(){
 const activeIdentity=readHostIdentity();
 const [mode,setMode]=useState<'rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell'|null>(null);
 const [snapshot,setSnapshot]=useState<EventRecord|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{
   setMode(null);setSnapshot(null);setError('');
   if(!activeIdentity)return;
   let disposed=false,inFlight=false;
   const repo=new EventRepository();
   // Read-only snapshot; native game hosts remain the sole writers and publishers.
   const refresh=async()=>{
     if(disposed||inFlight)return;
     inFlight=true;
     try{
       const event=await repo.get(activeIdentity.eventId);
       if(disposed)return;
       if(!event||event.hostId!==activeIdentity.hostId)
         throw new Error('Die Spielleitung gehört zu einer anderen Sitzung.');
       const selected=event.umfrageduell?'umfrageduell':event.logikleiter?'logikleiter':
         event.verbindungen?'verbindungen':event.quiztafel?'quiztafel':event.rundenquiz?'rundenquiz':null;
       if(!selected)throw new Error('Kein unterstütztes Spiel in dieser Sitzung.');
       setMode(selected);
       setSnapshot(previous=>previous?.revision===event.revision &&
         previous.hostEpoch===event.hostEpoch && previous.stageRevision===event.stageRevision
         ?previous:event);
       setError('');
     }catch(e){
       if(!disposed){
         // Never retain private host UI or stale scores after failed owner verification.
         setMode(null);setSnapshot(null);
         setError(e instanceof Error?e.message:'Sitzung ungültig');
       }
     }finally{inFlight=false;}
   };
   void refresh();
   const timer=window.setInterval(()=>{void refresh();},2500);
   return ()=>{disposed=true;window.clearInterval(timer);void repo.close();};
 },[activeIdentity?.eventId,activeIdentity?.hostId]);
 return <section className="exp-host-wrapper sp-cockpit-wrap" aria-label="Spielleitung">
   <div className="exp-host-header sp-cockpit-topline"><a href="#/spielen">← Spielen</a>
     <div><strong>Spielleitung</strong></div>
     <a href="#/technik">Technikcheck</a></div>
   {error&&<div role="alert" className="exp-error">{error} <a href="#/spielen">Zur Übersicht</a></div>}
   {snapshot&&mode&&!error&&<HostCockpit event={snapshot}/>}
   {activeIdentity&&!error&&!snapshot&&<p role="status" className="sp-cockpit-loading">Gespeicherter Spielstand wird geprüft …</p>}
   {activeIdentity&&!error&&mode&&<div id="sp-host-game" tabIndex={-1} className="sp-host-game-region">
     {mode==='umfrageduell'?<UmfrageduellHost/>:
      mode==='logikleiter'?<LogikleiterHost/>:
      mode==='verbindungen'?<VerbindungenHost/>:
      mode==='quiztafel'?<QuiztafelHost/>:<RundenquizHost/>}
   </div>}
   {!activeIdentity&&<div className="exp-page exp-empty">
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
  route==='mitspielen'?'LiGoQuiz — Mitspielen':
  route==='host'?'LiGoQuiz — Spielleitung':'LiGoQuiz — '+(route==='spielen'?'Spielen':route);},[route]);
 if(route==='stage')return <StageView/>;
 if(route==='mitspielen')return <AudiencePlayalong/>;
 if(route==='host')return <AppShell route={route}><HostSurface/></AppShell>;
 if(route==='demo')return <div className="exp-focused"><DisposableDemo/></div>;
 return <AppShell route={route}>
     {route==='spielen'&&<OrganizerHome/>}
     {route==='setup'&&<SetupWizard/>}
     {route==='inhalte'&&<ContentStudio/>}
     {route==='verlauf'&&<SessionHistory eventId={null}/>}
     {route==='bericht'&&<SessionHistory eventId={currentEventId(currentHash)}/>}
     {route==='einstellungen'&&<ExperienceSettings/>}
     {route==='technik'&&<section className="exp-page u10-tech-workflow">
       <div className="exp-heading"><div><h1>Technikcheck</h1>
</div><a className="exp-quiet" href="#/spielen">← Spielstände</a></div>
       <TechWorkflowNavigation/>
       <section className="u10-tech-section" id="u10-offline-check" tabIndex={-1} aria-label="Offline und Gerätespeicher">
        <div className="u10-tech-section-head"><h2>Offline und Speicher</h2>
         <p>Der Browsercheck belegt weder die physische Beamerverkabelung noch ein reales WLAN-Ausfallprotokoll.</p></div>
        <OfflinePreflight/>
        <p className="u10-tech-section-next"><a href="#/einstellungen">Vollständige Sitzung sichern und ggf. wiederherstellen →</a></p>
       </section>
       <section className="u10-tech-section" id="u10-projector-check" tabIndex={-1} aria-label="Originale Beamerprobe">
        <div className="u10-tech-section-head"><h2>Beamer getrennt testen</h2>
         <p>Die technische Demo bleibt separat. Der echte Abend veröffentlicht nur über den ursprünglichen Host.</p></div>
        <ProjectorTechCheck/>
        <p className="u10-tech-section-next"><a href="#/spielen">Echten Abend auswählen – Beamer in der Spielleitung öffnen →</a></p>
       </section>
       <section className="u10-tech-section u10-tech-section--evidence" id="u10-g26-evidence" tabIndex={-1} aria-label="G26 Originalnachweise und Rückweg">
        <div className="u10-tech-section-head"><h2>Unabhängige Nachweise · NO-GO</h2>
         <p>Alle ursprünglichen Prüfmodule bleiben vollständig vorhanden. Weder diese Übersicht noch eine grüne lokale Prüfung erteilt Veranstaltungs- oder Releasefreigabe.</p></div>
        <CutoverPreflight/>
        <ReleaseCandidateDesk/>
        <VisualEvidenceReview/>
        <EventTrialReadiness/>
        <WitnessEvidenceReview/>
        <CustodyHandoffReview/>
        <IndependentReleaseDryRun/>
        <PhysicalCustodyReview/>
       </section>
       <nav className="u10-tech-last" aria-label="Nach dem Technikcheck">
        <a href="#/spielen">Spielstände & sichere Wiederaufnahme</a>
        <a href="#/einstellungen">Sicherung & Wiederherstellung</a>
        <a href="#/verlauf">Ergebnisse</a>
        <a href="#/inhalte">Quellen & Rechte</a>
       </nav>
    
     </section>}
 </AppShell>;
}
