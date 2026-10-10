import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createEvent} from '../src/domain/event/transition';
import {encodeBackup} from '../src/resilience/backup';
import {assembleHandoff} from '../src/features/experience/g25-handoff';
import {G26_QUALIFIED_PARENT,G26_PARENT_BUNDLE,inspectManifest,inspectHandoff,inspectBackup,
 releaseCutoverStatus,rollbackInstructions,type CutoverInputs} from '../src/features/experience/g26-cutover';

const manifest=()=>({
 format:'ligoquiz-g12-build-evidence-v1',gitSha:G26_QUALIFIED_PARENT,
 validatedCheckoutSha:'cacf2a1f58b5927486ec9b061092e06d0ba458ce',
 deploymentPath:'relative',expectedScope:'./',
 offlinePrecache:['index.html','manifest.webmanifest','icons/ligoquiz.svg',
   'assets/index-B9_XT94O.js','assets/index-BIvmk1EM.css'],
 files:['assets/index-B9_XT94O.js','assets/index-B9_XT94O.js.map','assets/index-BIvmk1EM.css',
   'icons/ligoquiz.svg','index.html','manifest.webmanifest','sw.js'].map((path,index)=>({
   path,sha256:(String(index)+ '0'.repeat(63)).slice(0,64)})),
 bundleSha256:G26_PARENT_BUNDLE,
 rollbackRules:['Preserve original v1.14 main and legacy-origin browser profile.',
  'Never auto-migrate active v1 data or overwrite an existing event ID.',
  'Require human-controlled preview, backup exports, and physical signoff before cutover.'],
});
const fixtures=()=>createEvent({
 id:'private-g26-event',hostId:'private-g26-host',at:1000,
 teams:[0,1,2].map(i=>({id:'team-'+i,name:'Private team '+i,order:i,colorToken:'t'+i})),
 program:[{id:'g26-demo',type:'rundenquiz',profile:'kurz',order:0,rulesVersion:'demo-only'}],
 frozenTasks:[{taskId:'test-001',gameType:'rundenquiz',publicPrompt:'Test?',
  publicClues:[],privateAnswers:['Sensitive answer'],sourceContentId:'demo',sourceHash:'demo'}],
});
describe('G26 read-only cutover and rollback',()=>{
 it('ingests exactly qualified G25 source manifest without claiming original assets were checked',async()=>{
  const m=await inspectManifest(JSON.stringify(manifest()));
  expect(m.qualifiedHead).toBe(G26_QUALIFIED_PARENT);
  expect(m.bundleSha256).toBe(G26_PARENT_BUNDLE);
  expect(m.fileCount).toBe(7);
  expect(m.originalAssetBytesCompared).toBe(false);
  expect(m.relativeScope).toBe(true);
 });
 it('rejects cross-origin scope, wrong head, duplicated paths, spoofed rollback and path traversal',async()=>{
  const x=manifest();x.expectedScope='/' as never;
  await expect(inspectManifest(JSON.stringify(x))).rejects.toThrow();
  x.expectedScope='./';x.gitSha='another-head' as never;
  await expect(inspectManifest(JSON.stringify(x))).rejects.toThrow();
  x.gitSha=G26_QUALIFIED_PARENT;
  x.files[1]!.path=x.files[0]!.path;
  await expect(inspectManifest(JSON.stringify(x))).rejects.toThrow(/Dateiliste/);
  x.files=manifest().files;
  x.files[0]!.path='../index.html';
  await expect(inspectManifest(JSON.stringify(x))).rejects.toThrow();
  await expect(inspectManifest('{}')).rejects.toThrow();
  await expect(inspectManifest('x'.repeat(65537))).rejects.toThrow();
 });
 it('accepts only G25 NO_GO summary, never external independent signer claims',async()=>{
  const x=JSON.stringify(assembleHandoff({pilot:null,editorial:null}));
  const v=await inspectHandoff(x);
  expect(v.independentReviewConfirmed).toBe(false);
  expect(v.pilotSelfReported).toBeNull();
  expect(v.openDefects).toBe(0);
  const forge=JSON.parse(x);forge.ownerApproved=true;
  await expect(inspectHandoff(JSON.stringify(forge))).rejects.toThrow();
  forge.ownerApproved=false;forge.release='GO';
  await expect(inspectHandoff(JSON.stringify(forge))).rejects.toThrow();
 });
 it('reads original G11 backup into paused-only preview without restoring or exposing identity',async()=>{
  const dbName='g26-fixture-'+crypto.randomUUID();
  const store=new EventRepository(fakeIndexedDB,dbName);
  try{
   await store.create(fixtures());
   const text=await encodeBackup(await store.exportBackup('private-g26-event'));
   const view=await inspectBackup(text);
   expect(view.eventId).toBe('private-g26-event');
   expect(view.recoveryPlan).toBe('paused');
   expect(view.restoreExecuted).toBe(false);
   expect(view.originalBytesWritten).toBe(false);
   const report=releaseCutoverStatus({manifest:null,handoff:null,backup:view});
   expect(JSON.stringify(report)).not.toContain('private-g26-event');
   expect(JSON.stringify(report)).not.toContain('Private team');
   expect(JSON.stringify(report)).not.toContain('Sensitive answer');
   expect(await store.get('private-g26-event')).toEqual(fixtures());
   expect((await store.listSessions()).items).toHaveLength(1);
   const forged=JSON.parse(text);
   forged.payload.event.teams[0].name='tampered';
   await expect(inspectBackup(JSON.stringify(forged))).rejects.toThrow(/Prüfsumme/);
  }finally{await store.close();}
 });
 it('missing source and valid source never enable cutover or non-consensual rollback',async()=>{
  const inputs:CutoverInputs={manifest:null,handoff:null,backup:null};
  const empty=releaseCutoverStatus(inputs);
  expect(empty.release).toBe('NO_GO');
  expect(empty.deployAuthorized).toBe(false);
  expect(empty.localWritePerformed).toBe(false);
  expect(empty.checks.filter(x=>x.state==='external-open')).toHaveLength(4);
  inputs.manifest=await inspectManifest(JSON.stringify(manifest()));
  inputs.handoff=await inspectHandoff(JSON.stringify(assembleHandoff({pilot:null,editorial:null})));
  const loaded=releaseCutoverStatus(inputs);
  expect(loaded.checks.filter(x=>x.state==='metadata-only')).toHaveLength(2);
  expect(loaded.ownerReleaseAuthorization).toBe(false);
  expect(loaded.isolatedRestorePerformed).toBe(false);
  expect(loaded.originalLegacyBrowserPreserved).toBe(true);
 });
 it('rollback instructions cannot be mistaken for deployment script or consent',()=>{
  const text=rollbackInstructions();
  expect(text).toContain('NO_GO');
  expect(text).toContain('main/v1.14');
  expect(text).toContain('isolierten');
  expect(text).not.toContain('curl -');
  expect(text).not.toContain('rm -rf');
 });
});
