import {useState} from 'react';
import type {GameType} from '../domain/game/contracts';
import {GAME_ORDER, GAME_VISUALS} from './theme';
import {StudioPopLogo,PopButton,PopTag,PopPanel,GameTile,TeamBadge,ScoreChip,PopTimer,PopProgress,PopShowFrame} from './StudioPop';
import './preview.css';

const sampleTeams = [
  {name:'Team Blau',points:240,tone:'blue' as const},
  {name:'Team Pink',points:180,tone:'pink' as const},
  {name:'Team Mint',points:320,tone:'mint' as const},
];

export function StudioPopPreview(){
  const [selected,setSelected]=useState<GameType>('quiztafel');
  const [seconds,setSeconds]=useState(45);
  const [paused,setPaused]=useState(false);
  const [mobile,setMobile]=useState(false);
  const visual=GAME_VISUALS[selected];

  return <main data-lq-theme="studio-pop" className="sp-preview-root">
    <div className="sp-preview-wrap">
      <header className="sp-preview-header">
        <StudioPopLogo/>
        <div className="sp-preview-header-aside"><PopTag>U01 / DESIGN SYSTEM</PopTag><span>INTERAKTIVES DESIGNLABOR · KEIN ECHTER SPIELABEND</span></div>
      </header>

      <section className="sp-preview-intro">
        <div><span className="sp-eyebrow">LICHT AN. TEAMS BEREIT.</span>
          <h1>Das <em>große</em><br/>Quizduell!</h1>
          <p>Eine Designvorschau für LiGoQuiz 3.0: volle Farbe, starke Typografie und die richtige Spannung vor dem nächsten Spiel.</p>
          <div className="sp-preview-actions">
            <PopButton size="large" onClick={()=>document.getElementById('sp-preview-games')?.scrollIntoView({behavior:'smooth'})}>Spiele entdecken</PopButton>
            <PopButton tone="quiet" onClick={()=>document.getElementById('sp-preview-stage')?.scrollIntoView({behavior:'smooth'})}>Bühne ansehen</PopButton>
          </div>
        </div>
        <div className="sp-preview-art" aria-hidden="true"><span>?</span><i>★</i><b>!</b></div>
      </section>

      <section className="sp-preview-section" id="sp-preview-games">
        <div className="sp-preview-section-head"><div><span className="sp-eyebrow">FÜNF SPIELE · EIN LOOK</span><h2>Wähle die Spielwelt</h2></div><PopTag tone="positive">LOKAL · OFFLINE-FÄHIG</PopTag></div>
        <div className="sp-preview-games">{GAME_ORDER.map((game,i)=><GameTile key={game} game={game} number={String(i+1).padStart(2,'0')}/>)}</div>
        <p className="sp-preview-note">Spielkacheln zeigen nur den künftigen Stil. Navigation und echte Spielauswahl folgen in U02–U04.</p>
      </section>

      <section className="sp-preview-section">
        <div className="sp-preview-section-head"><div><span className="sp-eyebrow">WIEDERVERWENDBARE BAUSTEINE</span><h2>Ein gemeinsamer Werkzeugkasten</h2></div></div>
        <div className="sp-preview-components">
          <PopPanel title="Buttons & Status" eyebrow="INTERAKTION">
            <div className="sp-preview-flex"><PopButton onClick={()=>setSeconds(45)}>Primär</PopButton><PopButton tone="secondary" onClick={()=>setPaused(v=>!v)}>Sekundär</PopButton><PopButton tone="quiet" onClick={()=>setSeconds(9)}>Zeitwarnung</PopButton><PopButton tone="danger" disabled>Gesperrt</PopButton></div>
            <div className="sp-preview-flex"><PopTag tone="live">LIVE</PopTag><PopTag tone="positive">BEREIT</PopTag><PopTag tone="warning">PAUSIERT</PopTag><PopTag>VORSCHAU</PopTag></div>
            <p className="sp-preview-note">Die Vorschau-Buttons ändern ausschließlich lokale Beispieldaten.</p>
          </PopPanel>
          <PopPanel title="Teams & Punkte" eyebrow="WETTBEWERB">
            <div className="sp-preview-flex">{sampleTeams.map(t=><TeamBadge key={t.name} name={t.name} tone={t.tone}/>)}</div>
            <div className="sp-preview-scores">{sampleTeams.map((t,i)=><ScoreChip key={t.name} {...t} leading={i===2} change={i===2?40:undefined}/>)}</div>
          </PopPanel>
          <PopPanel title="Timer & Fortschritt" eyebrow="SPANNUNG">
            <div className="sp-preview-flex"><PopTimer seconds={seconds} paused={paused}/><div className="sp-preview-counter">
              <PopButton tone="quiet" onClick={()=>setSeconds(s=>Math.max(0,s-5))}>− 5 s</PopButton>
              <PopButton tone="quiet" onClick={()=>{setSeconds(45);setPaused(false);}}>Reset</PopButton>
            </div></div>
            <PopProgress label="FRAGEN" current={3} total={10}/>
          </PopPanel>
        </div>
      </section>

      <section className="sp-preview-section" id="sp-preview-stage">
        <div className="sp-preview-section-head"><div><span className="sp-eyebrow">BEAMER & MOBILE</span><h2>Ein Auftritt. Zwei Perspektiven.</h2></div>
          <div className="sp-preview-segment" aria-label="Anzeigebeispiel">
            <button aria-pressed={!mobile} className={!mobile?'active':''} onClick={()=>setMobile(false)}>Desktop</button>
            <button aria-pressed={mobile} className={mobile?'active':''} onClick={()=>setMobile(true)}>Mobile</button>
          </div></div>
        <div className={mobile?'sp-device sp-device--mobile':'sp-device sp-device--desktop'}>
          <PopShowFrame kind="stage">
            <div className="sp-stage-top"><StudioPopLogo compact/><PopTag tone="live">DESIGN-VORSCHAU</PopTag></div>
            <div className="sp-stage-center sp-animate-in" key={selected}>
              <span className="sp-eyebrow">{visual.kicker}</span>
              <div className="sp-stage-symbol" aria-hidden="true">{visual.symbol}</div>
              <h3>{visual.label}</h3>
              <p>{visual.description}</p>
            </div>
            <div className="sp-stage-footer"><span>LiGoQuiz · Studio Pop</span><span>KEINE ECHTEN FRAGEN / PUNKTE</span></div>
          </PopShowFrame>
        </div>
        <div className="sp-preview-mode-select" role="group" aria-label="Spieltyp für die Vorschau">
          {GAME_ORDER.map(game=><button key={game} aria-pressed={selected===game} className={selected===game?'selected':''}
            onClick={()=>setSelected(game)}>{GAME_VISUALS[game].label}</button>)}
        </div>
      </section>

      <footer className="sp-preview-footer">LiGoQuiz 3.0 · U01 · Visual foundation only · No host commands, persistence, projector publication or game engine changes</footer>
    </div>
  </main>;
}
