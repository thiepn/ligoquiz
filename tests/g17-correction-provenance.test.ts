import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {HostSessionController} from '../src/application/host-controller/host-session';
import {newSetupDraft,createPreparedRundenquiz,createPreparedQuiztafel,createPreparedVerbindungen,
 createPreparedLogikleiter,createPreparedUmfrageduell} from '../src/features/experience/model';
import {auditView,recoveryAdvice} from '../src/features/host/correction-provenance';
import {evidenceSource} from '../src/features/experience/visual-evidence';
import {sealObservation,reconcileObservation} from '../src/features/experience/review-reconcile';

describe('G17 source-backed correction history',()=>{
 it('five engines report only persisted audit, revision, source hashes and ownership',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g17-audit-'+crypto.randomUUID());
  try{
   const draft=newSetupDraft();
   const creators=[createPreparedRundenquiz,createPreparedQuiztafel,createPreparedVerbindungen,
    createPreparedLogikleiter,createPreparedUmfrageduell];
   for(const create of creators){
    const identity=await create(db,draft);
    const event=await db.get(identity.eventId);
    expect(event).not.toBeNull();
    const view=auditView(event!);
    expect(view).not.toBeNull();
    expect(view?.actionCount).toBe(0);
    expect(view?.engineRevision).toBe(0);
    expect(view?.sourceEvidence.frozen).toBeGreaterThan(0);
    expect(view?.anomalies).toEqual([]);
   }
  }finally{await db.close();}
 });
 it('revision and correction display comes from real engine audit, not game action guesses',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g17-real-'+crypto.randomUUID());
  try{
   const identity=await createPreparedQuiztafel(db,newSetupDraft());
   const host=new HostSessionController(db,identity.eventId,identity.hostId);
   const event=await host.load();
   const changed=await host.submit({type:'QT_ACTION',action:{type:'START'}},event,crypto.randomUUID());
   const view=auditView(changed);
   expect(view).toMatchObject({mode:'quiztafel',engineRevision:1,actionCount:1});
   expect(view?.recent[0]).toMatchObject({action:'Spielstart bestätigt',revision:1});
   expect(view?.anomalies).toEqual([]);
   const bad=structuredClone(changed);
   bad.quiztafel!.audit=[
    {revision:1,commandId:'repeat',type:'CORRECT',at:1},
    {revision:1,commandId:'repeat',type:'ANNUL',at:2}
   ];
   const warning=auditView(bad)!;
   expect(warning.corrections).toBe(2);
   expect(warning.anomalies).toContain('Nicht aufsteigende Aktionrevision');
   expect(warning.anomalies).toContain('Doppelter Befehlsnachweis');
   expect(JSON.stringify(warning)).not.toContain('repeat');
  }finally{await db.close();}
 });
 it('fail-closed recovery never automatically replays a mutation',()=>{
  expect(recoveryAdvice('STALE_HOST: Eine andere Spielleitung hat diese Sitzung übernommen'))
   .toMatchObject({type:'revoked',reload:false});
  expect(recoveryAdvice('STALE_REVISION Session has changed')).toMatchObject({type:'stale',reload:true});
  expect(recoveryAdvice('Wiederhergestellten Stand prüfen')).toMatchObject({type:'recovery'});
  expect(recoveryAdvice('Unexpected invalid response')).toMatchObject({type:'unknown',reload:true});
 });
});
describe('G17 local-only evidence reconciliation',()=>{
 it('sealed packet is source-bound, checksum-validated and never grants release',async()=>{
  const name=evidenceSource.files[0]!.file;
  const sealed=await sealObservation({[name]:{observation:'observed',note:'Screenshot im Test betrachtet'}},'Nur synthetisch');
  const valid=await reconcileObservation(sealed);
  expect(valid.summary).toEqual({observed:1,defects:0,unreviewed:14});
  expect(valid.releaseAuthorized).toBe(false);
  expect(valid.physicalProjectorApproved).toBe(false);
  expect(valid.mergeAuthorized).toBe(false);
 });
 it('rejects notes tampering, source swapping, false human approval, spoofed checksum and missing images',async()=>{
  const valid=await sealObservation({},'Prüfung');
  const tampered=structuredClone(valid);
  tampered.packet.records[0]!.note='Geändert';
  await expect(reconcileObservation(tampered)).rejects.toThrow(/SHA-256/);
  const forged=structuredClone(valid);
  forged.packet.humanApproval=true;
  await expect(reconcileObservation(forged)).rejects.toThrow(/Abnahmefelder/);
  const badHash=structuredClone(valid);
  badHash.packet.source.files[0].sha256='0'.repeat(64) as typeof badHash.packet.source.files[0]['sha256'];
  await expect(reconcileObservation(badHash)).rejects.toThrow(/Abnahmefelder|Bildnachweis/);
  const removed=structuredClone(valid);
  removed.packet.records.pop();
  await expect(reconcileObservation(removed)).rejects.toThrow(/unvollständig/);
  const wrong={...valid,checksum:'f'.repeat(64)};
  await expect(reconcileObservation(wrong)).rejects.toThrow(/SHA-256/);
 });
});
