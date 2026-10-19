import { useEffect, useState } from 'react';
import { BrowserStagePort, stageEventIdFromHash } from './protocol';
import { StageViewer, type ViewerState } from './stage-viewer';
import type { PublicStageScene } from '../../domain/projection/public-stage';
import {stagePresentation,publicScoreRows} from './stage-presentation';
import './studio-stage.css';

const WAIT: ViewerState = { status: 'connecting', frame: null, lastReceivedAt: null };

/** Extra controls are opt-in on the public stage URL, never on legacy projector links. */
export function stageAccessibleDisplayFromHash(hash:string):boolean{
  const match = /^#\/stage\?(.+)$/.exec(hash);
  return Boolean(match && new URLSearchParams(match[1]).get('display') === 'accessible');
}

function Scene({ scene }: { scene: PublicStageScene }) {
  if(scene.kind==='ud-prompt'||scene.kind==='ud-reveal')return <section className="ud-stage" aria-label="Umfrageduell">
    <p className="stage-kicker">UMFRAGEDUELL · {scene.step} / {scene.total} · {scene.format==='popular'?'BELIEBTESTE ANTWORT':'TOP 3'}</p>
    <p className="ud-provenance">{scene.provenance}</p>
    <h1>{scene.prompt}</h1>
    {scene.kind==='ud-prompt'?<p className="ud-stage-instruction">{scene.format==='popular'?'Gebt eine Vermutung ab.':'Nennt drei Vermutungen in der Reihenfolge Platz 1 bis 3.'}</p>:
      <ol className="ud-stage-results">{scene.categories.map((label,i)=><li key={label}><span>{i+1}</span><strong>{label}</strong><small>{scene.format==='popular'?[20,15,10,5,2][i]+' PUNKTE':'PLATZ '+(i+1)}</small></li>)}</ol>}
    {scene.sourceContext&&<p className="ud-stage-source">{scene.sourceContext}</p>}
  </section>;
  if(scene.kind==='ll-ladder')return <section className="ll-stage-ladder" aria-label="Logikleiter">
    <p className="stage-kicker">LOGIKLEITER · STUFE {scene.step} / {scene.total}</p>
    <div className="ll-rung-bar" aria-hidden="true">{Array.from({length:scene.total},(_,i)=><span key={i} className={i<scene.step?'reached':''}>{i+1}</span>)}</div>
    <p className="ll-stage-value">{scene.points} PUNKTE · VOR DEM HINWEIS</p>
    <h1>{scene.prompt}</h1>
    {scene.hint&&<div className="ll-stage-hint"><b>HINWEIS</b><p>{scene.hint}</p></div>}
  </section>;
  if(scene.kind==='ll-answer')return <section className="ll-stage-answer">
    <p className="stage-kicker">LOGIKLEITER · STUFE {scene.step} / {scene.total}</p>
    <h1>{scene.prompt}</h1>
    <div className="stage-reveal"><strong>{scene.answer}</strong><p>{scene.explanation}</p></div>
  </section>;
  if(scene.kind==='vb-sequence')return <div className="vb-stage-sequence">
    <p className="stage-kicker">{scene.heading} · {scene.activeTeam}</p>
    <h1>{scene.prompt}</h1>
    <div className="vb-stage-items">{scene.items.map((item,i)=><span key={i}>{item}</span>)}<span className="vb-stage-missing">?</span></div>
  </div>;
  if(scene.kind==='vb-wall')return <section className="vb-stage-wall">
    <p className="stage-kicker">VERBINDUNGSWAND · {scene.revealed.length} / 4 GRUPPEN AUFGELÖST</p>
    <h1>Was gehört zusammen?</h1>
    <div className="vb-stage-tiles">{scene.tiles.map(tile=>{
      const group=scene.revealed.find(g=>g.tileIds.includes(tile.id));
      return <div key={tile.id} className={'vb-stage-tile'+(group?' revealed':'')}>
        <strong>{tile.label}</strong>{group&&<small>{group.link}</small>}
      </div>;
    })}</div>
    {scene.revealed.length>0&&<div className="vb-stage-links">{scene.revealed.map((g,i)=><span key={g.id}>
      <b>{i+1}</b> {g.link}</span>)}</div>}
  </section>;
  if(scene.kind==='qt-board'){
    return <section className="qt-stage-board" aria-label="Quiztafel">
      <div className="stage-kicker">QUIZTAFEL · {scene.turn}/{scene.total} FELDER</div>
      <h1>Quiztafel</h1>
      <p className="qt-stage-selector">Wahlrecht: <strong>{scene.selectorName}</strong></p>
      <div className="qt-stage-grid" style={{gridTemplateColumns:`repeat(${scene.categories.length},minmax(0,1fr))`}}>
        {scene.categories.map(c=><div className="qt-stage-column" key={c.id} style={{gridTemplateRows:"auto repeat("+scene.rows+",minmax(0,1fr))"}}>
          <h2>{c.name}</h2>
          {Array.from({length:scene.rows},(_,i)=>{
            const cell=scene.cells.find(t=>t.categoryId===c.id&&t.row===i+1);
            if(!cell)return null;
            return <div key={cell.id} className={'qt-stage-cell'+(cell.closed?' closed':'')}>
              {cell.closed?'—':cell.value}
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
    return <div className="stage-live-question sp-stage-score-scene">
      <p className="stage-kicker">DIE PUNKTE AUF EINEN BLICK</p><h1>{scene.heading}</h1>
      <div className="stage-scores sp-stage-scores" aria-label="Öffentlicher Punktestand">
        {publicScoreRows(scene.visibleScores).map(team=><div key={team.name}
          className={'sp-stage-score-row'+(team.leading?' is-leading':'')}
          aria-label={team.name+': '+team.points+' Punkte, Platz '+team.rank}>
          <span className="sp-stage-score-rank" aria-hidden="true">{String(team.rank).padStart(2,'0')}</span>
          <span className="sp-stage-score-name">{team.name}</span>
          <strong>{team.points.toLocaleString('de-DE')}<small>PUNKTE</small></strong>
          <span className="sp-stage-score-bar" aria-hidden="true"><span style={{width:team.share+'%'}}/></span>
        </div>)}
      </div>
    </div>;
  }
  return <div className="stage-live-question">
    <p className="stage-kicker">{scene.kind === 'paused' ? 'KURZE UNTERBRECHUNG' : 'DER QUIZABEND'}</p>
    <h1>{scene.kind === 'paused' ? 'Pause' : 'Warte auf die Spielleitung'}</h1>
  </div>;
}

export function StageView() {
  const eventId = stageEventIdFromHash(window.location.hash);
  const accessibleDisplay = stageAccessibleDisplayFromHash(window.location.hash);
  const [displaySize,setDisplaySize] = useState<'normal'|'large'|'largest'>('normal');
  const [highContrast,setHighContrast] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [state, setState] = useState<ViewerState>(WAIT);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplaySize('normal');
    setHighContrast(false);
    setSettingsOpen(false);
  },[eventId,accessibleDisplay]);

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
  const presentation = stagePresentation(scene,state.status);
  const status = !eventId ? 'Sitzungslink fehlt' : error
    ? 'Nicht unterstützt'
    : scene ? 'Mit Spielleitung verbunden'
    : state.status === 'connecting' ? 'Verbindung wird aufgebaut'
    : state.status === 'conflict' ? 'Übertragung widersprüchlich'
    : 'Verbindung unterbrochen';

  return <main className="stage-preview sp-stage" data-public-scene={scene?.kind??'withheld'}
    data-stage-display={accessibleDisplay?'accessible':undefined}
    data-stage-size={accessibleDisplay?displaySize:undefined}
    data-stage-contrast={accessibleDisplay&&highContrast?'high':undefined}
    data-stage-phase={presentation.phase} data-stage-tone={presentation.tone} aria-label="Beamer-Ansicht">
    <div className="stage-topline">
      <span className="sp-stage-logo">LiGo<span className="stage-yellow">Quiz</span><b aria-hidden="true">!</b></span>
      <span className="sp-stage-phase"><span className="sp-stage-phase-dot" aria-hidden="true"/>{presentation.label}</span>
      <span>LIGOQUIZ · BEAMER</span>
    </div>
    <div className="stage-center" aria-live="polite" aria-atomic="true">
      {scene ? <Scene scene={scene}/> : <>
        <div className="stage-mark sp-stage-mark" aria-hidden="true"><span>?</span><span>✳</span><span>★</span></div>
        <p className="stage-kicker">{presentation.label}</p>
        <h1>Warte auf die<br/><span>Spielleitung</span></h1>
        <p>{!eventId ? 'Öffne diesen Bildschirm über die Spielleitung.'
          : error ?? (state.status === 'conflict'
            ? 'Widersprüchliche Projektionsdaten. Die Anzeige bleibt sicher ausgeblendet.'
            : 'Sobald eine Verbindung besteht, wird nur der freigegebene Spielinhalt angezeigt.')}</p>
      </>}
    </div>
    <div className="stage-bottom">
      <span aria-live="polite">{status}</span>
      {accessibleDisplay && <div className="stage-access-area">
        <button id="stage-access-trigger" type="button" className="stage-access-trigger"
          aria-expanded={settingsOpen} aria-controls="stage-access-controls"
          onClick={()=>setSettingsOpen(open=>!open)}>Anzeige</button>
        {settingsOpen && <div id="stage-access-controls" className="stage-access-controls"
          role="group" aria-label="Beameranzeige einstellen">
          <span>Schriftgröße</span>
          {([
            ['normal','Normal'],['large','Groß'],['largest','Sehr groß'],
          ] as const).map(([value,label])=><button key={value} type="button"
            aria-pressed={displaySize===value} onClick={()=>setDisplaySize(value)}>{label}</button>)}
          <button type="button" aria-pressed={highContrast}
            onClick={()=>setHighContrast(v=>!v)}>Hoher Kontrast</button>
          <button type="button" onClick={()=>{setSettingsOpen(false);
            document.getElementById('stage-access-trigger')?.focus();}}>Schließen</button>
        </div>}
      </div>}
      <span className="sp-stage-trust"><span aria-hidden="true">◆</span> Nur freigegebene Spielinhalte</span>
    </div>
  </main>;
}
