import {describe,it,expect} from 'vitest';
import {launchContentInventory} from '../src/content/launch-inventory';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {createDraft,type ContentItem} from '../src/content/contracts';

const original=trialDraftItems();
describe('G28 source-bound launch inventory and editor prioritization',()=>{
 it('separates original V1 metadata and 79 V2 trial records without asserting any migration',()=>{
  const empty=launchContentInventory([]);
  expect(empty).toMatchObject({originalDeclaredActive:704,originalDeclaredTotal:706,
   localCount:0,verifiedLegacyMappings:0,externalRightsApproved:false,release:'NO_GO'});
  expect(empty.historicFamilies).toHaveLength(8);
  expect(empty.historicFamilies.reduce((n,f)=>n+f.declared,0)).toBe(704);
  expect(empty.programs).toHaveLength(45);
  expect(empty.programs.every(p=>!p.structurallyComplete)).toBe(true);
  const bank=launchContentInventory(original);
  expect(bank).toMatchObject({localCount:79,validUnapproved:79,localApprovalClaims:0,
   unreviewedIllustrative:10,verifiedLegacyMappings:0,release:'NO_GO'});
  expect(bank.programs).toHaveLength(45);
  expect(bank.possibleLegacyLinks).toEqual([]);
  expect(bank.historicFamilies.every(x=>x.confirmedV2Mappings===0)).toBe(true);
  expect(original.every(x=>x.status==='draft'&&!x.review)).toBe(true);
 });
 it('analyzes all original five engines, three profiles, and team counts without artificial approval',()=>{
  const bank=launchContentInventory(original);
  expect(bank.programs.map(x=>x.game+'-'+x.profile+'-'+x.teams)).toHaveLength(45);
  for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell']){
   expect(bank.programs.filter(x=>x.game===game)).toHaveLength(9);
  }
  expect(bank.programs.find(x=>x.game==='quiztafel'&&x.profile==='lang'&&x.teams===5)
   ?.gaps.some(g=>g.kind.includes('Kategorien')&&g.required===5)).toBe(true);
  expect(bank.programs.find(x=>x.game==='verbindungen'&&x.profile==='lang'&&x.teams===5)
   ?.gaps.map(g=>g.required)).toEqual([10,5,1]);
  expect(bank.programs.find(x=>x.game==='logikleiter'&&x.profile==='lang'&&x.teams===3)
   ?.gaps).toHaveLength(7);
 });
 it('detects a missing highest Quiztafel category row without treating raw tile totals as complete',()=>{
  const reduced=original.filter(i=>i.id!=='qt-geschichte-6');
  const result=launchContentInventory(reduced);
  const long5=result.programs.find(x=>x.game==='quiztafel'&&x.profile==='lang'&&x.teams===5)!;
  expect(long5.structurallyComplete).toBe(false);
  expect(long5.gaps.some(g=>g.kind.includes('Kategorien')&&g.missing===1)).toBe(true);
  const standard5=result.programs.find(x=>x.game==='quiztafel'&&x.profile==='standard'&&x.teams===5)!;
  expect(standard5.structurallyComplete).toBe(true);
  expect(result.localApprovalClaims).toBe(0);
 });
 it('does not count duplicate or absent Logikleiter difficulty as a complete seven-step ladder',()=>{
  const changed=original.map(i=>i.id==='ll-07'?{...i,
   payload:{...i.payload as object,difficulty:6}}:i);
  const row=launchContentInventory(changed).programs.find(p=>
   p.game==='logikleiter'&&p.profile==='lang'&&p.teams===3)!;
  expect(row.structurallyComplete).toBe(false);
  expect(row.gaps.find(x=>x.kind==='Stufe 7')?.missing).toBe(1);
 });
 it('accepts only structurally typed imported legacy provenance as an unverified mapping candidate',()=>{
  const q=original.find(i=>i.id==='rq-w4')!;
  const typed:ContentItem={...q,provenance:{
   origin:'legacy',sourceKey:'ligo.quiz.content.library.v1',
   sourceId:'cb:stable-23',bundleHash:'f'.repeat(64)}};
  const inventory=launchContentInventory([typed]);
  expect(inventory.possibleLegacyLinks).toEqual([expect.objectContaining({
   sourceId:'cb:stable-23',game:'rundenquiz',independentlyVerified:false,
   approved:false,evidence:'import-metadata-only',
  })]);
  expect(inventory.verifiedLegacyMappings).toBe(0);
  const bogus={...typed,provenance:{...typed.provenance,sourceId:'not-v1-origin'}};
  expect(launchContentInventory([bogus]).possibleLegacyLinks).toHaveLength(0);
  const noHash={...typed,provenance:{...typed.provenance,bundleHash:undefined}};
  expect(launchContentInventory([noHash]).possibleLegacyLinks).toHaveLength(0);
  const collision={...typed,id:'another',payload:{...typed.payload as object,id:'another'}};
  const conflicted=launchContentInventory([typed,{...collision,
   provenance:{...collision.provenance,sourceId:typed.provenance.sourceId}}]);
  expect(conflicted.possibleLegacyLinks).toHaveLength(0);
  expect(conflicted.legacyCollisions).toEqual(['cb:stable-23']);
 });
 it('prioritizes actual source conflicts and reviewed primary-source leads without granting rights',()=>{
  const one=original.find(i=>i.id==='rq-w4')!;
  const other=createDraft('rundenquiz',{...one.payload as object,id:'g28-duplicate'},0);
  const scan=launchContentInventory([...original,other]);
  const entry=scan.priorities.find(x=>x.item.id===one.id)!;
  expect(entry.issueCodes).toContain('EXACT_DUPLICATE');
  expect(entry.reasons).toContain('EXACT_DUPLICATE');
  expect(scan.priorities.every(x=>x.item.status!=='approved')).toBe(true);
  expect(scan.externalRightsApproved).toBe(false);
  expect(scan.release).toBe('NO_GO');
 });
});
