import { useEffect, useState } from 'react';
import { parseRoute, routeHref, type Route } from './routes';
import { GAME_MANIFESTS } from '../games/registry';
import { StageView } from '../features/stage/StageView';
import { ProjectorTechCheck } from '../features/host/ProjectorTechCheck';
import { RundenquizHost } from '../features/host/RundenquizHost';

const PAGES: readonly { route: Exclude<Route, 'stage'>; label: string; symbol: string }[] = [
  { route: 'spielen', label: 'Spielen', symbol: '▶' },
  { route: 'inhalte', label: 'Inhalte', symbol: '▤' },
  { route: 'verlauf', label: 'Verlauf', symbol: '◷' },
];

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return route;
}

function PlaySurface() {
  return (
    <section className="surface-play" aria-label="Quizabend">
      <div className="surface-header">
        <div><div className="eyebrow">SPIELRAUM</div><h1>Quizabend</h1>
          <p>Ein Abend für eure Gruppe. Noch im technischen Neuaufbau.</p></div>
        <span className="status-label">G4 / SPIELTEST</span>
      </div>
      <div className="start-layout">
        <div className="start-panel">
          <div className="eyebrow">NÄCHSTER SCHRITT</div>
          <h2>Bereitmachen</h2>
          <p>Mit dem Rundenquiz könnt ihr jetzt einen ersten Quizabend im Testbetrieb durchführen.</p>
          <a href="#rundenquiz" className="main-cta">
            Rundenquiz starten <span aria-hidden="true">↗</span>
          </a>
          <p className="small-note">Testversion mit vorläufigen Fragen. Die übrigen Spiele folgen später.</p>
        </div>
        <a className="projection-preview" href={routeHref('stage')} target="_blank" rel="noopener noreferrer">
          <span className="projection-icon" aria-hidden="true">▣</span>
          <span className="projection-title">Beamer-Vorschau</span>
          <span className="projection-copy">Getrennte Anzeige ohne private Lösungen. Aktuell nur Wartezustand.</span>
          <span className="preview-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
      <div id="rundenquiz"><RundenquizHost /></div>
      <ProjectorTechCheck />
      <div className="section-heading"><h2>Spielauswahl</h2><span>5 SPIELFORMATE · IN AUFBAU</span></div>
      <div className="game-grid">
        {GAME_MANIFESTS.map((game, index) => (
          <article className="game-entry" key={game.id}>
            <div className="game-topline"><span className="game-code">{game.code}</span>
              <span className="game-index">0{index + 1}</span></div>
            <div><h3>{game.nameDe}</h3><p>{game.taglineDe}</p></div>
            <div className="game-footer">{game.ready ? 'Im Test spielbar' : 'Spielmodul folgt'}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContentSurface() {
  return (
    <section className="surface-secondary" aria-label="Inhaltsbibliothek">
      <div className="eyebrow">INHALTSSTUDIO</div><h1>Inhalte</h1>
      <p>Fragen, Medien und vorbereitete Programme werden unabhängig vom Spielbetrieb verwaltet.</p>
      <div className="empty-workspace">
        <span className="workspace-emblem" aria-hidden="true">▤</span>
        <h2>Inhaltsbibliothek wird aufgebaut</h2>
        <p>Die v1.14-Fragen bleiben bis zur geprüften Migration unangetastet. Hier sind noch keine Inhalte geladen.</p>
        <span className="workspace-status">INHALTSIMPORT · G10</span>
      </div>
    </section>
  );
}

function HistorySurface() {
  return (
    <section className="surface-secondary" aria-label="Spielverlauf">
      <div className="eyebrow">VERLAUF</div><h1>Vergangene Abende</h1>
      <p>Abgeschlossene Spiele, Ergebnisse und Berichte erscheinen nach dem ersten tatsächlich gespielten Abend.</p>
      <div className="empty-workspace">
        <span className="workspace-emblem" aria-hidden="true">◷</span>
        <h2>Noch keine Spielabende</h2>
        <p>Dieser Neubau hat noch keine Sitzungsdaten. Alte Spielstände erhalten später einen sicheren Import.</p>
        <span className="workspace-status">SITZUNGSVERLAUF · G4+</span>
      </div>
    </section>
  );
}

export function App() {
  const route = useHashRoute();
  useEffect(() => {
    document.title = route === 'stage' ? 'LiGoQuiz — Beamer' : 'LiGoQuiz — Neuaufbau';
  }, [route]);
  if (route === 'stage') return <StageView />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href={routeHref('spielen')} className="brand" aria-label="LiGoQuiz Startseite">
          <span className="brand-symbol" aria-hidden="true">L<span>.</span></span>
          <span className="brand-text">LiGo<span>Quiz</span><small>GAME NIGHT SYSTEM</small></span>
        </a>
        <div className="nav-group-title">NAVIGATION</div>
        <nav className="main-nav" aria-label="Hauptnavigation">
          {PAGES.map((page) => (
            <a href={routeHref(page.route)} key={page.route}
              className={route === page.route ? 'nav-item active' : 'nav-item'}
              aria-current={route === page.route ? 'page' : undefined}>
              <span className="nav-symbol" aria-hidden="true">{page.symbol}</span>{page.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="build-indicator"><span className="pulse-dot" aria-hidden="true"></span>Neuaufbau · G4</div>
          <div className="version-info">VERSION 2.0 · ENTWICKLUNG</div>
        </div>
      </aside>
      <main className="workspace" id="main-content">
        {route === 'spielen' ? <PlaySurface /> : route === 'inhalte' ? <ContentSurface /> : <HistorySurface />}
      </main>
    </div>
  );
}
