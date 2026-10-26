import type {ContentItem} from './contracts';
import {contentSignature,validatePayload} from './contracts';
import {auditLibrary} from './editorial-audit';
import {qualitySignals} from './editorial-quality';
import {PROFILE_COUNTS,selectProfile,type Question} from '../games/rundenquiz/engine';
import {DEPTH,verifyBoard,type Tile} from '../games/quiztafel/engine';
import {NEEDS,validateContent as checkVerbindungen,type Puzzle} from '../games/verbindungen/engine';
import {LENGTH,validateContent as checkLogikleiter,type Rung} from '../games/logikleiter/engine';
import {FORMAT_COUNTS,validateContent as checkUmfrageduell,type Survey} from '../games/umfrageduell/engine';
import type {GameProfile,GameType} from '../domain/game/contracts';

export type PreparationSlot={key:string;label:string;options:readonly string[];selected:string|null};
export type PreparationProblem={code:'MISSING'|'INVALID_OVERRIDE'|'DUPLICATE_ID'|'DUPLICATE_CONTENT'|
 'SOURCE_BLOCKER'|'SOURCE_REVIEW'|'ENGINE_INVALID'|'CROSS_GAME_SPOILER';
 message:string;itemIds:readonly string[]};
export type PreparationPlan={
 game:GameType;profile:GameProfile;teams:3|4|5;
 slots:PreparationSlot[];selectedIds:string[];problems:PreparationProblem[];
 structuralReady:boolean;localReviewClaims:number;sourceDrafts:number;
 validForPublication:false;rightsVerified:false;status:'NO_GO';
};
type Override=Readonly<Record<string,string>>;
const groups=(items:readonly ContentItem[],game:GameType)=>
 items.filter(x=>x.game===game&&x.status!=='quarantined'&&
  validatePayload(x.game,x.payload).length===0).sort((a,b)=>a.id.localeCompare(b.id));
const p=(item:ContentItem)=>item.payload as Record<string,unknown>;
const teamRoster=(teams:number)=>Array.from({length:teams},(_,i)=>({
 id:'plan-'+(i+1),name:'Team '+(i+1),order:i}));
const unique=(ids:readonly string[])=>new Set(ids).size===ids.length;
export function composeContentPack(items:readonly ContentItem[],game:GameType,
 profile:GameProfile,teams:3|4|5,overrides:Override={}):PreparationPlan{
 const bank=groups(items,game),slots:PreparationSlot[]=[],problems:PreparationProblem[]=[];
 const add=(key:string,label:string,options:readonly ContentItem[])=>{
  const values=options.map(x=>x.id);
  const choice=overrides[key];
  if(choice!==undefined&&!values.includes(choice)){
   problems.push({code:'INVALID_OVERRIDE',message:'Auswahl passt nicht zu '+label,itemIds:[choice]});
  }
  const selected=choice!==undefined?(values.includes(choice)?choice:null):(values[0]??null);
  slots.push({key,label,options:values,selected});
  if(!selected)problems.push({code:'MISSING',message:'Nicht besetzt: '+label,itemIds:[]});
 };
 if(game==='rundenquiz'){
  const counts=PROFILE_COUNTS[profile];
  for(const [round,needed] of Object.entries(counts))
   for(let i=0;i<needed;i++)
    add(round+':'+(i+1),round+' '+(i+1),
     bank.filter(x=>p(x).round===round).slice(i));
 }else if(game==='quiztafel'){
  const depth=DEPTH[profile],categories=new Map<string,{name:string;items:ContentItem[]}>();
  for(const item of bank){
   const key=String(p(item).categoryId);
   const entry=categories.get(key)??{name:String(p(item).categoryName),items:[]};
   entry.items.push(item);categories.set(key,entry);
  }
  const choices=[...categories.entries()].filter(([,v])=>v.items.some(i=>Number(p(i).row)===1))
   .sort(([a],[b])=>a.localeCompare(b));
  for(let i=0;i<teams;i++){
   const catKey='category:'+String(i+1),options=choices.map(([,v])=>v.items.find(x=>Number(p(x).row)===1)!).filter(Boolean);
   add(catKey,'Kategorie Team '+(i+1),options.slice(i));
   const choice=slots.at(-1)?.selected,cat=choice?String(p(bank.find(x=>x.id===choice)!).categoryId):null;
   for(let row=1;row<=depth;row++){
    add('tile:'+String(i+1)+':'+String(row),'Team '+(i+1)+' · '+String(row*100)+' Punkte',
     bank.filter(x=>String(p(x).categoryId)===cat&&Number(p(x).row)===row));
   }
  }
 }else if(game==='verbindungen'){
  const need=NEEDS[profile];
  for(let round=1;round<=need.clues;round++)
   for(let team=1;team<=teams;team++){
    const idx=(round-1)*teams+team-1;
    add('clue:'+round+':'+team,'Hinweise · Runde '+round+' / Team '+team,
     bank.filter(x=>p(x).kind==='clues').slice(idx));
   }
  for(let round=1;round<=need.sequences;round++)
   for(let team=1;team<=teams;team++){
    const idx=(round-1)*teams+team-1;
    add('sequence:'+round+':'+team,'Folge · Runde '+round+' / Team '+team,
     bank.filter(x=>p(x).kind==='sequence').slice(idx));
   }
  for(let i=0;i<need.wall;i++)add('wall:'+i,'16er-Wand',bank.filter(x=>p(x).kind==='wall').slice(i));
 }else if(game==='logikleiter'){
  for(let n=1;n<=LENGTH[profile];n++)
   add('rung:'+n,'Stufe '+n,bank.filter(x=>p(x).difficulty===n));
 }else{
  const counts=FORMAT_COUNTS[profile];
  for(const [format,required] of Object.entries(counts))
   for(let n=1;n<=required;n++)
    add(format+':'+n,(format==='top3'?'Top 3':'Beliebteste Antwort')+' · '+n,
     bank.filter(x=>p(x).format===format).slice(n-1));
 }
 // Category slots are structural choices, not extra questions in the chosen pack.
 const chosen=slots.filter(x=>!x.key.startsWith('category:')).map(x=>x.selected).filter((x):x is string=>x!==null);
 if(!unique(chosen)){
  const counts=new Map<string,number>();for(const key of chosen)counts.set(key,(counts.get(key)??0)+1);
  const repeated=[...counts].filter(([,n])=>n>1).map(([key])=>key);
  problems.push({code:'DUPLICATE_ID',message:'Aufgabe mehrfach im selben Spiel',itemIds:repeated});
 }
 const picked=chosen.map(key=>bank.find(x=>x.id===key)).filter((x):x is ContentItem=>Boolean(x));
 const signatures=new Map<string,string>();
 for(const item of picked){
  const signature=contentSignature(item);
  if(!signature)continue;
  const before=signatures.get(signature);
  if(before&&before!==item.id)problems.push({code:'DUPLICATE_CONTENT',
   message:'Gleicher Fragenkern innerhalb des Packs',itemIds:[before,item.id]});
  else signatures.set(signature,item.id);
 }
 const issues=auditLibrary(items).issues;
 for(const item of picked){
  const relevant=issues.filter(x=>x.id===item.id);
  if(relevant.some(x=>x.severity==='blocker'))
   problems.push({code:'SOURCE_BLOCKER',message:'G23-Blocker: '+item.id,
    itemIds:[item.id]});
  const review=qualitySignals(item,relevant);
  if(review.some(x=>['CITATION_PINPOINT','CLUE_REPEAT','ANSWER_LEAK',
   'EXPLANATION_UNCLEAR','ILLUSTRATIVE_ONLY'].includes(x.code)))
   problems.push({code:'SOURCE_REVIEW',message:'Fragenqualität offen: '+item.id,itemIds:[item.id]});
 }
 if(!problems.some(x=>x.code==='MISSING'||x.code==='INVALID_OVERRIDE'||x.code==='DUPLICATE_ID')){
  try{
   const payloads=picked.map(x=>x.payload);
   const roster=teamRoster(teams);
   if(game==='rundenquiz'){
    const selected=selectProfile(payloads as Question[],profile);
    if(selected.length!==chosen.length||selected.some((x,i)=>x.id!==chosen[i]))
     throw Error('Rundenfolge stimmt nicht überein');
   }else if(game==='quiztafel'){
    const categorySlots=slots.filter(x=>x.key.startsWith('category:'));
    const cats=categorySlots.map(x=>{
     const item=bank.find(i=>i.id===x.selected)!;
     return {id:String(p(item).categoryId),name:String(p(item).categoryName)};
    });
    verifyBoard({teams:roster,categories:cats,tiles:payloads as Tile[],profile});
   }else if(game==='verbindungen'){
    checkVerbindungen(roster,profile,payloads as Puzzle[]);
   }else if(game==='logikleiter'){
    checkLogikleiter(roster,profile,payloads as Rung[]);
   }else checkUmfrageduell(roster,profile,payloads as Survey[]);
  }catch(e){problems.push({code:'ENGINE_INVALID',
   message:e instanceof Error?e.message:String(e),itemIds:chosen});}
 }
 const hard=problems.some(x=>['MISSING','INVALID_OVERRIDE','DUPLICATE_ID',
  'DUPLICATE_CONTENT','ENGINE_INVALID'].includes(x.code));
 return {game,profile,teams,slots,selectedIds:chosen,problems,
  structuralReady:!hard,localReviewClaims:picked.filter(x=>x.status==='approved').length,
  sourceDrafts:picked.filter(x=>x.status!=='approved').length,
  validForPublication:false,rightsVerified:false,status:'NO_GO'};
}
/** Source-ID-only, local redacted handoff. Never exports questions or answer keys. */
export function exportPreparationPlan(plan:PreparationPlan):string{
 return JSON.stringify({
  format:'ligoquiz-g30-source-ids-only-v1',game:plan.game,profile:plan.profile,
  teams:plan.teams,sourceIds:plan.selectedIds,
  assignments:plan.slots.map(x=>({slot:x.key,sourceId:x.selected})),
  problems:plan.problems.map(x=>({code:x.code,itemIds:x.itemIds})),
  status:'NO_GO',publicationAuthorized:false,rightsVerified:false,
 },null,2);
}
/** Selected ids from separate games get an actual cross-game spoiler check. */
export function prepareFiveGameEvening(items:readonly ContentItem[],profile:GameProfile,
 teams:3|4|5):{plans:PreparationPlan[];spoilers:PreparationProblem[];release:'NO_GO'}{
 const names=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const;
 const plans=names.map(game=>composeContentPack(items,game,profile,teams));
 const allIds=new Set(plans.flatMap(x=>x.selectedIds));
 const spoilers=auditLibrary(items).issues.filter(issue=>
  issue.code==='CROSS_GAME_CLUE_REUSE'&&issue.other&&allIds.has(issue.id)&&allIds.has(issue.other))
  .filter(issue=>issue.id.localeCompare(issue.other!)<0)
  .map(issue=>({code:'CROSS_GAME_SPOILER' as const,
   message:'Gleiches Hinweisziel in zwei Programmen',itemIds:[issue.id,issue.other!]}));
 return {plans,spoilers,release:'NO_GO'};
}
