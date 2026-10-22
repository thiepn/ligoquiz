import {describe,expect,it} from 'vitest';
import {StageViewer,type ViewerState} from '../src/features/stage/stage-viewer';
import type {StagePort,StageMessage} from '../src/features/stage/protocol';
import type {PublicStageDto,PublicStageScene} from '../src/domain/projection/public-stage';
import {
 audienceRound,playalongUrl,playalongEventIdFromHash,retainedGuess,freshGuess,
} from '../src/features/stage/audience-playalong-model';

const EVENT='u14-event-123';
const frame=(scene:PublicStageScene,stageRevision=1,hostEpoch=1):PublicStageDto=>({
 protocolVersion:1,eventId:EVENT,gameId:'u14-game-1',hostEpoch,stageRevision,scene,
});
const live=(f:PublicStageDto):ViewerState=>({status:'live',frame:f,lastReceivedAt:1});

describe('U14 only published public-stage play-along',()=>{
 it('preserves canonical stage route and rejects forged or malformed spectator links',()=>{
  expect(playalongUrl(EVENT)).toBe('#/mitspielen?event='+EVENT);
  expect(playalongEventIdFromHash(playalongUrl(EVENT))).toBe(EVENT);
  for(const hash of ['#/mitspielen?event=../secret','#/mitspielen?event=',
   '#/stage?event='+EVENT,'#/mitspielen?event=abcd','#/spielen?event='+EVENT]){
   expect(playalongEventIdFromHash(hash)).toBeNull();
  }
  expect(()=>playalongUrl('../bad')).toThrow();
 });
 it('keeps Rundenquiz published clues and answer paired across original heading changes',()=>{
  const question=audienceRound({kind:'question',heading:'Hinweise · 4/7',
   publicPrompt:'Wer ist gesucht?',visibleClues:['Erster Hinweis']});
  const f=frame({kind:'question',heading:'Hinweise · 4/7',publicPrompt:'Wer ist gesucht?',visibleClues:['Erster Hinweis']});
  const note={...freshGuess(f,question,'Mein Tipp'),locked:true};
  const later=live(frame({kind:'question',heading:'Hinweise · 4/7',
   publicPrompt:'Wer ist gesucht?',visibleClues:['Erster Hinweis','Zweiter Hinweis']},2));
  expect(retainedGuess(note,later)).toEqual(note);
  const answer=frame({kind:'answer',heading:'Hinweise',
   publicPrompt:'Wer ist gesucht?',publishedSolution:'Offizielle Lösung'},3);
  expect(audienceRound(answer.scene,note.key).key).toBe(note.key);
  expect(audienceRound(answer.scene,note.key).published).toEqual(['Offizielle Lösung']);
  expect(retainedGuess(note,live(answer))).toEqual(note);
  expect(retainedGuess({...note,locked:false},live(answer))).toBeNull();
 });
 it('follows Quiztafel reply/steal transitions without exposing unpublished correct answers',()=>{
  const question={kind:'qt-question' as const,heading:'Quiztafel · Bibel / 100',
   category:'Bibel',points:100,publicPrompt:'Wer baute die Arche?',
   selectorName:'Nord',respondingName:'Nord',steal:false};
  const start=audienceRound(question);
  expect(start.published).toEqual([]);
  const note={...freshGuess(frame(question),start,'Noah'),locked:true};
  const steal=audienceRound({...question,respondingName:'Mitte',steal:true});
  expect(steal.key).toBe(start.key);
  expect(steal.details).toContain('Übernahme: Mitte');
  const revealed=frame({kind:'qt-answer',heading:question.heading,category:'Bibel',points:100,
   publicPrompt:question.publicPrompt,publishedSolution:'Noah'},3);
  expect(retainedGuess(note,live(revealed))).toEqual(note);
  expect(audienceRound(revealed.scene).published).toEqual(['Noah']);
 });
 it('pairs Logikleiter hints and Umfrageduell illustrative reveal by public step and prompt',()=>{
  const ladder={kind:'ll-ladder' as const,heading:'Logikleiter',step:1,total:3,
   points:10,prompt:'Alle Rosen?',hint:null};
  const initial=audienceRound(ladder);
  const note={...freshGuess(frame(ladder),initial,'Vielleicht'),locked:true};
  expect(retainedGuess(note,live(frame({...ladder,hint:'Ein Hinweis'},2)))).toEqual(note);
  const answer=frame({kind:'ll-answer',heading:'Logikleiter · Auflösung',step:1,total:3,
   points:10,prompt:ladder.prompt,answer:'Nein',explanation:'Begründung'},3);
  expect(retainedGuess(note,live(answer))).toEqual(note);
  const prompt={kind:'ud-prompt' as const,heading:'Umfrageduell',step:1,total:4,
   format:'popular' as const,prompt:'Was bringt man mit?',provenance:'BEISPIELDATEN',
   sourceContext:null};
  const survey=audienceRound(prompt);
  expect(survey.details).toContain('BEISPIELDATEN');
  expect(survey.published).toEqual([]);
  const reveal=audienceRound({...prompt,kind:'ud-reveal',categories:['A','B','C','D','E']});
  expect(reveal.key).toBe(survey.key);
  expect(reveal.published).toEqual(['A','B','C','D','E']);
 });
 it('retains Verbindungen clue/sequence/wall guesses without inventing source identities',()=>{
  const clue=audienceRound({kind:'question',heading:'Vier Hinweise · Nord',
   publicPrompt:'Welche Person oder Verbindung ist gesucht?',visibleClues:['Geburtsort']});
  const more=audienceRound({kind:'question',heading:'Vier Hinweise · Nord',
   publicPrompt:'Welche Person oder Verbindung ist gesucht?',visibleClues:['Geburtsort','Instrument']});
  expect(more.key).toBe(clue.key);
  expect(audienceRound({kind:'answer',heading:'Verbindungen · Auflösung',
   publicPrompt:'Vier Hinweise',publishedSolution:'David'},clue.key).key).toBe(clue.key);
  const seq=audienceRound({kind:'vb-sequence',heading:'Folge ergänzen',activeTeam:'Nord',
   prompt:'Zahlenfolge',items:['1','2','3']});
  expect(audienceRound({kind:'answer',heading:'Verbindungen · Auflösung',
   publicPrompt:'Folge ergänzen',publishedSolution:'4'},seq.key).key).toBe(seq.key);
  const tiles=Array.from({length:16},(_,i)=>({id:'id-'+i,label:'Wort-'+i}));
  const wall=audienceRound({kind:'vb-wall',heading:'Verbindungswand',tiles,revealed:[]});
  const group={id:'g1',tileIds:['id-0','id-1','id-2','id-3'],link:'Gruppe 1'};
  const partial=audienceRound({kind:'vb-wall',heading:'Verbindungswand',tiles,revealed:[group]});
  expect(partial.key).toBe(wall.key);
  expect(partial.kind).toBe('question');
  expect(partial.published).toEqual(['Gruppe 1']);
  const all=audienceRound({kind:'vb-wall',heading:'Verbindungswand',tiles,revealed:[group,group,group,group]});
  expect(all.kind).toBe('reveal');
 });
 it('drops private guesses on another task, a pause, score display, host takeover or lost connection',()=>{
  const scene={kind:'question' as const,heading:'Wissen',publicPrompt:'Frage A',visibleClues:[]};
  const f=frame(scene);
  const guess={...freshGuess(f,audienceRound(scene),'privater Text'),locked:true};
  expect(retainedGuess(guess,live(frame({...scene,publicPrompt:'Frage B'},2)))).toBeNull();
  expect(retainedGuess(guess,live(frame({kind:'paused',heading:'Pause'},2)))).toBeNull();
  expect(retainedGuess(guess,live(frame({kind:'scores',heading:'Zwischenstand',visibleScores:[]},2)))).toBeNull();
  expect(retainedGuess(guess,live(frame(scene,2,2)))).toBeNull();
  expect(retainedGuess(guess,{status:'stale',frame:null,lastReceivedAt:null})).toBeNull();
  expect(retainedGuess(guess,{status:'conflict',frame:null,lastReceivedAt:null})).toBeNull();
  expect(retainedGuess(guess,live({...f,eventId:'other-event'}))).toBeNull();
  expect(retainedGuess(guess,live({...f,gameId:'other-game'}))).toBeNull();
  expect(()=>freshGuess(f,audienceRound({kind:'waiting',heading:'Warte'}),'fake')).toThrow();
 });
});

class TestPort implements StagePort{
 sent:StageMessage[]=[];
 handler:((value:unknown)=>void)|null=null;
 send(m:StageMessage){this.sent.push(m);}
 subscribe(cb:(value:unknown)=>void){this.handler=cb;return()=>{this.handler=null;};}
 close(){}
 deliver(v:unknown){this.handler?.(v);}
}
describe('U14 projector acknowledgement isolation',()=>{
 it('receives strict public messages but does not claim to be a confirmed projector',()=>{
  const port=new TestPort();
  const viewer=new StageViewer(EVENT,port,()=>undefined,{acknowledgeFrames:false,makeId:()=> 'u14-peer'});
  viewer.start();
  expect(port.sent.map(s=>s.kind)).toEqual(['HELLO']);
  const f=frame({kind:'question',heading:'Wissen',publicPrompt:'Frage',visibleClues:[]});
  port.deliver({protocolVersion:1,kind:'FRAME',eventId:EVENT,frame:f});
  expect(viewer.state.frame?.scene.kind).toBe('question');
  expect(port.sent.map(s=>s.kind)).toEqual(['HELLO']);
  port.deliver({protocolVersion:1,kind:'FRAME',eventId:EVENT,frame:f});
  expect(port.sent.map(s=>s.kind)).toEqual(['HELLO']);
  port.deliver({protocolVersion:1,kind:'FRAME',eventId:EVENT,
    frame:{...f,scene:{kind:'question',heading:'Wissen',publicPrompt:'Fremd',visibleClues:[]}}});
  expect(viewer.state.status).toBe('conflict');
  expect(viewer.state.frame).toBeNull();
  viewer.stop();
 });
});
