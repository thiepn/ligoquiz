import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {composeContentPack} from '../src/content/pack-preparation';
import {fiveGameReadiness,originalSlotCandidates,selectOriginalSlot,rehearsalIndexForSlot
} from '../src/content/original-slot-resolution';
import {GAME_TYPES} from '../src/domain/game/contracts';

const bank=trialDraftItems(),start={rundenquiz:{'wissen:1':''}};
describe('G35 native original-source slot completion and moderator continuity',()=>{
 it('reads all 45 original team/profile game combinations with explicit source custody and NO_GO',()=>{
  let combinations=0;
  for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const summary=fiveGameReadiness(bank,profile,teams);
    expect(summary.games.map(x=>x.game)).toEqual(GAME_TYPES);
    expect(summary.games.every(x=>x.teamTurns.length===teams&&x.balanced)).toBe(true);
    expect(summary.readyForLive).toBe(false);
    expect(summary.release).toBe('NO_GO');
    combinations+=5;
   }
  expect(combinations).toBe(45);
  expect(bank).toHaveLength(79);
 });
 it('reports a real missing source slot, offers actual original short-profile reserve questions',()=>{
  const state=fiveGameReadiness(bank,'kurz',3,start);
  const missing=state.issues.find(x=>x.game==='rundenquiz'&&x.slot==='wissen:1');
  expect(missing).toMatchObject({kind:'missing',sourceId:null,codes:['MISSING']});
  const options=originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'wissen:1',8);
  expect(options.length).toBeGreaterThan(0);
  expect(options.every(x=>x.hardAfter<=x.hardBefore&&x.sourceRights==='unverified')).toBe(true);
  expect(options.every(x=>!x.approvalGranted&&!x.publicationAllowed)).toBe(true);
  const selected=selectOriginalSlot(bank,'rundenquiz','kurz',3,start,options[0]!);
  expect(selected?.rundenquiz?.['wissen:1']).toBe(options[0]!.sourceId);
  const pack=composeContentPack(bank,'rundenquiz','kurz',3,selected?.rundenquiz);
  expect(pack.structuralReady).toBe(true);
  expect(pack.sourceDrafts).toBe(pack.selectedIds.length);
  expect(pack.validForPublication).toBe(false);
  expect(fiveGameReadiness(bank,'kurz',3,selected??undefined).release).toBe('NO_GO');
 });
 it('preserves independent game assignments and real 3/4/5-team exposure after reviewer selection',()=>{
  for(const teams of [3,4,5] as const){
   const choices=originalSlotCandidates(bank,'rundenquiz','kurz',teams,start,'wissen:1');
   expect(choices).not.toHaveLength(0);
   const change=selectOriginalSlot(bank,'rundenquiz','kurz',teams,start,choices[0]!);
   const summary=fiveGameReadiness(bank,'kurz',teams,change??undefined);
   expect(summary.games.every(x=>x.balanced)).toBe(true);
   expect(summary.games.every(x=>x.teamTurns.length===teams)).toBe(true);
   expect(change?.verbindungen).toBeUndefined();
  }
 });
 it('rejects duplicate question usage even if source belongs to same original round',()=>{
  const pack=composeContentPack(bank,'rundenquiz','kurz',3,start.rundenquiz);
  const occupied=pack.slots.find(x=>x.key==='wissen:2')!.selected!;
  const options=originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'wissen:1');
  expect(options.every(x=>x.sourceId!==occupied)).toBe(true);
  const forged={...options[0]!,sourceId:occupied};
  expect(selectOriginalSlot(bank,'rundenquiz','kurz',3,start,forged)).toBeNull();
 });
 it('blocks changed revision, quarantined source, foreign game and forged improvement claim',()=>{
  const options=originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'wissen:1');
  const chosen=options[0]!;
  const changed=bank.map(item=>item.id===chosen.sourceId?
   {...item,revision:item.revision+1}:item);
  expect(selectOriginalSlot(changed,'rundenquiz','kurz',3,start,chosen)).toBeNull();
  const quarantined=bank.map(item=>item.id===chosen.sourceId?
   {...item,status:'quarantined' as const}:item);
  expect(selectOriginalSlot(quarantined,'rundenquiz','kurz',3,start,chosen)).toBeNull();
  expect(selectOriginalSlot(bank,'rundenquiz','kurz',3,start,{
   ...chosen,sourceId:'qt-natur-1'})).toBeNull();
  expect(selectOriginalSlot(bank,'rundenquiz','kurz',3,start,{
   ...chosen,improvement:9999})).toBeNull();
  expect(selectOriginalSlot(bank,'rundenquiz','kurz',3,start,{
   ...chosen,approvalGranted:true as false})).toBeNull();
 });
 it('retains exact rehearsal phase index without issuing host or stage commands',()=>{
  const changed=originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'wissen:1')[0]!;
  const newChoices=selectOriginalSlot(bank,'rundenquiz','kurz',3,start,changed);
  expect(rehearsalIndexForSlot(bank,'rundenquiz','kurz',3,newChoices??undefined,'wissen:1')).toBe(0);
  expect(rehearsalIndexForSlot(bank,'rundenquiz','kurz',3,newChoices??undefined,'wissen:2')).toBe(5);
  expect(rehearsalIndexForSlot(bank,'rundenquiz','kurz',3,newChoices??undefined,'missing-slot')).toBeNull();
  expect(rehearsalIndexForSlot(bank,'quiztafel','kurz',3,newChoices??undefined,'category:1')).toBeNull();
 });
 it('checks original category dependency and does not resurrect invalid Quiztafel row',()=>{
  const previous=composeContentPack(bank,'quiztafel','lang',5);
  const category=previous.slots.find(s=>s.key==='category:1')!;
  const next={quiztafel:{'category:1':'','tile:1:1':''}};
  const issues=fiveGameReadiness(bank,'lang',5,next).issues;
  expect(issues.some(x=>x.game==='quiztafel'&&x.slot==='category:1'&&x.kind==='missing')).toBe(true);
  expect(originalSlotCandidates(bank,'quiztafel','lang',5,next,'tile:1:1')).toEqual([]);
  expect(category.selected).toBeTruthy();
 });
 it('never invents candidates for absent slots or sources without original rights',()=>{
  expect(originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'fake-slot')).toEqual([]);
  expect(originalSlotCandidates(bank,'rundenquiz','kurz',3,start,'wissen:1',0)).toEqual([]);
  const count=bank.filter(x=>x.status==='draft').length;
  expect(count).toBe(79);
  expect(bank.every(x=>x.status==='draft')).toBe(true);
 });
});
