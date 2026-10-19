import * as QT from '../../games/quiztafel/engine';
import * as VB from '../../games/verbindungen/engine';
import * as LL from '../../games/logikleiter/engine';
import * as UD from '../../games/umfrageduell/engine';
import {sampleQuiztafel} from '../../games/quiztafel/trial-bank';
import {trialVerbindungen} from '../../games/verbindungen/trial-bank';
import {trialLogikleiter} from '../../games/logikleiter/trial-bank';
import {trialUmfrageduell} from '../../games/umfrageduell/trial-bank';

export type TryoutGame='quiztafel'|'verbindungen'|'logikleiter'|'umfrageduell';
export type TryoutState=
 |{game:'quiztafel';data:QT.Session}
 |{game:'verbindungen';data:VB.Session}
 |{game:'logikleiter';data:LL.Session}
 |{game:'umfrageduell';data:UD.Session};
export type TryoutCommand=
 |{game:'quiztafel';action:QT.Action}
 |{game:'verbindungen';action:VB.Action}
 |{game:'logikleiter';action:LL.Action}
 |{game:'umfrageduell';action:UD.Action};

export const TRYOUT_TEAMS=[
 {id:'trial-nord',name:'Nord',order:0},
 {id:'trial-mitte',name:'Mitte',order:1},
 {id:'trial-sued',name:'Süd',order:2},
] as const;
const HOST='u13-local-only';
const ID='u13-disposable-';

export function createTryout(game:TryoutGame):TryoutState{
 const common={id:ID+game,ownerId:HOST,profile:'kurz' as const,teams:TRYOUT_TEAMS};
 switch(game){
  case 'quiztafel':return {game,data:QT.createSession({...common,...sampleQuiztafel('kurz',TRYOUT_TEAMS)})};
  case 'verbindungen':return {game,data:VB.createSession({...common,puzzles:trialVerbindungen('kurz',TRYOUT_TEAMS)})};
  case 'logikleiter':return {game,data:LL.createSession({...common,rungs:trialLogikleiter('kurz')})};
  case 'umfrageduell':return {game,data:UD.createSession({...common,surveys:trialUmfrageduell('kurz')})};
 }
}

/** Only the already installed authoritative state machines can advance this in-memory practice. */
export function stepTryout(state:TryoutState,command:TryoutCommand):TryoutState{
 if(command.game!==state.game)throw new Error('Spielmodus passt nicht zum Übungsstand.');
 const s=state.data;
 const metadata={id:ID+state.game+'-'+(s.revision+1),
  ownerId:s.ownerId,epoch:s.epoch,expectedRevision:s.revision,at:s.revision+1};
 if(state.game==='quiztafel'&&command.game==='quiztafel')
  return {game:state.game,data:QT.transition(s,{...metadata,action:command.action})};
 if(state.game==='verbindungen'&&command.game==='verbindungen')
  return {game:state.game,data:VB.transition(s,{...metadata,action:command.action})};
 if(state.game==='logikleiter'&&command.game==='logikleiter')
  return {game:state.game,data:LL.transition(s,{...metadata,action:command.action})};
 if(state.game==='umfrageduell'&&command.game==='umfrageduell')
  return {game:state.game,data:UD.transition(s,{...metadata,action:command.action})};
 throw new Error('Unbekannter Übungsmodus.');
}

export type PublicPracticePreview={heading:string;lines:string[];released:boolean};

/** Render only each original engine's PUBLIC projection, never a raw private task. */
export function publicTryout(state:TryoutState):PublicPracticePreview{
 if(state.game==='quiztafel'){
  const p=QT.publicScene(state.data);
  switch(p.kind){
   case 'waiting':case 'paused':return {heading:'Warte auf die Spielleitung',lines:[],released:false};
   case 'board':return {heading:'Quiztafel',lines:p.categories.map(c=>c.name),released:false};
   case 'question':return {heading:p.category,lines:[p.prompt],released:false};
   case 'answer':return {heading:p.category,lines:[p.prompt,p.answer],released:true};
   case 'results':return {heading:'Endstand',lines:p.teams.map(t=>t.name+': '+t.points),released:true};
  }
 }
 if(state.game==='verbindungen'){
  const p=VB.publicScene(state.data);
  switch(p.kind){
   case 'waiting':case 'paused':return {heading:'Warte auf die Spielleitung',lines:[],released:false};
   case 'clues':return {heading:'Vier Hinweise',lines:[...p.clues],released:false};
   case 'sequence':return {heading:p.prompt,lines:[...p.items],released:false};
   case 'wall':return {heading:'Verbindungswand',lines:p.tiles.map(t=>t.label),released:p.revealed.length>0};
   case 'answer':return {heading:p.prompt,lines:[p.answer],released:true};
   case 'scores':return {heading:p.final?'Endstand':'Zwischenstand',lines:p.teams.map(t=>t.name+': '+t.points),released:true};
  }
 }
 if(state.game==='logikleiter'){
  const p=LL.publicScene(state.data);
  switch(p.kind){
   case 'waiting':case 'paused':return {heading:'Warte auf die Spielleitung',lines:[],released:false};
   case 'ladder':return {heading:'Stufe '+p.step,lines:[p.prompt,...(p.hint?[p.hint]:[])],released:false};
   case 'answer':return {heading:'Auflösung',lines:[p.prompt,p.answer,p.explanation],released:true};
   case 'scores':return {heading:p.final?'Endstand':'Zwischenstand',lines:p.teams.map(t=>t.name+': '+t.points),released:true};
  }
 }
 const p=UD.publicScene(state.data);
 switch(p.kind){
  case 'waiting':case 'paused':return {heading:'Warte auf die Spielleitung',lines:[],released:false};
  case 'prompt':return {heading:'Beispieldaten · '+p.format,lines:[p.prompt],released:false};
  case 'reveal':return {heading:'Beispieldaten · Auflösung',lines:[p.prompt,...p.categories],released:true};
  case 'scores':return {heading:p.final?'Endstand':'Zwischenstand',lines:p.teams.map(t=>t.name+': '+t.points),released:true};
 }
}

export function tryoutScores(state:TryoutState):Record<string,number>{
 switch(state.game){
  case 'quiztafel':return QT.scores(state.data);
  case 'verbindungen':return VB.scores(state.data);
  case 'logikleiter':return LL.scores(state.data);
  case 'umfrageduell':return UD.scores(state.data);
 }
}

export function privateTryout(state:TryoutState):{prompt:string;answer:string;reference:string}{
 if(state.game==='quiztafel'){
  const tile=QT.selectedTile(state.data);
  return {prompt:tile?.prompt??'Feld auswählen',answer:tile?.answer??'—',reference:tile?.reference??'Ungeprüfte Probe'};
 }
 if(state.game==='verbindungen'){
  const {puzzle}=VB.active(state.data);
  return {prompt:puzzle.kind==='clues'?'Vier Hinweise':puzzle.kind==='sequence'?puzzle.prompt:'Verbindungswand',
   answer:puzzle.kind==='clues'?puzzle.target:puzzle.kind==='sequence'?puzzle.answer:puzzle.groups.map(g=>g.link).join(' · '),
   reference:puzzle.reference};
 }
 if(state.game==='logikleiter'){
  const task=state.data.rungs[state.data.index];
  return {prompt:task?.prompt??'Abgeschlossen',answer:task?.answer??'—',reference:task?.reference??'Ungeprüfte Probe'};
 }
 const task=state.data.surveys[state.data.index];
 return {prompt:task?.prompt??'Abgeschlossen',answer:task?.categories.map(c=>c.label).join(' · ')??'—',
  reference:'Erfundene Beispieldaten – keine echte Umfrage'};
}
