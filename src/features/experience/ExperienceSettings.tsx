import { useState } from 'react';
import { readPreferences, savePreferences, type Preferences } from './model';
import {BackupRecovery} from '../resilience/ResilienceCenter';
import {backupTargetFromHash} from './backstage-model';

export function ExperienceSettings(){
 const [value,setValue]=useState<Preferences>(readPreferences);
 const [state,setState]=useState('');
 function save(){
  try{savePreferences(value);setState('Einstellungen auf diesem Gerät gespeichert.');}
  catch{setState('Die Einstellungen konnten im Browser nicht gespeichert werden.');}
 }
 return <section className="exp-page" aria-label="Einstellungen">
  <div className="exp-heading"><div><h1>Einstellungen</h1>
    <p>Gilt für neue Quizabende; laufende Spielstände bleiben unverändert.</p></div>
    <a href="#/spielen" className="exp-quiet">Zur Übersicht</a></div>
  {backupTargetFromHash(window.location.hash)&&<p className="sp-backstage-settings-hint" role="status">
   Backstage hat eine lokale Sitzung zur Sicherung vorausgewählt. Es wurde noch kein Export oder Wiederherstellung ausgeführt.
   <a href="#/spielen">Zurück zur Spielwelt</a></p>}
  <div className="exp-form">
   <h2>Neue Quizabende</h2>
   <div className="exp-settings-grid">
     <label className="exp-field">Teams (Vorgabe)
       <select value={value.defaultTeams} onChange={e=>{setState('');setValue(p=>({...p,defaultTeams:Number(e.target.value) as Preferences['defaultTeams']}));}}>
         {[3,4,5].map(n=><option key={n} value={n}>{n} Teams</option>)}
       </select></label>
     <label className="exp-field">Rundenquiz-Umfang (Vorgabe)
       <select value={value.defaultProfile} onChange={e=>{setState('');setValue(p=>({...p,defaultProfile:e.target.value as Preferences['defaultProfile']}));}}>
         <option value="kurz">Kurz</option><option value="standard">Standard</option><option value="lang">Lang</option>
       </select></label>
   </div>
   <h2>Darstellung</h2>
   <label className="exp-field">Animationen
     <select value={value.motion} onChange={e=>{setState('');setValue(p=>({...p,motion:e.target.value as Preferences['motion']}));}}>
       <option value="system">Systemeinstellung verwenden</option>
       <option value="reduce">Bewegung reduzieren</option>
       <option value="full">Normale Übergänge</option>
     </select>
   </label>
   <button className="exp-primary" onClick={save}>Einstellungen speichern</button>
   {state&&<p role="status" className="exp-feedback">{state}</p>}
  </div>
  <BackupRecovery/>
 </section>;
}
