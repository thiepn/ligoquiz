import {useState} from 'react';
import type {EventRecord} from '../../domain/event/schemas';
import {completedRoundReview,type ReviewTask} from './round-review-model';
import './u15-round-review.css';

function Breakdown({task,selectedTeam}:{task:ReviewTask;selectedTeam:string}){
 const teams=selectedTeam==='all'?task.teams:task.teams.filter(t=>t.id===selectedTeam);
 return <div className="u15-review-points" aria-label="Originale Punkte dieser Aufgabe">
  {teams.map(team=><div className="u15-review-points-row" key={team.id}>
   <strong>{team.name}</strong>
   <span className={team.points>0?'u15-points-positive':''}>
    {team.points>0?'+':''}{team.points} <small>Aufgabe</small>
   </span>
   <span>{team.total} <small>Gesamt</small></span>
  </div>)}
 </div>;
}

/** Read-only, owner-data-backed local archive; never mounted on the public stage. */
export function RoundReviewDesk({event}:{event:EventRecord}){
 const review=completedRoundReview(event);
 const [selectedTeam,setSelectedTeam]=useState('all');
 const [mode,setMode]=useState<'all'|'scored'>('all');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [answerVisible,setAnswerVisible]=useState(false);
 if(!review)return null;
 const visible=review.tasks.filter(task=>mode==='all'||task.teams.some(t=>
  (selectedTeam==='all'||t.id===selectedTeam)&&t.points>0));
 const index=Math.max(0,visible.findIndex(t=>t.id===selectedId));
 const selected=visible[index]??null;
 const max=Math.max(1,...review.tasks.at(-1)!.teams.map(t=>t.total));

 const choose=(id:string)=>{
  setSelectedId(id);setAnswerVisible(false);
 };
 const move=(direction:-1|1)=>{
  if(!selected)return;
  const next=visible[index+direction];
  if(next)choose(next.id);
 };
 return <section className="u15-review" aria-label="Rundenrückblick" data-review-game={review.game}>
  <header className="u15-review-head">
   <div><h2>Rundenrückblick</h2>
    <strong>{review.game} · {review.tasks.length} Aufgaben</strong></div>
   <span className="u15-review-finished">Abgeschlossen</span>
  </header>
  <div className="u15-review-controls">
   <label>Team
    <select aria-label="Team im Rückblick" value={selectedTeam}
      onChange={e=>{setSelectedTeam(e.target.value);setSelectedId(null);setAnswerVisible(false);}}>
     <option value="all">Alle Teams</option>
     {review.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
    </select></label>
   <label>Aufgaben
    <select aria-label="Aufgaben filtern" value={mode}
      onChange={e=>{setMode(e.target.value as 'all'|'scored');setSelectedId(null);setAnswerVisible(false);}}>
     <option value="all">Alle Aufgaben</option>
     <option value="scored">Mit Punkten</option>
    </select></label>
   <span role="status">{visible.length} von {review.tasks.length}</span>
  </div>
  <div className="u15-review-layout">
   <nav className="u15-review-task-list" aria-label="Abgeschlossene Aufgaben auswählen">
    {visible.map(task=>{
     const earned=task.teams.filter(t=>selectedTeam==='all'||t.id===selectedTeam)
       .reduce((sum,t)=>sum+t.points,0);
     return <button key={task.id} type="button" aria-current={task.id===selected?.id?'step':undefined}
       onClick={()=>choose(task.id)} className={selected?.id===task.id?'is-selected':''}>
       <span className="u15-review-task-index">{String(task.number).padStart(2,'0')}</span>
       <span className="u15-review-task-name"><strong>{task.type}</strong>
        <span>{task.prompt}</span></span>
       <span className="u15-review-task-points">{task.annulled?'Annulliert':earned>0?'+'+earned:earned}</span>
      </button>;
    })}
   </nav>
   <div className="u15-review-detail">
    {selected?<>
     <div className="u15-review-detail-top"><span>{selected.type}</span>
      <strong>{selected.number} / {review.tasks.length}</strong></div>
     <h3>{selected.prompt}</h3>
     <Breakdown task={selected} selectedTeam={selectedTeam}/>
     {selected.annulled&&<p role="status" className="u15-review-annulled">Annulliert – keine Punkte aus dieser Aufgabe.</p>}
     <div className="u15-review-answer">
      <button type="button" aria-expanded={answerVisible} aria-controls="u15-review-solution"
       onClick={()=>setAnswerVisible(v=>!v)}>{answerVisible?'Lösung verbergen':'Lösung und Quelle prüfen'}</button>
      {answerVisible&&<div id="u15-review-solution">
       <h4>Originalantwort</h4>
       <p className="u15-review-solution">{selected.answer}</p>
       {selected.evidence.length>0&&<ul>{selected.evidence.map((detail,i)=><li key={i}>{detail}</li>)}</ul>}
       <p className="u15-review-source"><b>Quelle:</b> {selected.source}</p>
      </div>}
     </div>
     <div className="u15-review-navigation">
      <button type="button" disabled={index===0} onClick={()=>move(-1)}>← Vorherige Aufgabe</button>
      <button type="button" disabled={index>=visible.length-1} onClick={()=>move(1)}>Nächste Aufgabe →</button>
     </div>
    </>:<p role="status" className="u15-review-no-results">Keine Aufgabe mit Punkten für diese Auswahl.</p>}
   </div>
  </div>
  <div className="u15-review-standings" aria-label="Originaler Punkteverlauf zum Endstand">
   <h3>Endstand der Spielpunkte</h3>
   <div className="u15-review-bars">{review.tasks.at(-1)!.teams.map(t=><div className="u15-review-bar-row" key={t.id}>
    <span>{t.name}</span>
    <div className="u15-review-bar-track"><div style={{width:Math.max(0,t.total)/max*100+'%'}}/></div>
    <strong>{t.total}</strong>
   </div>)}</div>
  </div>
  <p className="u15-review-source-notice">{review.sourceNotice}</p>
 </section>;
}
