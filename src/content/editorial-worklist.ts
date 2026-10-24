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
  const notes=HEADER.slice(14).map((heading,j)=>({
   heading,text:row[14+j]!.trim().slice(0,1500),
  })).filter(note=>note.text!=='');
  if(!notes.length)continue;
  const current=index.get(id);
  const identityFields=[0,1,2,4,5,6,7,11,12,13];
  const status:ImportedReviewNote['status']=!current?'missing':
   identityFields.every(col=>row[col]===current[col])?'current':'changed';
  if(status==='current')matched++;
  else if(status==='changed')changed++;
  else missing++;
  annotated.push({id,status,
   reason:status==='current'?'Inhalt und Quellenstand stimmen überein':
    status==='missing'?'Aufgabe ist nicht mehr in der lokalen Bibliothek':
     'Frage, Antwort, Beleg, Rechte oder Herkunft haben sich geändert',
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
 if(!after||after.length>500||/[\r\n\x00-\x1F]/u.test(after))return null;
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
