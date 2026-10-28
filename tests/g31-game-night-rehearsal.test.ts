import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {composeContentPack,prepareFiveGameEvening} from '../src/content/pack-preparation';
import {buildEditorialRehearsal,projectedRehearsalFrame} from '../src/content/game-night-rehearsal';

const bank=trialDraftItems();
const games=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const;
const profiles=['kurz','standard','lang'] as const;
const teams=[3,4,5] as const;
describe('G31 original five-game host / stage preparation rehearsal',()=>{
 it('rehearses every selected original G30 slot across 45 configurations without live authority',()=>{
  let scenarios=0;
  for(const game of games)for(const profile of profiles)for(const teamCount of teams){
   const plan=composeContentPack(bank,game,profile,teamCount);
   const rehearsal=buildEditorialRehearsal(plan,bank);
   const slots=plan.slots.filter(x=>!x.key.startsWith('category:'));
   expect(rehearsal.taskCount).toBe(slots.length);
   expect(rehearsal.steps.length).toBeGreaterThan(slots.length);
   expect(rehearsal.steps.every((s,i)=>s.index===i)).toBe(true);
   expect(rehearsal.steps.every(s=>s.hostStep.length>0&&s.hostNext.length>0)).toBe(true);
   expect(rehearsal.teamTurns).toHaveLength(teamCount);
   expect(rehearsal.balancedTeamExposure,game+' '+profile+' '+teamCount).toBe(true);
   expect(rehearsal.canStartLiveGame).toBe(false);
   expect(rehearsal.publicAnswersIncluded).toBe(false);
   expect(rehearsal.release).toBe('NO_GO');
   for(const step of rehearsal.steps){
    expect(plan.slots.some(s=>s.key===step.slot)).toBe(true);
    const stage=projectedRehearsalFrame(step);
    expect(stage).toMatchObject({publicPromptPresent:false,
     privateAnswerPresent:false,sourceIdPresent:false});
    const asText=JSON.stringify(stage);
    expect(asText).not.toContain(step.sourceId??'some-source');
    expect(asText).not.toContain('clues');
   }
   scenarios++;
  }
  expect(scenarios).toBe(45);
  expect(bank).toHaveLength(79);
  expect(bank.every(x=>x.status==='draft'&&!x.review)).toBe(true);
 });
 it('counts actual team turns from original Quiztafel category and Verbindungen round assignment',()=>{
  const quiz=buildEditorialRehearsal(composeContentPack(bank,'quiztafel','lang',5),bank);
  expect(quiz.teamTurns).toEqual([6,6,6,6,6]);
  const chain=buildEditorialRehearsal(composeContentPack(bank,'verbindungen','lang',5),bank);
  expect(chain.teamTurns).toEqual([4,4,4,4,4]);
  expect(chain.steps.filter(s=>s.slot.startsWith('wall:')).length).toBe(5);
  const round=buildEditorialRehearsal(composeContentPack(bank,'rundenquiz','kurz',3),bank);
  expect(round.teamTurns).toEqual([7,7,7]);
  expect(round.steps[0]).toMatchObject({phase:'ready',stageState:'waiting'});
  expect(round.steps[1]).toMatchObject({phase:'open',stageState:'prompt'});
  expect(round.steps[3]).toMatchObject({phase:'revealed',stageState:'revealed'});
 });
 it('preserves missing content, stale candidate problems and user-selectable source references',()=>{
  const limited=bank.filter(i=>i.id!=='ll-07');
  const plan=composeContentPack(limited,'logikleiter','lang',5);
  const r=buildEditorialRehearsal(plan,limited);
  expect(plan.structuralReady).toBe(false);
  expect(r.missingCount).toBe(1);
  expect(r.canStartLiveGame).toBe(false);
  expect(r.steps.some(s=>s.sourceId===null)).toBe(true);
  const poisoned=composeContentPack(bank,'rundenquiz','kurz',5,{'wissen:1':'fake-source'});
  const rejected=buildEditorialRehearsal(poisoned,bank);
  expect(rejected.missingCount).toBeGreaterThan(0);
  expect(rejected.steps.some(s=>s.issues.some(issue=>issue.code==='MISSING'))).toBe(true);
 });
 it('uses actual selected sources in cross-game spoiler checks, not default sources after override',()=>{
  const initial=prepareFiveGameEvening(bank,'kurz',3);
  expect(initial.spoilers.some(x=>x.itemIds.includes('rq-h1')&&x.itemIds.includes('vb-a-david'))).toBe(true);
  const r=initial.plans.find(x=>x.game==='rundenquiz')!;
  const first=r.slots.find(s=>s.key==='hinweise:1')!;
  expect(first.selected).toBe('rq-h1');
  const alternative=first.options.find(id=>id!=='rq-h1'&&!r.selectedIds.includes(id));
  expect(alternative).toBeTruthy();
  const rerouted=prepareFiveGameEvening(bank,'kurz',3,{
   rundenquiz:{'hinweise:1':alternative!},
  });
  expect(rerouted.plans.find(p=>p.game==='rundenquiz')!.selectedIds).toContain(alternative);
  expect(rerouted.spoilers.some(x=>x.itemIds.includes('rq-h1')&&
   x.itemIds.includes('vb-a-david'))).toBe(false);
  expect(rerouted.release).toBe('NO_GO');
 });
 it('public stage never acquires original prompts, references, answers, teams or source IDs',()=>{
  const plan=composeContentPack(bank,'verbindungen','lang',5);
  const rehearsal=buildEditorialRehearsal(plan,bank);
  const serialized=rehearsal.steps.map(s=>JSON.stringify(projectedRehearsalFrame(s))).join(' ');
  for(const id of plan.selectedIds)expect(serialized).not.toContain(id);
  for(const item of bank){
   const p=item.payload as {prompt?:string;target?:string;answer?:string};
   for(const field of ['target','prompt','answer'] as const){
    const original=p[field];
    if(original&&original.length>6)expect(serialized).not.toContain(original);
   }
  }
 });
});
