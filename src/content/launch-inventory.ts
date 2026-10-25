import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import {validatePayload,contentSignature,type ContentItem} from './contracts';
import {PROFILE_COUNTS} from '../games/rundenquiz/engine';
import {DEPTH} from '../games/quiztafel/engine';
import {NEEDS} from '../games/verbindungen/engine';
import {LENGTH} from '../games/logikleiter/engine';
import {FORMAT_COUNTS} from '../games/umfrageduell/engine';
import {LEGACY_V113_INVENTORY} from './editorial-audit';
import {contentReviewTasks,type SourceReviewTask} from './editorial-source-review';

/** Source-backed structural possibilities, NEVER a claim of local or external approval. */
export type ProgramGap={kind:string;required:number;present:number;missing:number};
export type ProgramCandidate={
 game:GameType;profile:GameProfile;teams:3|4|5;gaps:ProgramGap[];
 structurallyComplete:boolean;candidateCount:number;locallyApproved:number;
};
export type LegacyCandidate={
 sourceId:string;sourceKey:string;itemId:string;game:GameType;
 family:keyof typeof LEGACY_V113_INVENTORY.familyActive;
 evidence:'import-metadata-only';independentlyVerified:false;approved:false;
};
export type EditorialPriority={
 item:ContentItem;route:SourceReviewTask['route'];issueCodes:string[];
 score:number;reasons:string[];
};
export type LaunchInventory={
 originalDeclaredActive:704;originalDeclaredTotal:706;
 historicFamilies:readonly {code:string;declared:number;confirmedV2Mappings:0}[];
 localCount:number;validUnapproved:number;localApprovalClaims:number;
 unreviewedIllustrative:number;
 programs:ProgramCandidate[];possibleLegacyLinks:LegacyCandidate[];
 legacyCollisions:string[];priorities:EditorialPriority[];
 verifiedLegacyMappings:0;externalRightsApproved:false;release:'NO_GO';
};
const profiles=['kurz','standard','lang'] as const;
const teamCounts=[3,4,5] as const;
const familyNames=Object.keys(LEGACY_V113_INVENTORY.familyActive) as
 (keyof typeof LEGACY_V113_INVENTORY.familyActive)[];
const key=(x:unknown)=>typeof x==='string'?x.trim().toLocaleLowerCase('de-DE'):'';
const gap=(kind:string,required:number,present:number):ProgramGap=>({
 kind,required,present,missing:Math.max(0,required-present),
});
function structural(items:readonly ContentItem[],game:GameType,profile:GameProfile,teams:3|4|5):ProgramCandidate{
 const bank=items.filter(item=>item.game===game&&item.status!=='quarantined'&&
  validatePayload(game,item.payload).length===0);
 const counts=(field:'round'|'kind'|'format',value:string)=>
  bank.filter(item=>(item.payload as Record<string,unknown>)[field]===value).length;
 let gaps:ProgramGap[]=[];
 if(game==='rundenquiz'){
  const needs=PROFILE_COUNTS[profile];
  gaps=Object.entries(needs).map(([round,n])=>gap(round,n,counts('round',round)));
 }else if(game==='quiztafel'){
  const depth=DEPTH[profile];
  const groups=new Map<string,{name:string;rows:Map<number,number>}>();
  for(const item of bank){
   const tile=item.payload as {categoryId:string;categoryName:string;row:number};
   const entry=groups.get(tile.categoryId)??{name:tile.categoryName,rows:new Map<number,number>()};
   if(entry.name!==tile.categoryName)entry.name='';
   entry.rows.set(tile.row,(entry.rows.get(tile.row)??0)+1);
   groups.set(tile.categoryId,entry);
  }
  // Distinct category IDs AND public names are mandatory for a real board.
  const complete=new Map<string,number>();
  for(const group of groups.values()){
   if(!group.name||!Array.from({length:depth},(_,i)=>i+1).every(row=>group.rows.get(row)===1))continue;
   const name=key(group.name);
   complete.set(name,(complete.get(name)??0)+1);
  }
  gaps=[gap('vollständige Kategorien ('+depth+' Zeilen)',teams,complete.size)];
 }else if(game==='verbindungen'){
  const n=NEEDS[profile];
  gaps=[gap('Vier Hinweise',n.clues*teams,counts('kind','clues')),
   gap('Folgen',n.sequences*teams,counts('kind','sequence')),
   gap('16er-Wand',n.wall,counts('kind','wall'))];
 }else if(game==='logikleiter'){
  for(let level=1;level<=LENGTH[profile];level++){
   gaps.push(gap('Stufe '+level,1,bank.filter(i=>
    (i.payload as {difficulty?:number}).difficulty===level).length));
  }
 }else{
  const n=FORMAT_COUNTS[profile];
  gaps=[gap('Beliebteste Antwort',n.popular,counts('format','popular')),
   gap('Top 3',n.top3,counts('format','top3'))];
 }
 // Repeated source signatures are an editorial conflict even if raw counts suffice.
 const seen=new Set<string>();let duplicate=false;
 for(const item of bank){
  const signature=contentSignature(item);
  if(signature&&seen.has(signature))duplicate=true;
  if(signature)seen.add(signature);
 }
 if(duplicate)gaps.push(gap('doppelte Frage im Spiel',1,0));
 return {game,profile,teams,gaps,structurallyComplete:gaps.every(g=>g.missing===0),
  candidateCount:bank.length,locallyApproved:bank.filter(i=>i.status==='approved').length};
}
/** Source-specific imported family IDs provide a *candidate*, not proof of the V1 item. */
function legacyCandidates(items:readonly ContentItem[]):{
 links:LegacyCandidate[];collisions:string[];
}{
 const found=new Map<string,LegacyCandidate[]>(),collisions:string[]=[];
 for(const item of items){
  if(item.status==='quarantined'||item.provenance.origin!=='legacy'||
   validatePayload(item.game,item.payload).length!==0)continue;
  const {sourceKey,sourceId,bundleHash}=item.provenance;
  if(!sourceKey||!sourceId||!bundleHash||!/^([a-f0-9]{64})$/iu.test(bundleHash)||
   !(sourceKey.startsWith('ligo.quiz.')||sourceKey==='main/index.html'))continue;
  const family=sourceId.slice(0,sourceId.indexOf(':')) as LegacyCandidate['family'];
  const identifier=sourceId.slice(sourceId.indexOf(':')+1);
  if(!familyNames.includes(family)||!identifier||identifier.length>120||
   !/^[\p{L}\p{N}_.-]+$/u.test(identifier))continue;
  const candidate:LegacyCandidate={sourceId,sourceKey,itemId:item.id,game:item.game,
   family,evidence:'import-metadata-only',independentlyVerified:false,approved:false};
  found.set(sourceId,[...(found.get(sourceId)??[]),candidate]);
 }
 const links:LegacyCandidate[]=[];
 for(const [id,group] of found){
  if(group.length>1){collisions.push(id);continue;}
  links.push(group[0]!);
 }
 return {links:links.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)),
  collisions:collisions.sort()};
}
export function launchContentInventory(items:readonly ContentItem[]):LaunchInventory{
 const programs=GAME_TYPES.flatMap(game=>profiles.flatMap(profile=>
  teamCounts.map(teams=>structural(items,game,profile,teams))));
 const historical=familyNames.map(code=>({
  code,declared:LEGACY_V113_INVENTORY.familyActive[code],confirmedV2Mappings:0 as const,
 }));
 const {links,collisions}=legacyCandidates(items);
 const sourceTasks=contentReviewTasks(items);
 const longest=new Map(GAME_TYPES.map(game=>[game,programs.find(p=>
  p.game===game&&p.profile==='lang'&&p.teams===5)!]));
 const priorities=sourceTasks.filter(task=>task.item.status!=='approved').map(task=>{
  const gameGaps=longest.get(task.item.game)!.gaps.filter(g=>g.missing>0);
  const risky=task.issues.filter(issue=>
   issue.code==='EXACT_DUPLICATE'||issue.code==='POSSIBLE_DUPLICATE'||
   issue.code==='CROSS_GAME_CLUE_REUSE');
  const blockers=task.issues.filter(issue=>issue.severity==='blocker');
  const reasons=[
   ...new Set([...risky.map(issue=>issue.code),
    ...blockers.map(issue=>issue.code),
    ...(gameGaps.length?['Unvollständiges Langprofil']:[]),
    task.route==='primary'?'Primärquelle prüfen':
     task.route==='illustrative'?'Keine erhobene Umfrage':'Quelle ermitteln']),
  ];
  const score=100*(blockers.length>0?1:0)+30*risky.length+
   25*(gameGaps.length>0?1:0)+15*(task.route==='primary'?1:0)+
   (task.item.status==='draft'?5:0);
  return {item:task.item,route:task.route,issueCodes:task.issues.map(i=>i.code),
   score,reasons};
 }).sort((a,b)=>b.score-a.score||a.item.id.localeCompare(b.item.id));
 return {
  originalDeclaredActive:LEGACY_V113_INVENTORY.declaredActive,
  originalDeclaredTotal:LEGACY_V113_INVENTORY.declaredTotal,
  historicFamilies:historical,
  localCount:items.length,
  validUnapproved:items.filter(i=>i.status==='draft'||i.status==='review')
   .filter(i=>validatePayload(i.game,i.payload).length===0).length,
  localApprovalClaims:items.filter(i=>i.status==='approved').length,
  unreviewedIllustrative:items.filter(i=>i.status!=='quarantined'&&i.game==='umfrageduell'&&
   (i.payload as {source?:{kind?:string}}).source?.kind==='illustrative').length,
  programs,possibleLegacyLinks:links,legacyCollisions:collisions,priorities,
  verifiedLegacyMappings:0,externalRightsApproved:false,release:'NO_GO',
 };
}
