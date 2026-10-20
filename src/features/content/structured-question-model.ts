import type {GameType} from '../../domain/game/contracts';
import {validatePayload} from '../../content/contracts';

type Field=string|number;
type ObjectValue=Record<string,unknown>;
const record=(value:unknown):value is ObjectValue=>
 typeof value==='object'&&value!==null&&!Array.isArray(value);
const parts=(value:unknown):value is unknown[]=>Array.isArray(value);

/** Edits only existing author-owned fields, never IDs, source-kind or review authority. */
export function editQuestionField(game:GameType,raw:unknown,path:readonly Field[],value:string|number):unknown{
 if(!path.length||!record(raw))throw Error('Ungültiges Bearbeitungsziel');
 if(path.some(segment=>segment==='id'||segment==='reviewed'||segment==='kind'||
   segment==='sourceId'||segment==='status'||segment==='rights')||
   path[0]==='source'&&path[1]==='kind')throw Error('Identität und Freigabe bleiben unverändert');
 const walk=(node:unknown,depth:number):unknown=>{
  const field=path[depth];
  if(typeof field==='number'){
   if(!parts(node)||!Number.isInteger(field)||field<0||field>=node.length)throw Error('Feldindex ungültig');
   const next=[...node];next[field]=depth===path.length-1?value:walk(next[field],depth+1);return next;
  }
  if(typeof field!=='string'||!record(node)||!Object.hasOwn(node,field))throw Error('Feld ist nicht Teil der Originalaufgabe');
  if(depth===path.length-1){
   if(typeof node[field]!=='string'&&typeof node[field]!=='number')throw Error('Feldtyp ist nicht editierbar');
   return {...node,[field]:value};
  }
  return {...node,[field]:walk(node[field],depth+1)};
 };
 void game;
 return walk(raw,0);
}

type RqRound='wissen'|'hinweise'|'schaetzen'|'finale';
type VbKind='clues'|'sequence'|'wall';
/** Changing the shape creates EMPTY editorial fields; nothing is silently approved or fabricated. */
export function switchQuestionFormat(game:'rundenquiz'|'verbindungen',raw:unknown,variant:RqRound|VbKind):unknown{
 if(!record(raw)||typeof raw.id!=='string'||!raw.id)throw Error('Originale Inhalts-ID fehlt');
 if(game==='rundenquiz'){
  if(!['wissen','hinweise','schaetzen','finale'].includes(variant))throw Error('Ungültige Runde');
  const {clues,choices,truth,unit,...base}=raw;
  void clues;void choices;void truth;void unit;
  const edited:Record<string,unknown>={...base,round:variant};
  if(variant==='hinweise')edited.clues=['','','',''];
  if(variant==='schaetzen'){edited.truth='';edited.unit='';}
  return edited;
 }
 if(!['clues','sequence','wall'].includes(variant))throw Error('Ungültiger Aufgabentyp');
 const id=raw.id,reference=typeof raw.reference==='string'?raw.reference:'';
 const base={id,reference};
 if(variant==='clues')return {...base,kind:variant,target:'',clues:['','','','']};
 if(variant==='sequence')return {...base,kind:variant,prompt:'',items:['','',''],answer:'',explanation:''};
 return {...base,kind:variant,
  tiles:Array.from({length:16},(_,i)=>({id:id+'-tile-'+String(i+1).padStart(2,'0'),label:''})),
  groups:Array.from({length:4},(_,i)=>({id:id+'-group-'+(i+1),
   tileIds:Array.from({length:4},(_,j)=>id+'-tile-'+String(i*4+j+1).padStart(2,'0')),
   link:'',acceptedLinks:['']})),
 };
}

/** Existing canonical validation remains the only save gate. */
export function editorialIssues(game:GameType,raw:unknown):string[]{
 return validatePayload(game,raw);
}
export function spectatorPromptPreview(game:GameType,raw:unknown):{
 heading:string;lines:string[];unsafe:boolean;
}{
 if(!record(raw))return {heading:'Ungültige Struktur',lines:[],unsafe:true};
 const string=(key:string)=>typeof raw[key]==='string'?raw[key] as string:'';
 const asStrings=(x:unknown)=>Array.isArray(x)?x.filter((v):v is string=>typeof v==='string'):[];
 if(game==='rundenquiz')return {heading:'Rundenquiz · '+string('round'),lines:[
  string('prompt'),...(raw.round==='hinweise'?asStrings(raw.clues):raw.round==='wissen'?asStrings(raw.choices):[])
 ],unsafe:editorialIssues(game,raw).length>0};
 if(game==='quiztafel')return {heading:'Quiztafel · '+string('categoryName')+' · '+String(raw.value??''),
  lines:[string('prompt')],unsafe:editorialIssues(game,raw).length>0};
 if(game==='verbindungen')return {heading:'Verbindungen · '+string('kind'),lines:
  raw.kind==='clues'?asStrings(raw.clues):raw.kind==='sequence'?
   [string('prompt'),...asStrings(raw.items)]:Array.isArray(raw.tiles)?
   raw.tiles.filter(record).map(t=>typeof t.label==='string'?t.label:''):[],
  unsafe:editorialIssues(game,raw).length>0};
 if(game==='logikleiter')return {heading:'Logikleiter · Stufe '+String(raw.difficulty??''),
  lines:[string('prompt')],unsafe:editorialIssues(game,raw).length>0};
 return {heading:'Umfrageduell · '+string('format'),
  lines:[string('prompt')],unsafe:editorialIssues(game,raw).length>0};
}
