import {validatePayload,type ContentItem} from './contracts';
import type {SourceReviewTask} from './editorial-source-review';

/** A local-only research worksheet; blank reviewer fields are deliberately not decisions. */
const HEADER=[
 'Aufgaben-ID','Spiel','Lokaler Status','Prüfgruppe','Frage oder Hinweise',
 'Antwort oder illustrative Kategorien','Referenz im Entwurf',
 'Primärquelle als Recherchehinweis','Prüfauftrag zur Quelle',
 'G23-Hinweise','Verwandte Aufgaben','Angegebene Rechte (nicht verifiziert)',
 'Ursprungsdatei','Quellenversion','Antwort geprüft','Beleg geprüft',
 'Rechte geprüft','Spielleitung geprüft','Redaktionelle Entscheidung',
] as const;
const phrase=(x:unknown)=>typeof x==='string'?x:'';
function field(item:ContentItem){
 const p=item.payload as Record<string,unknown>;
 const pieces=[phrase(p.prompt),
  Array.isArray(p.clues)?'Hinweise: '+p.clues.map(phrase).join(' | '):'',
  Array.isArray(p.items)?'Reihe: '+p.items.map(phrase).join(' | '):'',
  Array.isArray(p.tiles)?'Wandfelder: '+p.tiles.map(t=>phrase((t as {label?:unknown}).label)).join(' | '):'',
  phrase(p.hint)?'Zusätzlicher Hinweis: '+phrase(p.hint):'',
  Array.isArray(p.choices)&&p.choices.length?'Antwortoptionen: '+p.choices.map(phrase).join(' | '):'',
 ].filter(Boolean);
 const question=pieces.join(' — ')||phrase(p.target);
 const categoryText=Array.isArray(p.categories)?
  p.categories.map(c=>phrase((c as {label?:unknown}).label)).join(' | '):'';
 const source=(p.source as {kind?:string;source?:string;population?:string;
  method?:string;collectedOn?:string;limitations?:string}|undefined);
 const answer=[
  phrase(p.answer)||phrase(p.target)||
   (source?.kind==='illustrative'?'Illustrative Kategorien, keine Umfrage: '+categoryText:categoryText)||
   (Array.isArray(p.groups)?p.groups.map(g=>phrase((g as {link?:unknown}).link)).join(' | '):''),
  p.truth!==undefined?'Wahrheitswert: '+String(p.truth):'',
  phrase(p.explanation)?'Erklärung: '+phrase(p.explanation):'',
 ].filter(Boolean).join(' — ');
 const sourceLabel=source?.kind==='illustrative'?'Nur illustrativ, nicht erhoben':
  source?.kind==='observed'?
   ['Beobachtete Umfrage – unabhängig prüfen',phrase(source.source),phrase(source.population),
    phrase(source.method),phrase(source.collectedOn),phrase(source.limitations)].filter(Boolean).join(' | '):'';
 return {question,answer,reference:phrase(p.reference)||sourceLabel};
}
/** Quoted CSV with spreadsheet formula neutralization, even after leading whitespace. */
export function worksheetCell(input:string):string{
 const safe=/^[\s\uFEFF]*[=+\-@]/u.test(input)?"'"+input:input;
 return '"'+safe.replace(/"/g,'""')+'"';
}
/**
 * Explicit local download only. This contains raw question/answer material;
 * never upload, publish, authorize, or interpret blank review cells as approval.
 */
export function exportReviewWorksheet(tasks:readonly SourceReviewTask[]):string{
 const lines=[HEADER.map(worksheetCell).join(',')];
 for(const task of tasks){
  const {item,lead,issues,route}=task,p=field(item);
  const related=[...new Set(issues.map(x=>x.other).filter((x):x is string=>!!x))].sort();
  const row=[
   item.id,item.game,item.status,route,p.question,p.answer,p.reference,
   lead?.url??'',lead?.comparison??'',
   issues.map(x=>x.severity.toUpperCase()+': '+x.code).join(' | '),
   related.join(' | '),item.provenance.rights??'',
   item.provenance.sourceKey??'',item.provenance.sourceVersion??'',
   '','','','','',
  ];
  lines.push(row.map(worksheetCell).join(','));
 }
 return '\uFEFF'+lines.join('\r\n')+'\r\n';
}

export type ImportedReviewNote={
 id:string;status:'current'|'changed'|'missing';reason:string;
 changedFields:readonly string[];
 notes:readonly {heading:string;text:string}[];
};
export type ReviewWorksheetPreview={
 matched:number;changed:number;missing:number;rows:ImportedReviewNote[];
};
/**
 * Restricted local CSV parser: quotes, embedded line breaks, BOM, and strict
 * 19-column schema. It never interprets editable cells as permissions.
 */
function parseWorksheetCsv(source:string):string[][]{
 if(source.length>1024*1024)throw Error('CSV-Prüfliste ist größer als 1 MiB');
 const input=source.replace(/^\uFEFF/u,''),records:string[][]=[];
 let row:string[]=[],cell='',quoted=false,closed=false;
 const column=()=>{if(cell.length>16000)throw Error('CSV-Feld zu lang');
  row.push(cell);cell='';closed=false;};
 const record=()=>{column();
  if(row.length!==HEADER.length)throw Error('CSV hat eine ungültige Spaltenzahl');
  records.push(row);row=[];
  if(records.length>500)throw Error('Zu viele CSV-Datensätze');};
 for(let i=0;i<input.length;i++){
  const ch=input[i]!;
  if(quoted){
   if(ch==='"'&&input[i+1]==='"'){cell+='"';i++;}
   else if(ch==='"'){quoted=false;closed=true;}
   else cell+=ch;
  }else if(ch===','){column();}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   record();
  }else if(ch==='"'&&cell===''&&!closed){quoted=true;}
  else{
   if(closed||ch==='"')throw Error('CSV enthält ungültige Anführungszeichen');
   cell+=ch;
  }
 }
 if(quoted)throw Error('CSV enthält ein offenes Anführungszeichen');
 if(cell!==''||row.length>0)record();
 return records;
}
/**
 * Reopens the exported worksheet strictly as *advisory, volatile* reviewer
 * notes. The current source snapshot must match all content/provenance fields
 * before a note can navigate to its question. Nothing is persisted.
 */
export function previewReviewWorksheet(source:string,tasks:readonly SourceReviewTask[]):ReviewWorksheetPreview{
 const rows=parseWorksheetCsv(source);
 if(rows.length===0||rows[0]!.some((value,i)=>value!==HEADER[i]))
  throw Error('Keine LiGoQuiz-Redaktionsprüfliste oder Spalten geändert');
 const sourceRows=parseWorksheetCsv(exportReviewWorksheet(tasks)).slice(1);
 const index=new Map(sourceRows.map(row=>[row[0]!,row]));
 const seen=new Set<string>();
 const annotated:ImportedReviewNote[]=[];
 let matched=0,changed=0,missing=0;
 for(const row of rows.slice(1)){
  const id=row[0]!;
  if(!id||seen.has(id))throw Error('CSV enthält doppelte oder leere Aufgaben-IDs');
  seen.add(id);
  const notes=HEADER.slice(14).map((heading,j)=>{
   const text=row[14+j]!.trim();
   if(text.length>1500)throw Error('CSV-Prüfnotiz zu lang: '+heading);
   return {heading,text};
  }).filter(note=>note.text!=='');
  if(!notes.length)continue;
  const current=index.get(id);
  // Original full source context includes source route, research guidance,
  // G23 warnings and related IDs, not just the question and answer.
  const changedFields=current?HEADER.slice(0,14).filter((_,col)=>row[col]!==current[col]):[];
  const status:ImportedReviewNote['status']=!current?'missing':
   changedFields.length===0?'current':'changed';
  if(status==='current')matched++;
  else if(status==='changed')changed++;
  else missing++;
  annotated.push({id,status,changedFields,
   reason:status==='current'?'Inhalt und Prüfkontext stimmen überein':
    status==='missing'?'Aufgabe ist nicht mehr in der lokalen Bibliothek':
     'Geänderter Prüfstand: '+changedFields.join(', '),
   notes});
 }
 return {matched,changed,missing,rows:annotated};
}

/**
 * A worksheet note with one HTTPS URL may be staged in an existing draft.
 * This proposal is unverified, unsaved and cannot confer source rights.
 */
export function worksheetSourceProposal(note:ImportedReviewNote,item:ContentItem):string|null{
 if(note.status!=='current'||note.id!==item.id||item.status!=='draft'||
    item.game==='umfrageduell')return null;
 const raw=note.notes.find(x=>x.heading==='Beleg geprüft')?.text.trim();
 if(!raw||raw.length>500||!/^https:\/\//u.test(raw)||/\s/u.test(raw))return null;
 let url:URL;
 try{url=new URL(raw);}catch{return null;}
 if(url.protocol!=='https:'||!url.hostname.includes('.')||url.username||url.password||
    url.hostname==='localhost'||url.hostname.endsWith('.local'))return null;
 const p=item.payload as {reference?:unknown};
 if(typeof p.reference!=='string'||!p.reference.trim()||
    p.reference.includes(url.href))return null;
 const proposed=p.reference.trim()+'; '+url.href;
 return proposed.length<=1000?proposed:null;
}

export type WorksheetAnswerProposal={field:'answer'|'target';before:string;after:string;reference:string};
/** Exact current draft + explicit correction marker + cited HTTPS evidence only. */
export function worksheetAnswerProposal(note:ImportedReviewNote,item:ContentItem):WorksheetAnswerProposal|null{
 const reference=worksheetSourceProposal(note,item);
 if(!reference||note.status!=='current'||note.id!==item.id||item.status!=='draft')return null;
 const marked=note.notes.find(x=>x.heading==='Antwort geprüft')?.text.trim();
 if(!marked?.startsWith('Vorschlag: '))return null;
 const after=marked.slice('Vorschlag: '.length).trim();
 if(!after||after.length>500||[...after].some(ch=>ch.charCodeAt(0)<32))return null;
 const source=item.payload as {kind?:string;answer?:unknown;target?:unknown};
 const field=item.game==='verbindungen'?
  source.kind==='clues'?'target':source.kind==='sequence'?'answer':null:
  item.game==='umfrageduell'?null:'answer';
 if(!field||typeof source[field]!=='string')return null;
 const before=source[field] as string;
 if(before.trim()===after)return null;
 const payload={...item.payload as object,[field]:after,reference};
 if(validatePayload(item.game,payload).length)return null;
 return {field,before,after,reference};
}

export type WorksheetWordingProposal={
 kind:'prompt'|'clue';before:string;after:string;
 clueIndex?:number;reference:string;payload:Record<string,unknown>;
};
/** Stage a citation-backed, explicit prompt or individual clue revision from
 * untrusted offline notes. Answer corrections (if supplied) must also validate;
 * there are no implicit grading, rights, or approval decisions. */
export function worksheetWordingProposal(note:ImportedReviewNote,item:ContentItem):WorksheetWordingProposal|null{
 const reference=worksheetSourceProposal(note,item);
 if(!reference||note.status!=='current'||note.id!==item.id||item.status!=='draft')return null;
 const marker=note.notes.find(x=>x.heading==='Spielleitung geprüft')?.text.trim();
 if(!marker)return null;
 const p=item.payload as Record<string,unknown>;
 let kind:'prompt'|'clue',before:string,after:string,clueIndex:number|undefined;
 const clue=/^Hinweis ([1-4]): (.+)$/u.exec(marker);
 if(clue){
  const eligible=(item.game==='verbindungen'&&p.kind==='clues')||
   (item.game==='rundenquiz'&&p.round==='hinweise');
  if(!eligible||!Array.isArray(p.clues)||p.clues.length!==4)return null;
  const index=Number(clue[1])-1;
  if(typeof p.clues[index]!=='string')return null;
  kind='clue';before=p.clues[index] as string;after=(clue[2]??'').trim();clueIndex=index;
 }else if(marker.startsWith('Fragevorschlag: ')){
  if(item.game==='umfrageduell'||item.game==='verbindungen'&&p.kind!=='sequence'||
   typeof p.prompt!=='string')return null;
  kind='prompt';before=p.prompt;after=marker.slice('Fragevorschlag: '.length).trim();
 }else return null;
 if(!after||after===before.trim()||after.length>500||
  [...after].some(ch=>ch.charCodeAt(0)<32))return null;
 const answerMarked=note.notes.some(x=>x.heading==='Antwort geprüft'&&x.text.trim().startsWith('Vorschlag:'));
 const answer=answerMarked?worksheetAnswerProposal(note,item):null;
 if(answerMarked&&!answer)return null;
 const payload:Record<string,unknown>={...p,reference};
 if(kind==='prompt')payload.prompt=after;
 else {
  const clues=(p.clues as string[]).slice();
  clues[clueIndex!]=after;payload.clues=clues;
 }
 if(answer)payload[answer.field]=answer.after;
 if(validatePayload(item.game,payload).length)return null;
 return {kind,before,after,...(clueIndex!==undefined?{clueIndex}:{}),reference,payload};
}

export type WorksheetDetailChange={field:string;before:string;after:string};
export type WorksheetDetailProposal={
 changes:readonly WorksheetDetailChange[];reference:string;payload:Record<string,unknown>;
};
/** Source-bound corrections for original explanation, help and grouping content.
 * No second authoring store, save operation or authority to approve materials. */
export function worksheetDetailProposal(note:ImportedReviewNote,item:ContentItem):WorksheetDetailProposal|null{
 const reference=worksheetSourceProposal(note,item);
 if(!reference||note.status!=='current'||note.id!==item.id||item.status!=='draft')return null;
 const input=note.notes.find(x=>x.heading==='Spielleitung geprüft')?.text.trim();
 if(!input)return null;
 const lines=input.split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
 if(lines.length===0||lines.length>6)return null;
 const base=item.payload as Record<string,unknown>;
 const payload:Record<string,unknown>={...base,reference},changes:WorksheetDetailChange[]=[];
 const seen=new Set<string>();
 for(const line of lines){
  let field='',before='',after='',max=3000;
  let path:'hint'|'explanation'|'item'|'tile'|'group'|null=null,index=-1;
  const colon=line.indexOf(': ');
  if(colon<1)return null;
  const key=line.slice(0,colon),value=line.slice(colon+2).trim();
  if(key==='Zusatzhinweis'&&item.game==='logikleiter'&&typeof base.hint==='string'){
   path='hint';field='Zusatzhinweis';before=base.hint;max=3000;
  }else if(key==='Erklärungsvorschlag'&&
   (item.game==='logikleiter'||item.game==='verbindungen'&&base.kind==='sequence')&&
   typeof base.explanation==='string'){
   path='explanation';field='Erklärung';before=base.explanation;
  }else if(item.game==='verbindungen'&&base.kind==='sequence'&&/^Folgenelement [1-3]$/u.test(key)){
   index=Number(key.slice('Folgenelement '.length))-1;
   if(!Array.isArray(base.items)||typeof base.items[index]!=='string')return null;
   path='item';field=key;before=base.items[index];max=3000;
  }else if(item.game==='verbindungen'&&base.kind==='wall'&&/^Wandfeld (?:[1-9]|1[0-6])$/u.test(key)){
   index=Number(key.slice('Wandfeld '.length))-1;
   const tile=Array.isArray(base.tiles)?base.tiles[index] as {id?:string;label?:string}|undefined:undefined;
   if(!tile||typeof tile.label!=='string'||typeof tile.id!=='string')return null;
   path='tile';field=key;before=tile.label;max=3000;
  }else if(item.game==='verbindungen'&&base.kind==='wall'&&/^Verbindung [1-4]$/u.test(key)){
   index=Number(key.slice('Verbindung '.length))-1;
   const group=Array.isArray(base.groups)?base.groups[index] as
    {id?:string;link?:string;acceptedLinks?:string[]}|undefined:undefined;
   if(!group||typeof group.link!=='string'||!Array.isArray(group.acceptedLinks))return null;
   path='group';field=key;before=group.link;max=3000;
  }else return null;
  after=value;
  if(!after||after.length>max||after===before.trim()||
   [...after].some(ch=>ch.charCodeAt(0)<32)||seen.has(field))return null;
  seen.add(field);
  if(path==='hint')payload.hint=after;
  else if(path==='explanation')payload.explanation=after;
  else if(path==='item'){
   const items=(payload.items as string[]|undefined)??(base.items as string[]);
   const next=items.slice();next[index]=after;payload.items=next;
  }else if(path==='tile'){
   const tiles=((payload.tiles??base.tiles) as {id:string;label:string}[]).map(t=>({...t}));
   tiles[index]={...tiles[index]!,label:after};payload.tiles=tiles;
  }else if(path==='group'){
   const groups=((payload.groups??base.groups) as {
    id:string;link:string;acceptedLinks:string[];tileIds:string[]}[]).map(g=>({
     ...g,acceptedLinks:[...g.acceptedLinks],
    }));
   const g=groups[index]!;
   if(!g.acceptedLinks.includes(after))g.acceptedLinks.push(after);
   groups[index]={...g,link:after};payload.groups=groups;
  }
  changes.push({field,before,after});
 }
 const markedAnswer=note.notes.some(x=>x.heading==='Antwort geprüft'&&x.text.trim().startsWith('Vorschlag:'));
 if(markedAnswer){
  const answer=worksheetAnswerProposal(note,item);
  if(!answer)return null;
  payload[answer.field]=answer.after;
  changes.push({field:'Antwort',before:answer.before,after:answer.after});
 }
 if(validatePayload(item.game,payload).length)return null;
 return {changes,reference,payload};
}

/** Re-export only still-current original reviewer notes. Old changed/missing
 * notes remain in the original uploaded CSV, never silently re-anchored. */
export function refreshReviewWorksheet(source:string,tasks:readonly SourceReviewTask[]):{
 csv:string;carried:number;excludedChanged:number;excludedMissing:number;
}{
 const review=previewReviewWorksheet(source,tasks);
 const previous=parseWorksheetCsv(source);
 const original=new Map(previous.slice(1).map(row=>[row[0]!,row]));
 const currentIds=new Set(review.rows.filter(x=>x.status==='current').map(x=>x.id));
 const rows=parseWorksheetCsv(exportReviewWorksheet(tasks));
 const csv='\uFEFF'+rows.map((row,i)=>{
  // The original 19-column schema header must be preserved verbatim.
  // Only data rows receive blank reviewer cells when their notes are stale.
  if(i===0)return row.map(worksheetCell).join(',');
  const notes=currentIds.has(row[0]!)?original.get(row[0]!)?.slice(14):null;
  return [...row.slice(0,14),...(notes??['','','','',''])].map(worksheetCell).join(',');
 }).join('\r\n')+'\r\n';
 return {csv,carried:currentIds.size,excludedChanged:review.changed,excludedMissing:review.missing};
}
