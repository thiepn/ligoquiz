import {useState} from 'react';
import {reconcileTrial} from './event-trial';
import {readG22Parent,verifyG22,appendG22,g22Decision,g22Export,G22_KIND,
 type G22Parent,type G22Verified} from './g22-physical-custody';
import '../../styles/g22-physical-custody.css';

const evidenceTypes=[
 ['Beamer','Echte 1280 × 720-Auflösung und Abstand zum Publikum, keine privaten Antworten auf der Bühne.'],
 ['Geräte','Android/iOS, Tastatur und TalkBack/VoiceOver müssen an tatsächlichen Geräten separat abgenommen werden.'],
 ['Originalquellen','Originaldatei, Autor/Rechteinhaber, Lizenz und Zuordnung zum konkreten Inhalt außerhalb der App prüfen.'],
 ['Recovery','Wegwerf-Backup auf autorisierter isolierter Instanz wirklich wiederherstellen, Ausgangsbytes bewahren.'],
 ['Rehearsals','Fünf Spiele mit jeweils 3/4/5 Teams vor Ort als 15 einzelne überprüfbare Läufe.'],
 ['Eigentümer','Staging, Release, Migration, öffentliche Veröffentlichung und Nachkontrolle getrennt genehmigen.'],
] as const;
const save=(packet:unknown)=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}));
 const a=document.createElement('a');
 try{a.href=url;a.download='ligoquiz-g22-physical-no-go.json';a.click();}
 finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
export function PhysicalCustodyReview(){
 const [g18,setG18]=useState<unknown>(null),[g18Name,setG18Name]=useState('');
 const [parent,setParent]=useState<G22Parent|null>(null),[parentName,setParentName]=useState('');
 const [envelope,setEnvelope]=useState<unknown>(null),[envelopeName,setEnvelopeName]=useState('');
 const [key,setKey]=useState(''),[original,setOriginal]=useState<ArrayBuffer|null>(null);
 const [originalName,setOriginalName]=useState(''),[entries,setEntries]=useState<G22Verified[]>([]);
 const [note,setNote]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false);const summary=g22Decision(entries,parent);
 async function loadJson(file:File|undefined,what:'source'|'parent'|'receipt'){
  if(!file)return;
  setNotice('');setError('');
  if(file.size<1||file.size>256*1024){setError('JSON leer oder zu groß (maximal 256 KiB).');return;}
  setBusy(true);
  try{
   const parsed:unknown=JSON.parse(await file.text());
   if(what==='source'){
    await reconcileTrial(parsed);setG18(parsed);setG18Name(file.name);
    setParent(null);setParentName('');setEntries([]);setEnvelope(null);setOriginal(null);setKey('');
    setNotice('G18-Quelle geprüft, bisherige Zeugenkette aus Sicherheitsgründen zurückgesetzt.');
   }else if(what==='parent'){
    if(!g18)throw Error('Originales G18-Quellpaket zuerst laden');
    const valid=await readG22Parent(parsed,g18);
    setParent(valid);setParentName(file.name);setEntries([]);setEnvelope(null);setOriginal(null);setKey('');
    setNotice('G21-Checksum und Quellverknüpfung konsistent. Signaturen aus G20/G21 fehlen: NICHT wiederverifiziert.');
   }else{
    setEnvelope(parsed);setEnvelopeName(file.name);
    setNotice('Bericht geladen. Ungeprüft bis zum separaten Schlüssel- und Originalbytes-Abgleich.');
   }
  }catch(e){setError('Import verweigert: '+(e instanceof Error?e.message:'ungültiges JSON'));}
  finally{setBusy(false);}
 }
 async function loadOriginal(file:File|undefined){
  if(!file)return;
  setNotice('');setError('');
  if(file.size<1||file.size>12*1024*1024){setError('Originaldatei leer oder größer als 12 MiB.');return;}
  setBusy(true);
  try{
   setOriginal(await file.arrayBuffer());setOriginalName(file.name);
   setNotice('Originalbytes nur lokal und flüchtig eingelesen; die Signaturprüfung steht aus.');
  }catch{setError('Originaldatei nicht lesbar.');}
  finally{setBusy(false);}
 }
 async function check(){
  if(!parent||!envelope||!key.trim()||!original){
   setError('G18 + G21, signierter G22-Bericht, öffentlicher Schlüssel und Originaldatei erforderlich.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const verified=await verifyG22(envelope,key,original,parent);
   const updated=appendG22(entries,verified,parent);setEntries(updated);
   setEnvelope(null);setEnvelopeName('');setOriginal(null);setOriginalName('');setKey('');
   setNotice('Quelle, SHA-256 Originalbytes, Ed25519 und Belegfolge konsistent. Externe Rolle bleibt UNBESTÄTIGT. NO-GO.');
  }catch(e){setError('Beleg abgelehnt: '+(e instanceof Error?e.message:'ungültiger Beleg'));}
  finally{setBusy(false);}
 }
 async function exportReview(){
  setBusy(true);setError('');setNotice('');
  try{
   save(await g22Export(entries,parent,note));
   setNotice('Datensparsames G22-NO-GO-Paket ausgegeben: nur geprüfte Hashes und Metadaten, keine Originalbytes.');
  }catch{setError('Export fehlgeschlagen.');}
  finally{setBusy(false);}
 }
 return <section className="g22-review" aria-label="G22 Physische Abnahme und Originalbelege">
  <header><div><p className="eyebrow">G22 · PHYSISCHE ORIGINALBELEGE · UNABHÄNGIGE ABNAHME</p>
   <h2>Geräte- und Originalbelegprüfung</h2>
   <p>Externe signierte Aussagen samt tatsächlichen Originalbytes auf Hashes prüfen.
    Keine Originale speichern oder exportieren. Ungeprüfte Identitäten, Selbstberichte und simulierte Geräte sind keine Freigabe.</p>
   </div><strong>NO-GO · NICHT PRODUKTIV</strong></header>
  <div className="g22-fields">
   <label>1. Unverändertes G18-Original (JSON)
    <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{
     const f=e.currentTarget.files?.[0];e.currentTarget.value='';void loadJson(f,'source');}}/>
    <small>{g18Name||'Quelle fehlt'}</small></label>
   <label>2. Separates G21-NO-GO-Trockenlaufpaket (JSON)
    <input type="file" accept=".json,application/json" disabled={busy||!g18} onChange={e=>{
     const f=e.currentTarget.files?.[0];e.currentTarget.value='';void loadJson(f,'parent');}}/>
    <small>{parentName||'Paket fehlt'}</small></label>
   <label>3. Extern signierter G22-Originalbeleg (JSON)
    <input type="file" accept=".json,application/json" disabled={busy||!parent} onChange={e=>{
     const f=e.currentTarget.files?.[0];e.currentTarget.value='';void loadJson(f,'receipt');}}/>
    <small>{envelopeName||'Kein Beleg geladen'}</small></label>
   <label>4. Separater öffentlicher Ed25519-Schlüssel (Base64)
    <textarea rows={2} maxLength={100} spellCheck={false} autoComplete="off" value={key}
     onChange={e=>{setKey(e.target.value);setError('');}}
     placeholder="Nur den öffentlichen Schlüssel; niemals private Schlüssel." /></label>
   <label>5. Tatsächliche unveränderte Originalbeleg-Datei (max. 12 MiB)
    <input type="file" disabled={busy||!parent} onChange={e=>{
     const f=e.currentTarget.files?.[0];e.currentTarget.value='';void loadOriginal(f);}}/>
    <small>{originalName||'Originalbytes werden nach jeder Prüfung verworfen'}</small></label>
  </div>
  <button className="g22-action" type="button" disabled={busy||!parent||!envelope||!key.trim()||!original}
   onClick={()=>void check()}>Signatur, Originalhash, Rollen und Custody-Reihenfolge prüfen</button>
  {notice&&<p role="status" className="g22-notice">{notice}</p>}
  {error&&<p role="alert" className="g22-error">{error}</p>}
  <section className="g22-ledger" aria-label="G22 geprüfte Originalbeleg-Hashliste">
   <h3>In der Sitzung geprüfte Belege — unbestätigte Rollen</h3>
   <p>{entries.length} lokal signierte Belege · {summary.verifiedLocalOriginalHashes} Originalhashes ·
    {' '}{summary.compromisedCredentialReports} Kompromittierungsmeldungen · 0 extern bestätigte Identitäten.</p>
   <p>G20/G21 Ursprungssignaturen erneut unabhängig geprüft: NEIN.
    Originaldateien werden weder archiviert noch an Dienste übermittelt.</p>
   {entries.length>0&&<ol>{entries.map(e=><li key={e.digest}>
    <strong>#{e.statement.sequence} · {e.statement.kind} · {e.statement.finding}</strong>
    <span>{e.statement.actorId} · {e.statement.role} · SHA256 {e.statement.originalSha256.slice(0,20)}…</span>
    <small>Originalbytes SHA-256 verglichen · öffentlicher Signaturschlüssel UNANCHORED</small>
   </li>)}</ol>}
  </section>
  <section className="g22-gates" aria-label="G22 physische Abnahmegrenzen">
   <h3>Getrennte physische und rechtliche Prüfpunkte</h3>
   <p>Unterstützte signierte Belegarten: {Object.keys(G22_KIND).length}.
    Jeder geprüfte Beleg bleibt eine zu prüfende externe Behauptung.</p>
   <div role="table" aria-label="G22 unabhängige NO-GO-Matrix">
    {evidenceTypes.map(([name,description])=><div role="row" key={name}>
     <div role="cell"><strong>{name}</strong><p>{description}</p></div>
     <strong role="cell">OFFEN</strong>
    </div>)}
   </div>
  </section>
  <section className="g22-export">
   <label>Notiz für externe Prüfer (keine Autorisierung)
    <textarea rows={2} maxLength={1200} value={note} onChange={e=>setNote(e.target.value)}/></label>
   <button className="g22-action" type="button" disabled={busy} onClick={()=>void exportReview()}>
    G22 Original-Custody- und NO-GO-Paket exportieren</button>
  </section>
  <p className="g22-denied" role="status">NO-GO — keine extern autorisierte menschliche Abnahme.
   Staging, Merge, Release, Deployment, Veröffentlichung und Postrelease bleiben getrennt gesperrt.</p>
 </section>;
}
