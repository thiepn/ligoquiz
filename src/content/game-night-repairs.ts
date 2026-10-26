import type {GameProfile,GameType} from '../domain/game/contracts';
import type {ContentItem} from './contracts';
import {prepareFiveGameEvening,type PreparationPlan,
 type PreparationProblem} from './pack-preparation';
import {buildEditorialRehearsal} from './game-night-rehearsal';

/** The entire run sheet is read-only, local and assembled from original draft IDs. */
export type RunSheetGame={game:GameType;sourceIds:readonly string[];
 slots:number;phaseSteps:number;teamTurns:readonly number[];
 balanced:boolean;missing:number;hardIssues:number;reviewIssues:number;approvedClaims:number;
};
export type GameNightRunSheet={
 profile:GameProfile;teams:3|4|5;games:RunSheetGame[];
 spoilers:readonly {first:string;second:string}[];
 totalSteps:number;missing:number;hardIssues:number;reviewIssues:number;
 status:'NO_GO';publishAllowed:false;liveSessionCreated:false;
};
export type SourceSelection=Partial<Record<GameType,Readonly<Record<string,string>>>>;
const HARD=new Set<PreparationProblem['code']>([
 'MISSING','INVALID_OVERRIDE','DUPLICATE_ID','DUPLICATE_CONTENT','ENGINE_INVALID',
]);
function penalty(problem:PreparationProblem){
 return HARD.has(problem.code)?100:problem.code==='SOURCE_BLOCKER'?40:
  problem.code==='CROSS_GAME_SPOILER'?30:10;
}
export function gameNightRunSheet(items:readonly ContentItem[],profile:GameProfile,
 teams:3|4|5,selected:SourceSelection={}):GameNightRunSheet{
 const evening=prepareFiveGameEvening(items,profile,teams,selected);
 const games=evening.plans.map(plan=>{
  const host=buildEditorialRehearsal(plan,items);
  const hard=plan.problems.filter(p=>HARD.has(p.code)).length;
  return {game:plan.game,sourceIds:plan.selectedIds,slots:host.taskCount,
   phaseSteps:host.steps.length,teamTurns:host.teamTurns,balanced:host.balancedTeamExposure,
   missing:host.missingCount,hardIssues:hard,
   reviewIssues:plan.problems.length-hard,approvedClaims:plan.localReviewClaims};
 });
 const spoilers=evening.spoilers.map(p=>({first:p.itemIds[0]!,second:p.itemIds[1]!}));
 return {profile,teams,games,spoilers,totalSteps:games.reduce((s,x)=>s+x.phaseSteps,0),
  missing:games.reduce((s,x)=>s+x.missing,0),
  hardIssues:games.reduce((s,x)=>s+x.hardIssues,0),
  reviewIssues:games.reduce((s,x)=>s+x.reviewIssues,0)+spoilers.length,
  status:'NO_GO',publishAllowed:false,liveSessionCreated:false};
}
export type RepairChoice={
 slot:string;sourceId:string;before:number;after:number;change:number;
 issuesAfter:readonly PreparationProblem['code'][];
 reviewerDecisionRequired:true;approvalGranted:false;
};
/** A replacement proposal never mutates items or implicitly selects a source. */
export function sourceRepairChoices(items:readonly ContentItem[],plan:PreparationPlan,
 selections:SourceSelection={},slotKey:string,max=8):RepairChoice[]{
 const slot=plan.slots.find(s=>s.key===slotKey);
 if(!slot||max<=0)return [];
 const baseSelected=Object.fromEntries(plan.slots.map(s=>[s.key,s.selected??'']));
 const current:SourceSelection={...selections,[plan.game]:baseSelected};
 const baseline=prepareFiveGameEvening(items,plan.profile,plan.teams,current);
 const score=(p:PreparationPlan,spoilers:readonly PreparationProblem[])=>
  p.problems.reduce((sum,x)=>sum+penalty(x),0)+spoilers.length*30;
 const initial=score(plan,baseline.spoilers);
 const initialHard=plan.problems.filter(p=>HARD.has(p.code)).length;
 const candidates:RepairChoice[]=[];
 for(const sourceId of slot.options.filter(id=>id!==slot.selected)){
  const updated={...baseSelected,[slotKey]:sourceId};
  // Selecting a new Quiztafel category changes its entire row selection.
  if(slotKey.startsWith('category:')){
   const team=slotKey.slice('category:'.length);
   for(const k of Object.keys(updated))if(k.startsWith('tile:'+team+':'))delete updated[k];
  }
  const revised:SourceSelection={...current,[plan.game]:updated};
  const all=prepareFiveGameEvening(items,plan.profile,plan.teams,revised);
  const next=all.plans.find(p=>p.game===plan.game)!;
  if(next.problems.filter(p=>HARD.has(p.code)).length>initialHard)continue;
  const result=score(next,all.spoilers);
  if(result>initial)continue;
  candidates.push({slot:slotKey,sourceId,before:initial,after:result,
   change:initial-result,
   issuesAfter:next.problems.map(p=>p.code),
   reviewerDecisionRequired:true,approvalGranted:false});
 }
 return candidates.sort((a,b)=>b.change-a.change||a.sourceId.localeCompare(b.sourceId))
  .slice(0,Math.min(8,Math.trunc(max)));
}
/** Recheck the original snapshot immediately before committing to local UI state. */
export function applySourceRepair(items:readonly ContentItem[],plan:PreparationPlan,
 choices:SourceSelection,repair:RepairChoice):SourceSelection|null{
 if(!plan.slots.some(s=>s.key===repair.slot&&s.options.includes(repair.sourceId)))return null;
 const currently=sourceRepairChoices(items,plan,choices,repair.slot,100)
  .find(c=>c.sourceId===repair.sourceId&&c.before===repair.before&&c.after===repair.after);
 if(!currently)return null;
 const before=Object.fromEntries(plan.slots.map(s=>[s.key,s.selected??'']));
 const updated={...before,[repair.slot]:repair.sourceId};
 if(repair.slot.startsWith('category:')){
  const team=repair.slot.slice('category:'.length);
  for(const key of Object.keys(updated))if(key.startsWith('tile:'+team+':'))delete updated[key];
 }
 return {...choices,[plan.game]:updated};
}
export function prioritizedReviewSlots(plan:PreparationPlan,
 spoilers:readonly PreparationProblem[]):{slot:string;label:string;severity:'missing'|'blocker'|'review';
 itemId:string|null;issues:readonly string[]}[]{
 const matched=new Map<string,{slot:string;label:string;severity:'missing'|'blocker'|'review';
  itemId:string|null;issues:string[]}>();
 for(const slot of plan.slots.filter(s=>!s.key.startsWith('category:'))){
  const found=plan.problems.filter(p=>
   slot.selected?p.itemIds.includes(slot.selected):
    p.code==='MISSING'&&p.message.includes(slot.label));
  const cross=spoilers.filter(p=>slot.selected&&p.itemIds.includes(slot.selected));
  const issueCodes=[...new Set([...found,...cross].map(p=>p.code))];
  if(!issueCodes.length)continue;
  const severity: 'missing'|'blocker'|'review'=!slot.selected?'missing':
   issueCodes.some(c=>HARD.has(c as PreparationProblem['code'])||c==='SOURCE_BLOCKER')?'blocker':'review';
  matched.set(slot.key,{slot:slot.key,label:slot.label,severity,
   itemId:slot.selected,issues:issueCodes});
 }
 return [...matched.values()].sort((a,b)=>{
  const priority={missing:0,blocker:1,review:2};
  return priority[a.severity]-priority[b.severity]||a.slot.localeCompare(b.slot);
 });
}
