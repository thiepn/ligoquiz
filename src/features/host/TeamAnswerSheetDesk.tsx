import {useEffect,useMemo,useState} from 'react';
import type {EventRecord} from '../../domain/event/schemas';
import {originalAnswerSheetPlan,printableTeamSheets,type PrintSheetOptions} from './team-answer-sheets';
import './u17-answer-sheets.css';

/** Owner-cockpit-only, ephemeral print link. Never writes to session storage or stage. */
export function TeamAnswerSheetDesk({event}:{event:EventRecord}){
 const [expanded,setExpanded]=useState(false);
 const [teamId,setTeamId]=useState('all');
 const [lines,setLines]=useState<2|3|4>(3);
 const [url,setUrl]=useState<string|null>(null);
 const [error,setError]=useState('');
 const plan=useMemo(()=>originalAnswerSheetPlan(event),[event]);
 const chosen=plan&&plan.teams.some(t=>t.id===teamId)?teamId:'all';
 const html=useMemo(()=>{
  if(!expanded||!plan)return null;
  try{return printableTeamSheets(plan,{teamId:chosen,answerLines:lines} satisfies PrintSheetOptions);}
  catch{return null;}
 },[expanded,plan,chosen,lines]);
 useEffect(()=>{
  setUrl(null);setError('');
  if(!html)return;
  let link:string;
  try{link=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));}
  catch{setError('Antwortbögen konnten in diesem Browser nicht vorbereitet werden.');return;}
  setUrl(link);
  return ()=>URL.revokeObjectURL(link);
 },[html]);
 if(!plan)return null;
 const selected=chosen==='all'?plan.teams.length:1;
 return <section className="u17-answer-desk" aria-label="Papier-Antwortbögen" data-answer-sheets-game={plan.game}>
  <button type="button" className="u17-answer-toggle" aria-expanded={expanded}
   onClick={()=>setExpanded(v=>!v)}>Antwortbögen vorbereiten</button>
  {expanded&&<div className="u17-answer-panel">
   <div className="u17-answer-settings">
    <label>Team auswählen
     <select value={chosen} onChange={e=>setTeamId(e.target.value)} aria-label="Antwortbogen für Team">
      <option value="all">Alle Teams ({plan.teams.length})</option>
      {plan.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
     </select>
    </label>
    <label>Schreibplatz pro Aufgabe
     <select value={lines} onChange={e=>setLines(Number(e.target.value) as 2|3|4)}
      aria-label="Antwortzeilen je Aufgabe">
      <option value={2}>2 Zeilen</option>
      <option value={3}>3 Zeilen</option>
      <option value={4}>4 Zeilen</option>
     </select>
    </label>
   </div>
   <div className="u17-answer-summary">
    <strong>{plan.tasks.length} Aufgaben</strong>
    <span>{selected} {selected===1?'Team':'Teams'} · DIN A4</span>
   </div>
   {error&&<p role="alert">{error}</p>}
   {url?<a className="u17-answer-open" href={url} target="_blank" rel="noopener noreferrer">
    Druckansicht öffnen <span aria-hidden="true">↗</span></a>:
    <span role="status">Druckansicht wird vorbereitet.</span>}
  </div>}
 </section>;
}
