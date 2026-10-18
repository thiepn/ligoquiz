import {PhysicalCustodyReview} from '../features/experience/PhysicalCustodyReview';
import {IndependentReleaseDryRun} from '../features/experience/IndependentReleaseDryRun';
import {CustodyHandoffReview} from '../features/experience/CustodyHandoffReview';
import {WitnessEvidenceReview} from '../features/experience/WitnessEvidenceReview';
import {EventTrialReadiness} from '../features/experience/EventTrialReadiness';
import {ReleaseCandidateDesk} from '../features/experience/ReleaseCandidateDesk';
import {CutoverPreflight} from '../features/experience/CutoverPreflight';
import {VisualEvidenceReview} from '../features/experience/VisualEvidenceReview';
import { useEffect, useState } from 'react';
import '../styles/umfrageduell.css';
import { parseRoute, currentEventId } from './routes';
import { AppShell } from './AppShell';
import { StageView } from '../features/stage/StageView';
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
 if(route==='host')return <AppShell route={route}><HostSurface/></AppShell>;
 if(route==='demo')return <div className="exp-focused"><DisposableDemo/></div>;
 return <AppShell route={route}>
     {route==='spielen'&&<OrganizerHome/>}
     {route==='setup'&&<SetupWizard/>}
     {route==='inhalte'&&<ContentStudio/>}
     {route==='verlauf'&&<SessionHistory eventId={null}/>}
     {route==='bericht'&&<SessionHistory eventId={currentEventId(currentHash)}/>}
     {route==='einstellungen'&&<ExperienceSettings/>}
     {route==='technik'&&<section className="exp-page">
       <div className="exp-heading"><div><p className="eyebrow">GERÄTE</p><h1>Technikcheck</h1>
       <p>Hostfenster auf dem Laptop, öffentliche Beameransicht auf dem erweiterten Bildschirm.</p></div></div>
       <CutoverPreflight/>
       <ReleaseCandidateDesk/>
       <OfflinePreflight/>
       <ProjectorTechCheck/>
       <VisualEvidenceReview/>
       <EventTrialReadiness/>
       <WitnessEvidenceReview/>
       <CustodyHandoffReview/>
       <IndependentReleaseDryRun/>
       <PhysicalCustodyReview/>
       <p className="exp-footnote">Für einen echten Quizabend verbinde den Beamer über die Spielleitung des aktiven Spiels.</p>
     </section>}
 </AppShell>;
}
