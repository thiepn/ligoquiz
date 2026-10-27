import type {ContentItem} from './contracts';
import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import type {PreparationProblem} from './pack-preparation';
import {prepareFiveGameEvening} from './pack-preparation';
import {buildEditorialRehearsal,projectedRehearsalFrame} from './game-night-rehearsal';
import {fiveGameReadiness} from './original-slot-resolution';

type Choices=Partial<Record<GameType,Readonly<Record<string,string>>>>;
export type EveningCue={
 index:number;game:GameType;localIndex:number;slot:string;label:string;
 phase:string;teamNumber:number|null;sourceId:string|null;
 sourceRevision:number|null;needsReview:boolean;
 stage:string;publicPromptPresent:false;privateAnswerPresent:false;
};
export type EveningCueSheet={
 cues:readonly EveningCue[];missingSourceSlots:number;unresolvedSlots:number;
 teamTurns:readonly {game:GameType;count:readonly number[];balanced:boolean}[];
 gameStarts:Readonly<Record<GameType,number>>;status:'NO_GO';canPublish:false;
};
const byId=(items:readonly ContentItem[])=>new Map(items.map(x=>[x.id,x]));
/** Original five-game rehearsal, source-only. Never dispatches game commands or stage DTO. */
export function buildEveningCueSheet(items:readonly ContentItem[],
 profile:GameProfile,teams:3|4|5,selections:Choices={}):EveningCueSheet{
 const evening=prepareFiveGameEvening(items,profile,teams,selections);
 const readiness=fiveGameReadiness(items,profile,teams,selections);
 const source=byId(items),cues:EveningCue[]=[],starts={} as Record<GameType,number>;
 for(const game of GAME_TYPES){
  const plan=evening.plans.find(x=>x.game===game)!;
  starts[game]=cues.length;
  const cuesForGame=buildEditorialRehearsal(plan,items).steps;
  for(const step of cuesForGame){
   const row=plan.slots.find(s=>s.key===step.slot);
   const problems:readonly PreparationProblem[]=[
    ...plan.problems.filter(p=>step.sourceId?
     p.itemIds.includes(step.sourceId):p.code==='MISSING'&&
     p.message==='Nicht besetzt: '+(row?.label??'')),
    ...evening.spoilers.filter(p=>step.sourceId&&p.itemIds.includes(step.sourceId)),
   ];
   const item=step.sourceId?source.get(step.sourceId):undefined;
   const projected=projectedRehearsalFrame(step);
   cues.push({index:cues.length,game,localIndex:step.index,
    slot:step.slot,label:step.slotLabel,phase:step.phase,teamNumber:step.teamNumber,
    sourceId:step.sourceId,sourceRevision:item?.revision??null,
    needsReview:!item||item.status!=='approved'||problems.length>0,
    stage:projected.stage,publicPromptPresent:false,privateAnswerPresent:false});
  }
 }
 return {cues,missingSourceSlots:readiness.games.reduce((n,x)=>n+x.missing,0),
  unresolvedSlots:readiness.issues.length,
  teamTurns:readiness.games.map(g=>({game:g.game,count:g.teamTurns,balanced:g.balanced})),
  gameStarts:starts,status:'NO_GO',canPublish:false};
}
export function currentEveningCue(sheet:EveningCueSheet,game:GameType,localIndex:number):EveningCue|null{
 return sheet.cues.find(c=>c.game===game&&c.localIndex===localIndex)??null;
}
export function moveEveningCue(sheet:EveningCueSheet,game:GameType,localIndex:number,
 direction:-1|1):EveningCue|null{
 if(sheet.cues.length===0)return null;
 const idx=currentEveningCue(sheet,game,localIndex)?.index??sheet.gameStarts[game];
 return sheet.cues[(idx+direction+sheet.cues.length)%sheet.cues.length]??null;
}
export function nextUnresolvedCue(sheet:EveningCueSheet,game:GameType,
 localIndex:number):EveningCue|null{
 if(!sheet.cues.length)return null;
 const idx=currentEveningCue(sheet,game,localIndex)?.index??0;
 for(let offset=1;offset<=sheet.cues.length;offset++){
  const cue=sheet.cues[(idx+offset)%sheet.cues.length]!;
  // Go to the first step of a distinct unresolved slot, not repeatedly cycle
  // through four to five phases of the same question.
  if(cue.needsReview&&(cue.phase==='ready'||cue.phase==='prepared'))return cue;
 }
 return null;
}

/** A rehearsal mark is source-bound and never an approval or scoring receipt. */
export type RehearsalMark={game:GameType;slot:string;sourceId:string;sourceRevision:number};
const sameMark=(a:RehearsalMark,b:RehearsalMark)=>
 a.game===b.game&&a.slot===b.slot&&a.sourceId===b.sourceId&&a.sourceRevision===b.sourceRevision;
export function markForCue(cue:EveningCue|null):RehearsalMark|null{
 if(!cue?.sourceId||cue.sourceRevision===null)return null;
 return {game:cue.game,slot:cue.slot,sourceId:cue.sourceId,sourceRevision:cue.sourceRevision};
}
export function validRehearsalMarks(sheet:EveningCueSheet,
 marks:readonly RehearsalMark[]):RehearsalMark[]{
 const accepted:RehearsalMark[]=[];
 for(const mark of marks){
  if(accepted.some(x=>sameMark(x,mark)))continue;
  const cue=sheet.cues.find(x=>x.game===mark.game&&x.slot===mark.slot&&
   (x.phase==='ready'||x.phase==='prepared'));
  const expected=cue?markForCue(cue):null;
  if(expected&&sameMark(mark,expected))accepted.push({...expected});
 }
 return accepted;
}
export function toggleRehearsalMark(sheet:EveningCueSheet,
 marks:readonly RehearsalMark[],cue:EveningCue):RehearsalMark[]{
 const safe=validRehearsalMarks(sheet,marks),expected=markForCue(cue);
 if(!expected)return safe;
 if(!sheet.cues.some(x=>x.game===cue.game&&x.slot===cue.slot&&
  (x.phase==='ready'||x.phase==='prepared')&&sameMark(expected,markForCue(x)!)))return safe;
 return safe.some(m=>sameMark(m,expected))?
  safe.filter(m=>!sameMark(m,expected)):[...safe,expected];
}
export function rehearsalProgress(sheet:EveningCueSheet,
 marks:readonly RehearsalMark[]):{done:number;total:number;perGame:readonly {
 game:GameType;done:number;total:number}[];publicationAuthorized:false}{
 const valid=validRehearsalMarks(sheet,marks);
 const slotCues=sheet.cues.filter(x=>(x.phase==='ready'||x.phase==='prepared')&&x.sourceId!==null);
 const perGame=GAME_TYPES.map(game=>{
  const cues=slotCues.filter(x=>x.game===game);
  return {game,total:cues.length,
   done:cues.filter(c=>valid.some(m=>sameMark(m,markForCue(c)!))).length};
 });
 return {done:perGame.reduce((s,x)=>s+x.done,0),
  total:perGame.reduce((s,x)=>s+x.total,0),perGame,publicationAuthorized:false};
}
function nextEligible(sheet:EveningCueSheet,game:GameType,localIndex:number,
 predicate:(cue:EveningCue)=>boolean):EveningCue|null{
 if(!sheet.cues.length)return null;
 const from=currentEveningCue(sheet,game,localIndex)?.index??0;
 for(let step=1;step<=sheet.cues.length;step++){
  const next=sheet.cues[(from+step)%sheet.cues.length]!;
  if((next.phase==='ready'||next.phase==='prepared')&&predicate(next))return next;
 }
 return null;
}
/** Team labels are actual original engine slots, not inferred for shared questions. */
export function nextTeamTurnCue(sheet:EveningCueSheet,
 game:GameType,localIndex:number,team?:number):EveningCue|null{
 return nextEligible(sheet,game,localIndex,cue=>
  cue.teamNumber!==null&&(team===undefined||cue.teamNumber===team));
}
export function nextUntestedCue(sheet:EveningCueSheet,
 marks:readonly RehearsalMark[],game:GameType,localIndex:number):EveningCue|null{
 const valid=validRehearsalMarks(sheet,marks);
 return nextEligible(sheet,game,localIndex,cue=>{
  const expected=markForCue(cue);
  return expected!==null&&!valid.some(mark=>sameMark(mark,expected));
 });
}
