import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import type {ContentItem} from './contracts';
import {sha256} from './migration';
import {composeContentPack} from './pack-preparation';

export const PREPARATION_DB_NAME='ligoquiz.v2.preparation.g33';
const FORMAT='ligoquiz-g33-source-only-v1' as const;
type Selection=Record<string,string>;
export type StoredSelections=Record<GameType,Selection>;
export type DraftInput={game:GameType;profile:GameProfile;teams:3|4|5;step:number;
 selections:Partial<Record<GameType,Readonly<Selection>>>};
export type SourceStamp={id:string;game:GameType;revision:number;sha256:string};
export type SlotStamp={game:GameType;slot:string;id:string|null};
export type SavedPreparation={
 key:'current';format:typeof FORMAT;revision:number;updatedAt:number;
 game:GameType;profile:GameProfile;teams:3|4|5;step:number;
 selections:StoredSelections;assignments:SlotStamp[];sources:SourceStamp[];
 sourceOnly:true;release:'NO_GO';
};
export class PreparationError extends Error{
 constructor(readonly code:'CONFLICT'|'INVALID'|'MISSING'|'IDB'|'STALE',message:string){
  super(message);this.name='PreparationError';
 }
}
function fail(code:PreparationError['code'],message:string):never{
 throw new PreparationError(code,message);
}
function plain(v:unknown):v is Record<string,unknown>{
 return v!==null&&typeof v==='object'&&!Array.isArray(v);
}
const SAFE=/^[a-zA-Z0-9_:.\/-]{1,128}$/u;
export function assertSavedPreparation(raw:unknown):SavedPreparation{
 if(!plain(raw)||raw.key!=='current'||raw.format!==FORMAT||raw.sourceOnly!==true||
  raw.release!=='NO_GO'||!Number.isSafeInteger(raw.revision)||Number(raw.revision)<1||
  !Number.isSafeInteger(raw.updatedAt)||Number(raw.updatedAt)<0||
  !GAME_TYPES.includes(raw.game as GameType)||
  !['kurz','standard','lang'].includes(String(raw.profile))||
  ![3,4,5].includes(Number(raw.teams))||
  !Number.isSafeInteger(raw.step)||Number(raw.step)<0||Number(raw.step)>1000||
  !plain(raw.selections)||!Array.isArray(raw.assignments)||
  raw.assignments.length>300||!Array.isArray(raw.sources)||raw.sources.length>150)
  fail('INVALID','Ungültiger lokaler Vorbereitungsplan; keine automatische Wiederherstellung.');
 for(const game of GAME_TYPES){
  const map=raw.selections[game];
  if(!plain(map)||Object.keys(map).length>100||
   !Object.entries(map).every(([slot,id])=>SAFE.test(slot)&&typeof id==='string'&&
    (id===''||SAFE.test(id))))
   fail('INVALID','Quellauswahl enthält ungültige Einträge.');
 }
 const assignmentKeys=new Set<string>();
 for(const entry of raw.assignments){
  if(!plain(entry)||!GAME_TYPES.includes(entry.game as GameType)||
   typeof entry.slot!=='string'||!SAFE.test(entry.slot)||
   !(entry.id===null||(typeof entry.id==='string'&&SAFE.test(entry.id))))
   fail('INVALID','Plan enthält ungültige Quellplätze.');
  const k=entry.game+'/'+entry.slot;
  if(assignmentKeys.has(k))fail('INVALID','Quellplatz ist mehrfach vergeben.');
  assignmentKeys.add(k);
 }
 const sourceIds=new Set<string>();
 for(const source of raw.sources){
  if(!plain(source)||typeof source.id!=='string'||!SAFE.test(source.id)||
   !GAME_TYPES.includes(source.game as GameType)||!Number.isSafeInteger(source.revision)||
   Number(source.revision)<0||typeof source.sha256!=='string'||
   !/^[a-f0-9]{64}$/u.test(source.sha256)||sourceIds.has(source.id))
   fail('INVALID','Quellnachweis ist ungültig oder doppelt.');
  sourceIds.add(source.id);
 }
 const selections=raw.selections as StoredSelections;
 const assignmentIds=new Set(raw.assignments.map(s=>(s as SlotStamp).id).filter(Boolean));
 if(assignmentIds.size!==sourceIds.size||[...assignmentIds].some(id=>!sourceIds.has(id!)))
  fail('INVALID','Quellnachweise stimmen nicht mit der Aufgabenwahl überein.');
 if(JSON.stringify(raw).length>90_000)fail('INVALID','Vorbereitungsplan überschreitet die zulässige Größe.');
 return {...raw,selections} as SavedPreparation;
}
function normalizedSelections(input:DraftInput['selections']):StoredSelections{
 return Object.fromEntries(GAME_TYPES.map(g=>[g,{...input[g]}])) as StoredSelections;
}
const exact=(item:ContentItem)=>JSON.stringify({id:item.id,game:item.game,
 revision:item.revision,status:item.status,payload:item.payload,provenance:item.provenance});
async function sourceStamp(item:ContentItem):Promise<SourceStamp>{
 return {id:item.id,game:item.game,revision:item.revision,sha256:await sha256(exact(item))};
}
/** Atomic library data are never modified; only original IDs and hashes leave this function. */
export async function prepareSavedDraft(items:readonly ContentItem[],input:DraftInput,
 revision:number,at=Date.now()):Promise<SavedPreparation>{
 if(!GAME_TYPES.includes(input.game)||!['kurz','standard','lang'].includes(input.profile)||
  ![3,4,5].includes(input.teams)||!Number.isSafeInteger(input.step)||
  input.step<0||!Number.isSafeInteger(revision)||revision<1)
  fail('INVALID','Ungültiges Profil oder Versionszähler.');
 const selections=normalizedSelections(input.selections),assignments:SlotStamp[]=[];
 for(const game of GAME_TYPES){
  const plan=composeContentPack(items,game,input.profile,input.teams,selections[game]);
  for(const slot of plan.slots)assignments.push({game,slot:slot.key,id:slot.selected});
 }
 const chosen=new Set(assignments.map(x=>x.id).filter((x):x is string=>x!==null));
 const byId=new Map(items.map(item=>[item.id,item]));
 const selected:ContentItem[]=[];
 for(const id of [...chosen].sort()){
  const item=byId.get(id);
  if(!item)fail('MISSING','Ausgewählte Quelle fehlt in der Bibliothek: '+id);
  selected.push(item);
 }
 const sources=await Promise.all(selected.map(sourceStamp));
 return assertSavedPreparation({key:'current',format:FORMAT,revision,updatedAt:at,
  game:input.game,profile:input.profile,teams:input.teams,step:input.step,
  selections,assignments,sources,sourceOnly:true,release:'NO_GO'});
}
export type ReconcileResult={status:'ready'|'stale';issues:string[]};
export async function reconcileSavedDraft(record:SavedPreparation,
 items:readonly ContentItem[]):Promise<ReconcileResult>{
 assertSavedPreparation(record);
 const problems:string[]=[];
 const byId=new Map(items.map(i=>[i.id,i]));
 for(const stamp of record.sources){
  const item=byId.get(stamp.id);
  if(!item){problems.push(stamp.id+': Quelle fehlt');continue;}
  if(item.game!==stamp.game||item.revision!==stamp.revision||
   await sha256(exact(item))!==stamp.sha256)
   problems.push(stamp.id+': Inhalt oder Revision geändert');
 }
 const actual:SlotStamp[]=[];
 for(const game of GAME_TYPES){
  const plan=composeContentPack(items,game,record.profile,record.teams,record.selections[game]);
  for(const slot of plan.slots)actual.push({game,slot:slot.key,id:slot.selected});
 }
 const expected=JSON.stringify(record.assignments);
 if(JSON.stringify(actual)!==expected)problems.push('Aufgabenplätze und Quellen stimmen nicht mehr überein');
 return {status:problems.length?'stale':'ready',issues:problems.slice(0,24)};
}
export class PreparationRepository{
 private dbPromise:Promise<IDBDatabase>|null=null;
 constructor(private readonly factory:IDBFactory=indexedDB,
  private readonly name=PREPARATION_DB_NAME){}
 private db():Promise<IDBDatabase>{
  if(this.dbPromise)return this.dbPromise;
  this.dbPromise=new Promise<IDBDatabase>((resolve,reject)=>{
   const req=this.factory.open(this.name,1);
   req.onupgradeneeded=()=>{
    if(!req.result.objectStoreNames.contains('drafts'))
     req.result.createObjectStore('drafts',{keyPath:'key'});
   };
   req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
   req.onerror=()=>reject(new PreparationError('IDB','Lokaler Vorbereitungsplan nicht lesbar'));
   req.onblocked=()=>reject(new PreparationError('IDB','Vorbereitungsplan durch anderes Fenster blockiert'));
  }).catch(e=>{this.dbPromise=null;throw e;});
  return this.dbPromise;
 }
 async read():Promise<SavedPreparation|null>{
  const db=await this.db();
  return new Promise((resolve,reject)=>{
   const req=db.transaction('drafts','readonly').objectStore('drafts').get('current');
   req.onsuccess=()=>{
    try{resolve(req.result?assertSavedPreparation(req.result):null);}
    catch(e){reject(e);}
   };
   req.onerror=()=>reject(new PreparationError('IDB','Lokaler Plan nicht lesbar'));
  });
 }
 async save(record:SavedPreparation,expected:number|null):Promise<SavedPreparation>{
  const valid=assertSavedPreparation(record);
  const db=await this.db();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite');
   const store=tx.objectStore('drafts'),get=store.get('current');
   let fault:unknown;
   get.onsuccess=()=>{
    const prev=get.result as SavedPreparation|undefined;
    if((prev?.revision??null)!==expected||valid.revision!==(expected??0)+1){
     fault=new PreparationError('CONFLICT','Ein anderes Fenster hat den Abendplan geändert');
     tx.abort();return;
    }
    store.put(valid);
   };
   tx.oncomplete=()=>resolve(valid);
   tx.onabort=()=>reject(fault??new PreparationError('IDB','Speichern fehlgeschlagen'));
   tx.onerror=()=>{};
  });
 }
 async clear(expected:number|null):Promise<void>{
  const db=await this.db();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts');
   let fault:unknown;
   const get=store.get('current');
   get.onsuccess=()=>{
    if((get.result?.revision??null)!==expected){
     fault=new PreparationError('CONFLICT','Gespeicherter Plan wurde in anderem Fenster geändert');
     tx.abort();return;
    }
    store.delete('current');
   };
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(fault??new PreparationError('IDB','Löschen fehlgeschlagen'));
   tx.onerror=()=>{};
  });
 }
 async close():Promise<void>{const p=this.dbPromise;this.dbPromise=null;if(p)(await p).close();}
}
