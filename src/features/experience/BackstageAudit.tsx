import {useState} from 'react';
import type {EventRecord} from '../../domain/event/schemas';
import {auditView} from '../host/correction-provenance';
import {type BackstageAuditItem,type BackstageAuditCategory} from './backstage-model';

const CATEGORIES:Record<BackstageAuditCategory,string>={
 security:'Host & Wiederherstellung',scoring:'Wertungen',publication:'Öffentliche Ausgabe',moderation:'Moderation',
};
/** Read-only, sanitized overview. Full original ledger lives in unchanged IDB/backup. */
export function BackstageAudit({event,entries}:{event:EventRecord;entries:readonly BackstageAuditItem[]}){
 const [filter,setFilter]=useState<'all'|BackstageAuditCategory>('all');
 const summary=auditView(event);
 const matching=filter==='all'?entries:entries.filter(e=>e.category===filter);
 return <section className="sp-backstage-audit" aria-labelledby="sp-backstage-audit-title">
  <header><div><span className="sp-backstage-overline">REGIE · GESPEICHERTE NACHWEISE</span>
   <h3 id="sp-backstage-audit-title">Korrekturen & Spielverlauf</h3>
   <p>Revisionen aus dem lokalen Originalprotokoll. Die Anzeige enthält weder private Antworten
    noch Befehlskennungen oder Notizen.</p></div>
   <span className="sp-backstage-audit-count">{entries.length} lokale Nachweise</span>
  </header>
  {summary&&<div className="sp-backstage-audit-facts">
   <div><span>Spielaktionen</span><strong>{summary.actionCount}</strong></div>
   <div><span>Wertungs-/Erfassungsschritte</span><strong>{summary.commits}</strong></div>
   <div><span>Korrekturschritte</span><strong>{summary.corrections}</strong></div>
   <div><span>Quellenfingerabdrücke</span><strong>{summary.sourceEvidence.hashed} / {summary.sourceEvidence.frozen}</strong></div>
  </div>}
  {summary?.anomalies.length?<p role="alert" className="sp-backstage-audit-warning">
    Die Originaldaten erfordern Prüfung: {summary.anomalies.join('; ')}. Keine Wertung aus dieser Anzeige ableiten.
  </p>:null}
  {summary&&summary.recent.length>0&&<div className="sp-backstage-audit-recent">
   <h4>Letzte nachvollziehbare Spielaktionen</h4>
   <ol>{summary.recent.slice(0,5).map((entry,i)=><li key={entry.revision+'-'+i}>
    <span>R{entry.revision}</span><strong>{entry.action}</strong><small>{CATEGORIES[entry.category==='correction'?'scoring':entry.category==='release'?'publication':entry.category==='commit'?'scoring':'moderation']}</small>
   </li>)}</ol>
  </div>}
  <details className="sp-backstage-audit-detail">
   <summary>Gesamtes gespeichertes Ereignisprotokoll prüfen ({entries.length})</summary>
   <div className="sp-backstage-audit-filter">
    <label htmlFor="sp-backstage-audit-filter">Protokollbereich</label>
    <select id="sp-backstage-audit-filter" value={filter}
     onChange={e=>setFilter(e.target.value as typeof filter)}>
     <option value="all">Alle gespeicherten Aktionen</option>
     {Object.entries(CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
    <small aria-live="polite">{matching.length} von {entries.length} Einträgen</small>
   </div>
   {matching.length===0?<p role="status">Keine passenden Aktionen.</p>:
    <ol className="sp-backstage-audit-list">{matching.map((entry,i)=><li key={entry.revision+'-'+i}>
     <strong>Revision {entry.revision}</strong>
     <span>{entry.label}</span>
     <small>{CATEGORIES[entry.category]}</small>
     <time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString('de-DE')}</time>
    </li>)}</ol>}
   <p className="sp-backstage-audit-disclaimer">Die technische Zuordnung im vollständigen Protokoll ist absichtlich neutral.
    Details und private Quellennachweise bleiben ausschließlich in der unveränderten Originalsicherung.
    Die Kontrolle erfolgt im ursprünglichen Spielhost.</p>
  </details>
 </section>;
}
