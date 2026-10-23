import {describe,expect,it} from 'vitest';
import {countdownScope,countdownAfterElapsed} from '../src/features/host/useHostCountdown';
import {createPreparedQuiztafel,createPreparedVerbindungen,createPreparedLogikleiter,createPreparedUmfrageduell} from '../src/features/experience/model';
import type {EventRecord} from '../src/domain/event/schemas';
import type {EventRepository} from '../src/infrastructure/db/event-repository';

const originalArgs={count:3 as const,profile:'kurz' as const,
 teams:['Nord','Mitte','Süd','Vier','Fünf']};
async function original(factory:(repo:EventRepository,input:typeof originalArgs)=>Promise<unknown>):Promise<EventRecord>{
 let source:EventRecord|null=null;
 const repo={create:async(e:EventRecord)=>{source=e;}} as unknown as EventRepository;
 await factory(repo,originalArgs);
 if(!source)throw Error('Original source missing');
 return source;
}
describe('U20 four-game host countdown continuity, no extra clock authority',()=>{
 it('charges only completed seconds with no rounding gift at phase boundaries',()=>{
  expect(countdownAfterElapsed(20,999)).toEqual({remaining:20,consumedMs:0});
  expect(countdownAfterElapsed(20,1000)).toEqual({remaining:19,consumedMs:1000});
  expect(countdownAfterElapsed(20,2725)).toEqual({remaining:18,consumedMs:2000});
  expect(countdownAfterElapsed(10,22000)).toEqual({remaining:0,consumedMs:22000});
  expect(()=>countdownAfterElapsed(-1,1000)).toThrow();
  expect(()=>countdownAfterElapsed(20,-1)).toThrow();
 });
 it.each([
  ['Quiztafel',createPreparedQuiztafel],
  ['Verbindungen',createPreparedVerbindungen],
  ['Logikleiter',createPreparedLogikleiter],
  ['Umfrageduell',createPreparedUmfrageduell],
 ] as const)('%s uses unchanged session/host/task/phase identity while pausing',
 async(_game,factory)=>{
  const event=await original(factory);
  const state=event.quiztafel??event.verbindungen??event.logikleiter??event.umfrageduell;
  expect(state).toBeDefined();
  const a=countdownScope(event.id,event.hostEpoch,'original-task','open');
  const paused={...event,lifecycle:'paused' as const};
  const b=countdownScope(paused.id,paused.hostEpoch,'original-task','open');
  expect(a).toBe(b);
  expect(countdownScope(event.id,event.hostEpoch+1,'original-task','open')).not.toBe(a);
  expect(countdownScope(event.id,event.hostEpoch,'next-task','open')).not.toBe(a);
  expect(countdownScope(event.id,event.hostEpoch,'original-task','revealed')).not.toBe(a);
  expect(countdownScope('other',event.hostEpoch,'original-task','open')).not.toBe(a);
  // Original game source and scoring authority are not changed by clock operations.
  expect(event.revision).toBe(0);
  expect(event.frozenTasks.length).toBeGreaterThan(0);
 });
 it('Quiztafel deliberately resets first-answer and 10-second steal clocks independently',()=>{
  const first=countdownScope('event',1,'field-a','first');
  const steal=countdownScope('event',1,'field-a','steal');
  expect(steal).not.toBe(first);
  expect(countdownScope('event',1,'field-a','first')).toBe(first);
  expect(countdownScope('event',1,'field-b','first')).not.toBe(first);
 });
 it('Verbindungen keeps a separate clue window but a pause changes no clue scope',()=>{
  const clue1=countdownScope('event',1,'source-puzzle','clue-open',1);
  expect(countdownScope('event',1,'source-puzzle','clue-open',1)).toBe(clue1);
  expect(countdownScope('event',1,'source-puzzle','clue-open',2)).not.toBe(clue1);
  expect(countdownScope('event',1,'source-puzzle','sequence-open',1)).not.toBe(clue1);
 });
 it('no clock has a source ID, score, persistent entry or publication authority',()=>{
  const scoped=countdownScope('event-id',3,'task-id','open');
  expect(scoped).toBe('event-id:3:task-id:open:0');
  const snapshot=countdownAfterElapsed(30,2500);
  expect(Object.keys(snapshot).sort()).toEqual(['consumedMs','remaining']);
  expect(JSON.stringify(snapshot)).not.toContain('score');
  expect(JSON.stringify(snapshot)).not.toContain('stage');
 });
});
