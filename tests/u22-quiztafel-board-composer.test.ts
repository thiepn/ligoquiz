import {describe,expect,it} from 'vitest';
import {createDraft,validateItem,type ContentItem} from '../src/content/contracts';
import {sha256} from '../src/content/migration';
import {sampleQuiztafel} from '../src/games/quiztafel/trial-bank';
import {DEPTH,verifyBoard} from '../src/games/quiztafel/engine';
import {parseSetupDraft,newSetupDraft} from '../src/features/experience/model';
import {
 reviewedQuiztafelChoices,selectedQuiztafelBoardStatus,selectedReviewedQuiztafelBoard,
} from '../src/features/experience/quiztafel-board-composer';

const teams=Array.from({length:5},(_,i)=>({id:'team-'+i,name:'Team '+(i+1),order:i}));
async function review(payload:unknown):Promise<ContentItem>{
 const draft=createDraft('quiztafel',payload,42);
 return validateItem({...draft,status:'approved',review:{
  reviewer:'Synthetic test only',checkedAt:42,
  note:'Synthetic test approval. No independent real-world rights established.',
  checklist:[true,true,true,true],
  fingerprint:await sha256(JSON.stringify(draft.payload)),
 }});
}
async function originals(){
 const board=sampleQuiztafel('kurz',teams);
 const items=await Promise.all(board.tiles.map(t=>review({
  ...t,categoryName:board.categories.find(c=>c.id===t.categoryId)!.name,
 })));
 return {board,items};
}
describe('U22 source-backed Quiztafel original cell board composition',()=>{
 it('exposes only current SHA-reviewed question prompts and category/point values, never answers',async()=>{
  const {board,items}=await originals(),original=JSON.stringify(items);
  const alternative={...board.tiles.find(x=>x.categoryId==='natur'&&x.row===1)!,
   id:'qt-natur-1-alternative',prompt:'Testalternative zu Natur 100'};
  const data=[...items,await review({...alternative,categoryName:'Natur & Technik'})];
  const view=await reviewedQuiztafelChoices(data);
  expect(view.excluded).toBe(0);
  expect(view.tiles).toHaveLength(16);
  expect(view.tiles.find(t=>t.id===alternative.id)?.prompt).toBe(alternative.prompt);
  expect(view.tiles.every(t=>!Object.hasOwn(t,'answer')&&!Object.hasOwn(t,'reference'))).toBe(true);
  expect(JSON.stringify(items)).toBe(original);
 });
 it('creates nondefault three-category board with exact original canonical value/row and an alternative question',async()=>{
  const {board,items}=await originals();
  const alt={...board.tiles.find(t=>t.categoryId==='natur'&&t.row===1)!,
   id:'qt-natur-alternative',prompt:'Eigene geprüfte Alternative für 100'};
  const pool=[...items,await review({...alt,categoryName:'Natur & Technik'})];
  const choices=(await reviewedQuiztafelChoices(pool)).tiles;
  const selected=['natur','geschichte','geografie'].flatMap(categoryId=>
   Array.from({length:DEPTH.kurz},(_,i)=>{
    const row=i+1;
    return categoryId==='natur'&&row===1?alt.id:
     choices.find(t=>t.categoryId===categoryId&&t.row===row)!.id;
   }));
  const status=selectedQuiztafelBoardStatus('kurz',3,choices,selected);
  expect(status.exact).toBe(true);
  expect(status.selected).toBe(9);
  expect(status.categories).toBe(3);
  const result=selectedReviewedQuiztafelBoard(pool,'kurz',3,selected);
  expect(result.categories.map(c=>c.id)).toEqual(['geografie','geschichte','natur']);
  expect(new Set(result.tiles.map(t=>t.id))).toEqual(new Set(selected));
  expect(result.tiles.find(t=>t.id===alt.id)?.value).toBe(100);
  verifyBoard({teams:teams.slice(0,3),...result,profile:'kurz'});
 });
 it('never substitutes a missing tile or silently accepts an extra category, duplicated row or revoked source',async()=>{
  const {items}=await originals(),choices=(await reviewedQuiztafelChoices(items)).tiles;
  const selected=['natur','geschichte','geografie'].flatMap(categoryId=>
   [1,2,3].map(row=>choices.find(t=>t.categoryId===categoryId&&t.row===row)!.id));
  expect(selectedQuiztafelBoardStatus('kurz',3,choices,selected).exact).toBe(true);
  expect(selectedQuiztafelBoardStatus('kurz',3,choices,selected.slice(1)).exact).toBe(false);
  expect(selectedQuiztafelBoardStatus('kurz',3,choices,[...selected,selected[0]!]).exact).toBe(false);
  const illegal=[...selected.slice(0,-1),choices.find(x=>x.categoryId==='bibel')!.id];
  expect(selectedQuiztafelBoardStatus('kurz',3,choices,illegal).exact).toBe(false);
  expect(()=>selectedReviewedQuiztafelBoard(items,'kurz',3,illegal)).toThrow();
  expect(()=>selectedReviewedQuiztafelBoard(items,'kurz',3,selected.slice(1))).toThrow();
  expect(()=>selectedReviewedQuiztafelBoard(items,'kurz',3,[...selected.slice(0,-1),'forged-id'])).toThrow();
  expect(()=>selectedReviewedQuiztafelBoard(items.filter(i=>i.id!==selected[0]),'kurz',3,selected)).toThrow();
  expect(()=>selectedReviewedQuiztafelBoard(items.map(i=>i.id===selected[0]?{...i,status:'review',review:undefined}:i),'kurz',3,selected)).toThrow();
 });
 it('cannot offer tampered, draft, or revoked SHA-approval candidates and never fabricates category coverage',async()=>{
  const {items}=await originals();
  const affected=items[0]!;
  const changed=[...items.slice(1),{...affected,review:{...affected.review!,fingerprint:'f'.repeat(64)}},
   {...items[1]!,id:'unapproved-copy',status:'draft' as const,review:undefined}];
  const data=await reviewedQuiztafelChoices(changed);
  expect(data.excluded).toBe(2);
  expect(data.tiles.some(t=>t.id===affected.id)).toBe(false);
  expect(data.tiles.every(t=>t.id!=='unapproved-copy')).toBe(true);
 });
 it('uses original setup draft, accepts punctuation IDs, bounds to 30 cells and keeps old saves compatible',()=>{
  const draft=newSetupDraft();
  expect(parseSetupDraft(draft)?.qtTileIds).toBeUndefined();
  expect(parseSetupDraft({...draft,qtTileIds:['a-id','board.row:1','c/3']})?.qtTileIds)
   .toEqual(['a-id','board.row:1','c/3']);
  expect(parseSetupDraft({...draft,qtTileIds:['x','x']})?.qtTileIds).toBeUndefined();
  expect(parseSetupDraft({...draft,qtTileIds:Array.from({length:31},(_,i)=>'id'+i)})?.qtTileIds).toBeUndefined();
 });
});
