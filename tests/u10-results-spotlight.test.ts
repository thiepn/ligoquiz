import {describe,it,expect} from 'vitest';
import {rankedFinishedTeams} from '../src/features/experience/results-spotlight-model';
describe('U10 canonical completed-report rankings',()=>{
 const t=(id:string,name:string,rawPoints:number,eveningHalfPoints:number)=>({id,name,rawPoints,eveningHalfPoints});
 it('preserves original scores, half-points and ties without mutating the input',()=>{
  const source=[t('c','Charlie',4,7),t('b','Bravo',14,28),t('a','Alpha',14,28),t('d','Delta',-2,-4)];
  const before=JSON.stringify(source);
  expect(rankedFinishedTeams(source)).toEqual([
   {...source[2],rank:1,leader:true},{...source[1],rank:1,leader:true},
   {...source[0],rank:3,leader:false},{...source[3],rank:4,leader:false},
  ]);
  expect(JSON.stringify(source)).toBe(before);
 });
 it('handles equal zeroes and empty reports without inventing winners',()=>{
  expect(rankedFinishedTeams([])).toEqual([]);
  expect(rankedFinishedTeams([t('b','B',0,0),t('a','A',0,0)]).map(x=>[x.rank,x.leader]))
   .toEqual([[1,true],[1,true]]);
 });
});
