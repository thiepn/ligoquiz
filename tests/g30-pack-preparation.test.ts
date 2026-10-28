import {describe,it,expect} from 'vitest';
import {composeContentPack,prepareFiveGameEvening,exportPreparationPlan} from '../src/content/pack-preparation';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {createDraft,type ContentItem} from '../src/content/contracts';

const originals=trialDraftItems();
const modes=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const;
const profiles=['kurz','standard','lang'] as const;
const rosters=[3,4,5] as const;

describe('G30 original native five-engine pack preparation',()=>{
 it('builds 45 real engine-validated source-only plans with all source IDs and NO_GO',()=>{
  let count=0;
  for(const game of modes)for(const profile of profiles)for(const teams of rosters){
   const plan=composeContentPack(originals,game,profile,teams);
   expect(plan.structuralReady,game+' / '+profile+' / '+teams+' / '+JSON.stringify(plan.problems)).toBe(true);
   expect(plan.selectedIds).toHaveLength(new Set(plan.selectedIds).size);
   expect(plan.sourceDrafts).toBe(plan.selectedIds.length);
   expect(plan.localReviewClaims).toBe(0);
   expect(plan.validForPublication).toBe(false);
   expect(plan.rightsVerified).toBe(false);
   expect(plan.status).toBe('NO_GO');
   expect(plan.selectedIds.every(id=>originals.some(item=>item.id===id))).toBe(true);
   count++;
  }
  expect(count).toBe(45);
  expect(originals).toHaveLength(79);
  expect(originals.every(x=>x.status==='draft')).toBe(true);
 });
 it('uses actual 3/4/5 team Quiztafel category × original 100–600 point rows',()=>{
  for(const teams of rosters){
   const plan=composeContentPack(originals,'quiztafel','lang',teams);
   expect(plan.slots.filter(s=>s.key.startsWith('category:'))).toHaveLength(teams);
   expect(plan.slots.filter(s=>s.key.startsWith('tile:'))).toHaveLength(teams*6);
   expect(plan.selectedIds).toHaveLength(teams*6);
  }
  const partial=composeContentPack(originals.filter(x=>x.id!=='qt-geschichte-6'),'quiztafel','lang',5);
  expect(partial.structuralReady).toBe(false);
  expect(partial.problems.some(x=>x.code==='MISSING'||x.code==='ENGINE_INVALID')).toBe(true);
  const shorter=composeContentPack(originals.filter(x=>x.id!=='qt-geschichte-6'),'quiztafel','standard',5);
  expect(shorter.structuralReady).toBe(true);
 });
 it('does not falsely treat missing Logikleiter level as generic sufficient task count',()=>{
  const bank=originals.filter(x=>x.id!=='ll-07');
  expect(composeContentPack(bank,'logikleiter','lang',3).structuralReady).toBe(false);
  expect(composeContentPack(bank,'logikleiter','standard',3).structuralReady).toBe(true);
 });
 it('assigns original clue and sequence rounds per team and exactly one 16-cell wall',()=>{
  const three=composeContentPack(originals,'verbindungen','lang',3);
  expect(three.slots.filter(x=>x.key.startsWith('clue:'))).toHaveLength(6);
  expect(three.slots.filter(x=>x.key.startsWith('sequence:'))).toHaveLength(3);
  expect(three.slots.filter(x=>x.key.startsWith('wall:'))).toHaveLength(1);
  const five=composeContentPack(originals,'verbindungen','lang',5);
  expect(five.slots.filter(x=>x.key.startsWith('clue:'))).toHaveLength(10);
  expect(five.slots.filter(x=>x.key.startsWith('sequence:'))).toHaveLength(5);
  expect(five.slots.filter(x=>x.key.startsWith('wall:'))).toHaveLength(1);
  expect(five.selectedIds).toHaveLength(16);
 });
 it('keeps real source types distinct: Umfrageduell TOP 1, TOP 3, illustrative',()=>{
  const lang=composeContentPack(originals,'umfrageduell','lang',5);
  expect(lang.slots.filter(x=>x.key.startsWith('popular:'))).toHaveLength(8);
  expect(lang.slots.filter(x=>x.key.startsWith('top3:'))).toHaveLength(2);
  expect(lang.problems.some(x=>x.code==='SOURCE_REVIEW')).toBe(true);
  expect(lang.rightsVerified).toBe(false);
  const less=composeContentPack(originals.filter(x=>x.id==='ud-01'),'umfrageduell','lang',3);
  expect(less.structuralReady).toBe(false);
 });
 it('refuses unqualified source override, duplicate assigned source and exact duplicate question',()=>{
  const base=composeContentPack(originals,'rundenquiz','kurz',3);
  const k=base.slots.filter(s=>s.key.startsWith('wissen:'));
  const invalid=composeContentPack(originals,'rundenquiz','kurz',3,{[k[0]!.key]:'qt-natur-1'});
  expect(invalid.structuralReady).toBe(false);
  expect(invalid.problems.some(x=>x.code==='INVALID_OVERRIDE')).toBe(true);
  const duplicate=composeContentPack(originals,'rundenquiz','kurz',3,{[k[0]!.key]:k[1]!.selected!});
  expect(duplicate.structuralReady).toBe(false);
  expect(duplicate.problems.some(x=>x.code==='DUPLICATE_ID')).toBe(true);
  const known=originals.find(x=>x.id===k[0]!.selected)!;
  const source=createDraft('rundenquiz',{...known.payload as object,id:'g30-copy'},12);
  const near=composeContentPack([...originals,source],'rundenquiz','kurz',3,
   {[k[0]!.key]:known.id,[k[1]!.key]:'g30-copy'});
  expect(near.problems.some(x=>x.code==='DUPLICATE_CONTENT')).toBe(true);
 });
 it('recognizes source-specific cross-game spoilers without deleting or auto-editing them',()=>{
  const evening=prepareFiveGameEvening(originals,'lang',5);
  expect(evening.plans).toHaveLength(5);
  expect(evening.spoilers).toEqual(expect.arrayContaining([
   expect.objectContaining({code:'CROSS_GAME_SPOILER',itemIds:expect.arrayContaining(['rq-h1','vb-a-david'])})]));
  expect(evening.release).toBe('NO_GO');
 });
 it('exports ONLY G10 source IDs and slot assignments, no question, answer or approvals',()=>{
  const plan=composeContentPack(originals,'rundenquiz','lang',5);
  const text=exportPreparationPlan(plan),parsed=JSON.parse(text) as {
   status:string;publicationAuthorized:boolean;rightsVerified:boolean;sourceIds:string[];
   assignments:{slot:string;sourceId:string|null}[];
  };
  expect(parsed).toMatchObject({status:'NO_GO',publicationAuthorized:false,rightsVerified:false});
  expect(parsed.sourceIds).toEqual(plan.selectedIds);
  expect(parsed.assignments).toHaveLength(plan.slots.length);
  expect(text).not.toContain((originals[0]!.payload as {prompt:string}).prompt);
  expect(text).not.toContain('"answer"');
  expect(text).not.toContain('"categories"');
 });
 it('rejects quarantined or malformed imported payload, unchanged native content remains untouched',()=>{
  const before=JSON.stringify(originals),q=originals.find(i=>i.id==='qt-natur-1')!;
  const tampered:ContentItem={...q,status:'quarantined'};
  const invalid:ContentItem={...q,payload:{...q.payload as object,row:0}};
  for(const sample of [tampered,invalid]){
   const bank=[...originals.filter(i=>i.id!==q.id),sample];
   expect(composeContentPack(bank,'quiztafel','lang',5).structuralReady).toBe(false);
  }
  expect(JSON.stringify(originals)).toBe(before);
 });
});
