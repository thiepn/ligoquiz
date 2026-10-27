import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import type {ContentItem} from './contracts';
import {sha256} from './migration';
import {composeContentPack} from './pack-preparation';
import type {RehearsalMark} from './evening-rehearsal-queue';
import {HOLD_REASONS,type EditorialHold} from './team-turn-rotation';

export const PREPARATION_DB_NAME='ligoquiz.v2.preparation.g33';
const FORMAT='ligoquiz-g33-source-only-v1' as const;
type Selection=Record<string,string>;
export type StoredSelections=Record<GameType,Selection>;
export type DraftInput={game:GameType;profile:GameProfile;teams:3|4|5;step:number;
 selections:Partial<Record<GameType,Readonly<Selection>>>;rehearsed?:readonly RehearsalMark[];holds?:readonly EditorialHold[]};
export type SourceStamp={id:string;game:GameType;revision:number;sha256:string};
export type SlotStamp={game:GameType;slot:string;id:string|null};
export type SavedPreparation={
 key:'current';format:typeof FORMAT;revision:number;updatedAt:number;
 game:GameType;profile:GameProfile;teams:3|4|5;step:number;
 selections:StoredSelections;assignments:SlotStamp[];sources:SourceStamp[];rehearsed?:RehearsalMark[];holds?:EditorialHold[];
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
const SAFE=/^[a-zA-Z0-9_:./-]{1,128}$/u;
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
 const rehearsed=raw.rehearsed===undefined?[]:raw.rehearsed;
 const holds=raw.holds===undefined?[]:raw.holds;
 if(!Array.isArray(holds)||holds.length>300)
  fail('INVALID','Korrekturvermerke enthalten zu viele oder ungültige Einträge.');
 if(!Array.isArray(rehearsed)||rehearsed.length>300)
  fail('INVALID','Probenachweise enthalten zu viele oder ungültige Einträge.');
 const selections=raw.selections as StoredSelections;
 const assignmentIds=new Set(raw.assignments.map(s=>(s as SlotStamp).id).filter(Boolean));
 if(assignmentIds.size!==sourceIds.size||[...assignmentIds].some(id=>!sourceIds.has(id!)))
  fail('INVALID','Quellnachweise stimmen nicht mit der Aufgabenwahl überein.');
 const rehearsalKeys=new Set<string>();
 for(const mark of rehearsed){
  if(!plain(mark)||!GAME_TYPES.includes(mark.game as GameType)||
   typeof mark.slot!=='string'||!SAFE.test(mark.slot)||
   typeof mark.sourceId!=='string'||!SAFE.test(mark.sourceId)||
   !Number.isSafeInteger(mark.sourceRevision)||Number(mark.sourceRevision)<0)
   fail('INVALID','Probenachweis enthält ungültige Quellenreferenzen.');
  const key=mark.game+'/'+mark.slot;
  if(rehearsalKeys.has(key))fail('INVALID','Probenplatz wurde mehrfach bestätigt.');
  rehearsalKeys.add(key);
  const assignment=raw.assignments.find(x=>plain(x)&&x.game===mark.game&&
   x.slot===mark.slot) as SlotStamp|undefined;
  const stamp=raw.sources.find(x=>plain(x)&&x.id===mark.sourceId) as SourceStamp|undefined;
  if(!assignment||assignment.id!==mark.sourceId||
   mark.slot.startsWith('category:')||
   !stamp||stamp.game!==mark.game||stamp.revision!==mark.sourceRevision)
   fail('INVALID','Probenachweis gehört nicht mehr zu ausgewählter Originalquelle.');
 }
 const heldKeys=new Set<string>();
 for(const hold of holds){
  if(!plain(hold)||!GAME_TYPES.includes(hold.game as GameType)||
   typeof hold.slot!=='string'||!SAFE.test(hold.slot)||
   typeof hold.sourceId!=='string'||!SAFE.test(hold.sourceId)||
   !Number.isSafeInteger(hold.sourceRevision)||Number(hold.sourceRevision)<0||
   !HOLD_REASONS.includes(hold.reason as EditorialHold['reason']))
   fail('INVALID','Korrekturvermerk ist ungültig.');
  const identity=hold.game+'/'+hold.slot;
  if(heldKeys.has(identity))fail('INVALID','Quellplatz hat doppelte Korrekturvermerke.');
  heldKeys.add(identity);
  const assignment=raw.assignments.find(a=>plain(a)&&a.game===hold.game&&
   a.slot===hold.slot) as SlotStamp|undefined;
  const source=raw.sources.find(x=>plain(x)&&x.id===hold.sourceId) as SourceStamp|undefined;
  if(!assignment||assignment.id!==hold.sourceId||
   hold.slot.startsWith('category:')||!source||
   source.game!==hold.game||source.revision!==hold.sourceRevision)
   fail('INVALID','Korrekturvermerk gehört nicht mehr zur Originalquelle.');
 }
 if(JSON.stringify(raw).length>90_000)fail('INVALID','Vorbereitungsplan überschreitet die zulässige Größe.');
 return {...raw,selections,rehearsed:rehearsed as RehearsalMark[],
  holds:holds as EditorialHold[]} as SavedPreparation;
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
  selections,assignments,sources,rehearsed:[...(input.rehearsed??[])],holds:[...(input.holds??[])],sourceOnly:true,release:'NO_GO'});
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

/**
 * Recover an old draft only through an explicit host decision. Exact byte custody
 * controls each individual assignment; unverified questions become empty slots.
 * No question payload or manual approval is copied into a plan.
 */
export type RecoveryGap={game:GameType;slot:string;sourceId:string|null;
 reason:'changed'|'missing'|'incompatible'|'layout'};
export type RecoveryProposal={selections:StoredSelections;retained:number;
 cleared:RecoveryGap[];slots:number;canCommit:boolean;sourceOrderChanged:boolean;status:'NO_GO'};
export async function previewSelectiveRecovery(saved:SavedPreparation,
 items:readonly ContentItem[]):Promise<RecoveryProposal>{
 const old=assertSavedPreparation(saved);
 const byId=new Map(items.map(i=>[i.id,i]));
 const validated=new Map<string,boolean>();
 for(const stamp of old.sources){
  const item=byId.get(stamp.id);
  validated.set(stamp.id,Boolean(item&&item.game===stamp.game&&
   item.revision===stamp.revision&&await sha256(exact(item))===stamp.sha256));
 }
 const maps=normalizedSelections({});
 const gaps:RecoveryGap[]=[];
 const marked=new Set<string>();
 const gap=(entry:SlotStamp,reason:RecoveryGap['reason'])=>{
  const key=entry.game+'/'+entry.slot;
  if(marked.has(key))return;
  marked.add(key);gaps.push({game:entry.game,slot:entry.slot,
   sourceId:entry.id,reason});
 };
 // Rebuild the original assignment, not new defaults. A changed source is a
 // hole even if the changed content passes current schema validation.
 for(const entry of old.assignments){
  if(entry.id===null){maps[entry.game][entry.slot]='';continue;}
  if(!validated.get(entry.id)){
   maps[entry.game][entry.slot]='';
   gap(entry,byId.has(entry.id)?'changed':'missing');
  }else maps[entry.game][entry.slot]=entry.id;
 }
 // A valid source may become incompatible when an adjacent category/slot was
 // cleared. Propagate empties to a fixed point, never auto-select alternatives.
 for(let iteration=0;iteration<old.assignments.length+1;iteration++){
  let changed=false;
  for(const game of GAME_TYPES){
   const plan=composeContentPack(items,game,old.profile,old.teams,maps[game]);
   const slots=new Map(plan.slots.map(s=>[s.key,s]));
   for(const entry of old.assignments.filter(a=>a.game===game)){
    const wanted=maps[game][entry.slot];
    if(!wanted)continue;
    const slot=slots.get(entry.slot);
    if(!slot||slot.selected!==wanted||!slot.options.includes(wanted)){
     maps[game][entry.slot]='';
     gap(entry,slot?'incompatible':'layout');
     changed=true;
    }
   }
  }
  if(!changed)break;
  if(iteration===old.assignments.length)
   fail('INVALID','Quellplätze konnten nicht eindeutig abgeglichen werden.');
 }
 const retained=old.assignments.filter(x=>x.id!==null&&maps[x.game][x.slot]===x.id).length;
 const remaining=old.assignments.filter(x=>x.id!==null&&!maps[x.game][x.slot]);
 if(remaining.length!==gaps.length)
  fail('INVALID','Einige geänderte Quellen wurden nicht als Konflikt ausgewiesen.');
 const stale=(await reconcileSavedDraft(old,items)).status==='stale';
 return {selections:maps,retained,cleared:gaps,slots:old.assignments.length,
  canCommit:stale,sourceOrderChanged:stale&&gaps.length===0,status:'NO_GO'};
}
/** Independently recompute revision custody at commit time; never accept stale proposals. */
export async function commitSelectiveRecovery(
 repo:PreparationRepository,saved:SavedPreparation,
 items:readonly ContentItem[],input:RecoveryProposal):Promise<SavedPreparation>{
 const trusted=await previewSelectiveRecovery(saved,items);
 if(!trusted.canCommit||
  JSON.stringify(trusted.selections)!==JSON.stringify(input.selections)||
  JSON.stringify(trusted.cleared)!==JSON.stringify(input.cleared))
  fail('STALE','Quellen haben sich seit der Auswahl verändert; Wiederherstellung neu prüfen.');
 const next=await prepareSavedDraft(items,{
  game:saved.game,profile:saved.profile,teams:saved.teams,
  step:saved.step,selections:trusted.selections,
  rehearsed:(saved.rehearsed??[]).filter(mark=>
   trusted.selections[mark.game][mark.slot]===mark.sourceId&&
   items.some(item=>item.id===mark.sourceId&&item.game===mark.game&&
    item.revision===mark.sourceRevision)),
  holds:(saved.holds??[]).filter(hold=>
   trusted.selections[hold.game][hold.slot]===hold.sourceId&&
   items.some(item=>item.id===hold.sourceId&&item.game===hold.game&&
    item.revision===hold.sourceRevision)),
 },saved.revision+1);
 const check=await reconcileSavedDraft(next,items);
 if(check.status!=='ready')fail('STALE','Wiederhergestellte Auswahl konnte nicht bestätigt werden.');
 return repo.save(next,saved.revision);
}
