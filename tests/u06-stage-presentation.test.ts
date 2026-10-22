import {describe,expect,it} from 'vitest';
import {publicScoreRows,stagePresentation} from '../src/features/stage/stage-presentation';

describe('U06 public-only stage presentation',()=>{
 it('never labels an unpublished prompt as a reveal',()=>{
  expect(stagePresentation({kind:'question',heading:'Wissen',publicPrompt:'Frage',visibleClues:[]},'live'))
   .toMatchObject({phase:'question',tone:'question',label:'FRAGE IM SPIEL'});
  expect(stagePresentation({kind:'answer',heading:'Wissen',publicPrompt:'Frage',publishedSolution:'Freigegeben'},'live'))
   .toMatchObject({phase:'reveal',tone:'reveal'});
  expect(stagePresentation({kind:'ll-ladder',heading:'Logikleiter',step:1,total:3,points:10,prompt:'Frage',hint:null},'live').phase)
   .toBe('question');
  expect(stagePresentation({kind:'qt-board',heading:'Quiztafel',categories:[],rows:3,cells:[],selectorName:'Nord',turn:0,total:9},'live').phase)
   .toBe('board');
 });
 it('blanks stale/conflicting status and never invents verified connected state',()=>{
  expect(stagePresentation(null,'stale')).toMatchObject({phase:'withheld',label:'VERBINDUNG UNTERBROCHEN'});
  expect(stagePresentation(null,'conflict').phase).toBe('withheld');
  expect(stagePresentation(null,'connecting').label).toBe('BÜHNE BEREIT');
  expect(stagePresentation({kind:'paused',heading:'Pause'},'live').phase).toBe('paused');
 });
 it('keeps original public scores including negative values and ties',()=>{
  expect(publicScoreRows([{name:'Nord',value:20},{name:'Mitte',value:20},{name:'Süd',value:-5}]))
   .toEqual([
     {name:'Nord',points:20,rank:1,leading:true,share:100},
     {name:'Mitte',points:20,rank:1,leading:true,share:100},
     {name:'Süd',points:-5,rank:3,leading:false,share:0},
   ]);
  expect(publicScoreRows([{name:'Nord',value:0}])[0]).toMatchObject({rank:1,leading:false,share:0});
 });
});
