import {useMemo,useState} from 'react';
import {GAME_TYPES,type GameType,type GameProfile} from '../../domain/game/contracts';
import type {ContentItem} from '../../content/contracts';
import {launchContentInventory} from '../../content/launch-inventory';
import {composeContentPack,exportPreparationPlan,prepareFiveGameEvening} from '../../content/pack-preparation';
import {buildEditorialRehearsal,projectedRehearsalFrame} from '../../content/game-night-rehearsal';
import '../../styles/g28-launch-inventory.css';

const labels:Record<GameType,string>={
 rundenquiz:'Rundenquiz',quiztafel:'Quiztafel',verbindungen:'Verbindungen',
 logikleiter:'Logikleiter',umfrageduell:'Umfrageduell',
};
/** Local original-source content planning only; all G10 and G26 authorities untouched. */
export function LaunchInventoryPanel({items,onChoose}:{
 items:readonly ContentItem[];onChoose:(item:ContentItem)=>void;
}){
 const inventory=useMemo(()=>launchContentInventory(items),[items]);
 const [game,setGame]=useState<GameType>('rundenquiz');
 const [profile,setProfile]=useState<GameProfile>('lang');
 const [teams,setTeams]=useState<3|4|5>(5);
 const [showAll,setShowAll]=useState(false);
 const [stepIndex,setStepIndex]=useState(0);
 const [overrides,setOverrides]=useState<Record<string,Record<string,string>>>({});
 const configKey=game+'/'+profile+'/'+teams;
 const plan=useMemo(()=>composeContentPack(items,game,profile,teams,overrides[configKey]??{}),
  [items,game,profile,teams,overrides,configKey]);
 const eveningOverrides=useMemo(()=>Object.fromEntries(GAME_TYPES.map(key=>
  [key,overrides[key+'/'+profile+'/'+teams]??{}])) as Record<GameType,Record<string,string>>,
  [overrides,profile,teams]);
 const evening=useMemo(()=>prepareFiveGameEvening(items,profile,teams,eveningOverrides),
  [items,profile,teams,eveningOverrides]);
 const rehearsal=useMemo(()=>buildEditorialRehearsal(plan,items),[plan,items]);
 const activeStep=rehearsal.steps[Math.min(stepIndex,rehearsal.steps.length-1)]??null;
 const frame=projectedRehearsalFrame(activeStep);
 const firstBySlot=new Set<string>();
 const conflicts=rehearsal.steps.filter(step=>{
  if(!step.issues.length||firstBySlot.has(step.slot))return false;
  firstBySlot.add(step.slot);return true;
 });
 function goToNextIssue(){
  if(!conflicts.length)return;
  const next=conflicts.find(s=>s.index>stepIndex)??conflicts[0];
  if(next)setStepIndex(next.index);
 }
 function setGameSelection(next:GameType){setGame(next);setStepIndex(0);}
 function setProfileSelection(next:GameProfile){setProfile(next);setStepIndex(0);}
 function setTeamsSelection(next:3|4|5){setTeams(next);setStepIndex(0);}
 function downloadPlan(){
  const blob=new Blob([exportPreparationPlan(plan)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  try{link.href=url;link.download='ligoquiz-g30-packplan-quell-ids.json';link.click();}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 const program=inventory.programs.find(p=>
  p.game===game&&p.profile===profile&&p.teams===teams)!;
 const queue=inventory.priorities.filter(p=>p.item.game===game);
 return <section className="g28-inventory" aria-label="G28 Startinhalte und Quellenzuordnung">
  <div className="g28-inventory-head">
   <h2>Startinhalte und Quellenzuordnung</h2>
   <strong>NO_GO · Nicht freigegeben</strong>
  </div>
  <div className="g28-inventory-stats">
   <div><b>{inventory.originalDeclaredActive}</b><span>V1 deklarierte aktive Inhalte</span></div>
   <div><b>{inventory.localCount}</b><span>Tatsächliche V2-Datensätze</span></div>
   <div><b>{inventory.validUnapproved}</b><span>Valide, noch nicht freigegebene V2-Entwürfe</span></div>
   <div><b>{inventory.possibleLegacyLinks.length}</b><span>Nur strukturelle V1-Verknüpfungen</span></div>
  </div>
  <p className="g28-critical">V1-Zählungen sind historische Originalcode-Metadaten, keine übertragenen Fragen.
   Keine der {inventory.originalDeclaredActive} Altfragen ist durch diese Übersicht individuell migriert
   oder unabhängig fachlich/rechtlich freigegeben. {inventory.unreviewedIllustrative} lokale
   Umfrageaufgaben bleiben ausdrücklich illustrativ.</p>
  <details>
   <summary>Acht V1-Quellfamilien prüfen</summary>
   <div className="g28-family-grid">
    {inventory.historicFamilies.map(f=><div key={f.code}>
     <b>{f.code}</b><span>{f.declared} historisch gemeldet</span><span>0 verifizierte V2-Zuordnungen</span>
    </div>)}
   </div>
   <p>Eine Ähnlichkeit der historischen Quellfamilie zu einem V2-Spiel beweist keine
    Frage-ID, korrekte Antwort, freie Lizenz oder Schemaübernahme.</p>
  </details>
  <details>
   <summary>Strukturelle Importkandidaten ({inventory.possibleLegacyLinks.length})</summary>
   {inventory.possibleLegacyLinks.slice(0,25).map(candidate=><p key={candidate.sourceId}>
    {candidate.sourceId} → {candidate.itemId} ({labels[candidate.game]}) · Herkunft nur aus
    importierten Metadaten, Originaldatensatz nicht gegengeprüft
   </p>)}
   {inventory.legacyCollisions.map(id=><p key={id}>Mehrdeutige Quell-ID: {id}</p>)}
   {inventory.possibleLegacyLinks.length===0&&<p>Keine quellgebundenen Zuordnungskandidaten.
    Die 79 V2-Probeaufgaben sind kein V1-Migrationsnachweis.</p>}
  </details>
  <div className="g28-program-controls">
   <label>Spiel <select aria-label="G28 Spiel" value={game}
    onChange={e=>setGameSelection(e.target.value as GameType)}>
    {GAME_TYPES.map(key=><option key={key} value={key}>{labels[key]}</option>)}
   </select></label>
   <label>Profil <select aria-label="G28 Profil" value={profile}
    onChange={e=>setProfileSelection(e.target.value as GameProfile)}>
    <option value="kurz">Kurz</option><option value="standard">Standard</option>
    <option value="lang">Lang</option>
   </select></label>
   <label>Teams <select aria-label="G28 Teams" value={teams}
    onChange={e=>setTeamsSelection(Number(e.target.value) as 3|4|5)}>
    {[3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
   </select></label>
  </div>
  <div className="g28-program-result" aria-label="G28 Strukturelle Abdeckung">
   <strong>{program.structurallyComplete?'Strukturell vollständig':'Strukturell unvollständig'}</strong>
   <span>{program.candidateCount} valide Quellkandidaten · {program.locallyApproved} lokale Freigabeangaben</span>
   <div className="g28-gap-grid">
    {program.gaps.map(g=><div key={g.kind}>
     <b>{g.kind}</b><span>{g.present} / {g.required}</span>
     {g.missing>0&&<strong>{g.missing} fehlen</strong>}
    </div>)}
   </div>
   <p>Nur Strukturprüfung aus lokalen Quellen. Kein Beleg für editorische Freigabe,
    tatsächliche Spielauswahl, Sachrichtigkeit, Rechte oder Publikationsreife.</p>
  </div>
  <section className="g30-pack-plan" aria-label="G30 Original-Packplanung">
   <div className="g28-inventory-head">
    <h3>Packplanung · {labels[game]}</h3><strong>NO_GO · Quellenentwürfe</strong>
   </div>
   <p>{plan.slots.length} Plätze · {plan.selectedIds.length} zugeordnete Aufgaben ·
    {' '}{plan.sourceDrafts} ohne lokale Freigabe · {plan.problems.length} Prüfhinweise</p>
   <strong>{plan.structuralReady?'Regelstruktur erfüllt':'Spielstruktur unvollständig'}</strong>
   {plan.problems.length>0&&<div className="g30-pack-problems" aria-label="G30 Packrisiken">
    {plan.problems.slice(0,20).map((problem,i)=><p key={problem.code+'-'+i}>
     <b>{problem.code}:</b> {problem.message}
     {problem.itemIds.map(id=><span key={id}> {id}</span>)}</p>)}
   </div>}
   {evening.spoilers.length>0&&<div className="g30-pack-problems"
    aria-label="G30 Spielübergreifende Hinweis-Konflikte">
    <strong>Spielübergreifende Hinweis-Konflikte</strong>
    {evening.spoilers.map((problem,i)=><div key={i}>
     {problem.itemIds.map(id=><button type="button" className="exp-secondary" key={id}
      onClick={()=>{const item=items.find(x=>x.id===id);if(item)onChoose(item);}}>
      {id} im G10-Editor prüfen</button>)}
    </div>)}
   </div>}
   <div className="g30-plan-actions">
    <button type="button" className="exp-secondary" onClick={downloadPlan}
     disabled={!plan.selectedIds.length}>Quell-IDs als Packplan exportieren</button>
    <button type="button" className="exp-secondary"
     onClick={()=>setOverrides(prev=>({...prev,[configKey]:{}}))}>
     Auswahl zurücksetzen</button>
   </div>
   <details>
    <summary>Aufgabenplätze und Originalquellen wählen ({plan.slots.length})</summary>
    <div className="g30-pack-slots">
     {plan.slots.map(slot=><div key={slot.key} className="g30-pack-slot">
      <label>{slot.label}
       <select value={slot.selected??''} aria-label={'G30 '+slot.label}
        onChange={e=>setOverrides(prev=>({...prev,[configKey]:{
         ...prev[configKey],[slot.key]:e.target.value}}))}>
        <option value="">Nicht besetzt</option>
        {slot.options.map(id=><option value={id} key={id}>{id}</option>)}
       </select>
      </label>
      {slot.selected&&<button type="button" className="exp-secondary"
       onClick={()=>{const item=items.find(x=>x.id===slot.selected);if(item)onChoose(item);}}>
       {slot.selected} in G10 prüfen</button>}
     </div>)}
    </div>
   </details>
   <section className="g31-rehearsal" aria-label="G31 Moderationsprobe">
    <div className="g28-inventory-head">
     <h3>Moderationsprobe · {labels[game]}</h3><strong>NO_GO</strong>
    </div>
    <p>{rehearsal.taskCount} Aufgaben · {rehearsal.steps.length} Moderationsschritte
     {' '}· {rehearsal.missingCount} fehlend · {rehearsal.conflictedCount} mit Prüfhinweisen</p>
    <p>Teamaufgaben: {rehearsal.teamTurns.map((n,i)=>'Team '+(i+1)+': '+n).join(' · ')}
     {' '}· {rehearsal.balancedTeamExposure?'Gleich verteilt':'Verteilung prüfen'}</p>
    <div className="g31-nav">
     <button type="button" className="exp-secondary" disabled={!activeStep||activeStep.index===0}
      onClick={()=>setStepIndex(v=>Math.max(0,v-1))}>Vorheriger Schritt</button>
     <button type="button" className="exp-secondary"
      disabled={!activeStep||activeStep.index===rehearsal.steps.length-1}
      onClick={()=>setStepIndex(v=>Math.min(rehearsal.steps.length-1,v+1))}>Nächster Schritt</button>
     <button type="button" className="exp-secondary" disabled={!conflicts.length}
      onClick={goToNextIssue}>Nächsten Prüffall zeigen</button>
     <button type="button" className="exp-secondary"
      onClick={()=>setGameSelection(GAME_TYPES[(GAME_TYPES.indexOf(game)+1)%GAME_TYPES.length]!)}>
      Nächstes Spiel</button>
    </div>
    <div className="g31-two-views">
     <section className="g31-moderator" aria-label="G31 Spielleitung">
      <h4>Spielleitung</h4>
      {activeStep?<div aria-live="polite">
       <strong>Schritt {activeStep.index+1} / {rehearsal.steps.length} · {activeStep.slotLabel}</strong>
       <p>{activeStep.hostStep} · {activeStep.hostNext}</p>
       <p>{activeStep.scoreState}</p>
       <p>Quelle: {activeStep.sourceId??'Fehlender Inhalt'}</p>
       {activeStep.issues.length>0&&<p>{activeStep.issues.map(i=>i.code).join(' · ')}</p>}
       {activeStep.sourceId&&<button type="button" className="exp-secondary"
        onClick={()=>{const item=items.find(x=>x.id===activeStep.sourceId);
         if(item)onChoose(item);}}>Quelle {activeStep.sourceId} in G10 prüfen</button>}
      </div>:<p>Keine Aufgaben für dieses Profil.</p>}
     </section>
     <section className="g31-stage" aria-label="G31 Beamer-Probe">
      <h4>Beamer · Vorschau</h4>
      <strong aria-live="polite">{frame.stage}</strong>
     </section>
    </div>
    <p>Lesbare Simulation der ursprünglichen Moderationsphasen. Kein Spielstand,
     keine Bewertung, keine Live-Projektion oder Veröffentlichung.</p>
   </section>
   <p>Die Planung verwendet nur Original-IDs und bestehende Regeln. Auch vollständig besetzte Packs bleiben
    ohne unabhängige Redaktion, Rechteprüfung und G26-Entscheid nicht veröffentlichbar.</p>
  </section>
  <details>
   <summary>Alle 45 Kombinationen ({inventory.programs.filter(p=>p.structurallyComplete).length} strukturell vollständig)</summary>
   <table><thead><tr><th>Spiel</th><th>Profil</th><th>Teams</th><th>Struktur</th></tr></thead>
    <tbody>{inventory.programs.map(p=><tr key={p.game+'-'+p.profile+'-'+p.teams}>
     <td>{labels[p.game]}</td><td>{p.profile}</td><td>{p.teams}</td>
     <td>{p.structurallyComplete?'Vollständig':'Fehlend: '+p.gaps.filter(g=>g.missing).map(g=>g.kind+' '+g.missing).join(', ')}</td>
    </tr>)}</tbody></table>
  </details>
  <div className="g28-priority-head">
   <h3>Redaktionelle Reihenfolge · {labels[game]}</h3>
   <label><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>
    Alle offenen Aufgaben</label>
  </div>
  <div className="g28-priorities">
   {queue.slice(0,showAll?queue.length:8).map(task=><button type="button"
    className="g28-priority" key={task.item.id} onClick={()=>onChoose(task.item)}>
    <strong>{task.item.id}</strong><span>{task.reasons.join(' · ')}</span>
   </button>)}
   {queue.length===0&&<p>Keine offenen Aufgaben dieses Spiels.</p>}
  </div>
 </section>;
}
