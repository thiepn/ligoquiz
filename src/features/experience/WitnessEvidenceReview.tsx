import {useState} from 'react';
import {verifyWitness,appendWitnessChain,decisionForWitnesses,type VerifiedWitness} from './g19-witness';
import {reconcileTrial} from './event-trial';
import '../../styles/g19-witness.css';

export function WitnessEvidenceReview(){
 const [g18,setG18]=useState<unknown>(null);
 const [g18Name,setG18Name]=useState('');
 const [publicKey,setPublicKey]=useState('');
 const [witness,setWitness]=useState<unknown>(null);
 const [witnessName,setWitnessName]=useState('');
 const [attachment,setAttachment]=useState<ArrayBuffer|null>(null);
 const [attachmentName,setAttachmentName]=useState('');
 const [entries,setEntries]=useState<VerifiedWitness[]>([]);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const decision=decisionForWitnesses(entries);
 async function importJson(file:File|undefined,type:'source'|'witness'){
  if(!file)return;
  setError('');setNotice('');
  if(file.size===0||file.size>256*1024){setError('JSON-Datei außerhalb der zulässigen 256 KiB.');return;}
  setBusy(true);
  try{
   const decoded:unknown=JSON.parse(await file.text());
   if(type==='source'){
    await reconcileTrial(decoded);
    setG18(decoded);setG18Name(file.name);
    setEntries([]);setNotice('G18-Basis überprüft. Bisherige Zeugenkette zurückgesetzt.');
   }else{setWitness(decoded);setWitnessName(file.name);
    setNotice('Aussage eingelesen, Unterschrift und Quellenbindung noch NICHT geprüft.');}
  }catch(e){setError('Datei abgelehnt: '+(e instanceof Error?e.message:'JSON ungültig'));}
  finally{setBusy(false);}
 }
 async function importAttachment(file:File|undefined){
  if(!file)return;
  setError('');setNotice('');
  if(file.size===0||file.size>12*1024*1024){setError('Anhang außerhalb der 12-MiB-Grenze.');return;}
  setBusy(true);
  try{setAttachment(await file.arrayBuffer());setAttachmentName(file.name);
   setNotice('Anhang nur lokal geladen; wird erst beim Prüfen mit signierter SHA-256 verglichen.');}
  catch{setError('Anhang konnte nicht gelesen werden.');}
  finally{setBusy(false);}
 }
 async function verify(){
  if(!g18||!witness||!publicKey.trim()){setError('G18-Protokoll, Zeugenpaket und öffentlicher Schlüssel erforderlich.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const checked=await verifyWitness(witness,publicKey.trim(),g18,attachment??undefined);
   setEntries(previous=>appendWitnessChain(previous,checked));
   setWitness(null);setWitnessName('');setAttachment(null);setAttachmentName('');
   setNotice('Ed25519 korrekt, Quelle geprüft, Kette konsistent. SCHLÜSSELVERTRAUEN UNGEKLÄRT — NO-GO.');
  }catch(e){setError('Nachweis zurückgewiesen: '+(e instanceof Error?e.message:'Prüfung fehlgeschlagen'));}
  finally{setBusy(false);}
 }
 return <section className="g19-review" aria-label="G19 Externe Zeugennachweise prüfen">
  <header><div><p className="eyebrow">G19 · EXTERNE BELEGE · KEINE EIGENE SCHLÜSSELERZEUGUNG</p>
   <h2>Zeugennachweise kryptografisch prüfen</h2>
   <p>Importiere einen G18-Prüfumschlag, eine extern signierte Aussage und den separat erhaltenen
    öffentlichen Ed25519-Schlüssel. Jede Signatur wird gegen die unveränderte Aussage geprüft.
    Der Schlüssel muss außerhalb dieser Anwendung von einer autorisierten Stelle bestätigt werden.</p></div>
   <strong>NO-GO · ALLE FREIGABEN OFFEN</strong></header>
  <ol className="g19-steps">
   <li>G18-Prüfumschlag aus der lokalen Generalprobe auswählen; Quelle und SHA-256 werden validiert.</li>
   <li>Externes Zeugenpaket und öffentlichen Schlüssel getrennt einbringen. Niemals private Schlüssel hochladen.</li>
   <li>Optional ursprüngliche Belegdatei prüfen. Gleichlautende Dateinamen allein beweisen keinen Inhalt.</li>
   <li>Signatur, Quellenbindung, Reihenfolge sowie Rotation/Widerruf überprüfen. Ohne unabhängige Schlüsselfreigabe bleibt die Freigabe gesperrt.</li>
  </ol>
  <div className="g19-inputs">
   <label>1. G18-Protokoll importieren (JSON)
    <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
     const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(file,'source');
    }}/>
    <small>{g18Name||'Keine verifizierte lokale G18-Basis'}</small>
   </label>
   <label>2. Externes Zeugenpaket importieren (JSON)
    <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
     const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(file,'witness');
    }}/>
    <small>{witnessName||'Keine unabhängige Aussage eingelesen'}</small>
   </label>
   <label>3. Separat bezogenen Ed25519-öffentlichen Schlüssel (Base64) eingeben
    <textarea rows={2} value={publicKey} spellCheck={false} autoComplete="off" maxLength={100}
     onChange={e=>{setPublicKey(e.target.value);setNotice('');setError('');}}
     placeholder="Nur öffentlicher 32-Byte-Schlüssel, niemals privater Schlüssel"/>
   </label>
   <label>4. Optionale originale Belegdatei (nur im Browser, bis 12 MiB)
    <input type="file" disabled={busy} onChange={e=>{
     const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importAttachment(file);
    }}/>
    <small>{attachmentName||'Ohne Datei wird deren Inhalt nicht nachgeprüft.'}</small>
   </label>
  </div>
  <button className="g19-check-button" type="button" disabled={busy||!g18||!witness||!publicKey.trim()}
   onClick={()=>void verify()}>Ed25519-Signatur und Zeugenchronologie prüfen</button>
  {notice&&<p role="status" className="g19-notice">{notice}</p>}
  {error&&<p role="alert" className="g19-error">{error}</p>}
  <section aria-label="Verifizierte aber nicht freigegebene Zeugenkette" className="g19-history">
   <h3>Importierte Signaturen (kein Vertrauensentscheid)</h3>
   <p>{decision.cryptographicallyVerified} kryptografisch verifiziert · {decision.externallyTrusted}
    {' '}extern vertrauensbestätigt · {decision.revoked} Widerrufe · {decision.rotated} Rotation(en).</p>
   {entries.length===0?<p>Keine verifizierte Zeugenchronologie vorhanden.</p>:
    <ol>{entries.map(row=><li key={row.digest}>
     <strong>{row.statement.witnessId} · {row.statement.scenarioId}</strong>
     <span>#{row.statement.sequence} · {row.statement.operation.toUpperCase()} · {row.statement.gateId}</span>
     <span>Schlüsselfingerabdruck {row.statement.keyFingerprint.slice(0,16)}…</span>
     <span>Beleginhalt: {row.attachmentChecked?'Datei SHA-256 geprüft':'NICHT unabhängig gegen Originaldatei geprüft'}</span>
     <small>Hash {row.digest.slice(0,16)}… · Vertrauen: NICHT BESTÄTIGT</small>
    </li>)}</ol>}
  </section>
  <section aria-label="Getrennte Eigentümerentscheidung" className="g19-release">
   <h3>Unabhängige Eigentümerentscheidung</h3>
   <p>Signaturgültigkeit ist nicht gleich Identität, Beweisqualität, Rechteprüfung oder Freigabe.
    Widerruf/Rotation ist nur innerhalb der verifizierten, aber weiterhin untrusted Kette dokumentiert.</p>
   <div role="table" aria-label="G19 externe Freigabesperren">
    {[
     ['Öffentlicher Schlüssel unabhängig bestätigt','OFFEN'],
     ['Benannte Zeugenrolle und tatsächliches Gerät','OFFEN'],
     ['15 physische Spiele, Beamer und Abstand','OFFEN'],
     ['Originale Belegdateien und Quellenrechte','OFFEN'],
     ['Backup und realer Wiederherstellungstest','OFFEN'],
     ['Unabhängige Freigabe, Repository-Owner und Deployment','OFFEN'],
    ].map(([name,result])=><div role="row" key={name}>
     <span role="cell">{name}</span><strong role="cell">{result}</strong></div>)}
   </div>
   <p className="g19-restriction" role="status">NO-GO — keine Release-, Merge- oder Deployment-Autorisierung.
    Diese Oberfläche besitzt keine vertrauenswürdig konfigurierte externe Trust-Root,
    keine privaten Schlüssel und keinen unabhängigen Abnahmeprozess.</p>
  </section>
 </section>;
}
