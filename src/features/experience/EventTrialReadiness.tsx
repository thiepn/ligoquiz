import {useState} from 'react';
import {CHECKS,SCENARIOS,RELEASE_GATES,canonicalTrial,blankTrialRow,sealTrial,reconcileTrial,fingerprint,
 type TrialRow,type Observation} from './event-trial';
import '../../styles/g18-event-trial.css';

const labels:Record<Observation,string>={open:'OFFEN',reported:'Als beobachtet notiert',defect:'Problem festgestellt'};
function download(packet:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 try{a.href=url;a.download='ligoquiz-g18-generalprobe-evidenz.json';a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function EventTrialReadiness(){
 const [records,setRecords]=useState<Record<string,TrialRow>>({});
 const [selected,setSelected]=useState<string>(SCENARIOS[0]!.id);
 const [notes,setNotes]=useState('');
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const report=canonicalTrial(records,notes),active=records[selected]??blankTrialRow(selected);
 const scenario=SCENARIOS.find(s=>s.id===selected)!;
 function change(patch:Partial<TrialRow>){
  setRecords(previous=>({...previous,[selected]:{...(previous[selected]??blankTrialRow(selected)),...patch}}));
  setStatus('');
 }
 async function attach(file:File|undefined){
  if(!file)return;
  setBusy(true);setStatus('');
  try{const proof=await fingerprint(file);change({evidence:proof});
   setStatus('Lokale Datei gelesen und SHA-256 berechnet. Kein Upload oder Geräte-/Human-Nachweis.');}
  catch(e){setStatus('Datei abgelehnt: '+(e instanceof Error?e.message:'ungültig'));}
  finally{setBusy(false);}
 }
 async function save(){
  setBusy(true);setStatus('');
  try{download(await sealTrial(records,notes));
   setStatus('Prüfnotizen mit Selbstkonsistenz exportiert – NICHT signiert oder freigegeben.');}
  catch{setStatus('Export konnte nicht abgeschlossen werden.');}
  finally{setBusy(false);}
 }
 async function load(file:File|undefined){
  if(!file)return;
  if(file.size>256*1024){setStatus('Prüfpaket über 256 KiB abgelehnt.');return;}
  setBusy(true);setStatus('');
  try{
   const restored=await reconcileTrial(JSON.parse(await file.text()) as unknown);
   setRecords(Object.fromEntries(restored.rows.map(x=>[x.scenarioId,x])));
   setNotes(restored.notes);
   setStatus('15 Szenarien und G17-Quellenanker konsistent. Keine externe Unterschrift oder Abnahme.');
  }catch(e){setStatus('Prüfpaket ABGELEHNT: '+(e instanceof Error?e.message:'ungültig'));}
  finally{setBusy(false);}
 }
 return <section className="g18-trial" aria-label="G18 Generalprobe und Release-Sperren">
  <header className="g18-head"><div>
   <p className="eyebrow">G18 / 15 REAL-SZENARIEN · 5 SPIELMODI</p>
   <h2>Generalprobe und Freigabesperren</h2>
   <p>Probiere jeden Spielmodus mit 3, 4 und 5 Teams. Halte echte Beobachtungen, Rückweg und Quellenprüfung
    fest. Synthetische CI-Läufe und lokal notierte Beobachtungen ersetzen keine unabhängige Abnahme.</p></div>
   <strong className="g18-nogo">NO-GO · KEINE FREIGABE</strong>
  </header>
  <div className="g18-metrics" aria-live="polite">
   <strong>15 Szenarien</strong><span>{report.summary.reported} beobachtet notierte Prüfschritte</span>
   <span>{report.summary.defects} Probleme</span><span>{report.summary.open} offene Prüfschritte</span>
  </div>
  <nav className="g18-fastpaths" aria-label="Schritte zur Generalprobe">
   <a href="#/setup">1. Testabend mit Teams beginnen</a>
   <a href="#/technik">2. Beamer und Offline prüfen</a>
   <a href="#/einstellungen">3. Sitzung sichern / Rückweg prüfen</a>
  </nav>
  <div className="g18-scenario-layout">
   <div className="g18-scenarios" role="group" aria-label="15 Probeszenarien">
    {SCENARIOS.map(s=>{
     const row=records[s.id]??blankTrialRow(s.id);
     const defects=CHECKS.filter(c=>row.checks[c.id]==='defect').length;
     const observed=CHECKS.filter(c=>row.checks[c.id]==='reported').length;
     return <button key={s.id} type="button" className={s.id===selected?'g18-selected':''}
      aria-pressed={s.id===selected} onClick={()=>{setSelected(s.id);setStatus('');}}>
      <span>{s.label} · {s.teams} Teams</span>
      <small>{defects?'PROBLEM':observed+'/7 dokumentiert'}</small>
     </button>;
    })}
   </div>
   <div className="g18-active" role="group" aria-label="Ausgewähltes Probeszenario">
    <h3>{scenario.label} · {scenario.teams} Teams</h3>
    <p>Jeden Prüfschritt real ausführen. „Beobachtet“ ist eine unbestätigte Notiz, **keine Freigabe**.</p>
    {CHECKS.map((item,i)=><div className="g18-check" key={item.id}>
     <div><strong>{i+1}. {item.title}</strong><p>{item.instruction}</p></div>
     <label>Status: {item.title}
      <select value={active.checks[item.id]}
       onChange={e=>change({checks:{...active.checks,[item.id]:e.target.value as Observation}})}>
       <option value="open">{labels.open}</option>
       <option value="reported">{labels.reported}</option>
       <option value="defect">{labels.defect}</option>
      </select>
     </label>
    </div>)}
    <label className="g18-text">Beobachtungen und offene Defekte
     <textarea rows={3} maxLength={800} value={active.note}
      onChange={e=>change({note:e.target.value})} placeholder="Nur tatsächlich beobachtete Ergebnisse notieren"/>
    </label>
    <label className="g18-upload">Optionale lokale Belegdatei (bis 12 MiB, nur SHA-256 wird behalten)
     <input type="file" disabled={busy} onChange={e=>{
      const file=e.currentTarget.files?.[0];e.currentTarget.value='';void attach(file);
     }}/>
    </label>
    {active.evidence&&<div className="g18-file">
     <strong>Lokaler Datei-Fingerabdruck</strong>
     <span>{active.evidence.name} · {active.evidence.bytes} Byte</span>
     <code>{active.evidence.sha256}</code>
     <button type="button" onClick={()=>change({evidence:null})}>Verknüpfung entfernen</button>
    </div>}
   </div>
  </div>
  <section className="g18-gates" aria-label="Unabhängige Freigabematrix">
   <h3>Unabhängige Freigabematrix</h3>
   <p>Alle Punkte bleiben gesperrt, auch wenn ein Operator 105 Prüfschritte als beobachtet notiert. Hier
    gibt es weder Freigabe-Buttons noch Schlüssel- oder Zeugnisimitationen.</p>
   <div role="table" aria-label="Release-Status nach Eigentümerschaft">
    <div role="row" className="g18-table-head"><strong role="columnheader">Pflichtnachweis</strong>
     <strong role="columnheader">Zuständig</strong><strong role="columnheader">Status</strong></div>
    {RELEASE_GATES.map(g=><div role="row" key={g.id}>
     <span role="cell">{g.label}</span><span role="cell">{g.owner}</span>
     <strong role="cell">OFFEN</strong></div>)}
   </div>
  </section>
  <section className="g18-export" aria-label="Prüfnotizen exportieren und abgleichen">
   <h3>Prüfnotizen übernehmen / abgleichen</h3>
   <label>Allgemeine Notizen (keine erfundene Signatur)
    <textarea rows={2} maxLength={1200} value={notes} onChange={e=>{setNotes(e.target.value);setStatus('');}}/>
   </label>
   <div className="g18-actions">
    <button type="button" disabled={busy} onClick={()=>void save()}>G18-Protokoll als JSON exportieren</button>
    <label>G18-Protokoll lokal importieren
     <input type="file" accept=".json,application/json" disabled={busy}
      onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void load(file);}}/>
    </label>
   </div>
   {status&&<p role="status">{status}</p>}
   <p className="g18-limit">Der SHA-256-Umschlag prüft nur lokale Konsistenz, nicht Identität oder unabhängige Herkunft.
    Keine Belegdatei wird hochgeladen. Release, Merge, Deploy, Rechte und physische Abnahmen bleiben NO-GO.</p>
  </section>
 </section>;
}
