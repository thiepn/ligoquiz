import type {ScoreSource} from './score-decision';
import {scoreDecisionFor} from './score-decision';
import '../../styles/g16-moderation.css';

const howToCorrect:Record<ScoreSource['game'],string>={
 rundenquiz:'Nach Bestätigung „Letzte Wertung korrigieren“ auswählen und die Teams erneut bewerten.',
 quiztafel:'Nach Bestätigung „Wertung auditiert korrigieren“ benutzen. Annullierungen benötigen einen Grund.',
 verbindungen:'„Letzte Wertung korrigieren“ öffnet die betroffene Aufgabe erneut; Annullierungen sind begründungspflichtig.',
 logikleiter:'„Letzte Wertung korrigieren“ verlangt einen dokumentierten Grund; Hinweis- und Sperrstatus bleiben bestehen.',
 umfrageduell:'Nach Bestätigung eine Teamantwort mit „Begründet korrigieren“ einzeln neu zuordnen.',
};
export function ScoreDecisionPanel({source,blocked}:{source:ScoreSource;blocked:boolean}){
 const model=scoreDecisionFor(source);
 if(!model)return null;
 return <section className="g16-score" aria-label="Punktentscheidung" data-testid="g16-score-preview"
   data-decision-status={blocked?'blocked':model.status}>
  <div className="g16-score-heading">
   <div><small>NUR SPIELLEITUNG · KEINE BEAMERFREIGABE</small>
    <h3>{model.status==='committed'?'Verbuchte Punkte': 'Punkte vor Bestätigung'}</h3></div>
   <span className="g16-score-state">
    {blocked?'AUSGABE GESPERRT':model.status==='pending'?'NOCH NICHT GEBUCHT':
     model.status==='incomplete'?'NOCH NICHT VOLLSTÄNDIG':'VERBUCHT'}</span>
  </div>
  <p id="g16-score-disclaimer" className="g16-score-note" role="status">
   {blocked?'Pausiert oder in Wiederherstellung. Keine Aktion zulässig. ':''}{model.description}
  </p>
  <div className="g16-score-table" role="table" aria-label="Punktänderung pro Team">
   <div role="row" className="g16-score-labels">
    <span role="columnheader">Team</span><span role="columnheader">Bisher</span>
    <span role="columnheader">Änderung</span><span role="columnheader">Danach</span>
   </div>
   {model.rows.map(row=><div role="row" key={row.teamId}>
    <strong role="cell">{row.name}</strong><span role="cell">{row.before}</span>
    <strong role="cell">{row.change===null?'—':row.change>0?'+'+row.change:String(row.change)}</strong>
    <strong role="cell">{row.after===null?'—':row.after}</strong>
   </div>)}
  </div>
  <details className="g16-score-correction">
   <summary>Korrektur und sichere Entscheidung</summary>
   <p>{howToCorrect[source.game]}</p>
   <p>Prüfe alle Teamnamen und Änderungen. Der Abschnitt ist eine reine Vorschau;
    er sendet keine Wertung, verändert keine Sitzung und veröffentlicht keine Antworten.</p>
  </details>
 </section>;
}
