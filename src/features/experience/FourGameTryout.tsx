import {useState} from 'react';
import * as QT from '../../games/quiztafel/engine';
import * as VB from '../../games/verbindungen/engine';
import * as UD from '../../games/umfrageduell/engine';
import type {TryoutState,TryoutCommand,TryoutGame} from './tryout-model';
import {createTryout,stepTryout,publicTryout,privateTryout,tryoutScores} from './tryout-model';
import './u13-rehearsal.css';

function Action({label,onClick,disabled=false}:{label:string;onClick:()=>void;disabled?:boolean}){
 return <button type="button" className="u13-action" onClick={onClick} disabled={disabled}>{label}</button>;
}
function GameControls({state,send}:{state:TryoutState;send:(command:TryoutCommand)=>void}){
 if(state.game==='quiztafel'){
  const s=state.data,go=(action:QT.Action)=>send({game:'quiztafel',action});
  const tile=QT.selectedTile(s);
  return <div className="u13-controls" aria-label="Quiztafel-Übung">
   {s.phase==='setup'&&<Action label="Quiztafel starten" onClick={()=>go({type:'START'})}/>}
   {s.phase==='board'&&<div className="u13-pick" aria-label="Feld auswählen">
    {s.tiles.filter(t=>!s.usedTileIds.includes(t.id)).map(t=>
     <Action key={t.id} label={s.categories.find(c=>c.id===t.categoryId)?.name+' · '+t.value}
      onClick={()=>go({type:'PICK',tileId:t.id})}/>)}</div>}
   {s.phase==='prepared'&&<>
    <p>Ausgewählt: {tile?.prompt}</p>
    <Action label="Feld ändern" onClick={()=>go({type:'UNPICK'})}/>
    <Action label="Frage zeigen" onClick={()=>go({type:'PUBLISH'})}/>
   </>}
   {s.phase==='question'&&<>
    <p>Antwortrecht: {QT.selector(s).name}</p>
    <Action label="Erstantwort richtig" onClick={()=>go({type:'PRIMARY',result:'correct'})}/>
    <Action label="Erstantwort falsch" onClick={()=>go({type:'PRIMARY',result:'wrong'})}/>
    <Action label="Keine Antwort" onClick={()=>go({type:'PRIMARY',result:'none'})}/>
   </>}
   {s.phase==='steal-offer'&&<Action label="Übernahme anbieten" onClick={()=>go({type:'OFFER_STEAL'})}/>}
   {s.phase==='steal'&&<>
    <p>Übernahme: {QT.eligibleStealer(s).name}</p>
    <Action label="Übernahme richtig" onClick={()=>go({type:'STEAL',result:'correct'})}/>
    <Action label="Übernahme falsch" onClick={()=>go({type:'STEAL',result:'wrong'})}/>
    <Action label="Übernahme abgelehnt" onClick={()=>go({type:'STEAL',result:'declined'})}/>
   </>}
   {s.phase==='adjudicated'&&<Action label="Lösung veröffentlichen" onClick={()=>go({type:'REVEAL'})}/>}
   {s.phase==='revealed'&&<>
    <p>Wertungsentscheidung: {s.candidate==='selector'?QT.selector(s).name:s.candidate==='stealer'?QT.eligibleStealer(s).name:'Kein Team'}</p>
    <Action label="Keine Punkte" onClick={()=>go({type:'ADJUST',winner:'none'})}/>
    <Action label="Punkte bestätigen" onClick={()=>go({type:'CONFIRM'})}/>
   </>}
   {s.phase==='awarded'&&<Action label="Nächstes Feld" onClick={()=>go({type:'NEXT'})}/>}
  </div>;
 }
 if(state.game==='verbindungen'){
  const s=state.data,go=(action:VB.Action)=>send({game:'verbindungen',action});
  const {puzzle,assignment}=s.phase==='complete'?{puzzle:null,assignment:null}:VB.active(s);
  const group=puzzle?.kind==='wall'?puzzle.groups[s.revealedGroups-1]:undefined;
  return <div className="u13-controls" aria-label="Verbindungen-Übung">
   {s.phase==='setup'&&<Action label="Verbindungen starten" onClick={()=>go({type:'START'})}/>}
   {s.phase==='ready'&&<Action label="Aufgabe zeigen" onClick={()=>go({type:'PUBLISH'})}/>}
   {assignment?.teamId&&<p>Antwortrecht: {s.teams.find(t=>t.id===assignment.teamId)?.name}</p>}
   {s.phase==='clue-open'&&<>
    {s.clueIndex<4&&!s.judgement&&<Action label="Nächster Hinweis" onClick={()=>go({type:'NEXT_CLUE'})}/>}
    {!s.judgement&&<>
     <Action label="Antwort richtig" onClick={()=>go({type:'JUDGE',value:'correct'})}/>
     <Action label="Antwort falsch" onClick={()=>go({type:'JUDGE',value:'wrong'})}/>
     <Action label="Keine Antwort" onClick={()=>go({type:'JUDGE',value:'none'})}/>
    </>}
    {s.judgement&&<Action label="Lösung zeigen" onClick={()=>go({type:'REVEAL'})}/>}
   </>}
   {s.phase==='sequence-open'&&<>
    {!s.judgement&&<>
     <Action label="Folge richtig" onClick={()=>go({type:'JUDGE',value:'correct'})}/>
     <Action label="Folge falsch" onClick={()=>go({type:'JUDGE',value:'wrong'})}/>
     <Action label="Keine Antwort" onClick={()=>go({type:'JUDGE',value:'none'})}/>
    </>}
    {s.judgement&&<Action label="Lösung zeigen" onClick={()=>go({type:'REVEAL'})}/>}
   </>}
   {s.phase==='wall-open'&&<Action label="Wand schließen" onClick={()=>go({type:'CLOSE_WALL'})}/>}
   {(s.phase==='wall-closed'||s.phase==='wall-reveal')&&<>
    {group&&<div className="u13-team-decisions">
     <p>Gruppe {s.revealedGroups}: {group.link}</p>
     {s.teams.map(team=>{
      const mark=s.wallMarks[team.id]?.[group.id];
      return <div className="u13-team-decision" key={team.id}>
       <strong>{team.name}</strong>
       <Action label="Gruppe richtig" onClick={()=>go({type:'MARK_GROUP',teamId:team.id,groupId:group.id,correct:true})}/>
       <Action label="Gruppe falsch" onClick={()=>go({type:'MARK_GROUP',teamId:team.id,groupId:group.id,correct:false})}/>
       {mark?.group&&<>
        <Action label="Verbindung richtig" onClick={()=>go({type:'MARK_LINK',teamId:team.id,groupId:group.id,correct:true})}/>
        <Action label="Verbindung falsch" onClick={()=>go({type:'MARK_LINK',teamId:team.id,groupId:group.id,correct:false})}/>
       </>}
       <span>{mark?'Erfasst':'Offen'}</span>
      </div>;
     })}
    </div>}
    {s.revealedGroups<4&&<Action label="Nächste Gruppe auflösen"
      disabled={Boolean(group&&!s.teams.every(t=>Boolean(s.wallMarks[t.id]?.[group.id])))}
      onClick={()=>go({type:'REVEAL_WALL_GROUP'})}/>}
    {s.revealedGroups===4&&<Action label="Wandwertung bestätigen"
      disabled={s.teams.some(t=>puzzle?.kind==='wall'&&puzzle.groups.some(g=>!s.wallMarks[t.id]?.[g.id]))}
      onClick={()=>go({type:'CONFIRM'})}/>}
   </>}
   {s.phase==='revealed'&&<Action label="Wertung bestätigen" onClick={()=>go({type:'CONFIRM'})}/>}
   {s.phase==='graded'&&<Action label="Nächste Aufgabe" onClick={()=>go({type:'NEXT'})}/>}
  </div>;
 }
 if(state.game==='logikleiter'){
  const s=state.data,go=(action:import('../../games/logikleiter/engine').Action)=>send({game:'logikleiter',action});
  return <div className="u13-controls" aria-label="Logikleiter-Übung">
   {s.phase==='setup'&&<Action label="Logikleiter starten" onClick={()=>go({type:'START'})}/>}
   {s.phase==='ready'&&<Action label="Stufe veröffentlichen" onClick={()=>go({type:'PUBLISH'})}/>}
   {s.phase==='open'&&<>
    <div className="u13-team-decisions">{s.teams.map(team=><div className="u13-team-decision" key={team.id}>
     <strong>{team.name}</strong>
     <Action label="Antwort sperren" disabled={Boolean(s.locks[team.id])}
      onClick={()=>go({type:'LOCK',teamId:team.id})}/>
     <span>{s.locks[team.id]?'Erfasst':'Offen'}</span>
    </div>)}</div>
    {!s.hintShown&&<Action label="Hinweis zeigen" onClick={()=>go({type:'HINT'})}/>}
    <Action label="Antwortphase schließen" onClick={()=>go({type:'CLOSE'})}/>
   </>}
   {s.phase==='closed'&&<Action label="Lösung auflösen" onClick={()=>go({type:'REVEAL'})}/>}
   {s.phase==='revealed'&&<>
    <div className="u13-team-decisions">{s.teams.map(team=><div className="u13-team-decision" key={team.id}>
     <strong>{team.name}</strong>
     <Action label="Richtig" disabled={!s.locks[team.id]} onClick={()=>go({type:'GRADE',teamId:team.id,value:'correct'})}/>
     <Action label="Falsch" onClick={()=>go({type:'GRADE',teamId:team.id,value:'wrong'})}/>
     <Action label="Keine Antwort" onClick={()=>go({type:'GRADE',teamId:team.id,value:'absent'})}/>
     <span>{s.grades[team.id]??'Offen'}</span>
    </div>)}</div>
    <Action label="Punkte bestätigen" disabled={s.teams.some(t=>!s.grades[t.id])} onClick={()=>go({type:'CONFIRM'})}/>
   </>}
   {s.phase==='graded'&&<Action label="Nächste Stufe" onClick={()=>go({type:'NEXT'})}/>}
  </div>;
 }
 const s=state.data,go=(action:UD.Action)=>send({game:'umfrageduell',action});
 const survey=s.surveys[s.index];
 return <div className="u13-controls" aria-label="Umfrageduell-Übung">
  {s.phase==='setup'&&<Action label="Umfrageduell starten" onClick={()=>go({type:'START'})}/>}
  {s.phase==='ready'&&<Action label="Umfrage zeigen" onClick={()=>go({type:'PUBLISH'})}/>}
  {s.phase==='open'&&<Action label="Antwortphase schließen" onClick={()=>go({type:'CLOSE'})}/>}
  {s.phase==='closed'&&survey&&<>
   <div className="u13-team-decisions">{s.teams.map(team=><div className="u13-team-decision" key={team.id}>
    <strong>{team.name}</strong>
    {survey.categories.map((c,i)=><Action key={c.label} label={c.label} onClick={()=>go({
     type:'RECORD',teamId:team.id,submission:{answers:[c.label],mapped:[(i+1) as UD.Rank]},
    })}/>)}
    <Action label="Keine Antwort" onClick={()=>go({type:'RECORD',teamId:team.id,submission:{answers:[],mapped:[]}})}/>
    <span>{s.submissions[team.id]?'Erfasst':'Offen'}</span>
   </div>)}</div>
   <Action label="Kategorien auflösen" disabled={s.teams.some(t=>!s.submissions[t.id])} onClick={()=>go({type:'REVEAL'})}/>
  </>}
  {s.phase==='revealed'&&<Action label="Teamwertungen bestätigen" onClick={()=>go({type:'CONFIRM'})}/>}
  {s.phase==='graded'&&<Action label="Nächste Umfrage" onClick={()=>go({type:'NEXT'})}/>}
 </div>;
}

export function FourGameTryout({game}:{game:TryoutGame}){
 const [state,setState]=useState<TryoutState>(()=>createTryout(game));
 const [error,setError]=useState('');
 const preview=publicTryout(state),points=tryoutScores(state);
 const finished=state.data.phase==='complete';
 const privateTask=finished?null:privateTryout(state);
 function send(command:TryoutCommand){
  try{
   setState(previous=>stepTryout(previous,command));
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Übungsschritt nicht zulässig.');}
 }
 return <section className="u13-practice" aria-label="Spielregeln ausprobieren" data-u13-game={game}>
  <div className="u13-practice-head">
   <strong>{game==='quiztafel'?'Quiztafel':game==='verbindungen'?'Verbindungen':game==='logikleiter'?'Logikleiter':'Umfrageduell'}</strong>
   <button type="button" onClick={()=>{setState(createTryout(game));setError('');}}>Übung neu starten</button>
  </div>
  <div className="u13-practice-grid">
   <div className="u13-private">
    <h2>Spielleitung · Übung</h2>
    <p>Phase: {state.data.phase} · Schritt {state.game==='quiztafel'?state.data.turn+1:state.data.index+1}</p>
    <div className="u13-points" aria-label="Übungspunkte">
     {state.data.teams.map(t=><div key={t.id}><span>{t.name}</span><strong>{points[t.id]??0}</strong></div>)}
    </div>
    {privateTask&&<div className="u13-private-task">
     <strong>Private Aufgabenkarte</strong>
     <p>{privateTask.prompt}</p>
     <p>Antwort: <strong>{privateTask.answer}</strong></p>
     <small>Quelle: {privateTask.reference}</small>
    </div>}
    {finished?<p role="status">Übungsdurchlauf beendet.</p>:
      <GameControls state={state} send={send}/>}
    {error&&<p role="alert" className="exp-error">{error}</p>}
   </div>
   <div className="u13-public" aria-label="Öffentliche Übungsvorschau" data-u13-public-revealed={preview.released}>
    <span>Publikumsansicht · nur freigegebene Daten</span>
    <h2>{preview.heading}</h2>
    {preview.lines.length>0?<ul>{preview.lines.map((line,i)=><li key={i}>{line}</li>)}</ul>:
      <p>Noch keine Frage veröffentlicht.</p>}
   </div>
  </div>
  <p className="u13-notice">Ungeprüfte Probeinhalte. Nur eine flüchtige Übung; kein Spielstand, keine echte Beamerverbindung, keine Wertung eines Quizabends.</p>
 </section>;
}
