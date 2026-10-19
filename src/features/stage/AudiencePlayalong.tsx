import {useEffect,useState} from 'react';
import {BrowserStagePort} from './protocol';
import {StageViewer,type ViewerState} from './stage-viewer';
import {
  audienceRound,playalongEventIdFromHash,retainedGuess,freshGuess,type LocalGuess,
} from './audience-playalong-model';
import './audience-playalong.css';

const WAIT:ViewerState={status:'connecting',frame:null,lastReceivedAt:null};

export function AudiencePlayalong(){
 const eventId=playalongEventIdFromHash(window.location.hash);
 const [view,setView]=useState<ViewerState>(WAIT);
 const [guess,setGuess]=useState<LocalGuess|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  setView(WAIT);setGuess(null);setError('');
  if(!eventId)return;
  let viewer:StageViewer|null=null;
  try{
   viewer=new StageViewer(eventId,new BrowserStagePort(eventId),(next)=>{
    setView(next);
    setGuess(previous=>retainedGuess(previous,next));
   },{acknowledgeFrames:false});
   viewer.start();
  }catch{
   viewer?.stop();
   setError('Die Verbindung ist in diesem Browser nicht verfügbar.');
   return;
  }
  const active=viewer;
  const interval=window.setInterval(()=>active.tick(),1000);
  const onWake=()=>active.tick();
  document.addEventListener('visibilitychange',onWake);
  window.addEventListener('focus',onWake);
  return ()=>{
   window.clearInterval(interval);
   document.removeEventListener('visibilitychange',onWake);
   window.removeEventListener('focus',onWake);
   active.stop();
  };
 },[eventId]);

 const frame=view.status==='live'&&view.frame?.eventId===eventId?view.frame:null;
 const round=audienceRound(frame?.scene??null,guess?.key);
 const currentGuess=guess&&frame&&retainedGuess(guess,view)?.key===round.key?guess:null;
 const editable=Boolean(frame&&round.kind==='question'&&round.key);
 const locked=Boolean(currentGuess?.locked);
 const published=round.published.length>0;
 const status=!eventId?'Ungültiger Veranstaltungslink':error?'Nicht verfügbar':
   frame?'Mit der Spielleitung verbunden':view.status==='conflict'?
   'Widersprüchliche Verbindung':view.status==='stale'?'Verbindung verloren':'Verbindung wird aufgebaut';

 return <main className="u14-playalong" data-public-scene={frame?.scene.kind??'withheld'}
   data-audience-phase={round.kind} aria-label="Mitspielen ohne Punktewertung">
   <header className="u14-header">
    <span className="u14-logo">LiGo<strong>Quiz</strong><b aria-hidden="true">!</b></span>
    <span className="u14-connection" role="status">{status}</span>
   </header>
   <div className="u14-layout">
    <section className="u14-question" aria-label="Freigegebene Spielinhalte">
     <p className="u14-mode">{round.kind==='scores'?'PUNKTSTAND':round.kind==='reveal'?'AUFLÖSUNG':
       round.kind==='question'?'JETZT IM SPIEL':round.kind==='board'?'SPIELTAFEL':'SPIELLEITUNG'}</p>
     <h1>{round.title}</h1>
     {round.prompt&&<p className="u14-prompt">{round.prompt}</p>}
     {round.details.length>0&&<ul className="u14-detail-list">
       {round.details.map((line,i)=><li key={i}>{line}</li>)}
     </ul>}
     {round.kind==='scores'&&<ol className="u14-public-scores">
       {round.scores.map((team,i)=><li key={team.name}>
         <span>{i+1}. {team.name}</span><strong>{team.value.toLocaleString('de-DE')}</strong>
       </li>)}
     </ol>}
     {!frame&&<p className="u14-offline">{!eventId?
       'Den Mitspiel-Link in der Spielleitung öffnen.':error||(
       view.status==='conflict'?'Die widersprüchliche Ausgabe bleibt ausgeblendet.':
       'Die veröffentlichte Frage erscheint, sobald die Spielleitung in einem zweiten Tab desselben Browsers sendet.')}</p>}
     {published&&<div className="u14-reveal" aria-label="Öffentlich freigegebene Auflösung">
       <h2>{round.kind==='question'?'Bisher veröffentlicht':'Öffentliche Auflösung'}</h2>
       <ol>{round.published.map((line,i)=><li key={i}>{line}</li>)}</ol>
     </div>}
    </section>
    <section className="u14-answer" aria-label="Eigener Tipp">
     <h2>Dein Tipp</h2>
     {editable&&!locked&&<form onSubmit={e=>{
       e.preventDefault();
       if(currentGuess?.text.trim())setGuess({...currentGuess,locked:true,text:currentGuess.text.trim()});
      }}>
       <label htmlFor="u14-guess-input">Eigene Antwort</label>
       <textarea id="u14-guess-input" rows={4} maxLength={240}
         value={currentGuess?.text??''} onChange={e=>{
           if(frame)setGuess(freshGuess(frame,round,e.target.value));
         }} placeholder="Antwort notieren" autoComplete="off"/>
       <div className="u14-answer-actions">
        <span>{currentGuess?.text.length??0}/240</span>
        <button type="submit" disabled={!currentGuess?.text.trim()}>Tipp festhalten</button>
       </div>
      </form>}
     {locked&&<div className="u14-locked" role="status">
       <p>Festgehalten</p>
       <blockquote>{currentGuess?.text}</blockquote>
       {editable&&<button type="button" onClick={()=>currentGuess&&setGuess({...currentGuess,locked:false})}>
         Tipp bearbeiten</button>}
      </div>}
     {round.kind==='reveal'&&!locked&&<p>Kein Tipp vor der Auflösung festgehalten.</p>}
     {(round.kind==='scores'||round.kind==='board')&&<p>
       {round.kind==='board'?'Nach Veröffentlichung einer Frage kannst du hier antworten.':
         'Die Wertung der Teams kommt ausschließlich von der Spielleitung.'}</p>}
     {round.kind==='waiting'&&<p>Bei Verbindungsverlust oder Pause werden eigene Notizen ausgeblendet und verworfen.</p>}
     {round.kind==='question'&&<p className="u14-answer-state">
       Dein Tipp wird nur hier auf diesem Bildschirm gehalten, nicht eingesendet oder bewertet.</p>}
    </section>
   </div>
   <footer className="u14-footer">
    <span>Nur im selben Browser und Gerät verbunden. Keine Handy- oder Netzwerkübertragung.</span>
    <span>Privater Tipp · kein Punktestand</span>
   </footer>
 </main>;
}
