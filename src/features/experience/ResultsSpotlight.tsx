import type {CompletedReport} from './results-spotlight-model';
import {rankedFinishedTeams} from './results-spotlight-model';
import {backupHref} from './backstage-model';
import './u10-results.css';

/** Original session report only; stage and unfinished sessions never render this.
 * Display cannot issue game commands, alter awards, or reveal private frozen tasks. */
export function ResultsSpotlight({report}:{report:CompletedReport}){
 const results=rankedFinishedTeams(report.teams);
 const leaders=results.filter(t=>t.leader);
 return <section className="sp-u10-results" aria-label="Ergebnisfinale">
  <header className="sp-u10-results-head">
   <div><span>SHOWTIME / DER ENDSTAND</span>
    <h2>Das Finale<span aria-hidden="true">.</span></h2>
    <p>{report.gameLabel} · {report.profile} · {report.questionCount} Aufgaben ·
       {' '}{new Date(report.finishedAt).toLocaleDateString('de-DE')}</p></div>
   <span className="sp-u10-results-mark" aria-hidden="true">★</span>
  </header>
  {leaders.length>0&&<div className="sp-u10-winners">
    <span>PLATZ 01 · {leaders.length>1?'GEMEINSAMER ERSTER PLATZ':'GEWINNERTEAM'}</span>
    <strong>{leaders.map(t=>t.name).join(' / ')}</strong>
    <p>{leaders[0]?.rawPoints} Spielpunkte · {leaders[0]!.eveningHalfPoints/2} Abendpunkte</p>
   </div>}
  <ol className="sp-u10-result-lines">{results.map(t=><li key={t.id}
    className={t.leader?'is-leader':''}>
    <span className="sp-u10-result-rank">{String(t.rank).padStart(2,'0')}</span>
    <strong>{t.name}</strong>
    <span className="sp-u10-result-raw">{t.rawPoints}<small> Spielpunkte</small></span>
    <span className="sp-u10-result-evening">{t.eveningHalfPoints/2} Abendpunkte</span>
   </li>)}</ol>
  <p className="sp-u10-results-source">{report.sourceLabel}</p>
  <nav className="sp-u10-results-actions" aria-label="Nach dem Quizabend">
   <a href="#/verlauf">Alle Abende</a>
   <a href={backupHref(report.id)}>Vollständiges Sitzungsbackup</a>
  </nav>
  <p className="sp-u10-results-note">Der Ergebnisexport ist kein vollständiges Backup. Die
    Original-Sicherung mit Prüfsumme enthält Wertungen, Audit und Checkpoints
    und muss ausdrücklich durch die Spielleitung exportiert werden.</p>
 </section>;
}
