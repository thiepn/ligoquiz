import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {GAME_TYPES} from '../src/domain/game/contracts';
import {buildEveningCueSheet,markForCue,toggleRehearsalMark} from '../src/content/evening-rehearsal-queue';
import {buildTeamRotation,nextRotationTurn,rotationDecisionSummary,HOLD_REASONS,
 rotationLane,buildRotationWorkQueue,nextActionableRotationTurn,nextBlockedRotationTurn,
 setEditorialHold,validEditorialHolds} from '../src/content/team-turn-rotation';
import {prepareSavedDraft,PreparationRepository,reconcileSavedDraft,
 previewSelectiveRecovery,commitSelectiveRecovery,assertSavedPreparation
} from '../src/content/pack-draft-store';

const bank=trialDraftItems();
describe('G38 original source-bound team-turn practice and G10 correction decisions',()=>{
 it('builds real round-robin opportunities for each original game/profile/3–5-team choice',()=>{
  let combinations=0;
  for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const sheet=buildEveningCueSheet(bank,profile,teams);
    const rotation=buildTeamRotation(sheet,teams,[]);
    expect(rotation.teams).toBe(teams);
    expect(rotation.perTeam.map(t=>t.team)).toEqual(Array.from({length:teams},(_,i)=>i+1));
    expect(rotation.balanced).toBe(true);
    expect(rotation.perTeam.every(t=>t.assigned>0&&t.rehearsed===0)).toBe(true);
    expect(rotation.turns.slice(0,teams*2).map(t=>t.team))
     .toEqual(Array.from({length:teams*2},(_,i)=>i%teams+1));
    expect(rotation.turns.every(t=>GAME_TYPES.includes(t.game))).toBe(true);
    expect(rotation.turns.every(t=>t.sourceId===null||
     bank.some(x=>x.id===t.sourceId))).toBe(true);
    expect(rotation.release).toBe('NO_GO');
    expect(rotation.canPlay).toBe(false);
    expect(rotation.canPublish).toBe(false);
    expect(rotationDecisionSummary(rotation).rightsApproved).toBe(false);
    combinations+=5;
   }
  expect(combinations).toBe(45);
  expect(bank).toHaveLength(79);
 });
 it('moves to the next distinct actual team and accounts for source-specific marking',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=buildTeamRotation(sheet,3,[]);
  expect(first.turns[0]?.team).toBe(1);
  const p=first.turns[0]!;
  expect(nextRotationTurn(first,p.game,p.localIndex)?.team).toBe(2);
  const marked=toggleRehearsalMark(sheet,[],sheet.cues[p.cueIndex]!);
  const updated=buildTeamRotation(sheet,3,marked);
  expect(updated.perTeam[0]?.rehearsed).toBe(1);
  expect(updated.perTeam[1]?.rehearsed).toBe(0);
  expect(nextRotationTurn(updated,p.game,p.localIndex)?.team).toBe(2);
  expect(nextRotationTurn(updated,p.game,p.localIndex,3)?.team).toBe(3);
  expect(nextRotationTurn(updated,p.game,p.localIndex,6)).toBeNull();
  expect(rotationDecisionSummary(updated)).toMatchObject({done:1,rightsApproved:false});
 });
 it('does not fabricate individual turns for shared Rundenquiz and excludes missing-source marks',()=>{
  const original=buildEveningCueSheet(bank,'kurz',3);
  const base=buildTeamRotation(original,3,[]);
  expect(base.turns.every(x=>x.game!=='rundenquiz'&&x.game!=='logikleiter')).toBe(true);
  expect(base.turns.length).toBeGreaterThan(6);
  const missing=base.turns[0]!;
  const edited=buildEveningCueSheet(bank,'kurz',3,
   {[missing.game]:{[missing.slot]:''}});
  const rotation=buildTeamRotation(edited,3,[]);
  expect(rotation.turns.find(t=>t.game===missing.game&&t.slot===missing.slot)?.missing).toBe(true);
  const mark=markForCue(edited.cues.find(c=>c.game===missing.game&&c.slot===missing.slot)??null);
  expect(mark).toBeNull();
  expect(rotation.release).toBe('NO_GO');
 });
 it('sets, changes and clears original G10 question/source/rights/rules holds without an approval',()=>{
  const sheet=buildEveningCueSheet(bank,'standard',4);
  const first=sheet.cues.find(c=>c.teamNumber===1&&(c.phase==='ready'||c.phase==='prepared'))!;
  let holds=validEditorialHolds(sheet,[]);
  for(const reason of HOLD_REASONS){
   holds=setEditorialHold(sheet,holds,first,reason);
   expect(holds).toHaveLength(1);
   expect(holds[0]?.reason).toBe(reason);
   expect(buildTeamRotation(sheet,4,[],holds).perTeam[0]?.held).toBe(1);
  }
  holds=setEditorialHold(sheet,holds,first,null);
  expect(holds).toEqual([]);
  expect(setEditorialHold(sheet,[],first,'invented' as 'question')).toEqual([]);
 });
 it('rejects changed question source/revision, malformed rights hold and forged extra fields',async()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=sheet.cues.find(c=>c.teamNumber===1&&(c.phase==='ready'||c.phase==='prepared'))!;
  const good=setEditorialHold(sheet,[],first,'rights');
  const updated=bank.map(item=>item.id===good[0]?.sourceId?
   {...item,revision:item.revision+1}:item);
  const fresh=buildEveningCueSheet(updated,'kurz',3);
  expect(validEditorialHolds(fresh,good)).toEqual([]);
  const draft=await prepareSavedDraft(bank,{game:'quiztafel',profile:'kurz',
   teams:3,step:0,selections:{},holds:good},1);
  expect(draft.holds).toEqual(good);
  expect(draft.release).toBe('NO_GO');
  expect(JSON.stringify(draft)).not.toContain('"payload"');
  expect(JSON.stringify(draft)).not.toContain('"answer"');
  for(const invalid of [
   {...good[0]!,reason:'approved'},
   {...good[0]!,sourceRevision:9999},
   {...good[0]!,slot:'tile:99:1'},
   {...good[0]!,secret:'private answer'},
  ])expect(()=>assertSavedPreparation({...draft,holds:[invalid]})).toThrow();
  expect(()=>assertSavedPreparation({...draft,holds:[good[0],good[0]]})).toThrow();
  expect(()=>assertSavedPreparation({...draft,rehearsed:[{
   ...good[0]!,reason:undefined,secret:'answer'
  }]})).toThrow();
 });
 it('keeps valid team decisions through real IndexedDB reopen and blocks lost CAS races',async()=>{
  const factory=new IDBFactory(),first=new PreparationRepository(factory,'g38-team-cas'),
   second=new PreparationRepository(factory,'g38-team-cas');
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const cue=sheet.cues.find(c=>c.teamNumber===1&&(c.phase==='ready'||c.phase==='prepared'))!;
  const holds=setEditorialHold(sheet,[],cue,'source');
  const rehearsed=toggleRehearsalMark(sheet,[],cue);
  const input={game:cue.game,profile:'kurz' as const,teams:3 as const,
   step:cue.localIndex,selections:{},holds,rehearsed};
  const saved=await prepareSavedDraft(bank,input,1);
  await first.save(saved,null);
  expect((await second.read())?.holds).toEqual(holds);
  await first.save(await prepareSavedDraft(bank,{...input,step:cue.localIndex+1},2),1);
  await expect(second.save(await prepareSavedDraft(bank,{...input,step:22},2),1))
   .rejects.toMatchObject({code:'CONFLICT'});
  await first.close();await second.close();
  const reopened=new PreparationRepository(factory,'g38-team-cas');
  expect((await reopened.read())?.rehearsed).toEqual(rehearsed);
  expect((await reopened.read())?.holds).toEqual(holds);
  await reopened.close();
 });
 it('recovery preserves only unrelated valid editorial holds when a selected source is revised',async()=>{
  const factory=new IDBFactory(),repo=new PreparationRepository(factory,'g38-recovery');
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const cues=sheet.cues.filter(c=>c.teamNumber!==null&&(c.phase==='ready'||c.phase==='prepared'));
  const a=cues[0]!,b=cues.find(c=>c.game!==a.game&&c.sourceId!==a.sourceId)!;
  const holds=setEditorialHold(sheet,setEditorialHold(sheet,[],a,'rights'),b,'question');
  const draft=await prepareSavedDraft(bank,{game:a.game,profile:'kurz',
   teams:3,step:a.localIndex,selections:{},holds},1);
  await repo.save(draft,null);
  const updated=bank.map(item=>item.id===a.sourceId?
   {...item,revision:item.revision+1}:item);
  const proposal=await previewSelectiveRecovery(draft,updated);
  const recovered=await commitSelectiveRecovery(repo,draft,updated,proposal);
  expect(recovered.holds).toHaveLength(1);
  expect(recovered.holds?.[0]?.sourceId).toBe(b.sourceId);
  expect((await reconcileSavedDraft(recovered,updated)).status).toBe('ready');
  expect(recovered.release).toBe('NO_GO');
  await repo.close();
 });
});

describe('G39 source-aware actionable moderator queue',()=>{
 it('partitions every original 3–5 team slot exactly once without authorizing play',()=>{
  for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const sheet=buildEveningCueSheet(bank,profile,teams);
    const rotation=buildTeamRotation(sheet,teams,[]);
    const queue=buildRotationWorkQueue(rotation);
    expect(queue.practice.length+queue.hold.length+queue.source.length+
     queue.done.length).toBe(rotation.turns.length);
    expect(queue.practice.every(t=>t.sourceId!==null&&!t.missing&&!t.rehearsed&&
     t.onHold===null)).toBe(true);
    expect(queue.perTeam.map(t=>t.team)).toEqual(
     Array.from({length:teams},(_,i)=>i+1));
    expect(queue.perTeam.every(t=>t.practice+t.hold+t.source+t.done===
     rotation.perTeam[t.team-1]!.assigned)).toBe(true);
    expect(queue.release).toBe('NO_GO');
    expect(queue.publicationAuthorized).toBe(false);
   }
 });
 it('skips correction-held and missing-source turns while retaining independent turns',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=buildTeamRotation(sheet,3,[]).turns;
  const a=first[0]!,b=first[1]!,c=first[2]!;
  const missingSheet=buildEveningCueSheet(bank,'kurz',3,
   {[b.game]:{[b.slot]:''}});
  const heldCue=missingSheet.cues.find(x=>x.game===a.game&&x.slot===a.slot&&
   (x.phase==='ready'||x.phase==='prepared'))!;
  const holds=setEditorialHold(missingSheet,[],heldCue,'rights');
  const rotation=buildTeamRotation(missingSheet,3,[],holds);
  const queue=buildRotationWorkQueue(rotation);
  expect(queue.hold.some(t=>t.game===a.game&&t.slot===a.slot)).toBe(true);
  expect(queue.source.some(t=>t.game===b.game&&t.slot===b.slot)).toBe(true);
  expect(rotationLane(rotation.turns.find(t=>t.slot===c.slot&&t.game===c.game)!))
   .toBe('practice');
  const next=nextActionableRotationTurn(rotation,a.game,a.localIndex);
  expect(next).not.toBeNull();
  expect(next!.slot).not.toBe(a.slot);
  expect(next!.slot).not.toBe(b.slot);
  expect(nextBlockedRotationTurn(rotation,a.game,a.localIndex,'hold')).toMatchObject({
   slot:a.slot,sourceId:a.sourceId});
  expect(nextBlockedRotationTurn(rotation,a.game,a.localIndex,'source')).toMatchObject({
   slot:b.slot});
  expect(nextActionableRotationTurn(rotation,a.game,a.localIndex,6)).toBeNull();
  expect(nextBlockedRotationTurn(rotation,a.game,a.localIndex,'hold',0)).toBeNull();
 });
 it('moves a source from held to practice, then done; all held turns remain blocked',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const turn=buildTeamRotation(sheet,3,[]).turns[0]!;
  const cue=sheet.cues[turn.cueIndex]!;
  const hold=setEditorialHold(sheet,[],cue,'question');
  const held=buildTeamRotation(sheet,3,[],hold);
  expect(rotationLane(held.turns[0]!)).toBe('hold');
  expect(nextActionableRotationTurn(held,turn.game,turn.localIndex,turn.team))
   ?.slot).not.toBe(turn.slot);
  const cleared=buildTeamRotation(sheet,3,[],setEditorialHold(sheet,hold,cue,null));
  expect(rotationLane(cleared.turns[0]!)).toBe('practice');
  const marked=toggleRehearsalMark(sheet,[],cue);
  const completed=buildTeamRotation(sheet,3,marked);
  expect(rotationLane(completed.turns[0]!)).toBe('done');
  expect(buildRotationWorkQueue(completed).done).toHaveLength(1);
  const changed=bank.map(x=>x.id===turn.sourceId?{...x,revision:x.revision+1}:x);
  const fresh=buildEveningCueSheet(changed,'kurz',3);
  expect(buildRotationWorkQueue(buildTeamRotation(fresh,3,marked,hold)).hold)
   .toHaveLength(0);
 });
 it('reports exhaustion correctly when every practice slot is blocked or complete',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const cues=sheet.cues.filter(x=>x.teamNumber!==null&&
   (x.phase==='ready'||x.phase==='prepared')&&x.sourceId!==null);
  const held=cues.reduce((acc,cue)=>setEditorialHold(sheet,acc,cue,'source'),
   [] as EditorialHold[]);
  const rotation=buildTeamRotation(sheet,3,[],held);
  expect(buildRotationWorkQueue(rotation).practice).toHaveLength(0);
  expect(nextActionableRotationTurn(rotation,'quiztafel',0)).toBeNull();
  expect(rotation.release).toBe('NO_GO');
 });
});
