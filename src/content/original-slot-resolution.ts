import type {ContentItem} from './contracts';
import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import {composeContentPack,prepareFiveGameEvening,
 type PreparationPlan,type PreparationProblem} from './pack-preparation';
import {buildEditorialRehearsal} from './game-night-rehearsal';

type Choices=Partial<Record<GameType,Readonly<Record<string,string>>>>;
const HARD=new Set<PreparationProblem['code']>([
 'MISSING','INVALID_OVERRIDE','DUPLICATE_ID','DUPLICATE_CONTENT','ENGINE_INVALID',
]);
const penalty=(p:PreparationProblem)=>
 HARD.has(p.code)?100:p.code==='SOURCE_BLOCKER'?50:
 p.code==='CROSS_GAME_SPOILER'?40:10;

export type SlotCandidate={
 game:GameType;slot:string;sourceId:string;sourceRevision:number;
 sourceStatus:ContentItem['status'];sourceRights:'unverified';
 hardBefore:number;hardAfter:number;reviewAfter:number;
 spoilersBefore:number;spoilersAfter:number;teamTurns:readonly number[];
 balanced:boolean;improvement:number;remainingCodes:readonly string[];
 approvalGranted:false;publicationAllowed:false;
};
export type SlotIssue={
 game:GameType;slot:string;label:string;sourceId:string|null;
 kind:'missing'|'hard'|'review';codes:readonly string[];
};
export type FiveGameReadiness={
 games:{game:GameType;missing:number;hard:number;review:number;
  teamTurns:readonly number[];balanced:boolean;sourceDrafts:number}[];
 issues:SlotIssue[];spoilers:number;readyForLive:false;release:'NO_GO';
};
const hard=(issues:readonly PreparationProblem[])=>
 issues.filter(i=>HARD.has(i.code)).length;
const weight=(issues:readonly PreparationProblem[])=>
 issues.reduce((n,x)=>n+penalty(x),0);
function stable(plan:PreparationPlan):Record<string,string>{
 return Object.fromEntries(plan.slots.map(s=>[s.key,s.selected??'']));
}
/** Inspect the actual selected packs; never mistake defaults for verified source choices. */
export function fiveGameReadiness(items:readonly ContentItem[],profile:GameProfile,
 teams:3|4|5,selections:Choices={}):FiveGameReadiness{
 const evening=prepareFiveGameEvening(items,profile,teams,selections);
 const allIssues:SlotIssue[]=[];
 const games=evening.plans.map(plan=>{
  const host=buildEditorialRehearsal(plan,items);
  for(const slot of plan.slots){
   // Category assignments matter: an empty category invalidates all of its rows.
   const matched=plan.problems.filter(issue=>
    slot.selected?issue.itemIds.includes(slot.selected):
     issue.code==='MISSING'&&issue.message==='Nicht besetzt: '+slot.label);
   const cross=evening.spoilers.filter(issue=>
    slot.selected&&issue.itemIds.includes(slot.selected));
   const codes=[...new Set([...matched,...cross].map(i=>i.code))];
   if(!codes.length&&!slot.selected)codes.push('MISSING');
   if(!codes.length)continue;
   allIssues.push({game:plan.game,slot:slot.key,label:slot.label,
    sourceId:slot.selected,kind:!slot.selected?'missing':
    codes.some(c=>HARD.has(c as PreparationProblem['code'])||c==='SOURCE_BLOCKER')?
     'hard':'review',codes});
  }
  return {game:plan.game,missing:plan.slots.filter(s=>!s.selected).length,
   hard:hard(plan.problems),review:plan.problems.length-hard(plan.problems),
   teamTurns:host.teamTurns,balanced:host.balancedTeamExposure,
   sourceDrafts:plan.sourceDrafts};
 });
 const prio={missing:0,hard:1,review:2};
 allIssues.sort((a,b)=>prio[a.kind]-prio[b.kind]||
  GAME_TYPES.indexOf(a.game)-GAME_TYPES.indexOf(b.game)||
  a.slot.localeCompare(b.slot));
 return {games,issues:allIssues,spoilers:evening.spoilers.length,
  readyForLive:false,release:'NO_GO'};
}
/** Original-engine constrained alternatives, never a fabricated content or approval. */
export function originalSlotCandidates(items:readonly ContentItem[],
 game:GameType,profile:GameProfile,teams:3|4|5,
 selections:Choices,slotKey:string,max=8):SlotCandidate[]{
 if(!Number.isInteger(max)||max<=0)return [];
 const baseline=prepareFiveGameEvening(items,profile,teams,selections);
 const initial=baseline.plans.find(p=>p.game===game);
 const slot=initial?.slots.find(s=>s.key===slotKey);
 if(!initial||!slot)return [];
 const seen=initial.slots.filter(s=>s.key!==slotKey&&
  !s.key.startsWith('category:')).map(s=>s.selected).filter(Boolean);
 const occupied=new Set(seen);
 const initialScore=weight(initial.problems)+baseline.spoilers.length*40;
 const base=stable(initial),initialHard=hard(initial.problems);
 const out:SlotCandidate[]=[];
 const bank=new Map(items.map(x=>[x.id,x]));
 for(const candidateId of slot.options){
  if(candidateId===slot.selected||occupied.has(candidateId))continue;
  const item=bank.get(candidateId);
  if(!item||item.status==='quarantined'||item.game!==game)continue;
  const updated={...base,[slotKey]:candidateId};
  if(slotKey.startsWith('category:')){
   const team=slotKey.slice('category:'.length);
   for(const key of Object.keys(updated))
    if(key.startsWith('tile:'+team+':'))delete updated[key];
  }
  const proposed={...selections,[game]:updated};
  const evening=prepareFiveGameEvening(items,profile,teams,proposed);
  const selected=evening.plans.find(p=>p.game===game)!;
  const hardAfter=hard(selected.problems);
  if(hardAfter>initialHard||evening.spoilers.length>baseline.spoilers.length)continue;
  const after=weight(selected.problems)+evening.spoilers.length*40;
  // A missing slot should actually become usable, not just move the hole.
  if(!slot.selected&&!selected.slots.find(s=>s.key===slotKey)?.selected)continue;
  if(slot.selected&&after>initialScore)continue;
  const host=buildEditorialRehearsal(selected,items);
  out.push({game,slot:slotKey,sourceId:candidateId,
   sourceRevision:item.revision,sourceStatus:item.status,
   sourceRights:'unverified',hardBefore:initialHard,hardAfter,
   reviewAfter:selected.problems.length-hardAfter,
   spoilersBefore:baseline.spoilers.length,spoilersAfter:evening.spoilers.length,
   teamTurns:host.teamTurns,balanced:host.balancedTeamExposure,
   improvement:initialScore-after,
   remainingCodes:[...new Set(selected.problems.map(p=>p.code))],
   approvalGranted:false,publicationAllowed:false});
 }
 return out.sort((a,b)=>b.improvement-a.improvement||
  a.hardAfter-b.hardAfter||a.spoilersAfter-b.spoilersAfter||
  a.sourceId.localeCompare(b.sourceId)).slice(0,Math.min(max,20));
}
/** Revalidate the real source revision and the whole proposal before accepting a click. */
export function selectOriginalSlot(items:readonly ContentItem[],
 game:GameType,profile:GameProfile,teams:3|4|5,
 selections:Choices,claim:SlotCandidate):Choices|null{
 if(claim.game!==game||claim.approvalGranted!==false||
  claim.publicationAllowed!==false||claim.sourceRights!=='unverified')return null;
 const source=items.find(i=>i.id===claim.sourceId);
 if(!source||source.revision!==claim.sourceRevision||
  source.status!==claim.sourceStatus)return null;
 const fresh=originalSlotCandidates(items,game,profile,teams,selections,claim.slot,100)
  .find(c=>c.sourceId===claim.sourceId&&
    c.improvement===claim.improvement&&c.hardAfter===claim.hardAfter&&
    c.spoilersAfter===claim.spoilersAfter);
 if(!fresh)return null;
 const now=composeContentPack(items,game,profile,teams,selections[game]);
 const updated=stable(now);
 updated[claim.slot]=claim.sourceId;
 if(claim.slot.startsWith('category:')){
  const team=claim.slot.slice('category:'.length);
  for(const key of Object.keys(updated))
   if(key.startsWith('tile:'+team+':'))delete updated[key];
 }
 return {...selections,[game]:updated};
}
/** Moderator jump is always to an original local-only rehearsal phase, not a host command. */
export function rehearsalIndexForSlot(items:readonly ContentItem[],
 game:GameType,profile:GameProfile,teams:3|4|5,
 selections:Choices,slotKey:string):number|null{
 const plan=composeContentPack(items,game,profile,teams,selections[game]);
 const run=buildEditorialRehearsal(plan,items);
 return run.steps.find(x=>x.slot===slotKey)?.index??null;
}
