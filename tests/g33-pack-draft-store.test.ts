import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {PreparationRepository,PreparationError,assertSavedPreparation,prepareSavedDraft,reconcileSavedDraft,previewSelectiveRecovery,commitSelectiveRecovery
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

describe('G34 surgical recovery of original source-only five-game packs',()=>{
 const original=trialDraftItems();
 const input={game:'quiztafel' as const,profile:'lang' as const,
  teams:5 as const,step:3,selections:{}};
 const modify=(id:string,change:(item:ContentItem)=>ContentItem)=>
  original.map(i=>i.id===id?change(i):i);
 it('retains every independent original assignment, clears only changed source and persists as new CAS revision',async()=>{
  const storage=new IDBFactory(),repo=new PreparationRepository(storage,'g34-surgical');
  const saved=await prepareSavedDraft(original,input,1);await repo.save(saved,null);
  const target=saved.assignments.find(x=>x.game==='rundenquiz'&&x.slot==='wissen:1')!;
  expect(target.id).toBeTruthy();
  const changed=modify(target.id!,item=>({...item,revision:item.revision+1,
   payload:{...item.payload as object,prompt:'Neue redaktionelle Frage, nicht geprüft'}}));
  expect((await reconcileSavedDraft(saved,changed)).status).toBe('stale');
  const preview=await previewSelectiveRecovery(saved,changed);
  expect(preview.canCommit).toBe(true);
  expect(preview.selections.rundenquiz['wissen:1']).toBe('');
  expect(preview.cleared).toEqual([
   {game:'rundenquiz',slot:'wissen:1',sourceId:target.id,reason:'changed'},
  ]);
  const another=saved.assignments.find(s=>s.game==='quiztafel'&&s.slot==='tile:2:3')!;
  expect(preview.selections.quiztafel['tile:2:3']).toBe(another.id);
  expect(preview.retained).toBe(saved.assignments.filter(x=>x.id!==null).length-1);
  const recovered=await commitSelectiveRecovery(repo,saved,changed,preview);
  expect(recovered.revision).toBe(2);
  expect(recovered.selections.rundenquiz['wissen:1']).toBe('');
  expect((await reconcileSavedDraft(recovered,changed)).status).toBe('ready');
  expect(recovered.release).toBe('NO_GO');
  const restored=(await repo.read())!;
  expect(restored).toEqual(recovered);await repo.close();
 });
 it('fails closed for rights/status changes, missing source and unchanged draft',async()=>{
  const saved=await prepareSavedDraft(original,input,1);
  const fresh=await previewSelectiveRecovery(saved,original);
  expect(fresh.canCommit).toBe(false);expect(fresh.cleared).toEqual([]);
  const id=saved.assignments.find(s=>s.game==='verbindungen'&&s.id)!.id!;
  const missing=await previewSelectiveRecovery(saved,original.filter(x=>x.id!==id));
  expect(missing.cleared.some(x=>x.sourceId===id&&x.reason==='missing')).toBe(true);
  const rights=modify(id,item=>({...item,provenance:{...item.provenance,rights:'Neuer Rechtevorbehalt'}}));
  expect((await previewSelectiveRecovery(saved,rights)).cleared.some(x=>x.sourceId===id)).toBe(true);
  const review=modify(id,item=>({...item,status:'review'}));
  expect((await previewSelectiveRecovery(saved,review)).cleared.some(x=>x.sourceId===id)).toBe(true);
  const repo=new PreparationRepository(new IDBFactory(),'g34-unchanged');
  await repo.save(saved,null);
  await expect(commitSelectiveRecovery(repo,saved,original,fresh))
   .rejects.toMatchObject({code:'STALE'});
  await repo.close();
 });
 it('clearing a Quiztafel category also clears dependent rows without modifying other teams',async()=>{
  const saved=await prepareSavedDraft(original,input,1);
  const cat=saved.assignments.find(x=>x.game==='quiztafel'&&x.slot==='category:1')!;
  const changed=original.filter(x=>x.id!==cat.id);
  const proposal=await previewSelectiveRecovery(saved,changed);
  expect(proposal.selections.quiztafel['category:1']).toBe('');
  for(let row=1;row<=6;row++){
   expect(proposal.selections.quiztafel['tile:1:'+row]).toBe('');
  }
  expect(proposal.selections.quiztafel['tile:2:1'])
   .toBe(saved.assignments.find(s=>s.game==='quiztafel'&&s.slot==='tile:2:1')!.id);
  expect(proposal.cleared.some(g=>g.slot==='category:1')).toBe(true);
  expect(proposal.status).toBe('NO_GO');
 });
 it('rejects forged approval/selection proposal and changes made after preview',async()=>{
  const repo=new PreparationRepository(new IDBFactory(),'g34-forged');
  const saved=await prepareSavedDraft(original,input,1);await repo.save(saved,null);
  const id=saved.assignments.find(x=>x.game==='rundenquiz'&&x.id)!.id!;
  const changed=modify(id,item=>({...item,revision:item.revision+1}));
  const p=await previewSelectiveRecovery(saved,changed);
  const forged={...p,selections:{...p.selections,rundenquiz:{
   ...p.selections.rundenquiz,'wissen:1':id}}};
  await expect(commitSelectiveRecovery(repo,saved,changed,forged)).rejects.toMatchObject({code:'STALE'});
  const changedAgain=modify(id,item=>({...item,revision:item.revision+2}));
  // Same cleared slot, but an unrelated previously-valid slot changes as well.
  const other=p.selections.logikleiter['rung:1']!;
  const two=changedAgain.map(item=>item.id===other?{...item,revision:item.revision+1}:item);
  await expect(commitSelectiveRecovery(repo,saved,two,p)).rejects.toMatchObject({code:'STALE'});
  expect((await repo.read())?.revision).toBe(1);
  await repo.close();
 });
 it('two-tab recovery cannot overwrite a concurrent newer revision',async()=>{
  const storage=new IDBFactory(),a=new PreparationRepository(storage,'g34-race'),
   b=new PreparationRepository(storage,'g34-race');
  const saved=await prepareSavedDraft(original,input,1);await a.save(saved,null);
  const id=saved.assignments.find(x=>x.game==='rundenquiz'&&x.id)!.id!;
  const changed=modify(id,item=>({...item,revision:item.revision+1}));
  const preview=await previewSelectiveRecovery(saved,changed);
  await a.save(await prepareSavedDraft(original,{...input,step:5},2),1);
  await expect(commitSelectiveRecovery(b,saved,changed,preview))
   .rejects.toMatchObject({code:'CONFLICT'});
  expect((await b.read())?.step).toBe(5);
  await a.close();await b.close();
 });
 it('new unrelated original source must not silently change retained source ID',async()=>{
  const saved=await prepareSavedDraft(original,input,1);
  const related=original[0]!;
  const added:ContentItem={...related,id:'000-earlier-source',
   payload:{...related.payload as object,id:'000-earlier-source'}};
  const recovery=await previewSelectiveRecovery(saved,[...original,added]);
  expect(recovery.retained).toBe(saved.assignments.filter(x=>x.id!==null).length);
  expect(recovery.canCommit).toBe(true);
  expect(recovery.sourceOrderChanged).toBe(true);
  expect(recovery.selections.rundenquiz['wissen:1'])
   .toBe(saved.assignments.find(x=>x.game==='rundenquiz'&&x.slot==='wissen:1')!.id);
  expect(recovery.cleared).toEqual([]);
  const db=new PreparationRepository(new IDBFactory(),'g34-earlier-source');
  await db.save(saved,null);
  const retained=await commitSelectiveRecovery(db,saved,[...original,added],recovery);
  expect(retained.revision).toBe(2);
  expect((await reconcileSavedDraft(retained,[...original,added])).status).toBe('ready');
  expect(retained.selections.rundenquiz['wissen:1']).toBe(recovery.selections.rundenquiz['wissen:1']);
  await db.close();
 });
});
