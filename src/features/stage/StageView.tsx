import { useEffect, useState } from 'react';
import { BrowserStagePort, stageEventIdFromHash } from './protocol';
import { StageViewer, type ViewerState } from './stage-viewer';
import type { PublicStageScene } from '../../domain/projection/public-stage';

const WAIT: ViewerState = { status: 'connecting', frame: null, lastReceivedAt: null };

function Scene({ scene }: { scene: PublicStageScene }) {
  if(scene.kind==='qt-board'){
    return <section className="qt-stage-board" aria-label="Quiztafel">
      <div className="stage-kicker">QUIZTAFEL · {scene.turn}/{scene.total} FELDER</div>
      <h1>Quiztafel</h1>
      <p className="qt-stage-selector">Wahlrecht: <strong>{scene.selectorName}</strong></p>
      <div className="qt-stage-grid" style={{gridTemplateColumns:`repeat(${scene.categories.length},minmax(0,1fr))`}}>
        {scene.categories.map(c=><div className="qt-stage-column" key={c.id} style={{gridTemplateRows:"auto repeat("+scene.rows+",minmax(0,1fr))"}}>
          <h2>{c.name}</h2>
          {Array.from({length:scene.rows},(_,i)=>{
            const tileId='qt-'+c.id+'-'+(i+1),closed=scene.closedIds.includes(tileId);
            return <div key={tileId} className={'qt-stage-cell'+(closed?' closed':'')}>
              {closed?'—':(i+1)*100}
            </div>;
          })}
        </div>)}
      </div>
    </section>;
  }
  if(scene.kind==='qt-question'||scene.kind==='qt-answer'){
    return <div className="stage-live-question qt-stage-prompt">
      <p className="stage-kicker">{scene.category} · {scene.points} PUNKTE</p>
      <h1>{scene.publicPrompt}</h1>
      {scene.kind==='qt-question'&&<div className="qt-stage-team">
        <span>{scene.steal?'EINMALIGE ÜBERNAHME':'ANTWORTRECHT'}</span>
        <strong>{scene.respondingName}</strong>
      </div>}
      {scene.kind==='qt-answer'&&<div className="stage-reveal">
        <span>RICHTIGE ANTWORT</span><strong>{scene.publishedSolution}</strong>
      </div>}
    </div>;
  }
  if (scene.kind === 'question' || scene.kind === 'answer') {
    return (
      <div className="stage-live-question">
        <p className="stage-kicker">{scene.heading}</p>
        <h1>{scene.publicPrompt}</h1>
        {scene.kind === 'question' && scene.visibleClues.length > 0 && (
          <div className="stage-clues" aria-label="Veröffentlichte Hinweise">
            {scene.visibleClues.map((clue, i) => <p key={i}>{clue}</p>)}
          </div>
        )}
        {scene.kind === 'answer' && <div className="stage-reveal">
          <span>RICHTIGE ANTWORT</span><strong>{scene.publishedSolution}</strong>
        </div>}
      </div>
    );
  }
  if (scene.kind === 'scores') {
    return <div className="stage-live-question">
      <p className="stage-kicker">ZWISCHENSTAND</p><h1>{scene.heading}</h1>
      <div className="stage-scores">{scene.visibleScores.map((team) => (
        <div key={team.name}><span>{team.name}</span><strong>{team.value}</strong></div>
      ))}</div>
    </div>;
  }
  return <div className="stage-live-question">
    <p className="stage-kicker">{scene.kind === 'paused' ? 'KURZE UNTERBRECHUNG' : 'DER QUIZABEND'}</p>
    <h1>{scene.kind === 'paused' ? 'Pause' : 'Warte auf die Spielleitung'}</h1>
  </div>;
}

export function StageView() {
  const eventId = stageEventIdFromHash(window.location.hash);
  const [state, setState] = useState<ViewerState>(WAIT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(WAIT);
    setError(null);
    if (!eventId) return;
    let viewer: StageViewer | null = null;
    try {
      viewer = new StageViewer(eventId, new BrowserStagePort(eventId), setState);
      viewer.start();
    } catch {
      viewer?.stop();
      setError('Diese Browser-Umgebung unterstützt die Beamer-Verbindung nicht.');
      return;
    }
    const runningViewer = viewer;
    const clock = window.setInterval(() => runningViewer.tick(), 1000);
    const onFocus = () => runningViewer.tick();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      runningViewer.stop();
    };
  }, [eventId]);

  // Hash navigation can reuse this component before useEffect has reset its old state.
  // Never paint an answer belonging to a previously selected event.
  const scene = state.status === 'live' && state.frame?.eventId === eventId ? state.frame.scene : null;
  const status = !eventId ? 'Sitzungslink fehlt' : error
    ? 'Nicht unterstützt'
    : scene ? 'Mit Spielleitung verbunden'
    : state.status === 'connecting' ? 'Verbindung wird aufgebaut'
    : state.status === 'conflict' ? 'Übertragung widersprüchlich'
    : 'Verbindung unterbrochen';

  return <main className="stage-preview" aria-label="Beamer-Ansicht">
    <div className="stage-topline">
      <span>LiGo<span className="stage-yellow">Quiz</span></span>
      <span>LIGOQUIZ · BEAMER</span>
    </div>
    <div className="stage-center" aria-live="polite" aria-atomic="true">
      {scene ? <Scene scene={scene}/> : <>
        <div className="stage-mark" aria-hidden="true"><span/><span/><span/></div>
        <p className="stage-kicker">{state.status === 'stale' || state.status === 'conflict' ? 'VERBINDUNG UNTERBROCHEN' : 'BEREIT FÜR DEN QUIZABEND'}</p>
        <h1>Warte auf die<br/><span>Spielleitung</span></h1>
        <p>{!eventId ? 'Öffne diesen Bildschirm über die Spielleitung.'
          : error ?? (state.status === 'conflict'
            ? 'Widersprüchliche Projektionsdaten. Die Anzeige bleibt sicher ausgeblendet.'
            : 'Sobald eine Verbindung besteht, wird nur der freigegebene Spielinhalt angezeigt.')}</p>
      </>}
    </div>
    <div className="stage-bottom">
      <span aria-live="polite">{status}</span>
      <span>Nur freigegebene Spielinhalte</span>
    </div>
  </main>;
}
