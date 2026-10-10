import {useState} from 'react';
import {reconcileTrial} from './event-trial';
import {readG21Parent,verifyG21Envelope,appendG21Ledger,g21DryRun,g21Export,
 type G21Parent,type G21Verified} from './g21-attestation';
import '../../styles/g21-attestation.css';

const steps=[
 ['Trust-Roots','Zwei unabhängig identifizierte Personen müssen Root und Originalschlüssel außerhalb dieses Browsers bestätigen.'],
 ['Rotation und Zwischenfall','Widerruf, kompromittierte Alt-Schlüssel und unabhängige Re-Identifikation extern abgleichen.'],
 ['Wiederherstellung','Originalbytes eines ausdrücklich autorisierten Wegwerf-Backups tatsächlich wiederherstellen und separat bezeugen.'],
 ['Rechte','Echte Quellobjekte, redaktionelle Lizenz und Freigabeberechtigung durch Rechteinhaber nachweisen.'],
 ['Vor Ort','Echten Beamer, Abstand, Android/iOS, Tastatur sowie TalkBack/VoiceOver physisch prüfen.'],
 ['Eigentümerentscheid','Separater menschlicher Release-Owner muss Merge, Deployment und Nachkontrolle unabhängig entscheiden.'],
] as const;
function save(data:unknown){
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 try{a.href=url;a.download='ligoquiz-g21-independent-no-go.json';a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export function IndependentReleaseDryRun(){
 const [g18,setG18]=useState<unknown>(null),[g18Name,setG18Name]=useState('');
 const [parent,setParent]=useState<G21Parent|null>(null),[parentName,setParentName]=useState('');
 const [attestation,setAttestation]=useState<unknown>(null),[attestationName,setAttestationName]=useState('');
 const [publicKey,setPublicKey]=useState(''),[original,setOriginal]=useState<ArrayBuffer|null>(null);
 const [originalName,setOriginalName]=useState(''),[history,setHistory]=useState<G21Verified[]>([]);
 const [note,setNote]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const result=g21DryRun(history,parent);
 async function importJson(file:File|undefined,kind:'g18'|'parent'|'attestation'){
  if(!file)return;
  setError('');setMessage('');
  if(file.size===0||file.size>256*1024){setError('JSON leer oder größer als 256 KiB.');return;}
  setBusy(true);
  try{
   const parsed:unknown=JSON.parse(await file.text());
   if(kind==='g18'){
    await reconcileTrial(parsed);setG18(parsed);setG18Name(file.name);
    setParent(null);setParentName('');setHistory([]);setAttestation(null);
    setOriginal(null);setPublicKey('');
    setMessage('G18-Quelle intakt. Vorherige externe Kette sicher zurückgesetzt.');
   }else if(kind==='parent'){
    if(!g18)throw Error('Erst das unveränderte G18-Originalpaket laden');
    const verified=await readG21Parent(parsed,g18);
    setParent(verified);setParentName(file.name);setHistory([]);
    setAttestation(null);setOriginal(null);setPublicKey('');
    setMessage('G20-Handoff-Checksum geprüft; Originalsignaturen fehlen im Export. Root UNANCHORED. NO-GO.');
   }else{
    setAttestation(parsed);setAttestationName(file.name);
    setMessage('G21-Aussage noch nicht auf Ed25519, Quelle oder Rollen geprüft.');
   }
  }catch(e){setError('Import verweigert: '+(e instanceof Error?e.message:'ungültige Quelle'));}
  finally{setBusy(false);}
 }
 async function importOriginal(file:File|undefined){
  if(!file)return;
  setError('');setMessage('');
  if(file.size===0||file.size>12*1024*1024){setError('Originaldatei leer oder größer als 12 MiB.');return;}
  setBusy(true);
  try{setOriginal(await file.arrayBuffer());setOriginalName(file.name);
   setMessage('Originalbytes nur temporär eingelesen; Integritätsprüfung steht aus.');}
  catch{setError('Originaldatei nicht lesbar.');}
  finally{setBusy(false);}
 }
 async function verify(){
  if(!parent||!attestation||!publicKey.trim()){setError('G18, G20, G21-Aussage und öffentlicher Schlüssel erforderlich.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const item=await verifyG21Envelope(attestation,publicKey,parent,original??undefined);
   const ledger=appendG21Ledger(history,item,parent);setHistory(ledger);
   setAttestation(null);setAttestationName('');setPublicKey('');setOriginal(null);setOriginalName('');
   setMessage('Ed25519 und Quellenbindung gültig. Externe Identität NICHT autorisiert; keine Freigabe. NO-GO.');
  }catch(e){setError('G21 abgelehnt: '+(e instanceof Error?e.message:'Unbekannter Fehler'));}
  finally{setBusy(false);}
 }
 async function exportDryRun(){
  setBusy(true);setError('');setMessage('');
  try{save(await g21Export(history,parent,note));
   setMessage('Unverbindliches NO-GO-Protokoll exportiert, keine externe Entscheidung.');}
  catch{setError('Protokoll konnte nicht exportiert werden.');}
  finally{setBusy(false);}
 }
 return <section className="g21-review" aria-label="G21 Unabhängige Root-Attestierung und Release-Trockenlauf">
  <header><div><p className="eyebrow">G21 · EXTERNE PRÜFKETTE · KEINE PRODUKTION</p>
   <h2>Unabhängige Root-Attestierung</h2>
   <p>Originale aus G18 und G20 mit unabhängig zugestellten G21-Ed25519-Aussagen abgleichen.
    Signierte Behauptungen und selbst gemeldete Rollen sind keine bestätigte Identität oder Freigabe.</p></div>
   <strong>NO-GO · NUR TROCKENLAUF</strong>
  </header>
  <div className="g21-fields">
   <label>1. G18 Original-Quellenpaket (JSON)<input type="file" accept=".json,application/json"
    disabled={busy} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(f,'g18');}}/>
    <small>{g18Name||'Nicht geladen'}</small></label>
   <label>2. G20 Custody-Handoff (JSON)<input type="file" accept=".json,application/json"
    disabled={busy||!g18} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(f,'parent');}}/>
    <small>{parentName||'Nicht geladen · G20 Export ohne Originalsignaturen'}</small></label>
   <label>3. Extern signierte G21-Zeugenaussage (JSON)<input type="file" accept=".json,application/json"
    disabled={busy||!parent} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importJson(f,'attestation');}}/>
    <small>{attestationName||'Noch keine Aussage'}</small></label>
   <label>4. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)
    <textarea rows={2} spellCheck={false} autoComplete="off" maxLength={100}
    placeholder="Nur öffentlicher Schlüssel, niemals Private Key." value={publicKey}
    onChange={e=>{setPublicKey(e.target.value);setError('');}}/></label>
   <label>5. Unveränderte Originalbeleg-Datei (optional, max. 12 MiB)
    <input type="file" disabled={busy||!parent} onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importOriginal(f);}}/>
    <small>{originalName||'Für Geräte, Rechte, Beamer und Recovery erforderlich'}</small></label>
  </div>
  <button type="button" className="g21-action" disabled={busy||!parent||!attestation||!publicKey.trim()}
   onClick={()=>void verify()}>Signierte Aussage und unabhängige Rollen prüfen</button>
  {message&&<p className="g21-notice" role="status">{message}</p>}
  {error&&<p className="g21-error" role="alert">{error}</p>}
  <section className="g21-ledger" aria-label="Mehrparteiennachweise ohne Freigabe">
   <h3>Mehrparteien-Reconciliation</h3>
   <p>{result.signedWitnesses} signierte Aussagen · {result.independentRootCrossChecks} verschiedene Root-Prüfschlüssel
    {' '}· {result.originalsHashChecked} Originalbelege geprüft · {result.compromisedOrRevoked} gesperrte oder betroffene Schlüssel.</p>
   <p>G20 Originalsignaturen erneut überprüft: NEIN. Externe Identitätsanker: 0. Release: NO-GO.</p>
   {history.length>0&&<ol>{history.map(entry=><li key={entry.digest}>
     <strong>#{entry.statement.sequence} · {entry.statement.action} · {entry.statement.finding}</strong>
     <span>{entry.statement.actorId} · {entry.statement.role} · {entry.statement.scenarioId}</span>
     <small>SHA-256 {entry.digest.slice(0,18)}… · Datei {entry.attachmentChecked?'geprüft':'nicht geprüft'} · Trust-Root UNANCHORED</small>
    </li>)}</ol>}
  </section>
  <section className="g21-gates" aria-label="Unabhängige offene Entscheidungstore">
   <h3>Sechs getrennte, offene Freigabegrenzen</h3>
   <div role="table" aria-label="G21 NO-GO Freigabematrix">
    {steps.map(([label,description],i)=><div role="row" key={label}>
     <div role="cell"><strong>{label}</strong><p>{description}</p></div>
     <strong role="cell">{i===0?'UNBESTÄTIGT':'OFFEN'}</strong>
    </div>)}
   </div>
  </section>
  <section className="g21-export">
   <label>Reviewnotiz (niemals eine Autorisierung)
    <textarea rows={2} value={note} maxLength={1200} onChange={e=>setNote(e.target.value)}/></label>
   <button type="button" className="g21-action" disabled={busy} onClick={()=>void exportDryRun()}>
    Separates G21 NO-GO-Trockenlaufprotokoll exportieren</button>
  </section>
  <p className="g21-denied" role="status">NO-GO — Zwei Signaturen sind noch keine unabhängig bestätigten Trust-Roots.
   Keine echte Rechtefreigabe, Vor-Ort-Abnahme, Restore-Autorisierung, Owner-Entscheidung, kein Merge und kein Deployment.</p>
 </section>;
}
