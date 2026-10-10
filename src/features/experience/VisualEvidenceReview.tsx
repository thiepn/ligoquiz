import {useState} from 'react';
import {evidenceSource,reviewPacket,type ReviewRecord,type Observation} from './visual-evidence';
import '../../styles/g16-visual-review.css';
const label:Record<Observation,string>={unreviewed:'Nicht geprüft',observed:'Screenshot gesichtet',defect:'Problem entdeckt'};
const kind=(file:string)=>file.includes('host-200pct')?'Host bei 200 % Zoom':
 file.includes('revealed-1280x720')?'Lösung bei 1280 × 720':'Frage bei 1280 × 720';
export function VisualEvidenceReview(){
 const [reviews,setReviews]=useState<Record<string,ReviewRecord>>({});
 const [notes,setNotes]=useState('');
 const [expanded,setExpanded]=useState(false);
 const packet=reviewPacket(reviews,notes);
 function update(file:string,patch:Partial<ReviewRecord>){
  setReviews(prev=>({...prev,[file]:{observation:prev[file]?.observation??'unreviewed',
   note:prev[file]?.note??'',...patch}}));
 }
 function exportPacket(){
  const blob=new Blob([JSON.stringify(reviewPacket(reviews,notes),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  try{anchor.href=url;anchor.download='ligoquiz-g16-sichtungsnotizen.json';anchor.click();}
  finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 return <section className="g16-review" aria-label="Visuelle Evidenzprüfung">
  <span className="eyebrow">G16 · EVIDENZSICHTUNG</span>
  <h2>Visuelle Evidenz prüfen</h2>
  <p>15 unveränderte synthetische Chromium-Screenshots aus
   <a href="https://github.com/thiepn/ligoquiz/actions/runs/38040891245" target="_blank"
    rel="noopener noreferrer"> G15 CI</a>. Quelle {evidenceSource.head.slice(0,12)},
    Artefakt #{evidenceSource.artifactId}; jede Datei hat eine gepinnte SHA-256-Prüfsumme.</p>
  <p className="g16-review-denied">KEINE FREIGABE: Sichtungsnotizen sind weder eine physische Geräteprüfung
   noch eine redaktionelle, barrierefreie oder produktive Abnahme.</p>
  <div className="g16-review-summary" aria-live="polite">
   <strong>{packet.summary.observed} von 15 gesichtet</strong>
   <strong>{packet.summary.defects} Probleme</strong>
   <strong>{packet.summary.unreviewed} ungeprüft</strong>
  </div>
  <button type="button" aria-expanded={expanded} className="g16-review-toggle"
   onClick={()=>setExpanded(v=>!v)}>{expanded?'Bildliste schließen':'15 Bildnachweise sichten'}</button>
  {expanded&&<div className="g16-review-list">
   {evidenceSource.files.map(item=><div className="g16-review-item" key={item.file}>
    <div><strong>{item.game} · {kind(item.file)}</strong><small>{item.file}</small>
      <code title="SHA-256">{item.sha256}</code></div>
    <label>Status
     <select value={reviews[item.file]?.observation??'unreviewed'}
       onChange={e=>update(item.file,{observation:e.target.value as Observation})}>
      {(['unreviewed','observed','defect'] as const).map(o=>
        <option value={o} key={o}>{label[o]}</option>)}
     </select>
    </label>
    <label>Beobachtung
     <input value={reviews[item.file]?.note??''} maxLength={1000}
      onChange={e=>update(item.file,{note:e.target.value})}
      placeholder="Echte Beobachtung eintragen"/>
    </label>
   </div>)}
  </div>}
  <label className="g16-review-notes">Zusätzliche Sichtungsnotizen
   <textarea rows={3} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)}/>
  </label>
  <button type="button" onClick={exportPacket} className="g16-review-toggle">Notizen lokal als JSON exportieren</button>
  <p className="g16-review-denied" role="status">OFFEN: Veranstaltungsbeamer und Leseabstand,
   physische Mobilgeräte, Screenreader, redaktionelle Rechte, unabhängige menschliche Abnahme
   sowie Merge- und Deploy-Autorisierung. Kein Status dieser Oberfläche erteilt eine Freigabe.</p>
 </section>;
}
