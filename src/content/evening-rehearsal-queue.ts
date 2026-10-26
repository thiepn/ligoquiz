import type {ContentItem} from './contracts';
import {GAME_TYPES,type GameType,type GameProfile} from '../domain/game/contracts';
import {composeContentPack,type PreparationProblem} from './pack-preparation';
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
