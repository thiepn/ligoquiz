import {useState} from 'react';
import type {EventRecord} from '../../domain/event/schemas';
import {GAME_VISUALS} from '../../design-system/theme';
import {StudioPopMotif,ScoreChip,PopProgress} from '../../design-system/StudioPop';
import {stageUrl} from '../stage/protocol';
import {playalongUrl} from '../stage/audience-playalong-model';
import {backupHref} from '../experience/backstage-model';
import {describeCockpit} from './host-cockpit-model';
import {TeamAnswerSheetDesk} from './TeamAnswerSheetDesk';
import './host-cockpit.css';

/** Host-only read-only display. Game actions remain in the original game hosts. */
export function HostCockpit({event}:{event:EventRecord}){
 const [compactFor,setCompactFor]=useState<string|null>(null);
 const compact=compactFor===event.id;
 const state=describeCockpit(event);
 if(!state)return null;
 const visual=GAME_VISUALS[state.game];
 return <section className={'sp-cockpit'+(compact?' is-compact':'')} aria-label="Aktueller Spielstand" data-cockpit-game={state.game}>
  <div className={'sp-cockpit-hero sp-cockpit-hero--'+visual.tone}>
   <div className="sp-cockpit-title">
    <h2>{visual.label}<span aria-hidden="true">.</span></h2>
    <p>{state.teams.length} Teams</p>
    <div className="sp-cockpit-status">
     <span className={'sp-cockpit-state'+(state.recovery?' is-warning':state.paused?' is-paused':'')}>
      <span aria-hidden="true">●</span>{state.step}</span>
     <button type="button" className="sp-cockpit-density" aria-pressed={compact}
      onClick={()=>setCompactFor(compact?null:event.id)}>Kompaktansicht</button>
    </div>
   </div>
   <div className="sp-cockpit-art" aria-hidden="true"><StudioPopMotif game={state.game}/></div>
  </div>
  {state.recovery&&<div role="alert" className="sp-cockpit-warning">
   Wiederherstellung erforderlich. Vor dem Fortsetzen Spielstand, Wertung und Projektion im originalen Host prüfen.
  </div>}
  <div className="sp-cockpit-overview" aria-label="Moderationsstatus">
   <div className="sp-cockpit-fact sp-cockpit-fact--progress">
    <span>SPIELFORTSCHRITT</span>
    <PopProgress current={state.completed} total={state.total} label={state.progressLabel}/>
   </div>
   <div className="sp-cockpit-fact">
    <span>ALS NÄCHSTES</span><strong>{state.next}</strong>
   </div>
   <div className="sp-cockpit-fact">
    <span>ÖFFENTLICHE AUSGABE</span><strong>{state.visibility}</strong>
   </div>
  </div>
  <div className="sp-cockpit-scores">
   <div className="sp-cockpit-scores-head">
    <h3>Punktestand</h3>
   </div>
   <div className="sp-cockpit-scores-grid">
    {state.teams.map(t=><ScoreChip key={t.id} name={t.name} points={t.points} tone={t.tone} leading={t.leading}/>)}
   </div>
  </div>
  <nav className="sp-cockpit-actions" aria-label="Spielleitung Schnellzugriffe">
   <button type="button" className="sp-cockpit-primary" onClick={()=>{document.getElementById('sp-host-game')?.focus();}}>Zur Originalsteuerung <span aria-hidden="true">↓</span></button>
   <a className="sp-cockpit-stage" href={stageUrl(event.id)} target="_blank" rel="noopener noreferrer">
    Öffentliches Beamerfenster öffnen <span aria-hidden="true">↗</span></a>
   <a className="sp-cockpit-accessible-stage" href={stageUrl(event.id)+'&display=accessible'}
     target="_blank" rel="noopener noreferrer">Beamer-Lesemodus öffnen <span aria-hidden="true">↗</span></a>
   <a className="sp-cockpit-playalong" href={playalongUrl(event.id)} target="_blank" rel="noopener noreferrer">Mitspielen auf diesem Gerät öffnen</a>
   <a href="#/technik">Technikcheck</a>
   <a href={backupHref(event.id)}>Originalsicherung</a>
   <a href="#/spielen">Gespeicherte Abende</a>
   {state.finished&&<a href={'#/bericht?event='+encodeURIComponent(event.id)}>Abendbericht</a>}
  </nav>
  <TeamAnswerSheetDesk key={event.id} event={event}/>
  <p className="sp-cockpit-private-note">Spielleitung nicht auf den Beamer spiegeln. Ein geöffnetes Beamerfenster ist keine bestätigte Verbindung.</p>
 </section>;
}
