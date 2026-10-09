import { useState } from 'react';
import { createSession, transition, currentQuestion, publicScene, scores, type Action, type Session } from '../../games/rundenquiz/engine';
import { RQ_TRIAL_BANK } from '../../games/rundenquiz/trial-bank';

const DEMO_ID='disposable-demo-only';
function firstDemo():Session{
 const session=createSession({
  id:DEMO_ID,ownerId:'demo-only-host',profile:'kurz',
  teams:[0,1,2].map(i=>({id:'demo-team-'+(i+1),name:'Team '+(i+1),order:i})),
  bank:RQ_TRIAL_BANK,
 });
 const one={...session,questions:session.questions.slice(0,1)};
 return transition(one,{
  id:'demo-begin',ownerId:one.ownerId,epoch:one.epoch,expectedRevision:one.revision,
  at:0,action:{type:'START'},
 });
}
function stageView(s:Session){
 const scene=publicScene(s);
 if(scene.kind==='waiting')return <div><p>DER QUIZABEND</p><h2>{scene.title}</h2></div>;
 if(scene.kind==='paused')return <h2>Pause</h2>;
 if(scene.kind==='question')return <div><p>WISSEN</p><h2>{scene.prompt}</h2></div>;
 if(scene.kind==='answer')return <div><p>RICHTIGE ANTWORT</p><h2>{scene.solution}</h2></div>;
 if(scene.kind==='results')return <div><p>ERGEBNIS</p>{scene.teams.map(t=><p key={t.id}>
   {t.name}: <strong>{scene.scores[t.id]??0}</strong> Punkte</p>)}</div>;
 return null;
}

/** No repository, storage, session IDs, or public BroadcastChannel. */
export function DisposableDemo(){
 const [session,setSession]=useState<Session>(firstDemo);
 const [error,setError]=useState('');
 const q=currentQuestion(session);
 function command(action:Action){
  try{
   setSession(current=>transition(current,{
    id:'demo-'+(current.revision+1),ownerId:current.ownerId,epoch:current.epoch,
    expectedRevision:current.revision,at:current.revision+1,action,
   }));
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Dieser Schritt ist nicht möglich.');}
 }
 const points=scores(session);
 return <section className="exp-page" aria-label="Disposable demo">
  <div className="exp-heading">
   <div><p className="eyebrow">DEMO · NICHT GESPEICHERT</p><h1>Rundenquiz ausprobieren</h1>
    <p>Eine Beispielfrage im echten Ablauf, mit drei erfundenen Teams und ohne gespeicherte Ergebnisse.</p></div>
   <a className="exp-secondary" href="#/spielen">Demo beenden</a>
  </div>
  <div className="exp-demo-grid">
   <div className="exp-demo-host">
    <div className="eyebrow">SPIELLEITUNG · PRIVAT</div>
    <h2>{session.phase==='complete'?'Demo beendet':q?.prompt}</h2>
    <p className="exp-footnote">{session.phase==='open'?'Die Frage ist für die Zuschauer sichtbar, die Lösung bleibt privat.':
      session.phase==='ready'?'Die Frage wartet auf die Freigabe.':
      session.phase==='closed'?'Die Antwortzeit ist beendet. Keine automatische Enthüllung.':
      'Die Spielleitung entscheidet über jede Veröffentlichung und Wertung.'}</p>
    <div className="exp-demo-private">
      <small>Nur Spielleitung</small><strong>Antwort: {q?.answer??'—'}</strong>
    </div>
    <div className="exp-demo-scores">{session.teams.map(t=><div key={t.id}>
      <span>{t.name}</span><strong>{points[t.id]??0}</strong>
    </div>)}</div>
    <div className="exp-demo-actions">
      {session.phase==='ready'&&<button className="exp-primary" onClick={()=>command({type:'PUBLISH'})}>Frage zeigen</button>}
      {session.phase==='open'&&<button className="exp-primary" onClick={()=>command({type:'CLOSE'})}>Antwortphase schließen</button>}
      {session.phase==='closed'&&<button className="exp-primary" onClick={()=>command({type:'REVEAL'})}>Lösung zeigen</button>}
      {session.phase==='revealed'&&<>
        <p>Antworten bewerten:</p>
        {session.teams.map(t=><div className="exp-demo-judge" key={t.id}>
          <span>{t.name}</span>
          {(['richtig','falsch','keine'] as const).map(v=><button key={v}
            aria-pressed={session.entries[t.id]?.judgement===v} onClick={()=>command({type:'JUDGE',teamId:t.id,value:v})}>{v}</button>)}
        </div>)}
        <button className="exp-primary" disabled={!session.teams.every(t=>!!session.entries[t.id]?.judgement)}
          onClick={()=>command({type:'CONFIRM'})}>Punkte bestätigen</button>
      </>}
      {session.phase==='graded'&&<button className="exp-primary" onClick={()=>command({type:'FINISH'})}>Endstand zeigen</button>}
      {session.phase==='complete'&&<a className="exp-primary" href="#/spielen">Zurück zu Spielen</a>}
    </div>
    {error&&<p className="exp-error" role="alert">{error}</p>}
   </div>
   <div className="exp-demo-stage" aria-label="Beamer-Vorschau (nur freigegebener Inhalt)">
     <span>BEAMER-VORSCHAU</span>{stageView(session)}
   </div>
  </div>
  <p className="exp-footnote">Die Demo schreibt weder in IndexedDB noch in den Verlauf oder deine Einstellungen. Sie wird beim Verlassen verworfen.</p>
 </section>;
}
