import type {EventRecord} from '../../domain/event/schemas';
import {auditView,recoveryAdvice} from './correction-provenance';
import '../../styles/g17-correction.css';

/** Display only. The original game and repository retain all command authority. */
export function CorrectionProvenance({event}:{event:EventRecord}){
 const history=auditView(event);
 if(!history)return null;
 return <section className="g17-audit" aria-label="Wertungs- und Korrekturverlauf">
  <div className="g17-audit-top"><div>
   <small>NUR SPIELLEITUNG · GESPEICHERTER VERLAUF</small>
   <h3>Korrekturen und Herkunft</h3></div>
   <span>Revision {history.engineRevision} · Host-Epoche {history.hostEpoch}</span>
  </div>
  <p>{history.actionCount} gespeicherte Aktionen · {history.commits} Wertungs-/Erfassungsschritte
   {' '}· {history.corrections} Korrekturschritte.
   {' '}Inhalte: {history.sourceEvidence.hashed} von {history.sourceEvidence.frozen} eingefrorenen
   Aufgaben mit Quellen-Fingerabdruck.</p>
  {history.anomalies.length>0&&<p role="alert" className="g17-audit-warning">
   Verlauf benötigt Prüfung: {history.anomalies.join('; ')}. Nicht auf Basis dieser Anzeige korrigieren.</p>}
  <details><summary>Letzte {history.recent.length} Aktionen und Revisionen prüfen</summary>
   <ol className="g17-audit-list">{history.recent.map((entry,i)=>
    <li key={entry.revision+'-'+i}>
     <strong>Revision {entry.revision}</strong><span>{entry.action}</span>
     <span>{entry.category==='correction'?'Korrektur':entry.category==='commit'?'Wertung/Erfassung':
      entry.category==='release'?'Veröffentlichung':'Spielleitung'}</span>
    </li>)}</ol>
   <p>Es werden keine Befehls-IDs, Antworttexte oder privaten Lösungen angezeigt. Nur die gespeicherten
    Spielaktionen sind die Quelle. Die Anzeige ändert keine Wertung.</p>
  </details>
 </section>;
}
export function SafeErrorRecovery({message}:{message:string}){
 const advice=recoveryAdvice(message);
 return <section className="g17-recovery" aria-label="Sichere Fehlerbehandlung" data-recovery-type={advice.type}>
  <h3>{advice.title}</h3><p>{advice.next}</p>
  <div className="g17-recovery-actions">
   {advice.reload&&<button type="button" onClick={()=>{
    if(window.confirm('Spielstand manuell neu laden? Keine fehlgeschlagene Wertung wird wiederholt; Spiel und Beamer nach dem Laden erneut prüfen.'))
     window.location.reload();
   }}>Spielstand manuell neu laden</button>}
   <a href="#/spielen">Zur Spielübersicht</a>
  </div>
 </section>;
}
