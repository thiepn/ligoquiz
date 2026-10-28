import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {qualitySignals} from '../src/content/editorial-quality';
import {contentReviewTasks} from '../src/content/editorial-source-review';
import {createDraft} from '../src/content/contracts';

const originals=trialDraftItems();
describe('G29 native source-grounded question quality checks',()=>{
 it('finds actual cross-game source spoiler and preserves all 79 unapproved trial IDs',()=>{
  const task=contentReviewTasks(originals).find(x=>x.item.id==='rq-h1')!;
  expect(qualitySignals(task.item,task.issues)).toEqual(expect.arrayContaining([
   expect.objectContaining({code:'CROSS_GAME_REVEAL',relatedId:'vb-a-david'})]));
  expect(originals).toHaveLength(79);
  expect(originals.every(x=>x.status==='draft'&&!x.review)).toBe(true);
 });
 it('distinguishes concrete original reference from vague institution names without facts certification',()=>{
  const q=originals.find(x=>x.id==='qt-natur-1')!;
  expect(qualitySignals(q).some(x=>x.code==='CITATION_PINPOINT')).toBe(true);
  const located=originals.find(x=>x.id==='qt-geschichte-4')!;
  expect(qualitySignals(located).some(x=>x.code==='CITATION_PINPOINT')).toBe(false);
 });
 it('spots repeated/leaked clues and short proofs without changing game authority',()=>{
  const base=originals.find(x=>x.id==='vb-a-david')!,p=base.payload as {clues:string[]};
  const changed=createDraft('verbindungen',{...base.payload as object,
   clues:['David wird genannt','David wird genannt',p.clues[2],p.clues[3]]},123);
  const risks=qualitySignals(changed).map(x=>x.code);
  expect(risks).toContain('CLUE_REPEAT');
  expect(risks).toContain('ANSWER_LEAK');
  expect(changed.status).toBe('draft');
  expect(qualitySignals({...changed,status:'quarantined'})).toEqual([]);
  const ladder=originals.find(x=>x.game==='logikleiter')!;
  expect(qualitySignals({...ladder,payload:{...ladder.payload as object,explanation:'Weil es so ist.'}})
   .some(x=>x.code==='EXPLANATION_UNCLEAR')).toBe(true);
 });
 it('retains unobserved survey provenance as a source review risk only',()=>{
  const survey=originals.find(x=>x.id==='ud-01')!;
  expect(qualitySignals(survey).some(x=>x.code==='ILLUSTRATIVE_ONLY')).toBe(true);
  expect(originals.filter(x=>x.game==='umfrageduell')).toHaveLength(10);
 });
});
