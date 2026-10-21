import {describe,expect,it} from 'vitest';
import {createDraft,validateItem,type ContentItem} from '../src/content/contracts';
import {sha256} from '../src/content/migration';
import {RQ_TRIAL_BANK} from '../src/games/rundenquiz/trial-bank';
import {PROFILE_COUNTS,ROUNDS} from '../src/games/rundenquiz/engine';
import {parseSetupDraft,newSetupDraft} from '../src/features/experience/model';
import {reviewedRundenquizChoices,chosenRundenquizCounts,selectedReviewedRundenquizPack}
 from '../src/features/experience/rundenquiz-lineup';

async function approved():Promise<ContentItem[]>{
 return Promise.all(RQ_TRIAL_BANK.map(async p=>{
  const d=createDraft('rundenquiz',p,42);
  return validateItem({...d,status:'approved',review:{
   reviewer:'Testredaktion',checkedAt:42,
   note:'Synthetische Testfreigabe, keine realen Rechte',
   checklist:[true,true,true,true],
   fingerprint:await sha256(JSON.stringify(d.payload)),
  }});
 }));
}
describe('U19 source-backed Rundenquiz custom lineups',()=>{
 it('offers all five original round source groups without private answer or source disclosure',async()=>{
  const all=await approved(),snapshot=JSON.stringify(all);
  const result=await reviewedRundenquizChoices(all);
  expect(result.excluded).toBe(0);
  expect(result.questions).toHaveLength(all.length);
  for(const q of result.questions){
   const original=all.find(x=>x.id===q.id)!;
   expect(q.prompt).toBe((original.payload as {prompt:string}).prompt);
   expect(q).not.toHaveProperty('answer');
   expect(q).not.toHaveProperty('reference');
  }
  expect(JSON.stringify(all)).toBe(snapshot);
 });
 it('preserves explicit chosen original IDs and original Rundenquiz round order',async()=>{
  const all=await approved();
  const choices=(await reviewedRundenquizChoices(all)).questions;
  const picked=ROUNDS.flatMap(round=>choices.filter(q=>q.round===round)
   .slice(-PROFILE_COUNTS.kurz[round]).map(q=>q.id));
  expect(picked).toHaveLength(7);
  const checked=chosenRundenquizCounts('kurz',choices,picked);
  expect(checked.exact).toBe(true);
  const source=selectedReviewedRundenquizPack(all,'kurz',picked);
  expect(new Set(source.map(q=>q.id))).toEqual(new Set(picked));
  expect(source.map(q=>q.round)).toEqual([
   'wissen','wissen','wissen','hinweise','hinweise','schaetzen','schaetzen']);
 });
 it('denies incomplete, extra, duplicated, forged or revoked question IDs without trial fallback',async()=>{
  const all=await approved(),choices=(await reviewedRundenquizChoices(all)).questions;
  const ids=ROUNDS.flatMap(round=>choices.filter(q=>q.round===round)
   .slice(0,PROFILE_COUNTS.kurz[round]).map(q=>q.id));
  const fail=(selection:readonly string[],records=all)=>
   ()=>selectedReviewedRundenquizPack(records,'kurz',selection);
  expect(fail(ids)).not.toThrow();
  expect(fail(ids.slice(1))).toThrow();
  expect(fail([...ids,ids[0]!])).toThrow();
  expect(fail([...ids.slice(0,-1),'forged-question'])).toThrow();
  expect(fail([...ids,choices.find(q=>!ids.includes(q.id))!.id])).toThrow();
  expect(fail(ids,[...all.filter(x=>x.id!==ids[0])])).toThrow();
  expect(chosenRundenquizCounts('kurz',choices,ids.slice(0,-1)).exact).toBe(false);
  expect(chosenRundenquizCounts('kurz',choices,[...ids,'other']).exact).toBe(false);
 });
 it('rejects a stale approved payload digest at final immutable original event source check',async()=>{
  const all=await approved(),ids=ROUNDS.flatMap(round=>all
   .filter(i=>(i.payload as {round:string}).round===round)
   .slice(0,PROFILE_COUNTS.kurz[round]).map(i=>i.id));
  const changed=all.map(item=>item.id===ids[0]?{
   ...item,review:{...item.review!,fingerprint:'f'.repeat(64)},
  }:item);
  const validChoices=await reviewedRundenquizChoices(changed);
  expect(validChoices.excluded).toBe(1);
  expect(validChoices.questions.some(q=>q.id===ids[0])).toBe(false);
  // The bank selector never grants approvals; the unchanged event creator additionally
  // checks each exact original source digest at freeze time.
  expect(selectedReviewedRundenquizPack(changed,'kurz',ids)).toHaveLength(7);
 });
 it('keeps original setup draft portable and refuses malformed or duplicate canonical IDs',()=>{
  const baseline=newSetupDraft();
  expect(parseSetupDraft(baseline)?.rqQuestionIds).toBeUndefined();
  const updated={...baseline,rqQuestionIds:['a-id','b-id','c-id'],step:1};
  expect(parseSetupDraft(JSON.parse(JSON.stringify(updated)))?.rqQuestionIds).toEqual(updated.rqQuestionIds);
  expect(parseSetupDraft({...updated,rqQuestionIds:['a','a']})?.rqQuestionIds).toBeUndefined();
  expect(parseSetupDraft({...updated,rqQuestionIds:Array.from({length:17},(_,i)=>'id'+i)})?.rqQuestionIds).toBeUndefined();
 });
});
