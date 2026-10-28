import {describe,it,expect} from 'vitest';
import {trialDraftItems,TRIAL_DRAFT_SOURCE} from '../src/content/trial-draft-bundle';
import {originalWordingRisk,originalWordingDraftProposal,rightsClaimState,contentReviewTasks} from '../src/content/editorial-source-review';
import {qualitySignals} from '../src/content/editorial-quality';
import {validatePayload} from '../src/content/contracts';
const bank=trialDraftItems();
const byId=(id:string)=>bank.find(x=>x.id===id)!;
describe('G41 original-source wording and rights triage, no new authority',()=>{
 it('identifies two actual under-specified or imprecise source questions, without mutating originals',()=>{
  expect(bank).toHaveLength(79);
  expect(TRIAL_DRAFT_SOURCE).toBe('v2-original-trial-banks-v2');
  expect(bank.filter(item=>originalWordingRisk(item)).map(item=>item.id).sort())
   .toEqual(['ll-05','rq-s2']);
  for(const id of ['ll-05','rq-s2']){
   const original=byId(id),snapshot=JSON.stringify(original);
   const proposed=originalWordingDraftProposal(original)!;
   expect(proposed).not.toBeNull();
   expect(proposed.payload.id).toBe(id);
   expect(validatePayload(original.game,proposed.payload)).toEqual([]);
   expect(JSON.stringify(original)).toBe(snapshot);
   expect(proposed.payload.prompt).not.toBe((original.payload as {prompt:string}).prompt);
   expect(qualitySignals(original).map(x=>x.code)).toContain('ORIGINAL_WORDING_RISK');
  }
  expect((originalWordingDraftProposal(byId('ll-05'))?.payload.prompt as string))
   .toContain('jeweils genau eine');
  expect((originalWordingDraftProposal(byId('rq-s2'))?.payload.prompt as string))
   .toContain('hebräischen Zählung');
 });
 it('refuses modified, wrong-provenance, quarantined and non-draft proposal authority',()=>{
  const original=byId('ll-05');
  const altered={...original,payload:{...original.payload as object,prompt:'Anderer Fragetext'}};
  expect(originalWordingRisk(altered)).toBeNull();
  expect(originalWordingRisk({...original,provenance:{...original.provenance,sourceKey:'unknown'}})).toBeNull();
  expect(originalWordingRisk({...original,provenance:{...original.provenance,sourceVersion:'forged'}})).toBeNull();
  expect(originalWordingRisk({...original,status:'quarantined'})).toBeNull();
  expect(originalWordingDraftProposal({...original,status:'review'})).toBeNull();
  expect(originalWordingDraftProposal({...original,status:'approved'})).toBeNull();
  expect(originalWordingRisk({...original,provenance:{...original.provenance,sourceId:'other'}})).toBeNull();
  expect(originalWordingRisk({...original,provenance:{...original.provenance,origin:'manual'}})).toBeNull();
 });
 it('keeps rights self-claims separate from certified permissions and release readiness',()=>{
  expect(bank.every(x=>rightsClaimState(x)==='missing'&&!x.review&&x.status==='draft')).toBe(true);
  const note={...byId('rq-s2'),provenance:{...byId('rq-s2').provenance,rights:'Self-declared; no license attached'}};
  expect(rightsClaimState(note)).toBe('self-declared');
  expect(originalWordingRisk(note)).not.toBeNull();
  expect(contentReviewTasks(bank).filter(x=>x.route==='lookup')).toHaveLength(57);
  expect(byId('rq-s2').provenance.rights).toBeUndefined();
 });
});
