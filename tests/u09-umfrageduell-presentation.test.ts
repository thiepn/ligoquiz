import {describe,expect,it} from 'vitest';
import {draftScorePreview,recordedSurveyProgress} from '../src/features/host/umfrageduell-presentation';
import type {Survey} from '../src/games/umfrageduell/engine';
const popular:Survey={
 id:'s-1',format:'popular',prompt:'Beispiel',
 source:{kind:'illustrative'},
 categories:[
  {label:'Snacks',synonyms:['Knabberei']},{label:'Getränke',synonyms:[]},
  {label:'Musik',synonyms:[]},{label:'Spiele',synonyms:[]},{label:'Karten',synonyms:[]}
 ],
};
const top3:Survey={...popular,id:'s-2',format:'top3'};
describe('U09 truthful read-only draft scoring',()=>{
 it('does not invent points for partial, oversized or invalid drafts',()=>{
  expect(draftScorePreview(popular,{answers:[''],mapped:[null]})).toEqual({status:'empty',points:0});
  expect(draftScorePreview(top3,{answers:['Snacks','','Musik'],mapped:[1,null,3]})).toEqual({status:'incomplete',points:null});
  expect(draftScorePreview(popular,{answers:['a'.repeat(301)],mapped:[1]})).toEqual({status:'incomplete',points:null});
  expect(draftScorePreview(popular,{answers:['Snacks'],mapped:[]})).toEqual({status:'incomplete',points:null});
 });
 it('uses original Top 1 and Top 3 engines, including duplicate-category rules',()=>{
  expect(draftScorePreview(popular,{answers:['Snacks'],mapped:[1]})).toEqual({status:'ready',points:20});
  expect(draftScorePreview(popular,{answers:['Knabberei'],mapped:[5]})).toEqual({status:'ready',points:2});
  expect(draftScorePreview(top3,{answers:['Snacks','Getränke','Musik'],mapped:[1,2,3]}))
   .toEqual({status:'ready',points:30});
  expect(draftScorePreview(top3,{answers:['Snacks','Snacks','Getränke'],mapped:[1,1,2]}))
   .toEqual({status:'ready',points:15});
 });
 it('counts only actual saved team IDs including intentional empty answers',()=>{
  const teams=[{id:'n'},{id:'s'},{id:'w'}];
  expect(recordedSurveyProgress(teams,{n:{answers:[],mapped:[]}})).toEqual({recorded:1,total:3});
  expect(recordedSurveyProgress(teams,{n:{answers:[],mapped:[]},w:{answers:['x'],mapped:[null]}}))
   .toEqual({recorded:2,total:3});
 });
});
