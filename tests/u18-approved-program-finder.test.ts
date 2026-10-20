import {describe,it,expect} from 'vitest';
import {createDraft,coverage,selectReviewedPack,validateItem,type ContentItem}
 from '../src/content/contracts';
import {sha256} from '../src/content/migration';
import {RQ_TRIAL_BANK} from '../src/games/rundenquiz/trial-bank';
import {sampleQuiztafel} from '../src/games/quiztafel/trial-bank';
import {trialVerbindungen} from '../src/games/verbindungen/trial-bank';
import {trialLogikleiter} from '../src/games/logikleiter/trial-bank';
import {trialUmfrageduell} from '../src/games/umfrageduell/trial-bank';
import {assessApprovedPrograms,matchingApprovedChoice}
 from '../src/features/experience/approved-program-finder';

const roster=Array.from({length:3},(_,i)=>({id:'team-'+i,name:'Team '+(i+1),order:i}));
async function reviewed(game:ContentItem['game'],payload:unknown):Promise<ContentItem>{
 const draft=createDraft(game,payload,123);
 return validateItem({...draft,status:'approved' as const,review:{
  reviewer:'Originalquelle geprüft',note:'Nur synthetische Tests: echte Freigabe nicht vorgenommen',
  checkedAt:123,fingerprint:await sha256(JSON.stringify(draft.payload)),
  checklist:[true,true,true,true] as [true,true,true,true],
 }});
}
async function originals():Promise<ContentItem[]>{
 const board=sampleQuiztafel('kurz',roster);
 const items:ReadonlyArray<readonly [ContentItem['game'],unknown]>=[
  ...RQ_TRIAL_BANK.map(payload=>['rundenquiz',payload] as const),
  ...board.tiles.map(t=>['quiztafel',{...t,
   categoryName:board.categories.find(c=>c.id===t.categoryId)!.name}] as const),
  ...trialVerbindungen('kurz',roster).map(payload=>['verbindungen',payload] as const),
  ...trialLogikleiter('kurz').map(payload=>['logikleiter',payload] as const),
  ...trialUmfrageduell('kurz').map(payload=>['umfrageduell',payload] as const),
 ];
 return Promise.all(items.map(([game,payload])=>reviewed(game,payload)));
}
describe('U18 authentic reviewed program finder, no shadow pack authority',()=>{
 it('is empty and fail-closed with unreviewed content; creates no game automatically',async()=>{
  const items=[createDraft('rundenquiz',RQ_TRIAL_BANK[0]!,123)];
  const raw=JSON.stringify(items);
  const result=await assessApprovedPrograms(items);
  expect(result.choices).toHaveLength(45);
  expect(result.usableCount).toBe(0);
  expect(result.approvedCount).toBe(0);
  expect(matchingApprovedChoice(result,'rundenquiz','kurz',3)?.missing.length).toBeGreaterThan(0);
  expect(JSON.stringify(items)).toBe(raw);
 });
 it('qualifies all five genuine engine source packs in short 3-team format, never fabricating 5-team requirements',async()=>{
  const all=await originals();
  const result=await assessApprovedPrograms(all);
  expect(result.invalidFingerprints).toBe(0);
  expect(result.approvedCount).toBe(all.length);
  for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as const){
   const actual=matchingApprovedChoice(result,game,'kurz',3);
   expect(actual?.ready,game+': '+actual?.reason).toBe(true);
   expect(actual?.missing).toEqual([]);
  }
  expect(matchingApprovedChoice(result,'verbindungen','lang',5)?.ready).toBe(false);
  expect(matchingApprovedChoice(result,'quiztafel','standard',3)?.ready).toBe(false);
  expect(matchingApprovedChoice(result,'rundenquiz','standard',3)?.ready).toBe(false);
  expect(matchingApprovedChoice(result,'logikleiter','standard',3)?.ready).toBe(false);
 });
 it('distinguishes numeric counts from structural integrity for a corrupted original quiz board',async()=>{
  const board=sampleQuiztafel('kurz',roster);
  const base=board.tiles.map(tile=>({
   ...tile,categoryName:board.categories.find(c=>c.id===tile.categoryId)!.name,
  }));
  // Nine tile records exist, but the first category has no second row.
  const corrupted=base.map((tile,i)=>i===1?{...tile,id:'u18-unusable-field',row:6,value:600}:tile);
  const items=await Promise.all(corrupted.map(p=>reviewed('quiztafel',p)));
  expect(coverage(items,'quiztafel','kurz',3).ready).toBe(true);
  expect(()=>selectReviewedPack(items,'quiztafel','kurz',3)).toThrow();
  const result=await assessApprovedPrograms(items);
  const candidate=matchingApprovedChoice(result,'quiztafel','kurz',3)!;
  expect(candidate.ready).toBe(false);
  expect(candidate.missing).toEqual([]);
  expect(candidate.reason.length).toBeGreaterThan(5);
 });
 it('rejects a SHA-mismatched previously approved source even when enough valid-looking items remain',async()=>{
  const source=await Promise.all(trialLogikleiter('kurz').map(x=>reviewed('logikleiter',x)));
  const ready=await assessApprovedPrograms(source);
  expect(matchingApprovedChoice(ready,'logikleiter','kurz',3)?.ready).toBe(true);
  const corrupt=[...source];
  corrupt[0]={...source[0]!,review:{...source[0]!.review!,fingerprint:'a'.repeat(64)}};
  const actual=await assessApprovedPrograms(corrupt);
  expect(actual.invalidFingerprints).toBe(1);
  expect(actual.usableCount).toBe(0);
  expect(actual.approvedCount).toBe(3);
  expect(matchingApprovedChoice(actual,'logikleiter','kurz',3)?.missing).toContain('rungs: 2 / 3');
 });
 it('does not falsely promote a submitted but unapproved draft or quarantine to a selected program',async()=>{
  const source=await Promise.all(trialLogikleiter('kurz').map(x=>reviewed('logikleiter',x)));
  const changed=[...source];
  changed[1]={...changed[1]!,status:'review',review:undefined};
  const actual=await assessApprovedPrograms(changed);
  expect(matchingApprovedChoice(actual,'logikleiter','kurz',3)?.ready).toBe(false);
  expect(matchingApprovedChoice(actual,'logikleiter','kurz',3)?.missing).toContain('rungs: 2 / 3');
 });
 it('matches each combination by canonical ID only, not a label or unrelated readiness',async()=>{
  const source=await Promise.all(trialLogikleiter('kurz').map(x=>reviewed('logikleiter',x)));
  const result=await assessApprovedPrograms(source);
  expect(matchingApprovedChoice(result,'logikleiter','kurz',3)?.ready).toBe(true);
  expect(matchingApprovedChoice(result,'rundenquiz','kurz',3)?.ready).toBe(false);
  expect(matchingApprovedChoice(result,'logikleiter','lang',3)?.ready).toBe(false);
 });
});
