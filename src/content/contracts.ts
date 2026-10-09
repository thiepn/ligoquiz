import {z} from 'zod';
import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import {validateQuestion,PROFILE_COUNTS,selectProfile,type Question} from '../games/rundenquiz/engine';
import {DEPTH,verifyBoard,type Tile} from '../games/quiztafel/engine';
import {NEEDS,validateContent as verifyVerbindungen,type Puzzle} from '../games/verbindungen/engine';
import {LENGTH,validateContent as verifyLogikleiter,type Rung} from '../games/logikleiter/engine';
import {FORMAT_COUNTS,validateContent as verifyUmfrageduell,type Survey} from '../games/umfrageduell/engine';

const id=z.string().trim().min(1).max(128);
const phrase=z.string().trim().min(1).max(3000);
const answer=z.string().trim().min(1).max(2000);
const reference=z.string().trim().min(1).max(1000);
const n=z.number().int().nonnegative().safe();
const cat=z.strictObject({label:z.string().trim().min(1).max(100),synonyms:z.array(z.string().trim().min(1).max(100)).max(15)});
const source=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('illustrative')}),
 z.strictObject({kind:z.literal('observed'),source:phrase,population:phrase,method:phrase,collectedOn:z.iso.date(),limitations:phrase,reviewed:z.literal(true)}),
]);
const rq=z.strictObject({id,round:z.enum(['wissen','hinweise','schaetzen','finale']),prompt:phrase,answer,
 reference,durationSeconds:z.number().int().min(5).max(300),
 clues:z.array(phrase).length(4).optional(),choices:z.array(phrase).max(6).optional(),
 truth:z.union([z.number().int().safe(),z.string().trim().min(1).max(80)]).optional(),
 unit:z.string().trim().min(1).max(60).optional()});
const qt=z.strictObject({id,categoryId:id,categoryName:z.string().trim().min(1).max(55),
 row:z.number().int().min(1).max(6),value:z.number().int().min(100).max(600),
 prompt:phrase,answer,reference});
const group=z.strictObject({id,tileIds:z.tuple([id,id,id,id]),link:phrase,acceptedLinks:z.array(phrase).min(1).max(15)});
const vb=z.discriminatedUnion('kind',[
 z.strictObject({id,kind:z.literal('clues'),target:answer,clues:z.tuple([phrase,phrase,phrase,phrase]),reference}),
 z.strictObject({id,kind:z.literal('sequence'),prompt:phrase,items:z.tuple([phrase,phrase,phrase]),answer,explanation:phrase,reference}),
 z.strictObject({id,kind:z.literal('wall'),tiles:z.array(z.strictObject({id,label:phrase})).length(16),
   groups:z.array(group).length(4),reference}),
]);
const ll=z.strictObject({id,difficulty:z.number().int().min(1).max(7),
 kind:z.enum(['deduction','numeric','ordering','constraint']),prompt:phrase,
 hint:phrase,answer,explanation:phrase,reference});
const ud=z.strictObject({id,format:z.enum(['popular','top3']),prompt:phrase,
 categories:z.tuple([cat,cat,cat,cat,cat]),source});
export const payloadSchemas={rundenquiz:rq,quiztafel:qt,verbindungen:vb,logikleiter:ll,umfrageduell:ud};
export type PayloadByGame={
 rundenquiz:z.infer<typeof rq>;quiztafel:z.infer<typeof qt>;
 verbindungen:z.infer<typeof vb>;logikleiter:z.infer<typeof ll>;umfrageduell:z.infer<typeof ud>;
};
export const contentSchema=z.strictObject({
 id,game:z.enum(GAME_TYPES),payload:z.unknown(),status:z.enum(['draft','review','approved','quarantined']),
 createdAt:n,updatedAt:n,revision:n,
 provenance:z.strictObject({
  origin:z.enum(['manual','legacy','pack','sample']),
  sourceKey:z.string().max(500).optional(),sourceId:z.string().max(300).optional(),
  bundleHash:z.string().max(100).optional(),sourceVersion:z.string().max(100).optional(),
  rights:z.string().max(600).optional(),reviewHint:z.string().max(200).optional(),
 }),
 review:z.strictObject({
  reviewer:z.string().trim().min(2).max(100),checkedAt:n,
  note:z.string().trim().min(10).max(1500),fingerprint:id,
  checklist:z.tuple([z.literal(true),z.literal(true),z.literal(true),z.literal(true)]),
 }).optional(),
 audit:z.array(z.strictObject({revision:n,at:n,action:z.string().max(100),note:z.string().max(1500)})).max(150),
});
export type ContentItem=z.infer<typeof contentSchema>;
export type ContentStatus=ContentItem['status'];
export function payloadId(item:ContentItem):string {
 const raw=item.payload;
 return raw&&typeof raw==='object'&&'id' in raw&&typeof raw.id==='string'?raw.id:'';
}
export function validatePayload(game:GameType,raw:unknown):string[]{
 const result=payloadSchemas[game].safeParse(raw);
 if(!result.success)return result.error.issues.map(x=>x.path.join('.')+': '+x.message).slice(0,15);
 try {
  if(game==='rundenquiz')validateQuestion(rq.parse(raw) as Question);
  if(game==='quiztafel'){
   const tile=qt.parse(raw);
   if(tile.value!==tile.row*100)throw Error('Kategoriepunktzahl stimmt nicht mit Zeile überein');
  }
  if(game==='logikleiter'){
   const rung=ll.parse(raw);
   if(rung.hint.toLocaleLowerCase('de-DE')===rung.answer.toLocaleLowerCase('de-DE'))
    throw Error('Hinweis darf nicht die Lösung verraten');
  }
  if(game==='umfrageduell'){
   const survey=ud.parse(raw);
   const terms=survey.categories.flatMap(c=>[c.label,...c.synonyms])
    .map(s=>s.toLocaleLowerCase('de-DE').normalize('NFKC').trim());
   if(new Set(terms).size!==terms.length)throw Error('Antwortkategorien überschneiden sich');
  }
  if(game==='verbindungen'){
   const p=vb.parse(raw);
   if(p.kind==='wall'){
    const groupIds=p.groups.flatMap(g=>g.tileIds);
    if(new Set(groupIds).size!==16||!groupIds.every(x=>p.tiles.some(t=>t.id===x))||
       new Set(p.tiles.map(t=>t.id)).size!==16)
      throw Error('Alle 16 Felder müssen je einer eindeutigen Gruppe zugeordnet sein');
   }
  }
 }catch(e){return [e instanceof Error?e.message:String(e)];}
 return [];
}
export function validateItem(value:unknown):ContentItem{
 const item=contentSchema.parse(value);
 const issues=validatePayload(item.game,item.payload);
 if(item.status!=='quarantined'&&issues.length)throw Error(issues.join(' | '));
 if(item.status==='approved'&&!item.review)throw Error('Freigabe benötigt redaktionelle Prüfung');
 if(item.status!=='quarantined'&&payloadId(item)!==item.id)
  throw Error('Inhalts-ID muss der Aufgaben-ID entsprechen');
 return item;
}
export function normalizedKey(s:string):string{return s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('de-DE');}
export function findDuplicates(items:readonly ContentItem[]):{id:string;other:string}[]{
 const seen=new Map<string,string>(),found:{id:string;other:string}[]=[];
 for(const item of items.filter(x=>x.status!=='quarantined')){
  const p=item.payload as {prompt?:string;target?:string};
  const text=typeof p.prompt==='string'?p.prompt:typeof p.target==='string'?p.target:'';
  if(!text)continue;
  const key=item.game+'|'+normalizedKey(text);
  if(seen.has(key))found.push({id:item.id,other:seen.get(key)!});
  else seen.set(key,item.id);
 }
 return found;
}
export function createDraft(game:GameType,payload:unknown,at=Date.now()):ContentItem{
 const parsed=payloadSchemas[game].parse(payload) as {id:string};
 const candidate:ContentItem={id:parsed.id,game,payload:parsed,status:'draft',createdAt:at,updatedAt:at,revision:0,
  provenance:{origin:'manual'},audit:[{revision:0,at,action:'CREATE',note:'Neuer Entwurf, nicht freigegeben'}]};
 return validateItem(candidate);
}
export function coverage(items:readonly ContentItem[],game:GameType,profile:GameProfile,teams:number){
 const approved=items.filter(i=>i.game===game&&i.status==='approved'&&validatePayload(i.game,i.payload).length===0);
 let required:Record<string,number>={};const available:Record<string,number>={};
 if(game==='rundenquiz')required={...PROFILE_COUNTS[profile]};
 if(game==='quiztafel')required={tiles:teams*DEPTH[profile]};
 if(game==='verbindungen'){
  const counts=NEEDS[profile];required={clues:counts.clues*teams,sequence:counts.sequences*teams,wall:counts.wall};
 }
 if(game==='logikleiter')required={rungs:LENGTH[profile]};
 if(game==='umfrageduell')required={...FORMAT_COUNTS[profile]};
 for(const item of approved){
  const p=item.payload as {round?:string;kind?:string;format?:string};
  const k=game==='rundenquiz'?p.round:game==='quiztafel'?'tiles':game==='verbindungen'?p.kind:game==='logikleiter'?'rungs':p.format;
  if(k)available[k]=(available[k]??0)+1;
 }
 return {required,available,ready:Object.entries(required).every(([k,num])=>(available[k]??0)>=num),totalApproved:approved.length};
}
export function selectReviewedPack(items:readonly ContentItem[],game:'rundenquiz',profile:GameProfile,teams:number):Question[];
export function selectReviewedPack(items:readonly ContentItem[],game:'quiztafel',profile:GameProfile,teams:number):{categories:{id:string;name:string}[];tiles:Tile[]};
export function selectReviewedPack(items:readonly ContentItem[],game:'verbindungen',profile:GameProfile,teams:number):Puzzle[];
export function selectReviewedPack(items:readonly ContentItem[],game:'logikleiter',profile:GameProfile,teams:number):Rung[];
export function selectReviewedPack(items:readonly ContentItem[],game:'umfrageduell',profile:GameProfile,teams:number):Survey[];
export function selectReviewedPack(items:readonly ContentItem[],game:GameType,profile:GameProfile,teams:number):
 Question[]|{categories:{id:string;name:string}[];tiles:Tile[]}|Puzzle[]|Rung[]|Survey[]{
 const approved=items.filter(i=>i.game===game&&i.status==='approved'&&validatePayload(i.game,i.payload).length===0);
 if(game==='rundenquiz')return selectProfile(approved.map(i=>rq.parse(i.payload) as Question),profile);
 if(game==='quiztafel'){
  const tiles=approved.map(i=>qt.parse(i.payload)),categoriesById=new Map<string,string>();
  for(const tile of tiles)categoriesById.set(tile.categoryId,tile.categoryName);
  const categories=[...categoriesById].map(([id,name])=>({id,name})).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,teams);
  const chosen=categories.flatMap(c=>Array.from({length:DEPTH[profile]},(_,i)=>
    tiles.find(t=>t.categoryId===c.id&&t.row===i+1))).filter((t):t is z.infer<typeof qt>=>Boolean(t));
  const result=chosen.map(({categoryName,...t})=>{void categoryName;return t;});
  verifyBoard({teams:Array.from({length:teams},(_,i)=>({id:String(i),name:String(i),order:i})),categories,tiles:result,profile});
  return {categories,tiles:result};
 }
 if(game==='verbindungen'){
  const v=approved.map(i=>vb.parse(i.payload));
  const needs=NEEDS[profile];
  const chosen=[...v.filter(p=>p.kind==='clues').slice(0,needs.clues*teams),
    ...v.filter(p=>p.kind==='sequence').slice(0,needs.sequences*teams),...v.filter(p=>p.kind==='wall').slice(0,1)];
  verifyVerbindungen(Array.from({length:teams},(_,i)=>({id:String(i),name:String(i),order:i})),profile,chosen);
  return chosen;
 }
 if(game==='logikleiter'){
  const chosen=approved.map(i=>ll.parse(i.payload)).sort((a,b)=>a.difficulty-b.difficulty).slice(0,LENGTH[profile]);
  verifyLogikleiter(Array.from({length:teams},(_,i)=>({id:String(i),name:String(i),order:i})),profile,chosen);
  return chosen;
 }
 const needs=FORMAT_COUNTS[profile];
 const pool=approved.map(i=>ud.parse(i.payload));
 const chosen=[...pool.filter(x=>x.format==='popular').slice(0,needs.popular),
   ...pool.filter(x=>x.format==='top3').slice(0,needs.top3)];
 verifyUmfrageduell(Array.from({length:teams},(_,i)=>({id:String(i),name:String(i),order:i})),profile,chosen);
 return chosen;
}
