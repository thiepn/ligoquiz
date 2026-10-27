import type {GameType} from '../domain/game/contracts';
import {type EveningCue,type EveningCueSheet,type RehearsalMark,
 markForCue,validRehearsalMarks} from './evening-rehearsal-queue';

const first=(cue:EveningCue)=>cue.phase==='ready'||cue.phase==='prepared';
const key=(game:GameType,slot:string)=>game+'/'+slot;
export type EditorialHoldReason='question'|'source'|'rights'|'rules';
export type EditorialHold={
 game:GameType;slot:string;sourceId:string;sourceRevision:number;
 reason:EditorialHoldReason;
};
export const HOLD_REASONS:readonly EditorialHoldReason[]=[
 'question','source','rights','rules',
];
function sourceMatches(a:{game:GameType;slot:string;sourceId:string;sourceRevision:number},
 b:{game:GameType;slot:string;sourceId:string;sourceRevision:number}){
 return a.game===b.game&&a.slot===b.slot&&a.sourceId===b.sourceId&&
  a.sourceRevision===b.sourceRevision;
}
export function validEditorialHolds(sheet:EveningCueSheet,
 holds:readonly EditorialHold[]):EditorialHold[]{
 const valid:EditorialHold[]=[],used=new Set<string>();
 for(const hold of holds){
  if(!HOLD_REASONS.includes(hold.reason))continue;
  const identifier=key(hold.game,hold.slot);
  if(used.has(identifier))continue;
  const original=sheet.cues.find(cue=>first(cue)&&cue.game===hold.game&&cue.slot===hold.slot);
  const expected=original?markForCue(original):null;
  if(!expected||!sourceMatches(expected,hold))continue;
  used.add(identifier);valid.push({...hold});
 }
 return valid;
}
/** A correction hold is only a private decision to revisit G10, never an approval. */
export function setEditorialHold(sheet:EveningCueSheet,
 holds:readonly EditorialHold[],cue:EveningCue,
 reason:EditorialHoldReason|null):EditorialHold[]{
 const base=validEditorialHolds(sheet,holds);
 const target=markForCue(cue);
 if(!target||!HOLD_REASONS.includes(reason as EditorialHoldReason))return reason===null?
  base.filter(h=>!(target&&sourceMatches(h,target))):base;
 const eligible=sheet.cues.some(c=>first(c)&&sourceMatches(target,markForCue(c)??{
  game:c.game,slot:c.slot,sourceId:'',sourceRevision:-1}));
 if(!eligible)return base;
 return [...base.filter(h=>!sourceMatches(h,target)),{...target,reason:reason!}];
}
export type RotationTurn={
 team:number;game:GameType;slot:string;sourceId:string|null;sourceRevision:number|null;
 cueIndex:number;localIndex:number;missing:boolean;needsReview:boolean;
 rehearsed:boolean;onHold:EditorialHoldReason|null;
};
export type TeamRotation={
 teams:3|4|5;turns:readonly RotationTurn[];perTeam:readonly {
 team:number;assigned:number;rehearsed:number;missing:number;held:number}[];
 balanced:boolean;release:'NO_GO';canPlay:false;canPublish:false;
};
/** Round-robin dry run of actual team-labelled original slots only. Shared rounds
 * are intentionally not assigned an invented team. This is not a game scheduler. */
export function buildTeamRotation(sheet:EveningCueSheet,teams:3|4|5,
 marks:readonly RehearsalMark[],holds:readonly EditorialHold[]=[]):TeamRotation{
 const rehearsed=validRehearsalMarks(sheet,marks);
 const validHolds=validEditorialHolds(sheet,holds);
 const perTeamCues=Array.from({length:teams},()=>[] as EveningCue[]);
 for(const cue of sheet.cues){
  if(!first(cue)||cue.teamNumber===null||
   cue.teamNumber<1||cue.teamNumber>teams)continue;
  perTeamCues[cue.teamNumber-1]!.push(cue);
 }
 const turns:RotationTurn[]=[];
 const max=Math.max(...perTeamCues.map(list=>list.length));
 for(let i=0;i<max;i++)for(let team=1;team<=teams;team++){
  const cue=perTeamCues[team-1]![i];
  if(!cue)continue;
  const mark=markForCue(cue);
  turns.push({
   team,game:cue.game,slot:cue.slot,sourceId:cue.sourceId,
   sourceRevision:cue.sourceRevision,cueIndex:cue.index,localIndex:cue.localIndex,
   missing:mark===null,needsReview:cue.needsReview,
   rehearsed:Boolean(mark&&rehearsed.some(m=>sourceMatches(m,mark))),
   onHold:validHolds.find(h=>mark&&sourceMatches(h,mark))?.reason??null,
  });
 }
 const perTeam=Array.from({length:teams},(_,i)=>{
  const own=turns.filter(t=>t.team===i+1);
  return {team:i+1,assigned:own.length,rehearsed:own.filter(t=>t.rehearsed).length,
   missing:own.filter(t=>t.missing).length,held:own.filter(t=>t.onHold).length};
 });
 const quantities=perTeam.map(t=>t.assigned);
 return {teams,turns,perTeam,
  balanced:Math.max(...quantities)-Math.min(...quantities)<=1,
  release:'NO_GO',canPlay:false,canPublish:false};
}
export function nextRotationTurn(rotation:TeamRotation,game:GameType,
 localIndex:number,preferredTeam?:number,includeRehearsed=false):RotationTurn|null{
 if(preferredTeam!==undefined&&(!Number.isInteger(preferredTeam)||
  preferredTeam<1||preferredTeam>rotation.teams))return null;
 const options=rotation.turns.filter(t=>
  (preferredTeam===undefined||t.team===preferredTeam)&&
  (includeRehearsed||!t.rehearsed));
 if(!options.length)return null;
 const current=rotation.turns.findIndex(t=>t.game===game&&t.localIndex===localIndex);
 if(current<0)return options[0]??null;
 for(let i=1;i<=rotation.turns.length;i++){
  const candidate=rotation.turns[(current+i)%rotation.turns.length]!;
  if(options.includes(candidate))return candidate;
 }
 return null;
}
/** A moderator may rehearse incomplete questions but cannot mark empty source slots. */
export function rotationDecisionSummary(rotation:TeamRotation):{
 done:number;assigned:number;pending:number;held:number;missing:number;
 fairnessDelta:number;rightsApproved:false;
}{
 const totals=rotation.perTeam;
 const assigned=totals.reduce((s,t)=>s+t.assigned,0);
 const done=totals.reduce((s,t)=>s+t.rehearsed,0);
 return {done,assigned,pending:assigned-done,
  held:totals.reduce((s,t)=>s+t.held,0),
  missing:totals.reduce((s,t)=>s+t.missing,0),
  fairnessDelta:Math.max(...totals.map(t=>t.assigned))-
   Math.min(...totals.map(t=>t.assigned)),
  rightsApproved:false};
}
