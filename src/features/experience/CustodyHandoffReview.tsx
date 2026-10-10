import {useState} from 'react';
import {reconcileTrial} from './event-trial';
import {verifyCustody,appendCustody,custodyDecision,custodyHandoff,type VerifiedCustody} from './g20-custody';
import '../../styles/g20-custody.css';
const details=[
 ['Unabhängige Root-Annahme','Ein Prüfer außerhalb des Geräts muss Schlüssel, Organisation und Zuständigkeit nachweislich bestätigen.'],
 ['Kompromittierung/Widerruf','Bei kompromittierten Schlüsseln alle abhängigen Aussagen sperren und externe Quellbelege getrennt bewahren.'],
 ['Handoff und Rollen','Root-Verwaltung, unabhängige Sichtung, Recovery, Rechteprüfung und Repository-Eigentümer trennen.'],
 ['Backup und Originalquelle','Echte unveränderte Sicherungsdatei und Wiederherstellung nur im ausdrücklich autorisierten Testsystem prüfen.'],
 ['Physische Abnahme','1280 × 720-Beamer, Lesen aus Abstand, Android/iOS, Keyboard, TalkBack/VoiceOver separat vor Ort bezeugen.'],
 ['Freigabe in Fremdsystem','Merge/Deployment nur durch unabhängig autorisierten Owner nach echten Signaturen/Quellenrechten; hier nicht möglich.'],
] as const;
const download=(data:unknown)=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');
 try{a.href=url;a.download='ligoquiz-g20-custody-no-go.json';a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
export function CustodyHandoffReview(){
 const [g18,setG18]=useState<unknown>(null),[g18Name,setG18Name]=useState('');
 const [receipt,setReceipt]=useState<unknown>(null),[receiptName,setReceiptName]=useState('');
 const [publicKey,setPublicKey]=useState(''),[evidence,setEvidence]=useState<ArrayBuffer|null>(null);
 const [evidenceName,setEvidenceName]=useState(''),[notes,setNotes]=useState('');
 const [history,setHistory]=useState<VerifiedCustody[]>([]);
 const [status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const decision=custodyDecision(history);
 async function importJson(file:File|undefined,kind:'source'|'receipt'){
  if(!file)return;
  setError('');setStatus('');
  if(file.size===0||file.size>256*1024){setError('JSON zu groß oder leer (Maximum 256 KiB).');return;}
  setBusy(true);
  try{
   const data:unknown=JSON.parse(await file.text());
   if(kind==='source'){await reconcileTrial(data);setG18(data);setG18Name(file.name);
    setHistory([]);setReceipt(null);setEvidence(null);setStatus('G18-Quelle geprüft; bestehende Handoff-Kette aus Sicherheitsgründen geleert.');}
   else{setReceipt(data);setReceiptName(file.name);setStatus('Beleg geladen, aber Signatur und Schlüssel NICHT geprüft.');}
  }catch(e){setError('Ungültige Datei: '+(e instanceof Error?e.message:'JSON ungültig'));}
  finally{setBusy(false);}
 }
 async function importFile(file:File|undefined){
  if(!file)return;
  setError('');setStatus('');
  if(file.size===0||file.size>12*1024*1024){setError('Originalbeleg zu groß/leer (12 MiB).');return;}
  setBusy(true);
  try{setEvidence(await file.arrayBuffer());setEvidenceName(file.name);
   setStatus('Originaldatei lokal eingelesen. Hashabgleich erfolgt erst bei Signaturprüfung.');}
  catch{setError('Originaldatei konnte nicht gelesen werden.');}
  finally{setBusy(false);}
 }
 async function check(){
  if(!g18||!receipt||!publicKey.trim()){setError('G18-Paket, Handoff-Beleg und separater öffentlicher Schlüssel erforderlich.');return;}
  setBusy(true);setError('');setStatus('');
  try{
   const checked=await verifyCustody(receipt,publicKey,g18,evidence??undefined);
   const ledger=appendCustody(history,checked);
   setHistory(ledger);setReceipt(null);setReceiptName('');setEvidence(null);setEvidenceName('');
   setStatus('Signatur, Quellenbindung und Chronologie konsistent. Root bleibt UNBESTÄTIGT. NO-GO.');
  }catch(e){setError('Beleg VERWEIGERT: '+(e instanceof Error?e.message:'Unbekannter Fehler'));}
  finally{setBusy(false);}
 }
 async function exportHandoff(){
  setBusy(true);setError('');setStatus('');
  try{download(await custodyHandoff(history,notes));
   setStatus('NO-GO-Paket lokal ausgegeben. Weder Trust-Root noch menschliche Freigabe.');}
  catch{setError('Handoff-Export fehlgeschlagen.');}
  finally{setBusy(false);}
 }
 return <section className="g20-review" aria-label="G20 Unabhängige Schlüsselverwahrung und Recovery-Handoff">
  <header><div><p className="eyebrow">G20 · EXTERNE CUSTODY · UNABHÄNGIGE ROLLEN</p>
   <h2>Schlüsselverwahrung und Recovery-Handoff</h2>
   <p>Nur extern vorbereitete, signierte Belege prüfen: Root-Vorschlag, unabhängige Sichtung,
    Rotation, Widerruf/Kompromittierung, Recovery, Rechte und physische Geräte.
    Keine Schlüssel erzeugen oder Identitäten hier freigeben.</p></div>
   <strong>NO-GO · KEINE ROOT-AKTIVIERUNG</strong>
  </header>
  <div className="g20-fields">
   <label>1. Unverändertes G18-Quellenpaket (JSON)
    <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
     const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(file,'source');}}/>
    <small>{g18Name||'Keine geprüfte Quelle'}</small>
   </label>
   <label>2. Separat signierter G20-Custody-Beleg (JSON)
    <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
     const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(file,'receipt');}}/>
    <small>{receiptName||'Noch keine externe signierte Aussage'}</small>
   </label>
   <label>3. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)
    <textarea rows={2} maxLength={100} spellCheck={false} autoComplete="off"
     value={publicKey} onChange={e=>{setPublicKey(e.target.value);setStatus('');setError('');}}
     placeholder="Nur öffentlichen Schlüssel. KEINE privaten Schlüssel eingeben."/>
   </label>
   <label>4. Originalbeleg lokal SHA-256-vergleichen (optional, max. 12 MiB)
    <input type="file" disabled={busy} onChange={e=>{const file=e.currentTarget.files?.[0];
     e.currentTarget.value='';void importFile(file);}}/>
    <small>{evidenceName||'Ohne Originalbytes: Inhalt NICHT geprüft'}</small>
   </label>
  </div>
  <button type="button" className="g20-action" disabled={busy||!g18||!receipt||!publicKey.trim()}
   onClick={()=>void check()}>Signatur und unabhängige Custody-Reihenfolge prüfen</button>
  {status&&<p className="g20-success" role="status">{status}</p>}
  {error&&<p className="g20-error" role="alert">{error}</p>}
  <section className="g20-ledger" aria-label="Handoff und kompromittierte Signer">
   <h3>Verifizierte Belege – ohne externes Vertrauen</h3>
   <p>{decision.statements} signierte Belege · {decision.actors} unterschiedliche Rollennamen
    {' '}· {decision.compromised} Widerruf/Kompromittierung · {decision.independentTrustRoots} bestätigte Trust-Roots.</p>
   {history.length===0?<p>Noch keine chronologisch geprüften Belege.</p>:
    <ol>{history.map(item=><li key={item.digest}>
     <strong>#{item.statement.sequence} · {item.statement.action} · {item.statement.role}</strong>
     <span>{item.statement.actorId} · {item.statement.scenarioId}</span>
     <span>Digest {item.digest.slice(0,20)}… · Originaldatei {item.attachmentChecked?'SHA-256 geprüft':'nicht nachgewiesen'}</span>
     <small>Schlüsselvertrauen UNBESTÄTIGT · {item.statement.decision}</small>
    </li>)}</ol>}
  </section>
  <section className="g20-gates" aria-label="Getrennte Root und Eigentümer-Freigabematrix">
   <h3>Außerhalb von LiGoQuiz erforderliche Freigaben</h3>
   <div role="table" aria-label="G20 NO-GO-Matrix">
    {details.map(([title,description])=><div role="row" key={title}>
     <div role="cell"><strong>{title}</strong><p>{description}</p></div>
     <strong role="cell">OFFEN</strong></div>)}
   </div>
  </section>
  <section className="g20-export" aria-label="Handoff-Receipt exportieren">
   <label>Custody-Prüfnotiz (keine Autorisierung)
    <textarea rows={2} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)}/>
   </label>
   <button type="button" className="g20-action" disabled={busy} onClick={()=>void exportHandoff()}>
    NO-GO-Custody-Paket lokal exportieren</button>
  </section>
  <p className="g20-denied" role="status">NO-GO — kryptografisch gültig bedeutet nicht unabhängig
   vertrauenswürdig. Keine aktive Root, keine Recovery-/Geräteabnahme, keine Quellenrechte,
   keine Eigentümerfreigabe und KEIN Merge oder Deployment.</p>
 </section>;
}
