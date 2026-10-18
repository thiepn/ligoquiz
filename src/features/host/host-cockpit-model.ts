import type {EventRecord} from '../../domain/event/schemas';
import type {GameType} from '../../domain/game/contracts';
import type {TeamTone} from '../../design-system/theme';
import {describeHostStep} from './HostModerationGuide';
import {scores as rundenquizScores} from '../../games/rundenquiz/engine';
import {scores as quiztafelScores} from '../../games/quiztafel/engine';
import {scores as verbindungenScores} from '../../games/verbindungen/engine';
import {scores as logikleiterScores} from '../../games/logikleiter/engine';
import {scores as umfrageduellScores} from '../../games/umfrageduell/engine';

const TONES:readonly TeamTone[]=['blue','pink','mint','violet','orange'];
export type CockpitTeam={id:string;name:string;points:number;tone:TeamTone;leading:boolean};
export type CockpitReadout={
 game:GameType;phase:string;step:string;next:string;visibility:string;
 progressLabel:string;completed:number;total:number;paused:boolean;
 recovery:boolean;finished:boolean;teams:CockpitTeam[];
};
/** Nonauthoritative readout from the validated original event. Never reads frozenTasks. */
export function describeCockpit(event:EventRecord):CockpitReadout|null{
 let game:GameType,phase:string,paused:boolean,completed:number,total:number,progressLabel:string;
 let scoreMap:Record<string,number>;
 if(event.umfrageduell){
  const s=event.umfrageduell;
  game='umfrageduell';phase=s.phase;paused=s.paused;
  completed=s.phase==='complete'?s.surveys.length:s.index;
  total=s.surveys.length;progressLabel='Umfragen abgeschlossen';scoreMap=umfrageduellScores(s);
 }else if(event.logikleiter){
  const s=event.logikleiter;
  game='logikleiter';phase=s.phase;paused=s.paused;
  completed=s.phase==='complete'?s.rungs.length:s.index;
  total=s.rungs.length;progressLabel='Stufen abgeschlossen';scoreMap=logikleiterScores(s);
 }else if(event.verbindungen){
  const s=event.verbindungen;
  game='verbindungen';phase=s.phase;paused=s.paused;
  completed=s.phase==='complete'?s.assignments.length:s.index;
  total=s.assignments.length;progressLabel='Aufgaben abgeschlossen';scoreMap=verbindungenScores(s);
 }else if(event.quiztafel){
  const s=event.quiztafel;
  game='quiztafel';phase=s.phase;paused=s.paused;
  completed=s.phase==='complete'?s.tiles.length:s.usedTileIds.length;
  total=s.tiles.length;progressLabel='Felder gespielt';scoreMap=quiztafelScores(s);
 }else if(event.rundenquiz){
  const s=event.rundenquiz;
  game='rundenquiz';phase=s.phase;paused=s.paused;
  completed=s.phase==='complete'?s.questions.length:s.index;
  total=s.questions.length;progressLabel='Aufgaben abgeschlossen';scoreMap=rundenquizScores(s);
 }else return null;
 const guide=describeHostStep({game,phase,paused,recovery:event.recoveryRequired,
  completed,total,viewers:0,ready:true,busy:false});
 const high=Math.max(0,...event.teams.map(t=>scoreMap[t.id]??0));
 return {game,phase,paused,recovery:event.recoveryRequired,
  finished:phase==='complete',step:guide.step,next:guide.next,visibility:guide.visibility,
  completed:Math.max(0,Math.min(total,completed)),total,progressLabel,
  teams:[...event.teams].sort((a,b)=>a.order-b.order).map(t=>{
   const points=scoreMap[t.id]??0;
   return {id:t.id,name:t.name,points,tone:TONES[t.order%TONES.length]??'blue',
    leading:high>0&&points===high};
  }),
 };
}
