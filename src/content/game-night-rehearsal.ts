import type {ContentItem} from './contracts';
import type {GameType} from '../domain/game/contracts';
import {describeHostStep} from '../features/host/HostModerationGuide';
import type {PreparationPlan,PreparationProblem} from './pack-preparation';

export type RehearsalStep={
 index:number;slot:string;slotLabel:string;sourceId:string|null;
 phase:string;hostStep:string;hostNext:string;scoreState:string;
 stageState:'waiting'|'prompt'|'concealed'|'revealed'|'scores';
 teamNumber:number|null;issues:readonly PreparationProblem[];
};
export type Rehearsal={
 game:GameType;profile:PreparationPlan['profile'];teams:PreparationPlan['teams'];
 steps:RehearsalStep[];taskCount:number;missingCount:number;conflictedCount:number;
 teamTurns:readonly number[];balancedTeamExposure:boolean;
 canStartLiveGame:false;publicAnswersIncluded:false;release:'NO_GO';
};
function phases(game:GameType,slot:string):readonly string[]{
 if(game==='rundenquiz')return ['ready','open','closed','revealed','graded'];
 if(game==='quiztafel')return ['prepared','question','adjudicated','revealed','awarded'];
 if(game==='verbindungen'){
  if(slot.startsWith('wall:'))return ['ready','wall-open','wall-closed','wall-reveal','graded'];
  if(slot.startsWith('sequence:'))return ['ready','sequence-open','revealed','graded'];
  return ['ready','clue-open','revealed','graded'];
 }
 if(game==='logikleiter')return ['ready','open','closed','revealed','graded'];
 return ['ready','open','closed','revealed','graded'];
}
function projection(phase:string):RehearsalStep['stageState']{
 if(['ready','prepared'].includes(phase))return 'waiting';
 if(['open','question','clue-open','sequence-open','wall-open'].includes(phase))return 'prompt';
 if(['closed','adjudicated','wall-closed'].includes(phase))return 'concealed';
 if(['graded','awarded'].includes(phase))return 'scores';
 return 'revealed';
}
export function buildEditorialRehearsal(plan:PreparationPlan,items:readonly ContentItem[]):Rehearsal{
 const known=new Map(items.map(item=>[item.id,item]));
 const slots=plan.slots.filter(s=>!s.key.startsWith('category:'));
 const steps:RehearsalStep[]=[];
 const teamTurns=Array.from({length:plan.teams},()=>0);
 let index=0,missingCount=0,conflictedCount=0;
 for(const slot of slots){
  const item=slot.selected?known.get(slot.selected):undefined;
  const issues=plan.problems.filter(problem=>
   (slot.selected?problem.itemIds.includes(slot.selected):problem.code==='MISSING'&&problem.message.includes(slot.label)));
  if(!item||item.status==='quarantined')missingCount++;
  if(issues.length)conflictedCount++;
  const team=/(?:Team )([3-5]|[12])(?:\b|$)/u.exec(slot.label);
  const teamNumber=team?Number(team[1]):null;
  if(plan.game==='quiztafel'||plan.game==='verbindungen'){
   if(teamNumber&&teamTurns[teamNumber-1]!==undefined)teamTurns[teamNumber-1]!++;
   else if(slot.key.startsWith('wall:'))teamTurns.forEach((_,i)=>{teamTurns[i]!++;});
  }else teamTurns.forEach((_,i)=>{teamTurns[i]!++;});
  for(const phase of phases(plan.game,slot.key)){
   const desc=describeHostStep({
    game:plan.game,phase,paused:false,recovery:false,
    completed:0,total:slots.length,viewers:0,ready:true,busy:false,
   });
   steps.push({index:index++,slot:slot.key,slotLabel:slot.label,
    sourceId:item?.id??null,phase,hostStep:desc.step,hostNext:desc.next,
    scoreState:desc.scoring,stageState:projection(phase),teamNumber,issues});
  }
 }
 return {game:plan.game,profile:plan.profile,teams:plan.teams,steps,
  taskCount:slots.length,missingCount,conflictedCount,teamTurns,
  balancedTeamExposure:Math.max(...teamTurns)-Math.min(...teamTurns)===0,
  canStartLiveGame:false,publicAnswersIncluded:false,release:'NO_GO'};
}
/** Source references on the moderator side only. Stage gets no payload, clue or solution. */
export function projectedRehearsalFrame(step:RehearsalStep|null):{
 stage:string;publicPromptPresent:false;privateAnswerPresent:false;sourceIdPresent:false;
}{
 const names={waiting:'Warteschirm',prompt:'Aufgabe läuft',concealed:'Antworten geschlossen',
  revealed:'Auflösung freigegeben',scores:'Punkte bestätigt'};
 return {stage:step?names[step.stageState]:'Keine Aufgabe',
  publicPromptPresent:false,privateAnswerPresent:false,sourceIdPresent:false};
}
