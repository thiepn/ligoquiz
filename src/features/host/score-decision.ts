import type {Session as Rundenquiz} from '../../games/rundenquiz/engine';
import type {Session as Quiztafel} from '../../games/quiztafel/engine';
import type {Session as Verbindungen} from '../../games/verbindungen/engine';
import type {Session as Logikleiter} from '../../games/logikleiter/engine';
import type {Session as Umfrageduell} from '../../games/umfrageduell/engine';
import * as rq from '../../games/rundenquiz/engine';
import * as qt from '../../games/quiztafel/engine';
import * as vb from '../../games/verbindungen/engine';
import * as ll from '../../games/logikleiter/engine';
import * as ud from '../../games/umfrageduell/engine';

export type ScoreSource=
 |{game:'rundenquiz';session:Rundenquiz}
 |{game:'quiztafel';session:Quiztafel}
 |{game:'verbindungen';session:Verbindungen}
 |{game:'logikleiter';session:Logikleiter}
 |{game:'umfrageduell';session:Umfrageduell};
export type ScoreDeltaRow={teamId:string;name:string;before:number;change:number|null;after:number|null};
export type ScoreDecision={
 status:'pending'|'committed'|'incomplete';rows:readonly ScoreDeltaRow[];
 description:string;ready:boolean;revision:number;mode:ScoreSource['game'];
};
type Award={teamId:string;points:number};
type Team={id:string;name:string};
export function composeScoreRows(teams:readonly Team[],current:Readonly<Record<string,number>>,
 awards:readonly Award[]|null,committed:boolean):ScoreDeltaRow[]{
 const allowed=new Set(teams.map(t=>t.id));
 if(Object.keys(current).some(id=>!allowed.has(id)))throw new Error('Unbekannter Teamstand');
 const changes=new Map<string,number>();
 if(awards)for(const award of awards){
  if(!allowed.has(award.teamId)||!Number.isFinite(award.points)||!Number.isInteger(award.points))
   throw new Error('Ungültige Wertung oder unbekanntes Team');
  changes.set(award.teamId,(changes.get(award.teamId)??0)+award.points);
 }
 return teams.map(t=>{
  const value=current[t.id]??0,delta=awards?(changes.get(t.id)??0):null;
  if(!Number.isFinite(value))throw new Error('Ungültiger Punktestand');
  const before=committed&&delta!==null?value-delta:value;
  const after=delta===null?null:committed?value:value+delta;
  return {teamId:t.id,name:t.name,before,change:delta,after};
 });
}
/** Pure host-only preview using the exact engine scoring functions. No commands dispatched. */
export function scoreDecisionFor(source:ScoreSource):ScoreDecision|null{
 let teams:readonly Team[]=[];
 let current:Record<string,number>={};
 let awards:readonly Award[]|null=null;
 let status:ScoreDecision['status']='incomplete';
 let revision=0;
 let description='Fehlende Teamwertungen zuerst erfassen. Noch keine Punkte verbucht.';
 switch(source.game){
  case 'rundenquiz':{
   const s=source.session;
   if(s.phase!=='revealed'&&s.phase!=='graded')return null;
   teams=s.teams;current=rq.scores(s);revision=s.revision;
   if(s.phase==='graded'){
    awards=s.awards.filter(a=>a.questionId===rq.currentQuestion(s)?.id);
    status='committed';
   }else{
    try{awards=rq.taskAwards(s);status='pending';}
    catch{description='Nicht alle Antworten bewertet. Fehlende Wertungen ergänzen.';}
   }
   break;
  }
  case 'quiztafel':{
   const s=source.session;
   if(s.phase!=='revealed'&&s.phase!=='awarded')return null;
   teams=s.teams;current=qt.scores(s);revision=s.revision;
   const tile=qt.selectedTile(s);
   if(!tile)return null;
   if(s.phase==='awarded'){
    const saved=s.outcomes.find(a=>a.tileId===tile.id);
    if(!saved)return null;
    awards=saved.winnerId?[{teamId:saved.winnerId,points:saved.points}]:[];
    status='committed';
   }else if(s.candidate!==null){
    const target=s.candidate==='selector'?qt.selector(s).id:
      s.candidate==='stealer'?qt.eligibleStealer(s).id:null;
    awards=target?[{teamId:target,points:tile.value}]:[];
    status='pending';
   }else description='Erstantwort oder Übernahme bewerten, bevor Punkte bestätigt werden.';
   break;
  }
  case 'verbindungen':{
   const s=source.session;
   if(!['revealed','wall-reveal','graded'].includes(s.phase))return null;
   teams=s.teams;current=vb.scores(s);revision=s.revision;
   const task=vb.active(s);
   if(s.phase==='graded'){
    awards=s.awards.filter(a=>a.puzzleId===task.puzzle.id);
    status='committed';
   }else if(s.phase==='wall-reveal'&&s.revealedGroups<4){
    description='Zuerst alle vier Gruppen veröffentlichen und bewerten.';
   }else{
    try{awards=vb.awardsFor(s);status='pending';}
    catch{description='Teamversuch beziehungsweise Gruppen- und Verbindungswertungen vervollständigen.';}
   }
   break;
  }
  case 'logikleiter':{
   const s=source.session;
   if(s.phase!=='revealed'&&s.phase!=='graded')return null;
   teams=s.teams;current=ll.scores(s);revision=s.revision;
   if(s.phase==='graded'){
    awards=s.awards.filter(a=>a.rungId===ll.currentRung(s).id);
    status='committed';
   }else{
    try{awards=ll.awardsFor(s);status='pending';}
    catch{description='Alle Abgaben sperren und für jedes Team eine Wertung erfassen.';}
   }
   break;
  }
  case 'umfrageduell':{
   const s=source.session;
   if(s.phase!=='revealed'&&s.phase!=='graded')return null;
   teams=s.teams;current=ud.scores(s);revision=s.revision;
   if(s.phase==='graded'){
    awards=s.awards.filter(a=>a.surveyId===ud.currentSurvey(s).id);
    status='committed';
   }else{
    try{awards=ud.awardsFor(s);status='pending';}
    catch{description='Jede Teamantwort mit Zuordnung erfassen; erst danach Punkte bestätigen.';}
   }
   break;
  }
 }
 const rows=composeScoreRows(teams,current,awards,status==='committed');
 return {rows,status,ready:status!=='incomplete',revision,mode:source.game,
  description:status==='pending'?'Vorläufige Berechnung. Erst der vorhandene Bestätigungsbutton bucht die Punkte.':
   status==='committed'?'Diese Wertung ist bereits im Spielstand verbucht. Änderungen nur über den Korrekturweg.':description};
}
