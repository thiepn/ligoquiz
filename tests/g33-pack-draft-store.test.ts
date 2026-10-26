import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {PreparationRepository,PreparationError,assertSavedPreparation,prepareSavedDraft,reconcileSavedDraft
} from '../src/content/pack-draft-store';
import {GAME_TYPES} from '../src/domain/game/contracts';
import type {ContentItem} from '../src/content/contracts';
const originals=trialDraftItems();
const input={game:'verbindungen' as const,profile:'lang' as const,teams:5 as const,step:17,
 selections:{rundenquiz:{'hinweise:1':'rq-h2'},verbindungen:{'clue:1:1':'vb-a-david'}}};
function factory(){return new IDBFactory();}
describe('G33 original local source-only game-night draft and CAS',()=>{
 it('captures only 79 original IDs, revisions and cryptographic hashes; no answer, clues, stage or approval',async()=>{
  const record=await prepareSavedDraft(originals,input,1,42);
  expect(record).toMatchObject({key:'current',revision:1,updatedAt:42,
   profile:'lang',teams:5,game:'verbindungen',step:17,sourceOnly:true,release:'NO_GO'});
  expect(record.assignments.length).toBeGreaterThan(40);
  expect(record.sources.length).toBeGreaterThan(40);
  expect(record.sources.every(s=>/^[a-f0-9]{64}$/u.test(s.sha256))).toBe(true);
  expect(record.selections.rundenquiz['hinweise:1']).toBe('rq-h2');
  expect(record.selections.umfrageduell).toEqual({});
  const serialized=JSON.stringify(record);
  for(const secret of ['"payload"','"answer"','"clues"','"categories"','"rights"',
   '"review"','"reviewer"','"private"','"prompt"'])
   expect(serialized).not.toContain(secret);
  expect(record.sources.every(s=>originals.some(x=>x.id===s.id&&x.game===s.game))).toBe(true);
  expect(await reconcileSavedDraft(record,originals)).toEqual({status:'ready',issues:[]});
  expect(originals).toHaveLength(79);
 });
 it('recovers real multi-game assignments after indexedDB close/reopen without importing or approving',async()=>{
  const storage=factory();
  const a=new PreparationRepository(storage,'g33-test-reload');
  const draft=await prepareSavedDraft(originals,input,1);
  await a.save(draft,null);
  await a.close();
  const b=new PreparationRepository(storage,'g33-test-reload');
  const restored=await b.read();
  expect(restored).toEqual(draft);
  expect(await reconcileSavedDraft(restored!,originals)).toMatchObject({status:'ready'});
  await b.clear(1);
  expect(await b.read()).toBeNull();
  await b.close();
 });
 it('applies revision CAS across two browser-style sessions, never overwrites newer choices',async()=>{
  const storage=factory(),a=new PreparationRepository(storage,'g33-cas'),b=new PreparationRepository(storage,'g33-cas');
  const first=await prepareSavedDraft(originals,input,1);
  await a.save(first,null);
  const old=await b.read();expect(old?.revision).toBe(1);
  const latest=await prepareSavedDraft(originals,{...input,step:8},2);
  await a.save(latest,1);
  const collision=await prepareSavedDraft(originals,{...input,step:9},2);
  await expect(b.save(collision,old!.revision)).rejects.toMatchObject({code:'CONFLICT'});
  await expect(b.clear(old!.revision)).rejects.toMatchObject({code:'CONFLICT'});
  expect((await a.read())?.step).toBe(8);
  await a.close();await b.close();
 });
 it('detects exact question payload edit even when editor forgets to increment revision',async()=>{
  const saved=await prepareSavedDraft(originals,input,1);
  const targeted=saved.sources[0]!;
  const changed=originals.map(item=>item.id===targeted.id?
   {...item,payload:{...item.payload as object,reference:'Edited source evidence'}}:item);
  const review=await reconcileSavedDraft(saved,changed);
  expect(review.status).toBe('stale');
  expect(review.issues.join(' ')).toContain(targeted.id);
 });
 it('detects status/rights changes and loss of referenced source but ignores unrelated new source',async()=>{
  const saved=await prepareSavedDraft(originals,input,1);
  const id=saved.sources[0]!.id;
  const changed=originals.map(item=>item.id===id?{...item,status:'review' as const}:item);
  expect((await reconcileSavedDraft(saved,changed)).status).toBe('stale');
  expect((await reconcileSavedDraft(saved,originals.filter(x=>x.id!==id))).status).toBe('stale');
  const unrelated:ContentItem={...originals[0]!,id:'zz-g33-unrelated',payload:{...originals[0]!.payload as object,id:'zz-g33-unrelated'}};
  expect((await reconcileSavedDraft(saved,[...originals,unrelated])).status).toBe('ready');
 });
 it('blocks malformed, forged and oversized stored plan snapshots',async()=>{
  const plan=await prepareSavedDraft(originals,input,1);
  for(const altered of [
   {...plan,release:'GO'}, {...plan,sourceOnly:false},
   {...plan,selections:{...plan.selections,rundenquiz:{'hinweise:1':'not!safe'}}},
   {...plan,sources:[...plan.sources,plan.sources[0]]},
   {...plan,assignments:[...plan.assignments,plan.assignments[0]]},
   {...plan,game:'illegal'},{...plan,revision:-1},
  ])expect(()=>assertSavedPreparation(altered)).toThrow(PreparationError);
 });
 it('keeps 45 engine/profile/team preparations independent from publication and grading',async()=>{
  for(const game of GAME_TYPES)for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const record=await prepareSavedDraft(originals,{game,profile,teams,step:0,selections:{}},1);
    expect(record.sourceOnly).toBe(true);
    expect(record.release).toBe('NO_GO');
    expect((await reconcileSavedDraft(record,originals)).status).toBe('ready');
   }
 });
 it('rejects storage deletion after another tab created a record and preserves original bank',async()=>{
  const storage=factory(),repo=new PreparationRepository(storage,'g33-delete');
  const original=JSON.stringify(originals),plan=await prepareSavedDraft(originals,input,1);
  await repo.save(plan,null);
  await expect(repo.clear(null)).rejects.toMatchObject({code:'CONFLICT'});
  expect((await repo.read())?.revision).toBe(1);
  expect(JSON.stringify(originals)).toBe(original);
  await repo.close();
 });
});
