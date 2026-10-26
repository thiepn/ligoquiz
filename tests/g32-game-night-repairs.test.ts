import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {composeContentPack} from '../src/content/pack-preparation';
import {gameNightRunSheet,sourceRepairChoices,applySourceRepair,prioritizedReviewSlots} from '../src/content/game-night-repairs';
import {GAME_TYPES} from '../src/domain/game/contracts';
import type {ContentItem} from '../src/content/contracts';

const bank=trialDraftItems(),profiles=['kurz','standard','lang'] as const,teamSizes=[3,4,5] as const;
describe('G32 local five-game run sheet and source-constrained editorial repair',()=>{
 it('rehearses all original host/engine assignments for 3–5 teams without live or rights authority',()=>{
  const frozen=JSON.stringify(bank);
  let configurations=0;
  for(const profile of profiles)for(const teams of teamSizes){
   const run=gameNightRunSheet(bank,profile,teams);
   expect(run.games.map(x=>x.game)).toEqual(GAME_TYPES);
   expect(run.totalSteps).toBe(run.games.reduce((n,g)=>n+g.phaseSteps,0));
   expect(run.games.every(x=>x.teamTurns.length===teams&&x.balanced)).toBe(true);
   expect(run.games.every(x=>x.approvedClaims===0)).toBe(true);
   expect(run.liveSessionCreated).toBe(false);
   expect(run.publishAllowed).toBe(false);
   expect(run.status).toBe('NO_GO');
   configurations++;
  }
  expect(configurations).toBe(9);
  expect(bank).toHaveLength(79);
  expect(JSON.stringify(bank)).toBe(frozen);
 });
 it('cross-game spoiler counts respond to actual source overrides without touching V1 metadata',()=>{
  const baseline=gameNightRunSheet(bank,'kurz',3);
  expect(baseline.spoilers.some(x=>
   [x.first,x.second].includes('rq-h1')&&[x.first,x.second].includes('vb-a-david'))).toBe(true);
  const plan=composeContentPack(bank,'rundenquiz','kurz',3);
  const slot=plan.slots.find(x=>x.key==='hinweise:1')!;
  const alternative=slot.options.find(id=>id!=='rq-h1'&&!plan.selectedIds.includes(id));
  expect(alternative).toBeTruthy();
  const altered=gameNightRunSheet(bank,'kurz',3,{rundenquiz:{'hinweise:1':alternative!}});
  expect(altered.spoilers.some(x=>[x.first,x.second].includes('rq-h1')&&
   [x.first,x.second].includes('vb-a-david'))).toBe(false);
  expect(altered.status).toBe('NO_GO');
 });
 it('finds actual editorial problems from chosen source IDs and preserves other teams',()=>{
  const plan=composeContentPack(bank,'rundenquiz','kurz',3);
  const run=gameNightRunSheet(bank,'kurz',3);
  const tasks=prioritizedReviewSlots(plan,run.spoilers.map(x=>({
   code:'CROSS_GAME_SPOILER' as const,message:'Target repeated',itemIds:[x.first,x.second],
  })));
  expect(tasks.length).toBeGreaterThan(0);
  expect(tasks.some(x=>x.itemId==='rq-h1'&&x.issues.includes('CROSS_GAME_SPOILER'))).toBe(true);
  expect(tasks.every(x=>plan.slots.some(s=>s.key===x.slot))).toBe(true);
 });
 it('offers explicit ranked source replacement without new hard blockers or approvals',()=>{
  const plan=composeContentPack(bank,'rundenquiz','kurz',3);
  const choices=sourceRepairChoices(bank,plan,{},'hinweise:1');
  expect(choices.length).toBeGreaterThan(0);
  expect(choices.every(x=>x.sourceId!=='rq-h1'&&x.after<=x.before)).toBe(true);
  expect(choices.every(x=>x.approvalGranted===false&&x.reviewerDecisionRequired===true)).toBe(true);
  const fixed=applySourceRepair(bank,plan,{},choices[0]!);
  expect(fixed?.rundenquiz?.['hinweise:1']).toBe(choices[0]!.sourceId);
  expect(fixed?.quiztafel).toBeUndefined();
  expect(gameNightRunSheet(bank,'kurz',3,fixed).publishAllowed).toBe(false);
  expect(composeContentPack(bank,'rundenquiz','kurz',3).selectedIds).toContain('rq-h1');
 });
 it('rejects forged choices, incorrect score receipts and stale local candidates',()=>{
  const plan=composeContentPack(bank,'rundenquiz','kurz',3);
  const choices=sourceRepairChoices(bank,plan,{},'hinweise:1');
  const first=choices[0]!;
  expect(applySourceRepair(bank,plan,{},{
   ...first,sourceId:'qt-natur-1',
  })).toBeNull();
  expect(applySourceRepair(bank,plan,{},{
   ...first,after:-12345,
  })).toBeNull();
  expect(applySourceRepair(bank,plan,{},{
   ...first,slot:'not-a-real-slot',
  })).toBeNull();
  expect(sourceRepairChoices(bank,plan,{},'invalid')).toEqual([]);
  expect(sourceRepairChoices(bank,plan,{},'hinweise:1',0)).toEqual([]);
  const changed:ContentItem={...bank.find(x=>x.id===first.sourceId)!,
   status:'quarantined'};
  const newBank=bank.map(x=>x.id===changed.id?changed:x);
  expect(applySourceRepair(newBank,plan,{},first)).toBeNull();
 });
 it('never offers a duplicate already selected source as a safer choice',()=>{
  const plan=composeContentPack(bank,'rundenquiz','kurz',3);
  const current=new Set(plan.selectedIds);
  const repairs=sourceRepairChoices(bank,plan,{},'hinweise:1');
  expect(repairs.every(choice=>!current.has(choice.sourceId))).toBe(true);
 });
 it('rejects unsafe attempted Quiztafel category switches if new board lacks rows',()=>{
  const plan=composeContentPack(bank,'quiztafel','lang',5);
  const slot=plan.slots.find(x=>x.key==='category:1')!;
  const candidates=sourceRepairChoices(bank,plan,{},slot.key);
  for(const choice of candidates){
   const next=applySourceRepair(bank,plan,{},choice);
   expect(next).not.toBeNull();
   const composed=composeContentPack(bank,'quiztafel','lang',5,next?.quiztafel);
   expect(composed.problems.filter(p=>['MISSING','ENGINE_INVALID','DUPLICATE_ID'].includes(p.code))).toEqual([]);
  }
 });
 it('fails closed on short libraries and never fabricates substitute contents',()=>{
  const missing=bank.filter(x=>x.game==='logikleiter'&&
   (x.payload as {difficulty?:number}).difficulty===7?false:true);
  const run=gameNightRunSheet(missing,'lang',5);
  expect(run.missing).toBeGreaterThan(0);
  expect(run.publishAllowed).toBe(false);
  expect(run.games.find(x=>x.game==='logikleiter')?.hardIssues).toBeGreaterThan(0);
 });
});
