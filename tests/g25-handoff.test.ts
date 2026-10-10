import {describe,it,expect} from 'vitest';
import {SCENARIOS,CHECKS,blankTrialRow,sealTrial} from '../src/features/experience/event-trial';
import {createDraft} from '../src/content/contracts';
import {auditLibrary,exportAudit} from '../src/content/editorial-audit';
import {parsePilotEvidence,parseEditorialEvidence,assembleHandoff,handoffJson,handoffCsv}
 from '../src/features/experience/g25-handoff';

const noPilot=async()=>JSON.stringify(await sealTrial({},'Synthetic fixture without human observer'));
const noEditorial=()=>exportAudit(auditLibrary([]),null);
describe('G25 original-source release candidate debrief fail-closed',()=>{
 it('never treats missing files or 0 warnings as a released or accepted event',()=>{
  const out=assembleHandoff({pilot:null,editorial:null});
  expect(out.release).toBe('NO_GO');
  expect(out.ownerApproved).toBe(false);
  expect(out.missing).toEqual(expect.arrayContaining([
   'G18-Originalprotokoll fehlt','G23-Redaktionsindex fehlt']));
  expect(out.issues).toHaveLength(0);
  expect(out.deployAuthorized).toBe(false);
 });
 it('parses actual original G18 15×7 checksum envelope without human approval',async()=>{
  const x=await parsePilotEvidence(await noPilot(),'fixture-untrusted.json');
  expect(x.findings).toHaveLength(SCENARIOS.length*CHECKS.length);
  expect(x.open).toBe(105);expect(x.reported).toBe(0);expect(x.defects).toBe(0);
  expect(x.humanWitnessConfirmed).toBe(false);
  expect(x.originalSignerVerified).toBe(false);
  expect(x.sha256).toMatch(/^[0-9a-f]{64}$/);
 });
 it('rejects tampered SHA G18 JSON, forged approvals, excessive and invalid files',async()=>{
  const source=JSON.parse(await noPilot());
  source.packet.rows[0].checks.venue='reported';
  await expect(parsePilotEvidence(JSON.stringify(source),'forged.json')).rejects.toThrow();
  source.packet.ownerApproved=true;
  await expect(parsePilotEvidence(JSON.stringify(source),'forged.json')).rejects.toThrow();
  await expect(parsePilotEvidence('','blank')).rejects.toThrow();
  await expect(parsePilotEvidence('x'.repeat(256*1024+5),'too-large')).rejects.toThrow();
  await expect(parsePilotEvidence('{broken','broken')).rejects.toThrow();
 });
 it('reports each explicitly noted defect, retaining scenario/team and no private operator notes',async()=>{
  const row=blankTrialRow('quiztafel-4');row.checks.recovery='defect';
  row.checks.venue='reported';row.note='Private operator note SHOULD NEVER EXPORT';
  const p=await parsePilotEvidence(JSON.stringify(await sealTrial({'quiztafel-4':row},
   'Secret venue information SHOULD NEVER EXPORT')),'g18-original.json');
  const pack=assembleHandoff({pilot:p,editorial:null});
  expect(pack.blockers).toBe(1);
  expect(pack.issues).toContainEqual(expect.objectContaining({
   id:'pilot:quiztafel-4:recovery',severity:'blocker',scenarioId:'quiztafel-4',game:'quiztafel'}));
  expect(JSON.stringify(pack)).not.toContain('SHOULD NEVER EXPORT');
  expect(pack.pilot?.sha256).toBe(p.sha256);
  expect(pack.release).toBe('NO_GO');
 });
 it('accepts G23 redacted original exported schema; recognizes local approval as self-report only',async()=>{
  const local=createDraft('rundenquiz',{id:'g25-local',round:'wissen',
   prompt:'Welches Element hat das chemische Symbol Au?',answer:'Gold',
   reference:'NIST Chemistry WebBook: Gold',durationSeconds:30});
  const raw=exportAudit(auditLibrary([local]),null);
  const inspected=await parseEditorialEvidence(raw,'local-audit.json');
  expect(inspected.scanned).toBe(1);
  expect(inspected.locallyApproved).toBe(0);
  expect(inspected.blockers).toBe(0);
  expect(inspected.reviewFlags).toBe(1);
  expect(inspected.issues[0]?.code).toBe('RIGHTS_NOT_DOCUMENTED');
  expect(inspected.copyrightLicenseConfirmed).toBe(false);
  expect(inspected.factualAccuracyConfirmed).toBe(false);
  expect(inspected.independentReviewerConfirmed).toBe(false);
 });
 it('rejects fake source rights GO, inconsistent issue totals and unbound legacy source',async()=>{
  const source=JSON.parse(noEditorial());
  source.sourceRightsApproved=true;
  await expect(parseEditorialEvidence(JSON.stringify(source),'forged')).rejects.toThrow();
  source.sourceRightsApproved=false;
  source.release='GO';
  await expect(parseEditorialEvidence(JSON.stringify(source),'go')).rejects.toThrow();
  source.release='NO_GO';source.sourceManifest.sourceBlobSha='f'.repeat(40);
  await expect(parseEditorialEvidence(JSON.stringify(source),'other')).rejects.toThrow();
  source.sourceManifest.sourceBlobSha='0dc9c86abd4bda3b67fb7f4774429ba04578c76f';
  source.byGame.rundenquiz=9;
  await expect(parseEditorialEvidence(JSON.stringify(source),'bad-counter')).rejects.toThrow(/widersprüchliche/);
 });
 it('CSV and JSON are private-answer-free, Excel safe and remain NO_GO',async()=>{
  const p=await parsePilotEvidence(await noPilot(),'G18 source');
  const local=createDraft('rundenquiz',{id:'=HYPERLINK("https://evil")',round:'wissen',
   prompt:'Was ist acht mal acht?',answer:'64',reference:'Grundlagen der Mathematik 1',durationSeconds:30});
  // G10 allows source IDs as strings: fail-closed export must escape leading formula markers.
  const e=await parseEditorialEvidence(exportAudit(auditLibrary([local]),null),'source');
  const json=handoffJson({pilot:p,editorial:e}),csv=handoffCsv({pilot:p,editorial:e});
  expect(json).not.toContain('Was ist acht mal acht?');
  expect(json).not.toContain('Grundlagen der Mathematik');
  // Content IDs are retained for owner reconciliation; text and answers are never included.
  expect(json).toContain('https://evil');
  expect(JSON.parse(json)).toMatchObject({release:'NO_GO',ownerApproved:false,
   questionTextEmbedded:false,originalRestoreApproved:false});
  expect(csv).toContain('\uFEFF');
  expect(csv).toContain('"\'=HYPERLINK');
  expect(csv).not.toContain('Was ist acht mal acht?');
 });
});
