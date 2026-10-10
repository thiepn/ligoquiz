import {useMemo,useState} from 'react';
import {assembleHandoff,handoffJson,handoffCsv,parsePilotEvidence,parseEditorialEvidence,
 type PilotEvidence,type EditorialEvidence} from './g25-handoff';
import '../../styles/g25-release-desk.css';

const labels:Record<string,string>={rundenquiz:'Rundenquiz',quiztafel:'Quiztafel',
 verbindungen:'Verbindungen',logikleiter:'Logikleiter',umfrageduell:'Umfrageduell'};
function download(name:string,content:string,type:string){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement('a');
 try{a.href=url;a.download=name;a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function ReleaseCandidateDesk(){
 const [pilot,setPilot]=useState<PilotEvidence|null>(null);
 const [editorial,setEditorial]=useState<EditorialEvidence|null>(null);
 const [status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [game,setGame]=useState('all'),[filter,setFilter]=useState<'all'|'blocker'|'review'>('all');
 const report=useMemo(()=>assembleHandoff({pilot,editorial}),[pilot,editorial]);
 const found=report.issues.filter(x=>(game==='all'||x.game===game)&&
  (filter==='all'||x.severity===filter));
 async function readFile(file:File|undefined,kind:'pilot'|'editorial'){
  if(!file)return;
  setError('');setStatus('');setBusy(true);
  if(kind==='pilot')setPilot(null);else setEditorial(null);
  try{
   const limit=kind==='pilot'?256*1024:512*1024;
   if(file.size<1||file.size>limit)throw Error('Originaldatei außerhalb der Größe 1 Byte – '+limit+' Byte');
   const text=await file.text();
   if(kind==='pilot'){
    const verified=await parsePilotEvidence(text,file.name);
    setPilot(verified);setStatus('G18-Paket lokal auf Schema und SHA-256 geprüft; keine unabhängige Unterschrift.');
   }else{
    const inspected=await parseEditorialEvidence(text,file.name);
    setEditorial(inspected);setStatus('G23-Prüfindex strukturell abgeglichen; keine externe Rechte- oder Faktenfreigabe.');
   }
  }catch(e){setError((kind==='pilot'?'G18':'G23')+'-Datei abgelehnt: '+(e instanceof Error?e.message:'ungültig'));}
  finally{setBusy(false);}
 }
 return <section className="g25-desk" aria-label="G25 Spielabend und Release-Handoff">
  <header className="g25-head"><div><p className="eyebrow">G25 / ECHTE QUELLDATEIEN / LESEN OHNE ÜBERNAHME</p>
    <h2>Spielabend-Übergabe</h2>
    <p>Originale Generalprobe und den redaktionellen Prüfindex hier zusammenführen.
      Du siehst offene Fälle, die nächsten Handlungen und ein datensparsames Übergabepaket.
      Es werden keine Spielstände, Fragen, Backups oder Originaldateien geschrieben.</p>
   </div><strong>NO-GO · KEINE RELEASE-FREIGABE</strong>
  </header>
  <div className="g25-kpis" aria-label="G25 aktuelle Quellenlage">
   <div><b>{pilot?pilot.reported:'—'}<small> / 105</small></b><span>Selbst notierte Prüfschritte</span></div>
   <div><b>{pilot?pilot.defects:'—'}</b><span>Gemeldete Probenprobleme</span></div>
   <div><b>{editorial?editorial.blockers:'—'}</b><span>G23 Inhaltsblocker</span></div>
   <div><b>{report.missing.length}</b><span>Offene Handoff-Anforderungen</span></div>
  </div>
  <div className="g25-sources">
   <section><h3>1. Generalprobe einlesen</h3>
    <p>Originales G18-JSON mit 15 Szenarien. Selbst gemeldete Ergebnisse bleiben unbestätigt.</p>
    <label>G18 Originalprotokoll
     <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
      const f=e.currentTarget.files?.[0];e.currentTarget.value='';void readFile(f,'pilot');}}/></label>
    <small>{pilot?'Lokal geprüft: '+pilot.name+' · SHA-256 '+pilot.sha256.slice(0,20)+'…':
      'Keine G18-Originaldatei geladen'}</small>
    {pilot&&<button type="button" onClick={()=>setPilot(null)}>G18 nur aus Ansicht entfernen</button>}
   </section>
   <section><h3>2. Fragenprüfung einlesen</h3>
    <p>G23-Export des Inhaltsateliers. Zählungen und Prüfcodes ersetzen keine Quellenlizenz.</p>
    <label>G23 redaktionellen Prüfindex
     <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
      const f=e.currentTarget.files?.[0];e.currentTarget.value='';void readFile(f,'editorial');}}/></label>
    <small>{editorial?'Lokal geprüft: '+editorial.name+' · SHA-256 '+editorial.sha256.slice(0,20)+'…':
      'Kein G23-Prüfindex geladen'}</small>
    {editorial&&<button type="button" onClick={()=>setEditorial(null)}>G23 nur aus Ansicht entfernen</button>}
   </section>
  </div>
  <div className="g25-next"><h3>Nächste reale Schritte</h3>
   <ol>{report.missing.map(x=><li key={x}>{x}</li>)}</ol>
   <div className="g25-shortcuts"><a href="#/setup">Testspiel vorbereiten</a>
    <a href="#/inhalte">Fragen im Inhaltsatelier prüfen</a>
    <a href="#/einstellungen">Original-Backup nicht überschreiben</a>
   </div>
  </div>
  <div className="g25-triage" role="region" aria-label="G25 konkrete Prüfprobleme">
   <div className="g25-triage-head"><h3>Prüfliste aus tatsächlich geladenen Dateien</h3>
    <span>{found.length} von {report.issues.length} Hinweisen</span></div>
   <div className="g25-filters">
    <label>Spiel<select value={game} aria-label="G25 Spiel filtern" onChange={e=>setGame(e.target.value)}>
      <option value="all">Alle fünf Spiele</option>
      {Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
     </select></label>
    <label>Schwere<select value={filter} aria-label="G25 Schwere filtern" onChange={e=>setFilter(e.target.value as typeof filter)}>
      <option value="all">Alle Prüfungen</option><option value="blocker">Nur Blocker</option>
      <option value="review">Nur manuelle Prüfung</option>
     </select></label>
   </div>
   <div className="g25-issues">
    {found.slice(0,100).map(x=><div key={x.id} className="g25-issue">
      <strong>{x.severity==='blocker'?'BLOCKER':'PRÜFEN'} · {labels[x.game??'']??'Übergreifend'}</strong>
      <span>{x.label}</span>
      <small>{x.scenarioId??x.contentId??'–'}{x.checkId?' · '+x.checkId:''}</small>
     </div>)}
    {found.length===0&&<p>Keine geladenen Fälle für diese Filter. Nicht eingelesene oder fehlende Originalnachweise sind keine Freigabe.</p>}
    {found.length>100&&<p>Nur 100 Zeilen angezeigt. Der Export enthält den vollständigen datensparsamen Prüfindex.</p>}
   </div>
  </div>
  <div className="g25-export"><h3>Prüfstand an die Veranstaltungsleitung übergeben</h3>
   <p>Nur Fallkennungen, Spiel, Schwere, Quell-Dateihashes und offene Anforderungen. Keine Fragen, privaten Lösungen,
    Originalbelege, Bilder oder Teilnehmerdaten. Alle Exporte bleiben ausdrücklich NO-GO.</p>
   <button type="button" onClick={()=>download('ligoquiz-g25-uebergabe-NO-GO.json',
    handoffJson({pilot,editorial}),'application/json;charset=utf-8')}>Übergabe als JSON exportieren</button>
   <button type="button" onClick={()=>download('ligoquiz-g25-problemliste-NO-GO.csv',
    handoffCsv({pilot,editorial}),'text/csv;charset=utf-8')}>Prüfliste für Excel (CSV)</button>
  </div>
  {status&&<p role="status" className="g25-status">{status}</p>}
  {error&&<p role="alert" className="g25-error">{error}</p>}
  <p className="g25-limits">Lokale SHA-256-Prüfung ist kein Eigentümerzeugnis. Auch 105 selbst berichtete Schritte
   und 0 automatische Inhaltswarnungen bestätigen weder Saal, Beamer, Geräte, Lizenzlage noch genehmigten Restore.
   Merge, Migration, Staging, Deployment, Veröffentlichung und Nachkontrolle bleiben gesperrt.</p>
 </section>;
}
