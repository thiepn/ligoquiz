import {useEffect,useMemo,useState} from 'react';
import {GAME_TYPES,type GameType,type GameProfile} from '../../domain/game/contracts';
import {ContentRepository,type Receipt,type StoredQuarantine} from '../../content/repository';
import {createDraft,coverage,validatePayload,selectReviewedPack,findDuplicates,type ContentItem} from '../../content/contracts';
import {legacyBackup,previewFile,exportLibrary,type Preview} from '../../content/migration';
import '../../styles/content-studio.css';

const LABELS:Record<GameType,string>={
 rundenquiz:'Rundenquiz',quiztafel:'Quiztafel',verbindungen:'Verbindungen',
 logikleiter:'Logikleiter',umfrageduell:'Umfrageduell',
};
function starter(game:GameType,id:string):unknown{
 switch(game){
  case 'rundenquiz':return {id,round:'wissen',prompt:'Neue Frage – bitte konkretisieren',
   answer:'Prüfbare Antwort',reference:'Quellenbeleg hinzufügen',durationSeconds:30};
  case 'quiztafel':return {id,categoryId:'thema',categoryName:'Thema',
   row:1,value:100,prompt:'Neue Quiztafel-Frage',answer:'Prüfbare Antwort',reference:'Quellenbeleg'};
  case 'verbindungen':return {id,kind:'clues',target:'Eindeutiges Ziel',
   clues:['Erster Hinweis','Zweiter Hinweis','Dritter Hinweis','Vierter Hinweis'],reference:'Quellenbeleg'};
  case 'logikleiter':return {id,difficulty:1,kind:'deduction',
   prompt:'Neue eindeutige Denkaufgabe',hint:'Hilfreicher Hinweis ohne Lösung',
   answer:'Einzige richtige Lösung',explanation:'Begründung der Eindeutigkeit',reference:'Quellenbeleg'};
  case 'umfrageduell':return {id,format:'popular',
   prompt:'Welche Antwort wäre hier beliebt? (frei erfundene Rangfolge)',
   categories:['Möglichkeit eins','Möglichkeit zwei','Möglichkeit drei','Möglichkeit vier','Möglichkeit fünf']
    .map(label=>({label,synonyms:[]})),source:{kind:'illustrative'}};
 }
}
function saveFile(name:string,contents:string){
 const blob=new Blob([contents],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const formatError=(err:unknown)=>err instanceof Error?err.message:'Unbekannter Fehler';
function statusText(status:ContentItem['status']){return {
 draft:'Entwurf',review:'In Prüfung',approved:'Freigegeben',quarantined:'Quarantäne',
}[status];}
export function ContentStudio(){
 const [repo]=useState(()=>new ContentRepository());
 const [items,setItems]=useState<ContentItem[]>([]);
 const [quarantine,setQuarantine]=useState<StoredQuarantine[]>([]);
 const [receipts,setReceipts]=useState<Receipt[]>([]);
 const [current,setCurrent]=useState<ContentItem|null>(null);
 const [json,setJson]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<GameType|'alle'>('alle');
 const [statusFilter,setStatusFilter]=useState<'alle'|ContentItem['status']>('alle');
 const [templateGame,setTemplateGame]=useState<GameType>('rundenquiz');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[importConsent,setImportConsent]=useState(false);
 const [reviewer,setReviewer]=useState(''),[reviewNote,setReviewNote]=useState('');
 const [checklist,setChecklist]=useState<boolean[]>([false,false,false,false]);
 const [profile,setProfile]=useState<GameProfile>('kurz'),[teamCount,setTeamCount]=useState(3);
 async function refresh(){
  const [all,quarantined,imports]=await Promise.all([repo.list(),repo.quarantined(),repo.receipts()]);
  setItems(all.sort((a,b)=>b.updatedAt-a.updatedAt));
  setQuarantine(quarantined);setReceipts(imports);
 }
 useEffect(()=>{let alive=true;
  void Promise.all([repo.list(),repo.quarantined(),repo.receipts()]).then(([all,q,r])=>{
   if(alive){setItems(all.sort((a,b)=>b.updatedAt-a.updatedAt));setQuarantine(q);setReceipts(r);}
  }).catch(e=>{if(alive)setError(formatError(e));});
  return ()=>{alive=false;void repo.close();};
 },[repo]);
 const chosen=useMemo(()=>items.filter(i=>{
  const payload=i.payload as {prompt?:string;target?:string};
  return (filter==='alle'||i.game===filter)&&(statusFilter==='alle'||i.status===statusFilter)&&
   (i.id+' '+LABELS[i.game]+' '+(payload.prompt??payload.target??'')).toLocaleLowerCase('de-DE')
    .includes(search.toLocaleLowerCase('de-DE').trim());
 }),[items,filter,statusFilter,search]);
 const summary=useMemo(()=>({
  approved:items.filter(x=>x.status==='approved').length,
  review:items.filter(x=>x.status==='review').length,
  draft:items.filter(x=>x.status==='draft').length,
  duplicates:findDuplicates(items).length,
 }),[items]);
 const pack=useMemo(()=>{
  const games=GAME_TYPES.map(game=>{
   const result=coverage(items,game,profile,teamCount);
   let ready=false,reason='';
   if(result.ready)try{
    switch(game){
     case 'rundenquiz':selectReviewedPack(items,'rundenquiz',profile,teamCount);break;
     case 'quiztafel':selectReviewedPack(items,'quiztafel',profile,teamCount);break;
     case 'verbindungen':selectReviewedPack(items,'verbindungen',profile,teamCount);break;
     case 'logikleiter':selectReviewedPack(items,'logikleiter',profile,teamCount);break;
     case 'umfrageduell':selectReviewedPack(items,'umfrageduell',profile,teamCount);break;
    }
    ready=true;
   }catch(e){reason=formatError(e);}
   return {game,result,ready,reason};
  });
  return games;
 },[items,profile,teamCount]);
 function choose(item:ContentItem){
  setCurrent(item);setJson(JSON.stringify(item.payload,null,2));
  setReviewNote('');setChecklist([false,false,false,false]);setError('');setMessage('');
 }
 async function act(fn:()=>Promise<void>){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{await fn();await refresh();}catch(e){setError(formatError(e));}
  finally{setBusy(false);}
 }
 async function add(){
  await act(async()=>{
   const id='neu-'+crypto.randomUUID();
   const item=createDraft(templateGame,starter(templateGame,id));
   await repo.create(item);choose(item);setMessage('Neuer Entwurf angelegt; noch nicht spielbar.');
  });
 }
 function changeBasic(key:string,value:string){
  try{const payload=JSON.parse(json) as Record<string,unknown>;
   if(payload&&typeof payload==='object'&&!Array.isArray(payload)){
    payload[key]=value;setJson(JSON.stringify(payload,null,2));
   }
  }catch{setError('Strukturdaten enthalten derzeit ungültiges JSON');}
 }
 async function saveDraft(){
  if(!current)return;
  await act(async()=>{
   const payload=JSON.parse(json) as unknown;
   const issues=validatePayload(current.game,payload);
   if(issues.length)throw Error(issues.join(' | '));
   const item=await repo.saveDraft({...current,payload});
   choose(item);setMessage('Entwurf gespeichert. Frühere Freigabe wurde bei Änderungen zurückgesetzt.');
  });
 }
 async function review(){
  if(!current)return;
  await act(async()=>{const item=await repo.sendToReview(current);
   choose(item);setMessage('Eintrag zur redaktionellen Prüfung eingereicht.');});
 }
 async function approve(){
  if(!current)return;
  if(!checklist.every(Boolean)){setError('Alle vier redaktionellen Prüfpunkte müssen bestätigt werden.');return;}
  await act(async()=>{const approved=await repo.approve(current,{
   reviewer,note:reviewNote,checklist:[true,true,true,true],
  });
   choose(approved);setMessage('Redaktionelle Freigabe gespeichert; Abdeckung wird neu berechnet.');
  });
 }
 async function exportCurrent(){
  await act(async()=>{saveFile('ligoquiz-inhalte-v2.json',exportLibrary(items));
   setMessage('Lokale Bibliothek exportiert – unabhängig von alten Spielständen.');
  });
 }
 async function backupLegacy(){
  await act(async()=>{
   const backup=await legacyBackup(localStorage,window.location.origin);
   saveFile('ligoquiz-altbestand-rohbackup.json',JSON.stringify(backup,null,2));
   setMessage(backup.rawEntries.length+' alte Browser-Schlüssel unverändert exportiert. Das Original bleibt erhalten.');
  });
 }
 async function loadImport(file:File|undefined){
  if(!file)return;
  await act(async()=>{
   if(file.size>12*1024*1024)throw Error('Datei größer als 12 MiB; Import abgelehnt');
   const proposal=await previewFile(await file.text());
   setPreview(proposal);setImportConsent(false);
   setMessage(proposal.items.length+' gültige Entwürfe, '+proposal.quarantined.length+
    ' isolierte Einträge. Noch nichts importiert.');
  });
 }
 async function commitImport(){
  if(!preview)return;
  await act(async()=>{
   const result=await repo.importPreview(preview,importConsent);
   setMessage(result==='already-imported'?'Dieses Paket wurde bereits verarbeitet; keine Dubletten hinzugefügt.':
    'Import gespeichert. Alle Aufgaben bleiben Entwürfe bis zur Freigabe.');
   setPreview(null);setImportConsent(false);
  });
 }
 async function undoImport(hash:string){
  if(!window.confirm('Diesen Import rückgängig machen? Nur unveränderte Entwürfe werden entfernt.'))return;
  await act(async()=>{await repo.undo(hash);if(current?.provenance.bundleHash===hash)setCurrent(null);
   setMessage('Unveränderte Importentwürfe samt Quarantäne rückgängig gemacht.');
  });
 }
 let basic:Record<string,unknown>|null=null;
 try{const p=JSON.parse(json) as unknown;
  if(p&&typeof p==='object'&&!Array.isArray(p))basic=p as Record<string,unknown>;
 }catch{/* Raw editor displays JSON parsing problems on save. */}
 return <section className="cx-studio exp-page" aria-label="Inhaltsatelier">
  <div className="exp-heading"><div><p className="eyebrow">INHALTE / REDAKTION</p>
   <h1>Inhaltsatelier</h1><p>Aufgaben erfassen, Quellen prüfen, Bestand importieren und spielbare Pakete freigeben.</p></div>
   <div className="cx-summary"><b>{items.length} Inhalte</b><span>{summary.approved} freigegeben</span><span>{summary.review} in Prüfung</span></div></div>
  <div className="cx-warning" role="note"><strong>Getrennt von laufenden Spielabenden.</strong>
   {' '}Importiert wird nur in die v2-Inhaltsdatenbank. Bestehende v1-Spielstände, Browser-Schlüssel und veröffentlichte Spiele werden nicht geändert.</div>
  <div className="cx-actions"><label>Neuer Inhalt <select value={templateGame} onChange={e=>setTemplateGame(e.target.value as GameType)}>
    {GAME_TYPES.map(game=><option key={game} value={game}>{LABELS[game]}</option>)}</select></label>
   <button className="exp-primary" onClick={()=>void add()} disabled={busy}>Aufgabe anlegen</button>
   <button className="exp-secondary" onClick={()=>void exportCurrent()} disabled={busy}>v2-Bibliothek exportieren</button>
   <button className="exp-secondary" onClick={()=>void backupLegacy()} disabled={busy}>v1-Rohbackup erstellen</button>
   <label className="cx-file">Datei prüfen <input type="file" accept=".json,application/json"
    onChange={e=>void loadImport(e.currentTarget.files?.[0])} disabled={busy}/></label>
  </div>
  {preview&&<section className="cx-import" aria-label="Importvorschau">
    <div><p className="eyebrow">VOR DEM IMPORT · NICHT GESPEICHERT</p><h2>Importvorschau</h2>
     <p>{preview.records} Quelldatensätze · {preview.items.length} gültige Entwürfe · {preview.quarantined.length} Quarantäne</p>
     <small>Quelltyp {preview.sourceType} · SHA-256 {preview.bundleHash}</small></div>
    {preview.warnings.map((v,i)=><p key={i} className="cx-warning">{v}</p>)}
    {preview.quarantined.length>0&&<details><summary>Zurückgestellte Datensätze ({preview.quarantined.length})</summary>
      {preview.quarantined.slice(0,50).map(q=><p key={q.index}>{q.sourceId}: {q.reason}</p>)}
    </details>}
    <label className="cx-confirm"><input type="checkbox" checked={importConsent} onChange={e=>setImportConsent(e.target.checked)}/>
     Ich bestätige die Vorschau. Keine importierte Alt-Freigabe wird automatisch als redaktionell geprüft anerkannt.</label>
    <div className="cx-buttons"><button className="exp-primary" onClick={()=>void commitImport()}
       disabled={busy||!importConsent}>Vorschau ausdrücklich importieren</button>
     <button className="exp-secondary" onClick={()=>{setPreview(null);setImportConsent(false);}}>Abbrechen</button></div>
   </section>}
  <div className="cx-main">
   <section className="cx-catalog" aria-label="Aufgabenbestand">
    <div className="cx-catalog-top"><h2>Aufgabenbestand</h2><span>{chosen.length} Treffer</span></div>
    <div className="cx-filters"><input type="search" aria-label="Aufgaben durchsuchen" value={search}
      placeholder="Frage, Ziel oder Kennung suchen" onChange={e=>setSearch(e.target.value)}/>
     <select aria-label="Spieltyp filtern" value={filter} onChange={e=>setFilter(e.target.value as GameType|'alle')}>
       <option value="alle">Alle Spiele</option>{GAME_TYPES.map(g=><option key={g} value={g}>{LABELS[g]}</option>)}</select>
     <select aria-label="Prüfstatus filtern" value={statusFilter}
       onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
       <option value="alle">Alle Prüfstände</option><option value="draft">Entwurf</option>
       <option value="review">In Prüfung</option><option value="approved">Freigegeben</option></select>
    </div>
    <div className="cx-item-list">{chosen.length===0?<p className="cx-empty">Keine passenden Aufgaben. Neue Frage erstellen oder Importvorschau prüfen.</p>:
      chosen.map(item=>{
       const payload=item.payload as {prompt?:string;target?:string};
       return <button key={item.id} className={'cx-item'+(current?.id===item.id?' selected':'')}
        aria-pressed={current?.id===item.id} onClick={()=>choose(item)}>
        <span><b>{LABELS[item.game]}</b><small>{statusText(item.status)}</small></span>
        <strong>{payload.prompt??payload.target??'Strukturierte Aufgabe'}</strong>
        <small>{item.id}</small>
       </button>;
      })}</div>
   </section>
   <section className="cx-editor" aria-label="Aufgabe bearbeiten">
    {!current?<div className="cx-editor-empty"><h2>Redaktionspult</h2>
      <p>Eine Aufgabe links auswählen. Ungeprüfte Inhalte können nicht automatisch in einen spielbaren Fragenpool gelangen.</p>
     </div>:<>
     <div className="cx-editor-head"><div><p className="eyebrow">{LABELS[current.game]} · #{current.revision}</p>
       <h2>{statusText(current.status)}</h2></div><span className="cx-id">{current.id}</span></div>
     <p className="cx-origin">Herkunft: {current.provenance.origin}
      {current.provenance.sourceId?' / '+current.provenance.sourceId:''}</p>
     {current.status==='approved'&&<p className="cx-approved">Freigegeben durch {current.review?.reviewer}.
       {' '}Jede Bearbeitung verlangt erneute Prüfung.</p>}
     {'prompt' in (basic??{})&&<label className="cx-field">Fragestellung
       <textarea rows={3} value={String(basic?.prompt??'')} onChange={e=>changeBasic('prompt',e.target.value)}/></label>}
     {'answer' in (basic??{})&&<label className="cx-field">Lösung
       <input value={String(basic?.answer??'')} onChange={e=>changeBasic('answer',e.target.value)}/></label>}
     {'reference' in (basic??{})&&<label className="cx-field">Quelle
       <input value={String(basic?.reference??'')} onChange={e=>changeBasic('reference',e.target.value)}/></label>}
     <details className="cx-structured" open={current.game==='verbindungen'||current.game==='umfrageduell'}>
      <summary>Strukturierte Aufgabe · Kategorien, Hinweise und Antwortvarianten</summary>
      <label className="cx-field">JSON-Datensatz <textarea rows={15} spellCheck={false} value={json}
       onChange={e=>setJson(e.target.value)} /></label>
     </details>
     <div className="cx-buttons"><button className="exp-primary" disabled={busy}
       onClick={()=>void saveDraft()}>Änderungen als Entwurf speichern</button>
       {current.status==='draft'&&<button disabled={busy} className="exp-secondary"
         onClick={()=>void review()}>Zur Prüfung vorlegen</button>}</div>
     {current.status==='review'&&<fieldset className="cx-review"><legend>Redaktionelle Abnahme</legend>
      <p>Freigabe ist eine bewusste Prüfung, nicht das Übernehmen historischer Alt-Markierungen.</p>
      {['Antwort und eindeutige Wertung fachlich geprüft','Referenz und Herkunft geprüft',
        'Spielleitungs-/Beamerregeln sowie Zeitbedarf geprüft','Rechte, Alternativen und Doppelungen geprüft'].map((label,i)=>
       <label key={label}><input type="checkbox" checked={checklist[i]??false}
        onChange={e=>setChecklist(prev=>prev.map((v,j)=>i===j?e.target.checked:v))}/>{label}</label>)}
      <label className="cx-field">Prüfende Person<input value={reviewer}
        onChange={e=>setReviewer(e.target.value)} placeholder="Name der Redaktion"/></label>
      <label className="cx-field">Begründung (mindestens 10 Zeichen)
       <textarea rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label>
      <button className="exp-primary" disabled={busy||!checklist.every(Boolean)}
       onClick={()=>void approve()}>Inhalt verbindlich freigeben</button>
     </fieldset>}
     <details className="cx-audit"><summary>Änderungsverlauf ({current.audit.length})</summary>
      {current.audit.map((a,i)=><p key={i}>#{a.revision} {a.action}: {a.note}</p>)}
     </details>
    </>}
   </section>
  </div>
  <section className="cx-coverage" aria-label="Spielbare Inhalte">
   <div className="cx-catalog-top"><h2>Abdeckungsprüfung</h2>
    <div><label>Profil <select value={profile} onChange={e=>setProfile(e.target.value as GameProfile)}>
     <option value="kurz">Kurz</option><option value="standard">Standard</option><option value="lang">Lang</option></select></label>
     <label>Teams <select value={teamCount} onChange={e=>setTeamCount(Number(e.target.value))}>
      {[3,4,5].map(n=><option key={n}>{n}</option>)}</select></label></div></div>
   <div className="cx-coverage-grid">{pack.map(({game,result,ready,reason})=><div key={game}>
      <b>{LABELS[game]}</b><strong>{ready?'Spielbar':'Unvollständig'}</strong>
      <p>{Object.entries(result.required).map(([key,num])=>key+': '+(result.available[key]??0)+' / '+num).join(' · ')}</p>
      {reason&&<small>{reason}</small>}
     </div>)}</div>
   <p className="cx-footnote">Nur ausdrücklich freigegebene und regelkonform kombinierbare Inhalte zählen.
    Nicht erfüllte Profile dürfen nicht stillschweigend mit Probeaufgaben aufgefüllt werden.</p>
  </section>
  {(receipts.length>0||quarantine.length>0)&&<section className="cx-history">
    <h2>Importprotokoll</h2><p>{quarantine.length} aufbewahrte Problemfälle. Jeder bestätigte Quellbund erhält einen eigenen Beleg.</p>
    {receipts.map(r=><div className="cx-receipt" key={r.bundleHash}><div><b>{r.sourceType}</b>
      <small>{r.ids.length} Entwürfe · {r.quarantineIds.length} Quarantäne · {r.bundleHash.slice(0,16)}…</small></div>
      <button className="exp-secondary" disabled={busy} onClick={()=>void undoImport(r.bundleHash)}>Unveränderten Import zurücknehmen</button></div>)}
    {quarantine.length>0&&<details><summary>Quarantänebericht anzeigen</summary>
      {quarantine.slice(0,100).map(q=><p key={q.id}>{q.sourceId}: {q.reason}</p>)}
     </details>}
   </section>}
  {error&&<p className="exp-error" role="alert">{error}</p>}
  {message&&<p className="cx-message" role="status">{message}</p>}
 </section>;
}
