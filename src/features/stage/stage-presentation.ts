import type {PublicStageScene} from '../../domain/projection/public-stage';
import type {ViewerStatus} from './stage-viewer';

/**
 * Visual hints are derived exclusively from public scene kinds. Never read the
 * event aggregate, frozen task, host identity, or unpublished game answers.
 */
export type StagePresentation={
 readonly tone:'ready'|'question'|'reveal'|'score'|'board'|'paused';
 readonly phase:'withheld'|'waiting'|'question'|'reveal'|'scores'|'board'|'paused';
 readonly label:string;
};
export function stagePresentation(scene:PublicStageScene|null,status:ViewerStatus):StagePresentation{
 if(!scene)return status==='stale'||status==='conflict'
   ?{tone:'paused',phase:'withheld',label:'VERBINDUNG UNTERBROCHEN'}
   :{tone:'ready',phase:'withheld',label:'BÜHNE BEREIT'};
 switch(scene.kind){
  case 'waiting':return {tone:'ready',phase:'waiting',label:'BÜHNE BEREIT'};
  case 'paused':return {tone:'paused',phase:'paused',label:'KURZE UNTERBRECHUNG'};
  case 'scores':return {tone:'score',phase:'scores',
   label:scene.heading.toLocaleLowerCase('de-DE').includes('endstand')?'ENDSTAND':'ZWISCHENSTAND'};
  case 'qt-board':return {tone:'board',phase:'board',label:'FELDER WÄHLEN'};
  case 'vb-wall':return {tone:'board',phase:'board',label:'VERBINDUNGSWAND'};
  case 'answer':case 'qt-answer':case 'll-answer':case 'ud-reveal':
   return {tone:'reveal',phase:'reveal',label:'AUFLÖSUNG'};
  default:return {tone:'question',phase:'question',label:'FRAGE IM SPIEL'};
 }
}

/** Only show scores already included in the public DTO. No private ledger access. */
export function publicScoreRows(visibleScores:readonly {name:string;value:number}[]){
 const maximum=Math.max(0,...visibleScores.map(team=>team.value));
 return visibleScores.map(team=>({
   name:team.name,
   points:team.value,
   rank:1+visibleScores.filter(other=>other.value>team.value).length,
   leading:maximum>0&&team.value===maximum,
   share:maximum>0?Math.max(0,Math.min(100,team.value/maximum*100)):0,
 }));
}
