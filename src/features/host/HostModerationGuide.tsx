import '../../styles/g15-host-a11y.css';
import {useCallback,useEffect} from 'react';
import '../../styles/g14-moderator.css';

export type HostGame='rundenquiz'|'quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell';
export type HostGuideInput={
 game:HostGame; phase:string; paused:boolean; recovery:boolean;
 completed:number; total:number; viewers:number; ready:boolean; busy:boolean;
};
export type HostGuideState={step:string;next:string;visibility:string;scoring:string;warning:string;finished:boolean};

/** Deterministic host-only guidance. Never changes a game, stage frame or ledger. */
export function describeHostStep(input:HostGuideInput):HostGuideState{
 const {game,phase,paused,recovery}=input;
 if(recovery)return {step:'Wiederherstellung',next:'Spielstand ausdrücklich prüfen',visibility:'Beamer gesperrt',
  scoring:'Wertung prüfen',warning:'Erst Spielstand, Punkte und Projektion kontrollieren. Keine automatische Fortsetzung.',finished:false};
 if(phase==='complete')return {step:'Abgeschlossen',next:'Ergebnisbericht öffnen',visibility:'Endstand',scoring:'Wertung abgeschlossen',warning:'Der Abend ist beendet.',finished:true};
 if(paused)return {step:'Pausiert',next:'Spiel bewusst fortsetzen',visibility:'Ausgabe pausiert',
  scoring:'Punkte unverändert',warning:'Beim Fortsetzen Beamer und aktuelle Aufgabe kontrollieren.',finished:false};
 const phases:Record<HostGame,Record<string,[string,string,string,string]>>={
  rundenquiz:{
   setup:['Vorbereitung','Teams bestätigen','Antwort verborgen','Wertung offen'],
   ready:['Vorbereitung','Frage veröffentlichen','Antwort verborgen','Wertung offen'],
   open:['Antwortphase','Antworten schließen','Antwort verborgen','Wertung offen'],
   closed:['Antworten geschlossen','Lösung veröffentlichen','Antwort verborgen','Wertung offen'],
   revealed:['Wertung prüfen','Teams bewerten und Punkte bestätigen','Lösung freigegeben','Wertung offen'],
   graded:['Punkte bestätigt','Nächste Aufgabe oder Endstand','Lösung freigegeben','Punkte verbucht']},
  quiztafel:{
   setup:['Vorbereitung','Spieltafel vorbereiten','Antwort verborgen','Wertung offen'],
   board:['Feldwahl','Freies Feld auswählen','Antwort verborgen','Wertung offen'],
   prepared:['Private Auswahl','Frage bewusst veröffentlichen','Antwort verborgen','Wertung offen'],
   question:['Antwortphase','Erstantwort bewerten','Antwort verborgen','Wertung offen'],
   'steal-offer':['Übernahme','Übernahme anbieten','Antwort verborgen','Wertung offen'],
   steal:['Übernahme','Übernahme bewerten','Antwort verborgen','Wertung offen'],
   adjudicated:['Antwort bewertet','Lösung freigeben','Antwort verborgen','Wertung offen'],
   revealed:['Wertung prüfen','Punktkandidaten kontrollieren und bestätigen','Lösung freigegeben','Wertung offen'],
   awarded:['Punkte bestätigt','Nächstes Feld öffnen','Lösung freigegeben','Punkte verbucht']},
  verbindungen:{
   setup:['Vorbereitung','Aufgabenreihenfolge bestätigen','Antwort verborgen','Wertung offen'],
   ready:['Vorbereitung','Aufgabe veröffentlichen','Antwort verborgen','Wertung offen'],
   'clue-open':['Hinweisrunde','Hinweise oder Antwort bewerten','Antwort verborgen','Wertung offen'],
   'sequence-open':['Folgerunde','Antwort bewerten','Antwort verborgen','Wertung offen'],
   'wall-open':['Verbindungswand','Teamzuordnungen erfassen und schließen','Gruppen verborgen','Wertung offen'],
   'wall-closed':['Verbindungswand','Gruppen einzeln veröffentlichen','Gruppen verborgen','Wertung offen'],
   'wall-reveal':['Gruppenauflösung','Gruppenprüfung und Punkte bestätigen','Gruppen teilweise oder ganz freigegeben','Wertung offen'],
   revealed:['Wertung prüfen','Punkte verbindlich bestätigen','Lösung freigegeben','Wertung offen'],
   graded:['Punkte bestätigt','Nächste Aufgabe oder Endstand','Lösung freigegeben','Punkte verbucht']},
  logikleiter:{
   setup:['Vorbereitung','Leiter bestätigen','Antwort verborgen','Wertung offen'],
   ready:['Vorbereitung','Aufgabe veröffentlichen','Antwort verborgen','Wertung offen'],
   open:['Abgaben','Teamabgaben erfassen und schließen','Antwort verborgen','Wertung offen'],
   closed:['Antworten geschlossen','Lösung bewusst veröffentlichen','Antwort verborgen','Wertung offen'],
   revealed:['Wertung prüfen','Alle Teams bewerten und bestätigen','Lösung freigegeben','Wertung offen'],
   graded:['Punkte bestätigt','Nächste Stufe oder Endstand','Lösung freigegeben','Punkte verbucht']},
  umfrageduell:{
   setup:['Vorbereitung','Aufgabenfolge bestätigen','Antwort verborgen','Wertung offen'],
   ready:['Vorbereitung','Aufgabe veröffentlichen','Rangfolge verborgen','Wertung offen'],
   open:['Antwortphase','Antworten schließen','Rangfolge verborgen','Wertung offen'],
   closed:['Teamwertung','Antworten erfassen und Rangfolge veröffentlichen','Rangfolge verborgen','Wertung offen'],
   revealed:['Wertung prüfen','Teamwertungen verbindlich bestätigen','Rangfolge freigegeben','Wertung offen'],
   graded:['Punkte bestätigt','Nächste Umfrage oder Endstand','Rangfolge freigegeben','Punkte verbucht']}
 };
 const [step,next,visibility,scoring]=phases[game][phase]??['Status prüfen','Spielleitung prüfen','Antwort nicht automatisch freigegeben','Wertung prüfen'];
 const warning=visibility.includes('verborgen')?'Vertrauliche Lösung erst nach bewusstem Freigabeklick öffentlich zeigen.':
   scoring==='Punkte verbucht'?'Eine Änderung benötigt den vorhandenen Korrekturweg.':
   'Vor dem verbindlichen Bestätigen alle Teamwertungen kontrollieren.';
 return {step,next,visibility,scoring,warning,finished:false};
}

/** A keyboard shortcut is a focus hint, never a game command or input-editing override. */
export type FocusShortcut = Pick<KeyboardEvent,'key'|'altKey'|'shiftKey'|'ctrlKey'|'metaKey'|'repeat'|'isComposing'>;
export function isFocusShortcut(event:FocusShortcut, editing:boolean):boolean{
 return !editing&&!event.repeat&&!event.isComposing&&event.key.toLowerCase()==='n'&&
  event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey;
}

/** Focus only. Does not dispatch, reveal, score, pause or resume. */
export function focusHostAction(root:Element|null, paused:boolean,recovery:boolean):boolean{
 if(!root)return false;
 const selector=recovery?'.rq-recovery button:not(:disabled)':
  paused? '[data-host-resume]:not(:disabled), .rq-control .g3-tech-primary:not(:disabled)':
   '[data-host-next]:not(:disabled), .qt-cell:not(:disabled)';
 const target=root.querySelector<HTMLButtonElement>(selector);
 if(!target)return false;
 target.focus();
 return document.activeElement===target;
}

export function HostModerationGuide(props:HostGuideInput){
 const state=describeHostStep(props);
 const focusNext=useCallback(()=>{
  const root=document.querySelector<HTMLElement>(`[data-host-game="${props.game}"]`);
  return focusHostAction(root,props.paused,props.recovery);
 },[props.game,props.paused,props.recovery]);
 useEffect(()=>{
  function onKey(e:KeyboardEvent){
   // Keep editing fields and native dialogs free from global moderation shortcuts.
   const origin=e.target;
   const editing=origin instanceof HTMLElement && (origin.isContentEditable ||
     Boolean(origin.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')));
   if(!isFocusShortcut(e,editing))return;
   if(focusNext())e.preventDefault();
  }
  window.addEventListener('keydown',onKey);
  return ()=>window.removeEventListener('keydown',onKey);
 },[focusNext]);
 const total=Math.max(0,props.total);
 const completed=Math.max(0,Math.min(total,props.completed));
 const canFocus=props.ready&&!props.busy&&!state.finished;
 return <section className="g14-guide" aria-label="Moderationsübersicht">
  <div className="g14-guide-head">
   <div><span className="g14-eyebrow">MODERATIONSÜBERSICHT</span>
    <h3>{state.step}</h3><p>{state.warning}</p></div>
   <div className="g14-connect"><strong>{props.viewers}</strong><span>Beamerfenster bestätigt</span></div>
  </div>
  <div className="g14-facts">
   <div><small>ALS NÄCHSTES</small><strong>{state.next}</strong></div>
   <div><small>VERÖFFENTLICHUNG</small><strong>{state.visibility}</strong></div>
   <div><small>PUNKTSTAND</small><strong>{state.scoring}</strong></div>
  </div>
  <div className="g14-guide-foot">
   <div className="g14-progress">
    <span>{completed} von {total} {props.game==='quiztafel'?'Feldern':'Aufgaben'} abgeschlossen</span>
    <progress value={completed} max={Math.max(1,total)} aria-label="Abgeschlossene Aufgaben"/>
   </div>
   <button type="button" className="g14-focus" disabled={!canFocus} onClick={()=>{focusNext();}}>
    Nächste Aktion fokussieren <span className="g14-shortcut">Alt + Umschalt + N</span>
   </button>
  </div>
 </section>;
}
