import {describe,it,expect} from 'vitest';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {GAME_TYPES} from '../src/domain/game/contracts';
import {buildEveningCueSheet,currentEveningCue,moveEveningCue,nextUnresolvedCue
} from '../src/content/evening-rehearsal-queue';
import {composeContentPack} from '../src/content/pack-preparation';
import {buildEditorialRehearsal} from '../src/content/game-night-rehearsal';
const items=trialDraftItems();
describe('G36 original five-engine game-night moderator cue desk',()=>{
 it('reuses exact original five-game phases for all 3 profiles and 3/4/5 teams without live authority',()=>{
  let examined=0;
  for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const sheet=buildEveningCueSheet(items,profile,teams);
    expect(sheet.status).toBe('NO_GO');
    expect(sheet.canPublish).toBe(false);
    expect(sheet.teamTurns.map(x=>x.game)).toEqual(GAME_TYPES);
    expect(sheet.teamTurns.every(t=>t.count.length===teams&&t.balanced)).toBe(true);
    let accumulated=0;
    for(const game of GAME_TYPES){
     const plan=composeContentPack(items,game,profile,teams);
     const phases=buildEditorialRehearsal(plan,items).steps;
     expect(sheet.gameStarts[game]).toBe(accumulated);
     const actual=sheet.cues.filter(x=>x.game===game);
     expect(actual.map(x=>x.localIndex)).toEqual(phases.map(x=>x.index));
     expect(actual.map(x=>x.slot)).toEqual(phases.map(x=>x.slot));
     expect(actual.every(x=>x.sourceId===null||items.some(i=>i.id===x.sourceId))).toBe(true);
     expect(actual.every(x=>x.publicPromptPresent===false&&x.privateAnswerPresent===false)).toBe(true);
     accumulated+=phases.length;examined++;
    }
    expect(sheet.cues.length).toBe(accumulated);
  }
  expect(examined).toBe(45);
  expect(items).toHaveLength(79);
 });
 it('steps across original game boundaries and wraps without affecting source or event storage',()=>{
  const sheet=buildEveningCueSheet(items,'kurz',3);
  const old=JSON.stringify(items);
  const next=moveEveningCue(sheet,'rundenquiz',0,1)!;
  expect(next).toMatchObject({game:'rundenquiz',localIndex:1});
  const lastR=sheet.cues.filter(x=>x.game==='rundenquiz').at(-1)!;
  const nextGame=moveEveningCue(sheet,'rundenquiz',lastR.localIndex,1)!;
  expect(nextGame).toMatchObject({game:'quiztafel',localIndex:0});
  expect(moveEveningCue(sheet,'rundenquiz',0,-1)?.game).toBe('umfrageduell');
  expect(moveEveningCue(sheet,'umfrageduell',sheet.cues.at(-1)!.localIndex,1))
   .toMatchObject({game:'rundenquiz',localIndex:0});
  expect(JSON.stringify(items)).toBe(old);
 });
 it('jumps to next distinct original source review rather than repeating same hint phase',()=>{
  const sheet=buildEveningCueSheet(items,'lang',5);
  const first=sheet.cues[0]!;
  const next=nextUnresolvedCue(sheet,first.game,first.localIndex)!;
  expect(next.needsReview).toBe(true);
  expect(next.slot).not.toBe(first.slot);
  expect(['ready','prepared']).toContain(next.phase);
  const source=items.find(i=>i.id===next.sourceId);
  expect(source?.status).toBe('draft');
 });
 it('tracks explicitly missing slots through full game-night while never rendering a public question',()=>{
  const sheet=buildEveningCueSheet(items,'kurz',3,{rundenquiz:{'wissen:1':''}});
  expect(sheet.missingSourceSlots).toBeGreaterThan(0);
  const missing=sheet.cues.filter(x=>x.slot==='wissen:1'&&x.game==='rundenquiz');
  expect(missing).toHaveLength(5);
  expect(missing.every(x=>x.sourceId===null&&x.needsReview)).toBe(true);
  expect(JSON.stringify(sheet)).not.toContain('Welcher Planet');
  expect(JSON.stringify(sheet)).not.toContain('Ich besiegte Goliat');
  expect(JSON.stringify(sheet)).not.toContain('Pythagoreisches Tripel');
  expect(sheet.status).toBe('NO_GO');
 });
 it('retains chosen source and exact game/phase after changing games and returns no phantom cursor',()=>{
  const sheet=buildEveningCueSheet(items,'kurz',3,{rundenquiz:{'wissen:1':'rq-w4'}});
  expect(currentEveningCue(sheet,'rundenquiz',0)?.sourceId).toBe('rq-w4');
  expect(currentEveningCue(sheet,'verbindungen',3)?.game).toBe('verbindungen');
  expect(currentEveningCue(sheet,'rundenquiz',900)).toBeNull();
  const untouched=buildEveningCueSheet(items,'kurz',3);
  expect(untouched.cues[0]?.sourceId).toBe('rq-w1');
  expect(sheet.canPublish).toBe(false);
 });
});
