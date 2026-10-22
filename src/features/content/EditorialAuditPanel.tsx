import {useMemo,useState} from 'react';
import type {ContentItem} from '../../content/contracts';
import type {Preview} from '../../content/migration';
import {auditLibrary,auditPreview,exportAudit,LEGACY_V113_INVENTORY} from '../../content/editorial-audit';
import '../../styles/g23-editorial-audit.css';
const labels:{[key:string]:string}={rundenquiz:'Rundenquiz',quiztafel:'Quiztafel',
 verbindungen:'Verbindungen',logikleiter:'Logikleiter',umfrageduell:'Umfrageduell'};
function download(report:string){
 const url=URL.createObjectURL(new Blob([report],{type:'application/json;charset=utf-8'}));
 const a=document.createElement('a');
 try{a.href=url;a.download='ligoquiz-g23-redaktionsindex-no-go.json';a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function EditorialAuditPanel({items,preview,onChoose}:{
 items:readonly ContentItem[];preview:Preview|null;onChoose:(item:ContentItem)=>void;
}){
 const [blockersOnly,setBlockersOnly]=useState(false);
 const audit=useMemo(()=>auditLibrary(items),[items]);
 const inspectedPreview=useMemo(()=>preview?auditPreview(preview):null,[preview]);
 const visible=audit.issues.filter(x=>!blockersOnly||x.severity==='blocker').slice(0,150);
 return <section className="g23-panel" aria-label="G23 Quellen und Rechteprüfung">
  <header><div>
   <h2>Fragenqualität und Rechteprüfung</h2>
   <p>Historische v1-Angaben werden nicht als geprüfte Fakten, Lizenzen oder freigegebene Aufgaben anerkannt.</p>
   </div><strong>NO-GO · NICHT FREIGEGEBEN</strong></header>
  <p className="g23-inventory">Der Originalcode (v1.13) <b>meldet {LEGACY_V113_INVENTORY.declaredActive} aktive</b>
   {' '}von {LEGACY_V113_INVENTORY.declaredTotal} Fragen und {LEGACY_V113_INVENTORY.declaredRejected} abgelehnte.
   Die lokale v2-Inhaltsbibliothek enthält tatsächlich <b>{audit.scanned}</b> geladene Aufgaben.
   Beide Zahlen sind unabhängig: <b>keine automatische Übernahme</b>.</p>
  <div className="g23-metrics">
   <div><b>{audit.scanned}</b><span>Lokale Aufgaben</span></div>
   <div><b>{audit.blockers}</b><span>Blocker-Hinweise</span></div>
   <div><b>{audit.reviewFlags}</b><span>Manuelle Prüfhinweise</span></div>
   <div><b>{audit.approvedLocally}</b><span>G10-lokale Freigaben, nicht extern bestätigt</span></div>
  </div>
  <p>Unabhängig bestätigte Originalquellen, Nutzungsrechte und tatsächliche Redaktionsentscheidungen:
   <b> weiterhin offen</b>. Die Analyse weist nur Auffälligkeiten aus und entscheidet niemals selbst über Qualität.</p>
  <details className="g23-legacy">
   <summary>Originalquell-Inventar und acht historische Familien</summary>
   <p>Git-Blob <code>{LEGACY_V113_INVENTORY.sourceBlobSha}</code>;
    366 Baseline-Review-IDs und 340 Addition-Review-IDs einzeln aus Originalcode gelesen.
    556 „approved“ und 148 „edited“ sind lediglich v1-eigene historische Angaben.
    Acht historische Familien passen nicht eins zu eins zu fünf neuen Spiel-Engines.</p>
   <div>{Object.entries(LEGACY_V113_INVENTORY.familyActive).map(([family,count])=><span key={family}>
     <strong>{family}</strong> {count}</span>)}</div>
  </details>
  {inspectedPreview&&<p className="g23-preview" role="status">Noch nicht importierte Quelle:
   {' '}{inspectedPreview.records} Datensätze, {inspectedPreview.draftCandidates} Entwurfskandidaten,
   {' '}{inspectedPreview.quarantined} Quarantänefälle,
   {' '}{inspectedPreview.typedIssueCount} automatische Prüfpunkte. Keine Freigabe.</p>}
  <div className="g23-controls">
   <label><input type="checkbox" checked={blockersOnly} onChange={e=>setBlockersOnly(e.target.checked)}/>
    Nur Blocker-Hinweise zeigen</label>
   <button className="exp-secondary" type="button" onClick={()=>download(exportAudit(audit,preview))}>
    Redaktionsindex ohne Fragen und Antworten exportieren</button>
  </div>
  <div className="g23-types" aria-label="G23 lokale Spieltypverteilung">
   {Object.entries(audit.byGame).map(([game,n])=><span key={game}>{labels[game]}: <b>{n}</b></span>)}
  </div>
  <div className="g23-findings" aria-label="G23 tatsächliche Redaktionshinweise">
   {visible.map((issue,i)=><button type="button" key={issue.id+'-'+issue.code+'-'+i}
    className="g23-finding" onClick={()=>{
     const item=items.find(x=>x.id===issue.id);if(item)onChoose(item);
    }}>
    <b>{issue.severity==='blocker'?'BLOCKER':'PRÜFEN'} · {issue.code}</b>
    <span>{issue.message}</span><small>{issue.id} · {labels[issue.game]}</small>
   </button>)}
   {visible.length===0&&<p>Keine passenden automatischen Hinweise.
    Das belegt keine Fakten- oder Rechtefreigabe.</p>}
   {audit.issues.length>150&&<p>Nur die ersten 150 Hinweise sichtbar.
    Der datensparsame Export enthält den vollständigen Index.</p>}
  </div>
 </section>;
}
