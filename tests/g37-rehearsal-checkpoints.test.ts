import {describe,it,expect} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {trialDraftItems} from '../src/content/trial-draft-bundle';
import {GAME_TYPES} from '../src/domain/game/contracts';
import {buildEveningCueSheet,currentEveningCue,markForCue,validRehearsalMarks,
 toggleRehearsalMark,rehearsalProgress,nextTeamTurnCue,nextUntestedCue
} from '../src/content/evening-rehearsal-queue';
import {PreparationRepository,assertSavedPreparation,prepareSavedDraft,
 reconcileSavedDraft,previewSelectiveRecovery,commitSelectiveRecovery
} from '../src/content/pack-draft-store';
const bank=trialDraftItems();
describe('G37 source-specific, nonapproving original five-game rehearsal',()=>{
 it('supports actual original team handoff and rehearsal progress for all 45 game/configurations',()=>{
  for(const profile of ['kurz','standard','lang'] as const)
   for(const teams of [3,4,5] as const){
    const sheet=buildEveningCueSheet(bank,profile,teams);
    let marked=[] as ReturnType<typeof validRehearsalMarks>;
    expect(sheet.teamTurns.map(x=>x.game)).toEqual(GAME_TYPES);
    for(const game of GAME_TYPES){
     const first=sheet.cues.find(x=>x.game===game&&(x.phase==='ready'||x.phase==='prepared')&&x.sourceId);
     expect(first).toBeTruthy();
     marked=toggleRehearsalMark(sheet,marked,first!);
     const teamCue=nextTeamTurnCue(sheet,game,0);
     if(teamCue)expect(teamCue.teamNumber).toBeGreaterThanOrEqual(1);
    }
    const progress=rehearsalProgress(sheet,marked);
    expect(progress.done).toBe(5);
    expect(progress.total).toBeGreaterThan(5);
    expect(progress.publicationAuthorized).toBe(false);
    expect(sheet.status).toBe('NO_GO');
   }
  expect(bank).toHaveLength(79);
 });
 it('marks each source slot once regardless of four or five host phases and allows explicit undo',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=currentEveningCue(sheet,'rundenquiz',0)!;
  const secondPhase=currentEveningCue(sheet,'rundenquiz',1)!;
  expect(markForCue(first)).toEqual(markForCue(secondPhase));
  const once=toggleRehearsalMark(sheet,[],first);
  expect(rehearsalProgress(sheet,once).done).toBe(1);
  const twice=toggleRehearsalMark(sheet,once,secondPhase);
  expect(twice).toEqual([]);
  const repeated=validRehearsalMarks(sheet,[...once,...once]);
  expect(repeated).toHaveLength(1);
  expect(nextUntestedCue(sheet,once,'rundenquiz',0)?.slot).not.toBe(first.slot);
 });
 it('navigates only authentic team-labelled tasks and never fabricates shared-team turns',()=>{
  const sheet=buildEveningCueSheet(bank,'standard',5);
  for(const team of [1,2,3,4,5]){
   const cue=nextTeamTurnCue(sheet,'rundenquiz',0,team);
   expect(cue?.teamNumber).toBe(team);
   expect(['quiztafel','verbindungen']).toContain(cue?.game);
  }
  expect(nextTeamTurnCue(sheet,'rundenquiz',0,6)).toBeNull();
  expect(nextTeamTurnCue(sheet,'rundenquiz',0)?.teamNumber).toBe(1);
  expect(nextUntestedCue(sheet,[], 'rundenquiz',0)?.sourceId).toBeTruthy();
 });
 it('rejects stale, duplicate or forged rehearsal marks after original selected source changes',()=>{
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=sheet.cues[0]!,valid=toggleRehearsalMark(sheet,[],first);
  const replaced=buildEveningCueSheet(bank,'kurz',3,{rundenquiz:{'wissen:1':'rq-w4'}});
  expect(validRehearsalMarks(replaced,valid)).toEqual([]);
  const corrupted=[{...valid[0]!,sourceRevision:12345}];
  expect(validRehearsalMarks(sheet,corrupted)).toEqual([]);
  expect(validRehearsalMarks(sheet,[...valid,...valid])).toHaveLength(1);
  expect(toggleRehearsalMark(sheet,[],sheet.cues.find(x=>x.sourceId===null)??first))
   .toHaveLength(1);
 });
 it('writes source-only rehearsals through original G33 CAS and restores after real IndexedDB reopen',async()=>{
  const factory=new IDBFactory(),a=new PreparationRepository(factory,'g37-save');
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=sheet.cues[0]!,marks=toggleRehearsalMark(sheet,[],first);
  const input={game:'rundenquiz' as const,profile:'kurz' as const,
   teams:3 as const,step:0,selections:{},rehearsed:marks};
  const initial=await prepareSavedDraft(bank,input,1);
  expect(JSON.stringify(initial)).not.toContain('"payload"');
  expect(initial.release).toBe('NO_GO');
  await a.save(initial,null);
  await a.close();
  const b=new PreparationRepository(factory,'g37-save');
  const restored=(await b.read())!;
  expect(restored.rehearsed).toEqual(marks);
  expect((await reconcileSavedDraft(restored,bank)).status).toBe('ready');
  await b.save(await prepareSavedDraft(bank,{...input,step:5},2),1);
  await expect(b.save(await prepareSavedDraft(bank,{...input,step:9},2),1))
   .rejects.toMatchObject({code:'CONFLICT'});
  expect((await b.read())?.rehearsed).toEqual(marks);
  await b.close();
 });
 it('rejects fraudulent rehearsal approval markers, incorrect revisions and unrelated source keys',async()=>{
  const base=await prepareSavedDraft(bank,{game:'rundenquiz',profile:'kurz',teams:3,
   step:0,selections:{}},1);
  const source=base.assignments.find(x=>x.game==='rundenquiz'&&x.slot==='wissen:1')!;
  const good={game:'rundenquiz' as const,slot:'wissen:1',sourceId:source.id!,
   sourceRevision:base.sources.find(x=>x.id===source.id)!.revision};
  for(const forged of [{...good,sourceId:'fake-original'},
   {...good,sourceRevision:good.sourceRevision+1},
   {...good,slot:'category:1'}, {...good,game:'umfrageduell'}]){
   expect(()=>assertSavedPreparation({...base,rehearsed:[forged]})).toThrow();
  }
  expect(()=>assertSavedPreparation({...base,rehearsed:[good,good]})).toThrow();
  expect(assertSavedPreparation({...base,rehearsed:[good]}).release).toBe('NO_GO');
  expect(assertSavedPreparation({...base,rehearsed:[good]}).sourceOnly).toBe(true);
  expect(assertSavedPreparation({...base,rehearsed:undefined}).rehearsed).toEqual([]);
 });
 it('selective recovery invalidates only changed-source marks while preserving unaffected rehearsals',async()=>{
  const factory=new IDBFactory(),repo=new PreparationRepository(factory,'g37-recovery');
  const sheet=buildEveningCueSheet(bank,'kurz',3);
  const first=sheet.cues[0]!,other=sheet.cues.find(x=>
   x.game==='rundenquiz'&&x.slot==='wissen:2')!;
  const marks=toggleRehearsalMark(sheet,toggleRehearsalMark(sheet,[],first),other);
  const saved=await prepareSavedDraft(bank,{game:'rundenquiz',profile:'kurz',
   teams:3,step:0,selections:{},rehearsed:marks},1);
  await repo.save(saved,null);
  const changed=bank.map(x=>x.id===first.sourceId?
   {...x,revision:x.revision+1}:x);
  const proposal=await previewSelectiveRecovery(saved,changed);
  expect(proposal.cleared.some(x=>x.slot==='wissen:1')).toBe(true);
  const recovered=await commitSelectiveRecovery(repo,saved,changed,proposal);
  expect(recovered.rehearsed).toHaveLength(1);
  expect(recovered.rehearsed?.[0]?.slot).toBe('wissen:2');
  expect((await reconcileSavedDraft(recovered,changed)).status).toBe('ready');
  await repo.close();
 });
});
