import {describe,expect,it} from 'vitest';
import type {PublicStageDto,PublicStageScene} from '../src/domain/projection/public-stage';
import type {ViewerState} from '../src/features/stage/stage-viewer';
import {audienceRound,freshGuess,retainedGuess} from '../src/features/stage/audience-playalong-model';
import {chooseReflection,revealedComparison,retainedReflection} from '../src/features/stage/audience-reflection-model';

const f=(scene:PublicStageScene,hostEpoch=1,eventId='u21-event',gameId='game-1'):PublicStageDto=>({
 protocolVersion:1,stageRevision:1,eventId,gameId,hostEpoch,scene,
});
const live=(frame:PublicStageDto):ViewerState=>({status:'live',frame,lastReceivedAt:1});
const question={kind:'question' as const,heading:'Wissen',publicPrompt:'Welches Metall?',visibleClues:[]};
const answer={kind:'answer' as const,heading:'Wissen',publicPrompt:question.publicPrompt,publishedSolution:'Gold'};
const locked=(text:string)=>({...freshGuess(f(question),audienceRound(question),text),locked:true});
describe('U21 genuine public reveal / private user self-assessment',()=>{
 it('cannot create comparisons before public answer or without an original locked note',()=>{
  const note=locked('Gold');
  expect(revealedComparison(live(f(question)),note,null)).toBeNull();
  expect(revealedComparison(live(f(answer)),null,null)).toBeNull();
  expect(revealedComparison(live(f(answer)),{...note,locked:false},null)).toBeNull();
  expect(()=>chooseReflection(live(f(question)),note,'matched')).toThrow();
  expect(()=>chooseReflection(live(f(answer)),null,'partial')).toThrow();
  expect(()=>chooseReflection(live(f(answer)),note,'invalid' as 'matched')).toThrow();
 });
 it('only the spectator manually judges after public reveal, never assigns game scores',()=>{
  const note=locked('I think it was iron');
  const publicAnswer=live(f(answer));
  const first=revealedComparison(publicAnswer,note,null);
  expect(first).toEqual({guess:'I think it was iron',published:['Gold'],reflection:null});
  for(const choice of ['matched','partial','different'] as const){
   const reflection=chooseReflection(publicAnswer,note,choice);
   expect(reflection.choice).toBe(choice);
   expect(revealedComparison(publicAnswer,note,reflection)?.reflection).toEqual(reflection);
   expect(reflection).not.toHaveProperty('points');
   expect(reflection).not.toHaveProperty('judgement');
   expect(reflection).not.toHaveProperty('score');
  }
 });
 it('retains manual reflection across matching public scene revisions but erases it on next task and pause',()=>{
  const note=locked('Gold'),saved=chooseReflection(live(f(answer)),note,'partial');
  expect(retainedReflection(saved,live(f(answer)),note)).toEqual(saved);
  expect(retainedReflection(saved,live(f({...answer,publishedSolution:'Gold'})),note)).toEqual(saved);
  expect(retainedReflection(saved,live(f({...question,publicPrompt:'Andere Frage'})),note)).toBeNull();
  expect(retainedReflection(saved,live(f(question)),note)).toBeNull();
  expect(retainedReflection(saved,live(f({kind:'paused',heading:'Pause'})),note)).toBeNull();
  expect(retainedReflection(saved,live(f({kind:'scores',heading:'Wertung',visibleScores:[]})),note)).toBeNull();
 });
 it('fails closed on host takeover, different game/event, stale view and unlocked original note',()=>{
  const note=locked('Gold'),saved=chooseReflection(live(f(answer)),note,'matched');
  expect(retainedReflection(saved,live(f(answer,2)),note)).toBeNull();
  expect(retainedReflection(saved,live(f(answer,1,'other')),note)).toBeNull();
  expect(retainedReflection(saved,live(f(answer,1,'u21-event','other')),note)).toBeNull();
  expect(retainedReflection(saved,{status:'stale',frame:null,lastReceivedAt:null},note)).toBeNull();
  expect(retainedReflection(saved,{status:'conflict',frame:null,lastReceivedAt:null},note)).toBeNull();
  expect(retainedReflection(saved,live(f(answer)),{...note,locked:false})).toBeNull();
  expect(retainedGuess(note,live(f(answer,2)))).toBeNull();
 });
 it('supports all five original game revelations without private task access',()=>{
  const scenarios:[PublicStageScene,PublicStageScene,string[]][]=[
   [question,answer,['Gold']],
   [{kind:'qt-question',heading:'Quiztafel',category:'Bibel',points:100,publicPrompt:'Wer?',
    selectorName:'Nord',respondingName:'Nord',steal:false},
    {kind:'qt-answer',heading:'Quiztafel',category:'Bibel',points:100,
     publicPrompt:'Wer?',publishedSolution:'Noah'},['Noah']],
   [{kind:'ll-ladder',heading:'Logikleiter',step:1,total:3,points:10,prompt:'Logik?',hint:null},
    {kind:'ll-answer',heading:'Logikleiter',step:1,total:3,points:10,prompt:'Logik?',
     answer:'Keine',explanation:'Keine zwingende Konsequenz'},['Keine','Keine zwingende Konsequenz']],
   [{kind:'vb-sequence',heading:'Folge',activeTeam:'Nord',prompt:'1,2,3',items:['1','2','3']},
    {kind:'answer',heading:'Verbindungen · Auflösung',publicPrompt:'Folge ergänzen',
     publishedSolution:'4'},['4']],
   [{kind:'ud-prompt',heading:'Umfrageduell',format:'top3',step:1,total:4,prompt:'Was?',
    provenance:'BEISPIELDATEN',sourceContext:null},
    {kind:'ud-reveal',heading:'Umfrageduell',format:'top3',step:1,total:4,prompt:'Was?',
     categories:['A','B','C','D','E'],provenance:'BEISPIELDATEN',sourceContext:null},
    ['A','B','C','D','E']],
  ];
  for(const [before,after,publicAnswers] of scenarios){
   const view=live(f(before));const note={...freshGuess(view.frame!,audienceRound(before),'Mein eigener Tipp'),locked:true};
   const exposed=revealedComparison(live(f(after)),note,null);
   expect(exposed?.published).toEqual(publicAnswers);
   expect(exposed?.guess).toBe('Mein eigener Tipp');
   expect(exposed?.reflection).toBeNull();
  }
 });
 it('does not infer right/wrong from matching text, survey categories, or multiple wall groups',()=>{
  const note=locked('Gold');
  const result=revealedComparison(live(f(answer)),note,null);
  expect(result?.reflection).toBeNull();
  const wall={kind:'vb-wall' as const,heading:'Verbindungswand',
   tiles:Array.from({length:16},(_,i)=>({id:'tile'+i,label:'Wort'+i})),
   revealed:Array.from({length:4},(_,i)=>({id:'group'+i,tileIds:['a','b','c','d'],link:'Link'+i}))};
  const before={...wall,revealed:[]};
  const wallNote={...freshGuess(f(before),audienceRound(before),'Meine Gruppen'),locked:true};
  expect(revealedComparison(live(f(wall)),wallNote,null)?.published).toEqual(['Link0','Link1','Link2','Link3']);
  expect(revealedComparison(live(f(wall)),wallNote,null)?.reflection).toBeNull();
 });
});
