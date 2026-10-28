import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {contentReviewTasks,adjacentSourceReviewTask} from '../src/content/editorial-source-review';
const bank=trialDraftItems();
describe('G40 source review cursor over the original unauthorised question bank',()=>{
 it('preserves source custody, 79 draft IDs and route partitioning',()=>{
  const tasks=contentReviewTasks(bank);
  expect(tasks).toHaveLength(79);
  expect(new Set(tasks.map(task=>task.item.id)).size).toBe(79);
  expect(tasks.every(task=>task.item.status==='draft'&&!task.item.review)).toBe(true);
  expect(tasks.filter(x=>x.route==='primary')).toHaveLength(12);
  expect(tasks.filter(x=>x.route==='illustrative')).toHaveLength(10);
  expect(tasks.filter(x=>x.route==='lookup')).toHaveLength(57);
 });
 it('navigates forward and backward only over currently filtered real source tasks',()=>{
  const tasks=contentReviewTasks(bank).filter(x=>x.route==='lookup'&&
   x.item.game==='verbindungen');
  expect(tasks.length).toBeGreaterThan(1);
  expect(adjacentSourceReviewTask(tasks,null,1)?.item.id).toBe(tasks[0]!.item.id);
  expect(adjacentSourceReviewTask(tasks,null,-1)?.item.id).toBe(tasks.at(-1)!.item.id);
  expect(adjacentSourceReviewTask(tasks,tasks[0]!.item.id,-1)?.item.id).toBe(tasks.at(-1)!.item.id);
  expect(adjacentSourceReviewTask(tasks,tasks.at(-1)!.item.id,1)?.item.id).toBe(tasks[0]!.item.id);
  expect(adjacentSourceReviewTask(tasks,'forged-id',1)?.item.id).toBe(tasks[0]!.item.id);
  expect(adjacentSourceReviewTask(tasks,'forged-id',-1)?.item.id).toBe(tasks.at(-1)!.item.id);
 });
 it('handles empty and singleton groups without inventing a source or an approval',()=>{
  const task=contentReviewTasks(bank)[0]!;
  expect(adjacentSourceReviewTask([],task.item.id,1)).toBeNull();
  expect(adjacentSourceReviewTask([task],task.item.id,1)).toEqual(task);
  expect(adjacentSourceReviewTask([task],task.item.id,-1)).toEqual(task);
  expect(adjacentSourceReviewTask([task],'not-selected',1)).toEqual(task);
  expect(task.lead).not.toBeNull();
 });
});
