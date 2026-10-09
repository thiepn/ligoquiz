import {useEffect,useState} from 'react';
import {EventRepository} from '../../infrastructure/db/event-repository';
import {checkOffline,offerManualUpdate,registerShell,type OfflineCheck} from '../../resilience/offline';
import {decodeBackup,encodeBackup,type BackupPayload} from '../../resilience/backup';
import {writeHostIdentity} from '../experience/model';
import '../../styles/resilience.css';

const errorText=(e:unknown)=>e instanceof Error?e.message:'Vorgang fehlgeschlagen';
function downloadJSON(file:string,text:string){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=file;link.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function OfflinePreflight(){
 const [status,setStatus]=useState<OfflineCheck|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 async function check(){
  setBusy(true);setError('');setNote('');
  try{await registerShell();setStatus(await checkOffline());}
  catch(e){setError(errorText(e));}
  finally{setBusy(false);}
 }
 useEffect(()=>{void check();},[]);
 async function apply(){
  if(busy)return;setBusy(true);setError('');setNote('');
  const repo=new EventRepository();
  try{
   const answer=window.confirm('Update nur nach beendetem Quizabend übernehmen? Alle anderen Quizfenster schließen. Es erfolgt kein automatischer Live-Neustart.');
   if(!answer)return;
   const done=await offerManualUpdate(async()=>{
    const dir=await repo.listSessions();
    return dir.invalidCount===0&&!dir.items.some(e=>
     e.lifecycle==='active'||e.lifecycle==='paused'||e.recoveryRequired);
   });
   if(!done)throw Error('Update gesperrt: laufende/pausierte oder beschädigte Spielstände vorhanden, oder kein Update bereit');
   setNote('Update zur Aktivierung freigegeben. Alle Fenster nach dem Quizabend manuell neu öffnen.');
  }catch(e){setError(errorText(e));}
  finally{await repo.close();setBusy(false);}
 }
 return <section className="g11-preflight" aria-label="Offline-Vorprüfung">
  <div className="g11-heading"><p className="eyebrow">G11 / AUSFALLSICHERHEIT</p>
   <h2>Offline-Start und Gerätebereitschaft</h2>
   <p>Bitte vor Veranstaltungsbeginn bei aktiver Internetverbindung prüfen. Ein grüner Browserstatus ersetzt keinen echten Beamer- und Flugmodus-Test.</p></div>
  <button className="exp-secondary" disabled={busy} onClick={()=>void check()}>Offline-Vorprüfung erneut ausführen</button>
  {status&&<div className="g11-checks" role="group" aria-label="Gerätestatus">
   {[
    ['Sicherer Ursprung',status.secure],['IndexedDB beschreibbar',status.storage],
    ['Offline-Paket gespeichert',status.cacheReady],['Fenster offline gesteuert',status.controlled],
    ['Netzwerk zur Prüfung erreichbar',status.online],
   ].map(([label,ok])=><div key={String(label)}><b>{ok?'BEREIT':'PRÜFEN'}</b><span>{label}</span></div>)}
   {status.persisted!==null&&<div><b>{status.persisted?'GESCHÜTZT':'UNSICHER'}</b><span>Dauerhafte Browser-Speicherung</span></div>}
   {status.estimateBytes!==null&&<p className="g11-quota">Gemeldetes Speicherlimit: ca. {Math.round(status.estimateBytes/1024/1024)} MiB</p>}
  </div>}
  {status?.problems.length?<div role="status" className="g11-problems"><strong>Vor dem Einsatz prüfen:</strong>
    <ul>{status.problems.map(x=><li key={x}>{x}</li>)}</ul></div>:
   status?<p className="g11-ready" role="status">Lokale Grundprüfung bestanden. Beamer- und Offline-Rehearsal bleiben erforderlich.</p>:null}
  {status?.updateWaiting&&<div className="g11-update"><p>Eine neue Version ist bereit, wird aber nicht automatisch eingespielt.</p>
   <button disabled={busy} onClick={()=>void apply()}>Update nach Veranstaltungsende freigeben</button></div>}
  {note&&<p role="status">{note}</p>}
  {error&&<p className="exp-error" role="alert">{error}</p>}
 </section>;
}
export function BackupRecovery(){
 const [sessions,setSessions]=useState<{id:string;description:string}[]>([]);
 const [selected,setSelected]=useState('');
 const [preview,setPreview]=useState<BackupPayload|null>(null);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const repo=new EventRepository();let active=true;
  void repo.listSessions().then(d=>{
   if(!active)return;
   const list=d.items.map(e=>({id:e.id,description:
    (e.program[0]?.type??'Spiel')+' · '+e.teams.length+' Teams · '+e.lifecycle+
     ' · '+new Date(e.updatedAt).toLocaleString('de-DE')}));
   setSessions(list);setSelected(v=>v||list[0]?.id||'');
  }).catch(e=>{if(active)setError(errorText(e));})
   .finally(()=>void repo.close());
  return ()=>{active=false;};
 },[]);
 async function save(){
  if(!selected||busy)return;setBusy(true);setError('');setMessage('');
  const repo=new EventRepository();
  try{
   const file=await encodeBackup(await repo.exportBackup(selected));
   downloadJSON('ligoquiz-sitzung-'+selected+'.json',file);
   setMessage('Sitzungsbackup mit Wertungen, Protokoll und Prüfsumme exportiert. Datei sicher außerhalb des Browsers aufbewahren.');
  }catch(e){setError(errorText(e));}
  finally{await repo.close();setBusy(false);}
 }
 async function load(file:File|undefined){
  if(!file)return;setBusy(true);setError('');setPreview(null);setConsent(false);setMessage('');
  try{
   if(file.size>20*1024*1024)throw Error('Backup ist größer als 20 MiB');
   const candidate=await decodeBackup(await file.text());
   setPreview(candidate);
  }catch(e){setError(errorText(e));}
  finally{setBusy(false);}
 }
 async function restore(){
  if(!preview||!consent||busy)return;setBusy(true);setError('');
  const repo=new EventRepository();
  try{
   const dir=await repo.listSessions();
   if(dir.invalidCount)throw Error('Beschädigte lokale Sitzungen – erst manuell sichern und prüfen');
   const current=await repo.get(preview.event.id);
   if(current)throw Error('Eine Sitzung mit derselben Kennung existiert bereits. Keine Überschreibung möglich.');
   const newHostId=crypto.randomUUID();
   const restored=await repo.restoreBackup(preview,newHostId);
   writeHostIdentity({eventId:restored.id,hostId:newHostId});
   setPreview(null);setConsent(false);
   setMessage(restored.lifecycle==='complete'?'Abgeschlossene Sitzung als historischer Stand wiederhergestellt.':
    'Sitzung ist pausiert und benötigt ausdrücklich eine Wiederherstellungsprüfung durch den Host.');
   setSessions(s=>[{id:restored.id,description:'Wiederhergestellt · '+restored.lifecycle},...s]);
   setSelected(restored.id);
  }catch(e){setError(errorText(e));}
  finally{await repo.close();setBusy(false);}
 }
 return <section className="g11-backup" aria-label="Sicherung und Wiederherstellung">
  <div className="g11-heading"><p className="eyebrow">SICHERUNG / RÜCKKEHR</p>
   <h2>Spielstand sichern</h2>
   <p>Vollständige Sitzungsdatei mit Aufgaben, Wertungsledger, Audit und Checkpoints. Der einfache Ergebnisbericht reicht zur Wiederherstellung nicht aus.</p></div>
  <div className="g11-row"><label>Gespeicherte Sitzung
   <select value={selected} onChange={e=>setSelected(e.target.value)}>
    {!sessions.length&&<option value="">Keine Sitzung vorhanden</option>}
    {sessions.map(s=><option key={s.id} value={s.id}>{s.description}</option>)}</select></label>
   <button disabled={busy||!selected} onClick={()=>void save()}>Vollständiges Sitzungsbackup exportieren</button></div>
  <div className="g11-restore"><h3>Backup unabhängig prüfen</h3>
   <label>Lokale JSON-Datei wählen <input type="file" accept=".json,application/json"
    onChange={e=>void load(e.currentTarget.files?.[0])} disabled={busy}/></label>
   {preview&&<div className="g11-preview" aria-label="Geprüfte Wiederherstellung">
    <h4>Prüfsumme gültig – noch nichts verändert</h4>
    <p>{preview.event.program[0]?.type} · {preview.event.teams.length} Teams ·
     Revision {preview.event.revision} · {preview.outcomes.length} Wertungen · {preview.audit.length} Audit-Einträge</p>
    <p>Die alte Hostidentität wird ungültig. Unfertige Spiele starten ausschließlich pausiert und erfordern eine Überprüfung.</p>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
     Diese Sicherung als neuen lokalen, zunächst gesperrten Spielstand einspielen. Niemals bestehende Sitzung überschreiben.</label>
    <button disabled={busy||!consent} onClick={()=>void restore()}>Wiederherstellung ausdrücklich bestätigen</button></div>}
  </div>
  {message&&<p role="status" className="g11-result">{message}</p>}
  {error&&<p role="alert" className="exp-error">{error}</p>}
 </section>;
}
