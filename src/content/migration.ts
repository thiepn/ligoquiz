import {GAME_TYPES,type GameType} from '../domain/game/contracts';
import {contentSchema,validateItem,validatePayload,findDuplicates,type ContentItem} from './contracts';

export const G10_EXPORT_FORMAT='ligoquiz-v2-content' as const;
export const LEGACY_PREFIX='ligo.quiz.';
export const MAX_BYTES=12*1024*1024;
export type Quarantine={index:number;sourceId:string;reason:string;raw:unknown};
export type Preview={
 bundleHash:string;sourceType:'v2'|'legacy-pack'|'legacy-backup';items:ContentItem[];
 quarantined:Quarantine[];warnings:string[];records:number;sourceBytes:number;
};
export type LegacyArchive={
 format:'ligo-legacy-export';formatVersion:1;sourceOrigin:string;exportedAt:string;
 legacyCommit:string;rawEntries:{key:string;value:string}[];keyInventory:string[];
 checksum:string;warnings:string[];
};
export async function sha256(value:string):Promise<string>{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function sizeOf(value:string){return new TextEncoder().encode(value).byteLength;}
export function assertSize(value:string):void{
 if(sizeOf(value)>MAX_BYTES)throw Error('Datei ist größer als 12 MiB. Kein Teilimport; Daten werden unverändert belassen.');
}
export async function legacyBackup(storage:Pick<Storage,'length'|'key'|'getItem'>,
 origin:string,commit='f70e73f3c5b740ad3baf9580431f8393246b4eb0'):Promise<LegacyArchive>{
 const rawEntries:{key:string;value:string}[]=[];let total=0;
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i))
  .filter((key):key is string=>typeof key==='string'&&key.startsWith(LEGACY_PREFIX)).sort();
 for(const key of keys){
  const value=storage.getItem(key);
  if(value===null)continue;
  total+=sizeOf(key)+sizeOf(value);
  if(total>MAX_BYTES)throw Error('Altbestand überschreitet 12 MiB. Kein unvollständiger Export.');
  rawEntries.push({key,value});
 }
 const checksum=await sha256(JSON.stringify(rawEntries));
 return {format:'ligo-legacy-export',formatVersion:1,sourceOrigin:origin,
  exportedAt:new Date().toISOString(),legacyCommit:commit,rawEntries,
  keyInventory:rawEntries.map(x=>x.key),checksum,warnings:[
   'Dies ist ein unveränderter Präfix-Export dieses Browsers, kein geräteübergreifendes Backup.',
   'Ehemalige Spielstände werden NICHT in v2 wiederaufgenommen. Alte Daten bleiben am Ursprungsort.'
  ]};
}
function record(raw:unknown):Record<string,unknown>|null{
 return raw!==null&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:null;
}
function asArray(raw:unknown):unknown[]|null{return Array.isArray(raw)?raw:null;}
function gameValue(v:unknown):GameType|null{
 return typeof v==='string'&&(GAME_TYPES as readonly string[]).includes(v)?v as GameType:null;
}
function packFromKey(value:string):unknown{
 try{return JSON.parse(value);}catch{return {format:'invalid-json',value};}
}
export async function previewFile(text:string):Promise<Preview>{
 assertSize(text);
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw Error('Keine gültige JSON-Datei. Quelle bleibt unverändert.');}
 const obj=record(raw);
 if(!obj)throw Error('Import benötigt ein JSON-Objekt');
 let sourceType:Preview['sourceType'],sources:unknown[],warnings:string[]=[];
 const originalHash=await sha256(text);
 if(obj.format===G10_EXPORT_FORMAT&&obj.version===1&&asArray(obj.entries)){
  sourceType='v2';sources=asArray(obj.entries)!;
 }else if(obj.format==='ligo-content-pack'&&asArray(obj.items??obj.questions)){
  sourceType='legacy-pack';sources=asArray(obj.items??obj.questions)!;
  warnings.push('Legacy-Freigaben gelten nur als Historie, nicht als redaktionelle Zulassung.');
 }else if(obj.format==='ligo-legacy-export'&&obj.formatVersion===1&&asArray(obj.rawEntries)){
  sourceType='legacy-backup';sources=[];
  const entries=asArray(obj.rawEntries)!;
  for(const r of entries){
   const e=record(r);
   if(!e||typeof e.key!=='string'||!e.key.startsWith(LEGACY_PREFIX)||typeof e.value!=='string')
    throw Error('Ungültiger Legacy-Backup-Eintrag; Archiv unverändert belassen');
  }
  const backupHash=await sha256(JSON.stringify(entries));
  if(backupHash!==obj.checksum)throw Error('Legacy-Backup-Prüfsumme stimmt nicht; Import abgelehnt');
  const content=entries.find(x=>record(x)?.key==='ligo.quiz.content.library.v1');
  if(content){const pack=packFromKey(record(content)?.value as string),p=record(pack);
   sources=asArray(p?.items??p?.questions??p?.entries)??[];
   if(!sources.length)warnings.push('Legacy-Inhaltsbibliothek erkannt, aber unbekanntes Format. Rohdaten im Backup erhalten.');
  }else warnings.push('Kein Legacy-Inhaltspaket auf diesem Browser-Ursprung gefunden.');
  warnings.push('Spielstände, persönliche Prüfentscheidungen und unbekannte Schlüssel werden nur im unveränderten Backup bewahrt.');
 }else{
  throw Error('Unbekanntes Importformat. Unterstützt: ligoquiz-v2-content v1 oder Legacy-Bundle. Keine Speicherung.');
 }
 if(sources.length>2000)throw Error('Mehr als 2000 Datensätze; keine Teilübernahme');
 const items:ContentItem[]=[],quarantined:Quarantine[]=[],seen=new Set<string>();
 sources.forEach((source,index)=>{
  const obj=record(source),nested=record(obj?.payload??obj?.data??obj?.question);
  const game=gameValue(obj?.game??obj?.gameType);
  let issue='';
  if(!obj)issue='Datensatz ist kein Objekt';
  else if(!game)issue='Unbekannter Spieltyp; manuelle Zuordnung nötig';
  else if(!nested)issue='Spieltyp vorhanden, aber strukturierte Aufgaben-Daten fehlen';
  else{
   const payload={...nested};
   const orig=typeof obj.id==='string'?obj.id:typeof nested.id==='string'?nested.id:String(index+1);
   const candidateId=sourceType==='v2'?orig:'legacy-'+originalHash.slice(0,12)+'-'+String(index+1).padStart(5,'0');
   payload.id=candidateId;
   const problems=validatePayload(game,payload);
   if(problems.length)issue=problems.join(' | ');
   else if(seen.has(candidateId))issue='Doppelte Inhaltskennung';
   else{
    try{
     const parsed=sourceType==='v2'?contentSchema.parse(obj):{
      id:candidateId,game,payload,status:'draft' as const,createdAt:Date.now(),updatedAt:Date.now(),
      revision:0,provenance:{
       origin:'legacy' as const,bundleHash:originalHash,sourceId:orig,
       sourceKey:sourceType==='legacy-backup'?'ligo.quiz.content.library.v1':'ligo-content-pack',
       sourceVersion:typeof obj.version==='string'?obj.version:'unbekannt',
       reviewHint:typeof obj.status==='string'?obj.status:undefined,
      },audit:[{revision:0,at:Date.now(),action:'LEGACY_IMPORT',note:'Nicht freigegeben'}],
     };
     const safe=sourceType==='v2'?{
      ...parsed,status:'draft' as const,review:undefined,revision:0,updatedAt:Date.now(),
      audit:[...parsed.audit,{revision:0,at:Date.now(),action:'IMPORT',note:'Freigabe erneut erforderlich'}]
     }:parsed;
     const validated=validateItem(safe);
     items.push(validated);seen.add(candidateId);
    }catch(e){issue=e instanceof Error?e.message:'Datensatz ungültig';}
   }
  }
  if(issue)quarantined.push({index,sourceId:typeof obj?.id==='string'?obj.id:'Eintrag '+(index+1),reason:issue,raw:source});
 });
 for(const dup of findDuplicates(items)){
  const idx=items.findIndex(x=>x.id===dup.id);
  if(idx>=0){const [removed]=items.splice(idx,1);
   quarantined.push({index:idx,sourceId:removed!.id,reason:'Mögliche Doppelung mit '+dup.other,raw:removed});}
 }
 if(sourceType==='legacy-backup'&&sources.length===0)warnings.push('Keine Legacy-Fragen automatisch übernommen.');
 return {bundleHash:originalHash,sourceType,items,quarantined,warnings,records:sources.length,sourceBytes:sizeOf(text)};
}
export function exportLibrary(items:readonly ContentItem[]):string{
 return JSON.stringify({format:G10_EXPORT_FORMAT,version:1,exportedAt:new Date().toISOString(),
  entries:items},null,2);
}
