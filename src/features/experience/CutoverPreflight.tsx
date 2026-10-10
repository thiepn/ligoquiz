import {useMemo,useState} from 'react';
import {inspectManifest,inspectHandoff,inspectBackup,releaseCutoverStatus,rollbackInstructions,
 type CutoverInputs} from './g26-cutover';
import '../../styles/g26-cutover.css';

function saveFile(name:string,body:string,mime:string){
 const url=URL.createObjectURL(new Blob([body],{type:mime}));
 const a=document.createElement('a');
 try{a.href=url;a.download=name;a.click();}finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
type Kind='manifest'|'handoff'|'backup';
const kinds:{kind:Kind;title:string;caption:string;max:number}[]=[
 {kind:'manifest',title:'Buildmanifest prüfen',caption:'G25 g12-build.json aus dem originalen CI-Artefakt (nicht der Build selbst)',max:64*1024},
 {kind:'handoff',title:'Prüfergebnisse prüfen',caption:'G25 NO-GO-Übergabe aus Technikcheck (selbst notiert, nicht freigegeben)',max:1024*1024},
 {kind:'backup',title:'Spielstand lesen, nicht einspielen',caption:'G11 vollständiges Original-Sitzungsbackup; private Daten verbleiben nur im Arbeitsspeicher',max:20*1024*1024},
];
export function CutoverPreflight(){
 const [values,setValues]=useState<CutoverInputs>({manifest:null,handoff:null,backup:null});
 const [error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const status=useMemo(()=>releaseCutoverStatus(values),[values]);
 async function inspect(file:File|undefined,kind:Kind,max:number){
  if(!file)return;
  setError('');setNote('');setBusy(true);
  setValues(p=>({...p,[kind]:null}));
  try{
   if(file.size===0||file.size>max)throw Error('Datei leer oder über '+max+' Byte');
   const body=await file.text();
   const result=kind==='manifest'?await inspectManifest(body):kind==='handoff'?
    await inspectHandoff(body):await inspectBackup(body);
   setValues(p=>({...p,[kind]:result}));
   setNote('Originaldatei nur gelesen und strukturell geprüft; keine Zustimmung, Datenänderung oder Wiederherstellung.');
  }catch(e){setError((kind==='manifest'?'Build':kind==='handoff'?'Übergabe':'Backup')+
   ' abgelehnt: '+(e instanceof Error?e.message:'ungültig'));}
  finally{setBusy(false);}
 }
 return <section className="g26-cutover" aria-label="G26 Lesende Cutover- und Rückweg-Vorprüfung">
  <header><div><p className="eyebrow">G26 / RELEASE-KANDIDAT / QUELLE STATT DEPLOYMENT</p>
   <h2>V2.0 sicher vorbereiten</h2>
   <p>Drei vorhandene Dateien prüfen, ohne eine Sitzung wiederherzustellen, den Live-Stand zu öffnen oder DNS zu verändern.
    Die Prüfung ist lokal und gibt kein Produktivsystem frei.</p>
   </div><strong>NO-GO · NICHT VERÖFFENTLICHEN</strong></header>
  <div className="g26-quick"><div><strong>G25 Entwicklungsstand</strong>
    <span>Qualifiziert: 220 Unit, 85 Chromium, 7 Offline · keine reale Saalabnahme</span></div>
   <div><strong>Produktiver Altstand</strong>
    <span>main / v1.14 — Originaldaten und bestehende Browserprofile bewahren</span></div></div>
  <div className="g26-files">
   {kinds.map(({kind,title,caption,max})=><section key={kind}>
    <h3>{title}</h3><p>{caption}</p>
    <label>Originaldatei lokal auswählen
     <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
      const file=e.currentTarget.files?.[0];e.currentTarget.value='';void inspect(file,kind,max);}}/></label>
    <div className="g26-file-state" role="status">
     {values[kind]?<><span>Strukturell konsistent; unabhängige Identität NICHT bestätigt</span>
       <code>SHA-256 {values[kind]?.sha256.slice(0,20)}…</code></>:
      <span>Keine Datei geprüft</span>}
    </div>
    {kind==='backup'&&values.backup&&<p className="g26-backup-preview">
     {values.backup.game} · {values.backup.teams} Teams · Revision {values.backup.revision} ·
     {' '}{values.backup.currentLifecycle} · im isolierten Restore: {values.backup.recoveryPlan==='paused'?'pausiert':'abgeschlossen'}
    </p>}
    {values[kind]&&<button type="button" onClick={()=>setValues(p=>({...p,[kind]:null}))}>
     Nur diese Vorschau verwerfen</button>}
   </section>)}
  </div>
  <section className="g26-steps" aria-label="G26 belegte und offene Voraussetzungen">
   <h3>Was vor einem echten Umstieg fehlt</h3>
   <div>{status.checks.map(c=><div key={c.id} className="g26-step">
    <span>{c.state==='verified-code'?'QUELLCODE':c.state==='metadata-only'?'NUR METADATEN':'OFFEN'}</span>
    <p>{c.label}</p></div>)}</div>
  </section>
  <div className="g26-actions">
   <h3>Kontrollierten Rückweg vorbereiten</h3>
   <p>Der Rückweg hält das v1.14-Original und sämtliche lokalen Daten unverändert.
    Diese Dateien sind nur Checkliste und technisch begrenzter Nachweis, keine ausführbare Deployment-Anweisung.</p>
   <button type="button" onClick={()=>saveFile('ligoquiz-g26-rollback-vorbereitung.txt',
     rollbackInstructions(),'text/plain;charset=utf-8')}>Rückweg-Anleitung herunterladen</button>
   <button type="button" onClick={()=>saveFile('ligoquiz-g26-nicht-freigegeben.json',
     JSON.stringify(status,null,2),'application/json;charset=utf-8')}>NO-GO-Vorprüfung exportieren</button>
   <div className="g26-shortcuts"><a href="#/technik">Spielabend-Protokoll</a>
    <a href="#/inhalte">Inhaltsrechte prüfen</a><a href="#/einstellungen">Originalsicherung exportieren</a></div>
  </div>
  {error&&<p role="alert" className="g26-error">{error}</p>}
  {note&&<p role="status" className="g26-message">{note}</p>}
  <p className="g26-bottom">Die Datei-Prüfung liest nur Daten. Sie testet keine Original-Dist-Bytes, 
   keine externe Unterschrift, keine physische Projektion und führt keinerlei Restore oder Produktionsänderung aus.
   Der bestehende v1.14-Stand darf nicht durch dieses Prüffenster ersetzt werden.</p>
 </section>;
}
