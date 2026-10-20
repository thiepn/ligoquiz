import {describe,it,expect} from 'vitest';
import type {EventRecord} from '../src/domain/event/schemas';
import type {EventRepository} from '../src/infrastructure/db/event-repository';
import {
 createPreparedRundenquiz,createPreparedQuiztafel,createPreparedVerbindungen,
 createPreparedLogikleiter,createPreparedUmfrageduell,
} from '../src/features/experience/model';
import {completedRoundReview} from '../src/features/experience/round-review-model';

const draft={teams:['Nord','Mitte','Süd','Vier','Fünf'],count:3 as const,profile:'kurz' as const};
async function prepared(
 fn:(repo:EventRepository,draft:typeof draft)=>Promise<unknown>,
):Promise<EventRecord>{
 let original:EventRecord|null=null;
 const repo={create:async(event:EventRecord)=>{original=event;}} as unknown as EventRepository;
 await fn(repo,draft);
 if(!original)throw new Error('Original creator did not create the event');
 return original;
}
function finish(event:EventRecord):EventRecord{
 if(event.rundenquiz){
  const s=event.rundenquiz;
  return {...event,lifecycle:'complete',rundenquiz:{...s,phase:'complete',index:s.questions.length-1,
   awards:s.questions.flatMap((q,i)=>s.teams.map((team,j)=>({
    questionId:q.id,teamId:team.id,points:i===0&&j===0?10:0,
    judgement:i===0&&j===0?'richtig' as const:'keine' as const,
   }))) }};
 }
 if(event.quiztafel){
  const s=event.quiztafel;
  const ordered=[...s.tiles].reverse();
  return {...event,lifecycle:'complete',quiztafel:{...s,phase:'complete',
   usedTileIds:ordered.map(t=>t.id),turn:ordered.length,
   outcomes:ordered.map((tile,i)=>({
    tileId:tile.id,selectorId:s.teams[0]!.id,stealerId:null,
    winnerId:i===0?s.teams[0]!.id:null,points:i===0?tile.value:0,annulled:false,
   }))}};
 }
 if(event.verbindungen){
  const s=event.verbindungen;
  return {...event,lifecycle:'complete',verbindungen:{...s,phase:'complete',index:s.assignments.length,
   awards:s.assignments.flatMap((assignment,i)=>assignment.teamId?
    [{puzzleId:assignment.puzzleId,teamId:assignment.teamId,points:i===0?40:0,annulled:false}]:
    s.teams.map(t=>({puzzleId:assignment.puzzleId,teamId:t.id,points:0,annulled:false}))) }};
 }
 if(event.logikleiter){
  const s=event.logikleiter;
  return {...event,lifecycle:'complete',logikleiter:{...s,phase:'complete',index:s.rungs.length,
   awards:s.rungs.flatMap((r,i)=>s.teams.map((t,j)=>({
    rungId:r.id,teamId:t.id,points:i===0&&j===0?10:0,annulled:false,
   }))) }};
 }
 if(event.umfrageduell){
  const s=event.umfrageduell;
  return {...event,lifecycle:'complete',umfrageduell:{...s,phase:'complete',index:s.surveys.length,
   awards:s.surveys.flatMap((survey,i)=>s.teams.map((t,j)=>({
    surveyId:survey.id,teamId:t.id,points:i===0&&j===0?20:0,annulled:false,
   }))) }};
 }
 throw Error('Unsupported original event');
}

describe('U15 exact original completed-session educational recap',()=>{
 it('rejects draft, active and recovery sessions before accessing original answer material',async()=>{
  const created=await prepared(createPreparedRundenquiz);
  expect(completedRoundReview(created)).toBeNull();
  expect(completedRoundReview({...created,lifecycle:'active'})).toBeNull();
  expect(completedRoundReview({...finish(created),recoveryRequired:true})).toBeNull();
  expect(completedRoundReview({...created,lifecycle:'complete'})).toBeNull();
 });
 it('Rundenquiz uses original question ordering, right answer, references, cumulative score',async()=>{
  const event=finish(await prepared(createPreparedRundenquiz));
  const before=JSON.stringify(event);
  const review=completedRoundReview(event)!;
  expect(review.game).toBe('Rundenquiz');
  expect(review.tasks.length).toBe(event.rundenquiz!.questions.length);
  expect(review.tasks[0]).toMatchObject({
   id:event.rundenquiz!.questions[0]!.id,answer:event.rundenquiz!.questions[0]!.answer,
   source:event.rundenquiz!.questions[0]!.reference,
   teams:[{name:'Nord',points:10,total:10},{name:'Mitte',points:0,total:0},{name:'Süd',points:0,total:0}],
  });
  expect(review.tasks.at(-1)?.teams[0]?.total).toBe(10);
  expect(JSON.stringify(event)).toBe(before);
 });
 it('Quiztafel follows picked tiles, not editorial board layout, and shows authentic selector and winner',async()=>{
  const event=finish(await prepared(createPreparedQuiztafel));
  const review=completedRoundReview(event)!;
  expect(review.game).toBe('Quiztafel');
  expect(review.tasks.map(t=>t.id)).toEqual(event.quiztafel!.outcomes.map(o=>o.tileId));
  expect(review.tasks[0]?.type).toContain('300');
  expect(review.tasks[0]?.evidence).toContain('Auswahl: Nord');
  expect(review.tasks[0]?.teams[0]?.points).toBe(300);
  expect(review.tasks.at(-1)?.teams[0]?.total).toBe(300);
 });
 it('Verbindungen keeps original assignment ownership, sequence explanation and wall links',async()=>{
  const event=finish(await prepared(createPreparedVerbindungen));
  const review=completedRoundReview(event)!;
  expect(review.tasks.length).toBe(event.verbindungen!.assignments.length);
  expect(review.tasks[0]?.teams[0]?.points).toBe(40);
  expect(review.tasks.at(-1)?.type).toBe('Verbindungswand');
  expect(review.tasks.at(-1)?.answer).toContain('Evangelien');
  expect(review.tasks.at(-1)?.teams.every(t=>t.total===40||t.total===0)).toBe(true);
 });
 it('Logikleiter surfaces preserved source reasoning rather than AI-generated explanations',async()=>{
  const event=finish(await prepared(createPreparedLogikleiter));
  const review=completedRoundReview(event)!;
  expect(review.tasks.length).toBe(event.logikleiter!.rungs.length);
  expect(review.tasks[0]?.evidence).toContain(event.logikleiter!.rungs[0]!.explanation);
  expect(review.tasks[0]?.source).toBe(event.logikleiter!.rungs[0]!.reference);
  expect(review.tasks[0]?.teams[0]?.points).toBe(10);
 });
 it('Umfrageduell does not misrepresent synthetic categories as respondent measurements',async()=>{
  const event=finish(await prepared(createPreparedUmfrageduell));
  const review=completedRoundReview(event)!;
  expect(review.tasks.length).toBe(event.umfrageduell!.surveys.length);
  expect(review.tasks[0]?.evidence).toContain('BEISPIELDATEN – keine echte Umfrage');
  expect(review.tasks[0]?.answer).toContain('Snacks');
  expect(review.tasks[0]?.teams[0]?.points).toBe(20);
 });
 it('fails closed on missing/duplicate/wrong-team award receipts and score mismatch',async()=>{
  const event=finish(await prepared(createPreparedRundenquiz));
  const s=event.rundenquiz!;
  const original=s.awards;
  expect(completedRoundReview({...event,rundenquiz:{...s,awards:original.slice(1)}})).toBeNull();
  expect(completedRoundReview({...event,rundenquiz:{...s,awards:[...original,original[0]!]}})).toBeNull();
  expect(completedRoundReview({...event,rundenquiz:{...s,awards:[...original.slice(0,-1),{
   ...original.at(-1)!,teamId:'not-a-team',
  }]}})).toBeNull();
  expect(completedRoundReview({...event,rundenquiz:{...s,awards:[{
   ...original[0]!,points:Number.NaN,
  },...original.slice(1)]}})).toBeNull();
 });
 it('marks annulled original per-task award only from historical receipts',async()=>{
  const event=finish(await prepared(createPreparedVerbindungen));
  const s=event.verbindungen!;
  const altered=s.awards.map(a=>a.puzzleId===s.assignments[0]!.puzzleId?
   {...a,points:0,annulled:true}:a);
  const review=completedRoundReview({...event,verbindungen:{...s,awards:altered}})!;
  expect(review.tasks[0]?.annulled).toBe(true);
  expect(review.tasks[0]?.teams[0]?.total).toBe(0);
 });
});
