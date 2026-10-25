import {useEffect,useMemo,useState} from 'react';
import {GAME_TYPES,type GameType,type GameProfile} from '../../domain/game/contracts';
import {ContentRepository,type Receipt,type StoredQuarantine} from '../../content/repository';
import {createDraft,coverage,validatePayload,selectReviewedPack,findDuplicates,type ContentItem} from '../../content/contracts';
import {legacyBackup,previewFile,exportLibrary,type Preview} from '../../content/migration';
import '../../styles/content-studio.css';
import {EditorialAuditPanel} from './EditorialAuditPanel';
import {StructuredQuestionEditor} from './StructuredQuestionEditor';
import {trialDraftBundle} from '../../content/trial-draft-bundle';
import {contentReviewTasks,historicalTrialCorrection,draftSourceCitation,type ReviewRoute} from '../../content/editorial-source-review';
import {exportReviewWorksheet,previewReviewWorksheet,worksheetSourceProposal,worksheetAnswerProposal,worksheetWordingProposal,worksheetDetailProposal,refreshReviewWorksheet} from '../../content/editorial-worklist';


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
function saveFile(name:string,contents:string,type='application/json;charset=utf-8'){
 const blob=new Blob([contents],{type});
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
 const [rightsDraft,setRightsDraft]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<GameType|'alle'>('alle');
 const [statusFilter,setStatusFilter]=useState<'alle'|ContentItem['status']>('alle');
 const [templateGame,setTemplateGame]=useState<GameType>('rundenquiz');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[importConsent,setImportConsent]=useState(false);
 const [reviewer,setReviewer]=useState(''),[reviewNote,setReviewNote]=useState('');
 const [checklist,setChecklist]=useState<boolean[]>([false,false,false,false]);
 const [profile,setProfile]=useState<GameProfile>('kurz'),[teamCount,setTeamCount]=useState(3);
 const [reviewRoute,setReviewRoute]=useState<ReviewRoute>('primary');
 const [reviewSearch,setReviewSearch]=useState('');
 const [repeatsOnly,setRepeatsOnly]=useState(false);
 const [reviewCsv,setReviewCsv]=useState('');
 const [reviewCsvError,setReviewCsvError]=useState('');
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
 const sourceTasks=useMemo(()=>contentReviewTasks(items),[items]);
 const normalizedReviewSearch=reviewSearch.toLocaleLowerCase('de-DE').trim();
 const visibleSourceTasks=sourceTasks.filter(x=>{
  const payload=x.item.payload as {prompt?:string;target?:string;answer?:string};
  return x.route===reviewRoute&&
   (!repeatsOnly||x.issues.some(issue=>issue.code==='CROSS_GAME_CLUE_REUSE'))&&
   (!normalizedReviewSearch||
   [x.item.id,payload.prompt??'',payload.target??'',payload.answer??'']
    .join(' ').toLocaleLowerCase('de-DE').includes(normalizedReviewSearch));
 });
 const reviewerNotes=useMemo(()=>{
  if(!reviewCsv)return null;
  try{return previewReviewWorksheet(reviewCsv,sourceTasks);}
  catch{return null;}
 },[reviewCsv,sourceTasks]);
 const selectedSourceTask=current?sourceTasks.find(x=>x.item.id===current.id):null;
 const historicalCorrection=current?historicalTrialCorrection(current):null;
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
  setRightsDraft(item.provenance.rights??'');
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
 async function saveDraft(){
  if(!current)return;
  await act(async()=>{
   const payload=JSON.parse(json) as unknown;
   const issues=validatePayload(current.game,payload);
   if(issues.length)throw Error(issues.join(' | '));
   const item=await repo.saveDraft({...current,payload,
    provenance:{...current.provenance,rights:rightsDraft.trim().slice(0,600)||undefined}});
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
  if(json!==JSON.stringify(current.payload,null,2)){
   setError('Änderungen im Editor müssen vor einer Freigabe als Entwurf gespeichert werden.');return;
  }
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
 async function prepareTrialDrafts(){
  setPreview(null);setImportConsent(false);
  await act(async()=>{
   const proposal=await previewFile(trialDraftBundle(),items);
   setPreview(proposal);
   setMessage(proposal.items.length+' vorhandene Probeaufgaben als Entwürfe prüfbar; '+
    proposal.quarantined.length+' Kollisionen zurückgestellt. Noch nichts importiert.');
  });
 }


 function stageReviewDetail(entry:NonNullable<typeof reviewerNotes>['rows'][number]){
  const task=sourceTasks.find(x=>x.item.id===entry.id);
  if(!task||entry.status!=='current')return;
  const proposal=worksheetDetailProposal(entry,task.item);
  if(!proposal)return;
  if(current&&(json!==JSON.stringify(current.payload,null,2)||
   rightsDraft!==(current.provenance.rights??'')||reviewNote.trim()||
   reviewer.trim()||checklist.some(Boolean))){
   setError('Ungespeicherte Änderungen zuerst speichern oder verwerfen; Detailkorrektur nicht übernommen.');
   return;
  }
  choose(task.item);
  setJson(JSON.stringify(proposal.payload,null,2));
  setMessage('Quellenbasierte Detailkorrekturen im Editor vorbereitet; vor dem Speichern fachlich prüfen.');
 }
 function stageReviewWording(entry:NonNullable<typeof reviewerNotes>['rows'][number]){
  const task=sourceTasks.find(x=>x.item.id===entry.id);
  if(!task||entry.status!=='current')return;
  const proposal=worksheetWordingProposal(entry,task.item);
  if(!proposal)return;
  if(current&&(json!==JSON.stringify(current.payload,null,2)||
   rightsDraft!==(current.provenance.rights??'')||reviewNote.trim()||
   reviewer.trim()||checklist.some(Boolean))){
   setError('Ungespeicherte Änderungen zuerst speichern oder verwerfen; Formulierung nicht übernommen.');
   return;
  }
  choose(task.item);
  setJson(JSON.stringify(proposal.payload,null,2));
  setMessage('Formulierung und Quellenbeleg aus Prüfnotiz im Editor vorbereitet; erst nach unabhängiger Prüfung als Entwurf speichern.');
 }
 function stageReviewAnswer(entry:NonNullable<typeof reviewerNotes>['rows'][number]){
  const task=sourceTasks.find(x=>x.item.id===entry.id);
  if(!task||entry.status!=='current')return;
  const proposal=worksheetAnswerProposal(entry,task.item);
  if(!proposal)return;
  if(current&&(json!==JSON.stringify(current.payload,null,2)||
   rightsDraft!==(current.provenance.rights??'')||reviewNote.trim()||
   reviewer.trim()||checklist.some(Boolean))){
   setError('Ungespeicherte Änderungen zuerst speichern oder verwerfen; Antwortvorschlag nicht übernommen.');
   return;
  }
  choose(task.item);
  setJson(JSON.stringify({...task.item.payload as object,
   [proposal.field]:proposal.after,reference:proposal.reference},null,2));
  setMessage('Antwort und Quellenbeleg aus Prüfnotiz im Editor vorbereitet; vor dem Speichern unabhängig prüfen.');
 }
 function stageReviewCitation(entry:NonNullable<typeof reviewerNotes>['rows'][number]){
  const task=sourceTasks.find(x=>x.item.id===entry.id);
  if(!task||entry.status!=='current')return;
  const proposal=worksheetSourceProposal(entry,task.item);
  if(!proposal)return;
  if(current&&(json!==JSON.stringify(current.payload,null,2)||
    rightsDraft!==(current.provenance.rights??'')||reviewNote.trim()||
    reviewer.trim()||checklist.some(Boolean))){
   setError('Ungespeicherte Änderungen zuerst speichern oder verwerfen; Quellenangabe nicht übernommen.');
   return;
  }
  choose(task.item);
  setJson(JSON.stringify({...task.item.payload as object,reference:proposal},null,2));
  setMessage('URL aus Prüfnotiz im Entwurf vorbereitet. Quelle unabhängig prüfen; noch nicht gespeichert.');
 }
 async function loadReviewNotes(file:File|undefined){
  if(!file)return;
  setReviewCsv('');setReviewCsvError('');
  try{
   if(file.size>1024*1024)throw Error('CSV-Prüfliste ist größer als 1 MiB');
   const content=await file.text();
   previewReviewWorksheet(content,sourceTasks);
   setReviewCsv(content);
  }catch(e){setReviewCsvError(formatError(e));}
 }
 async function loadImport(file:File|undefined){
  if(!file)return;
  setPreview(null);setImportConsent(false);
  await act(async()=>{
   if(file.size>12*1024*1024)throw Error('Datei größer als 12 MiB; Import abgelehnt');
   const proposal=await previewFile(await file.text(),items);
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
 let structured:unknown=null;
 try{structured=JSON.parse(json) as unknown;}catch{/* Advanced JSON remains available to repair syntax. */}
 return <section className="cx-studio exp-page" aria-label="Inhaltsatelier">
  <div className="exp-heading"><div>
   <h1>Inhaltsatelier</h1></div>
   <div className="cx-summary"><b>{items.length} Inhalte</b><span>{summary.approved} freigegeben</span><span>{summary.review} in Prüfung</span></div></div>
  <div className="cx-warning" role="note"><strong>Getrennt von laufenden Spielabenden.</strong>
   {' '}Importiert wird nur in die v2-Inhaltsdatenbank. Bestehende v1-Spielstände, Browser-Schlüssel und veröffentlichte Spiele werden nicht geändert.</div>
  <div className="cx-actions"><label>Neuer Inhalt <select value={templateGame} onChange={e=>setTemplateGame(e.target.value as GameType)}>
    {GAME_TYPES.map(game=><option key={game} value={game}>{LABELS[game]}</option>)}</select></label>
   <button className="exp-primary" onClick={()=>void add()} disabled={busy}>Aufgabe anlegen</button>
   <button className="exp-secondary" onClick={()=>void prepareTrialDrafts()} disabled={busy}>Probeaufgaben als Entwürfe prüfen</button>
   <button className="exp-secondary" onClick={()=>void exportCurrent()} disabled={busy}>v2-Bibliothek exportieren</button>
   <button className="exp-secondary" onClick={()=>void backupLegacy()} disabled={busy}>v1-Rohbackup erstellen</button>
   <label className="cx-file">Datei prüfen <input type="file" accept=".json,application/json"
    onChange={e=>void loadImport(e.currentTarget.files?.[0])} disabled={busy}/></label>
  </div>
  {preview&&<section className="cx-import" aria-label="Importvorschau">
    <div><h2>Importvorschau</h2>
     <p>{preview.records} Quelldatensätze · {preview.items.length} gültige Entwürfe · {preview.quarantined.length} Quarantäne</p>
     <small>Quelltyp {preview.sourceType} · SHA-256 {preview.bundleHash}</small></div>
    {preview.warnings.map((v,i)=><p key={i} className="cx-warning">{v}</p>)}
    {preview.items.some(item=>item.provenance.origin==='sample')&&<p className="cx-warning">Probedaten sind ungeprüft. Antworten, Quellen und Nutzungsrechte vor Freigabe prüfen.</p>}
    {preview.quarantined.length>0&&<details><summary>Zurückgestellte Datensätze ({preview.quarantined.length})</summary>
      {preview.quarantined.slice(0,50).map(q=><p key={q.index}>{q.sourceId}: {q.reason}</p>)}
    </details>}
    <label className="cx-confirm"><input type="checkbox" checked={importConsent} onChange={e=>setImportConsent(e.target.checked)}/>
     Ich bestätige die Vorschau. Keine importierte Alt-Freigabe wird automatisch als redaktionell geprüft anerkannt.</label>
    <div className="cx-buttons"><button className="exp-primary" onClick={()=>void commitImport()}
       disabled={busy||!importConsent}>Vorschau ausdrücklich importieren</button>
     <button className="exp-secondary" onClick={()=>{setPreview(null);setImportConsent(false);}}>Abbrechen</button></div>
   </section>}
  <EditorialAuditPanel items={items} preview={preview} onChoose={choose}/>
  <section className="cx-source-queue" aria-label="Quellenprüfung">
   <div className="cx-catalog-top">
    <h2>Quellenprüfung</h2>
    <label>Prüfgruppe <select aria-label="Prüfgruppe" value={reviewRoute}
      onChange={e=>setReviewRoute(e.target.value as ReviewRoute)}>
      <option value="primary">Primärquellen ({sourceTasks.filter(x=>x.route==='primary').length})</option>
      <option value="lookup">Quellensuche ({sourceTasks.filter(x=>x.route==='lookup').length})</option>
      <option value="illustrative">Illustrative Umfragen ({sourceTasks.filter(x=>x.route==='illustrative').length})</option>
    </select></label>
   </div>
   <div className="cx-source-filter">
    <input type="search" aria-label="Quellenprüfung durchsuchen" value={reviewSearch}
      onChange={e=>setReviewSearch(e.target.value)} placeholder="Frage oder Kennung"/>
    <label><input type="checkbox" checked={repeatsOnly}
      onChange={e=>setRepeatsOnly(e.target.checked)}/>Nur wiederholte Hinweisziele</label>
    <span>{visibleSourceTasks.length} Treffer</span>
   </div>
   <div className="cx-worksheet-actions">
    <button type="button" className="exp-secondary" disabled={busy||visibleSourceTasks.length===0}
     onClick={()=>saveFile('ligoquiz-redaktionspruefliste-gefiltert.csv',
      exportReviewWorksheet(visibleSourceTasks),'text/csv;charset=utf-8')}>
     Gefilterte Prüfliste als CSV</button>
    <button type="button" className="exp-secondary" disabled={busy||sourceTasks.length===0}
     onClick={()=>saveFile('ligoquiz-redaktionspruefliste-vollstaendig.csv',
      exportReviewWorksheet(sourceTasks),'text/csv;charset=utf-8')}>
     Alle Aufgaben als CSV</button>
   </div>
   <section className="cx-worksheet-reentry" aria-label="CSV-Prüfnotizen">
    <label>Prüfnotizen aus CSV öffnen
     <input type="file" accept=".csv,text/csv" aria-label="CSV-Prüfnotizen öffnen"
      onChange={e=>{void loadReviewNotes(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/>
    </label>
    {reviewCsvError&&<p role="alert">{reviewCsvError}</p>}
    {reviewerNotes&&<>
     <div className="cx-worksheet-summary">
      <strong>{reviewerNotes.matched} zugeordnet · {reviewerNotes.changed} veraltet · {reviewerNotes.missing} fehlen</strong>
      <button type="button" className="exp-secondary" disabled={busy||reviewerNotes.matched===0}
       onClick={()=>saveFile('ligoquiz-redaktionspruefliste-aktuell.csv',
        refreshReviewWorksheet(reviewCsv,sourceTasks).csv,'text/csv;charset=utf-8')}>
       Nur aktuelle Prüfliste neu exportieren</button>
      <button type="button" className="exp-secondary"
       onClick={()=>{setReviewCsv('');setReviewCsvError('');}}>Prüfnotizen schließen</button>
     </div>
     <p>Nur lokale Notizen, keine Freigabe. Veraltete Einträge können nicht übernommen werden.</p>
     <div className="cx-worksheet-notes">
      {reviewerNotes.rows.map(entry=>{
       const task=sourceTasks.find(task=>task.item.id===entry.id);
       const proposal=task?worksheetSourceProposal(entry,task.item):null;
       const answerProposal=task?worksheetAnswerProposal(entry,task.item):null;
       const wordingProposal=task?worksheetWordingProposal(entry,task.item):null;
       const detailProposal=task?worksheetDetailProposal(entry,task.item):null;
       const hasSourceNote=entry.notes.some(note=>note.heading==='Beleg geprüft');
       return <section key={entry.id} className="cx-worksheet-note">
       <div><strong>{entry.id} · {entry.status==='current'?'Aktuell':'Veraltet'}</strong>
        <span>{entry.reason}</span></div>
       {entry.notes.map(note=><p key={note.heading}><b>{note.heading}:</b> {note.text}</p>)}
       <button type="button" className="exp-secondary" disabled={entry.status!=='current'||busy}
        onClick={()=>{const task=sourceTasks.find(task=>task.item.id===entry.id);
         if(task)choose(task.item);
        }}>Aufgabe zu Notizen öffnen</button>
       {proposal&&<button type="button" className="exp-secondary" disabled={busy}
        onClick={()=>stageReviewCitation(entry)}>Quellenlink im Entwurf vorbereiten</button>}
       {answerProposal&&!wordingProposal&&<div className="cx-answer-proposal">
        <strong>Antwortkorrektur · ungeprüfter Vorschlag</strong>
        <p><b>Bisher:</b> {answerProposal.before}</p>
        <p><b>Vorgeschlagen:</b> {answerProposal.after}</p>
        <button type="button" className="exp-secondary" disabled={busy}
         onClick={()=>stageReviewAnswer(entry)}>Antwort und Quelle im Entwurf vorbereiten</button>
       </div>}
       {wordingProposal&&<div className="cx-answer-proposal">
        <strong>{wordingProposal.kind==='clue'?'Hinweis':'Fragestellung'} · ungeprüfter Vorschlag</strong>
        <p><b>Bisher:</b> {wordingProposal.before}</p>
        <p><b>Vorgeschlagen:</b> {wordingProposal.after}</p>
        {answerProposal&&<p>Antwortvorschlag: {answerProposal.before} → {answerProposal.after}</p>}
        <button type="button" className="exp-secondary" disabled={busy}
         onClick={()=>stageReviewWording(entry)}>Formulierung und Quelle im Entwurf vorbereiten</button>
       </div>}
       {detailProposal&&<div className="cx-answer-proposal">
        <strong>Detailkorrektur · ungeprüfter Vorschlag</strong>
        {detailProposal.changes.map(change=><div key={change.field}>
         <p><b>{change.field} bisher:</b> {change.before}</p>
         <p><b>Vorgeschlagen:</b> {change.after}</p>
        </div>)}
        <button type="button" className="exp-secondary" disabled={busy}
         onClick={()=>stageReviewDetail(entry)}>Detailkorrekturen im Entwurf vorbereiten</button>
       </div>}
       {hasSourceNote&&!proposal&&entry.status==='current'&&
        <p>Für einen Quellenlink eine vollständige HTTPS-URL in „Beleg geprüft“ eintragen.</p>}
      </section>;})}
      {reviewerNotes.rows.length===0&&<p>Keine ausgefüllten Prüffelder in der CSV.</p>}
     </div>
    </>}
   </section>
   <div className="cx-source-items">
    {visibleSourceTasks.map(task=><button type="button" className="cx-source-item"
      key={task.item.id} aria-pressed={current?.id===task.item.id} onClick={()=>choose(task.item)}>
      <strong>{task.item.id}</strong>
      <span>{(task.item.payload as {prompt?:string;target?:string}).prompt??
       (task.item.payload as {target?:string}).target??'Strukturierte Aufgabe'}</span>
      <small>{task.lead?.name??(task.route==='illustrative'?'Keine beobachtete Rangfolge':'Quelle eigenständig suchen')}
       {' · '}{task.issues.length} Prüfhilfen</small>
    </button>)}
    {visibleSourceTasks.length===0&&<p>Keine Aufgaben in dieser Prüfgruppe.</p>}
   </div>
  </section>
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
     {selectedSourceTask&&<section className="cx-source-evidence" aria-label="Quellenabgleich">
      <strong>Quellenabgleich · {selectedSourceTask.item.id}</strong>
      {selectedSourceTask.lead?<p><a href={selectedSourceTask.lead.url}
       target="_blank" rel="noopener noreferrer">Primärquelle: {selectedSourceTask.lead.name} öffnen</a>
       {' — '}{selectedSourceTask.lead.comparison}</p>:
       <p>{selectedSourceTask.route==='illustrative'
        ?'Nur illustrative Rangfolge. Nicht als erhobene Umfrage kennzeichnen.'
        :'Keine zugeordnete Primärquelle. Ursprünglichen Beleg unabhängig recherchieren.'}</p>}
      <ul>
       <li>Fragestellung, Lösung und genaue Belegstelle vergleichen</li>
       <li>Mehrdeutigkeiten, Antwortvarianten und Bewertung prüfen</li>
       <li>Urheberschaft und Nutzungsrecht unabhängig dokumentieren</li>
      </ul>
      {selectedSourceTask.issues.length>0&&<div>
       <strong>Bestehende Redaktionshinweise ({selectedSourceTask.issues.length})</strong>
       <ul>{selectedSourceTask.issues.map((issue,i)=><li key={issue.code+'-'+i}>
        {issue.message}</li>)}</ul></div>}
      {selectedSourceTask.issues.filter(issue=>issue.code==='CROSS_GAME_CLUE_REUSE'&&issue.other)
       .map(issue=><button type="button" key={issue.other} className="exp-secondary"
        onClick={()=>{const related=items.find(item=>item.id===issue.other);
         if(related)choose(related);
        }}>Zugehörige Frage öffnen: {issue.other}</button>)}
      {draftSourceCitation(current)&&<button type="button" className="exp-secondary"
       disabled={busy||json!==JSON.stringify(current.payload,null,2)}
       onClick={()=>{
        const citation=draftSourceCitation(current);
        if(!citation)return;
        setJson(JSON.stringify({...current.payload as object,reference:citation},null,2));
        setMessage('Quellenvorschlag im Editor vorbereitet. Antwort und genaue Belegstelle vor dem Speichern unabhängig prüfen.');
       }}>Quellenangabe im Entwurf vorbereiten</button>}
      <p>Quellenlink und Prüfliste sind keine Fakten- oder Rechtefreigabe.</p>
     </section>}
     {historicalCorrection&&<section className="cx-source-evidence" aria-label="Historische Frage korrigieren">
      <strong>Mehrdeutige Probefrage · Korrekturvorschlag</strong>
      <p>{historicalCorrection.reason}</p>
      <p>Neue Frage: {historicalCorrection.prompt}</p>
      <a href={historicalCorrection.url} target="_blank" rel="noopener noreferrer">
       Quelle: {historicalCorrection.sourceName}</a>
      <button type="button" className="exp-secondary" disabled={busy||
       json!==JSON.stringify(current.payload,null,2)}
       onClick={()=>{
        setJson(JSON.stringify({...current.payload as object,prompt:historicalCorrection.prompt,
         reference:historicalCorrection.reference},null,2));
        setMessage('Korrektur im Editor vorbereitet. Erst „Änderungen als Entwurf speichern“ schreibt sie; keine Freigabe.');
       }}>Korrektur in Editor übernehmen</button>
     </section>}
     <StructuredQuestionEditor game={current.game} value={structured} onChange={next=>{
      setJson(JSON.stringify(next,null,2));setError('');setMessage('');
     }}/>
     <label className="cx-field">Nutzungsrechte und externe Freigabegrundlage
      <textarea rows={2} value={rightsDraft} maxLength={600}
       placeholder="Rechteinhaber, Lizenz oder Erlaubnis, Dokument, Datum (extern prüfen)"
       onChange={e=>setRightsDraft(e.target.value)}/></label>
     <p className="cx-origin">Rechteangaben sind Selbstangaben und keine unabhängige Autorisierung. Speichern setzt den Prüfstatus auf Entwurf.</p>
     <details className="cx-structured">
      <summary>Erweiterte JSON-Bearbeitung</summary>
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
