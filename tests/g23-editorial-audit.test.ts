import {describe,it,expect} from 'vitest';
import {createDraft,type ContentItem} from '../src/content/contracts';
import {previewFile} from '../src/content/migration';
import {auditLibrary,auditPreview,exportAudit,LEGACY_V113_INVENTORY} from '../src/content/editorial-audit';

const make=(id='audited-one',prompt='Welches chemische Element hat das Symbol Au?',reference='NIST Chemistry WebBook: Gold (Au)'):ContentItem=>
 createDraft('rundenquiz',{id,round:'wissen',prompt,answer:'Gold',reference,durationSeconds:30},123);
const codeList=(items:readonly ContentItem[])=>auditLibrary(items).issues.map(x=>x.code);
describe('G23 source-rights and content-only editor checks',()=>{
 it('labels original source metadata as claims, not imported or independently approved content',()=>{
  expect(LEGACY_V113_INVENTORY.declaredActive).toBe(704);
  expect(LEGACY_V113_INVENTORY.declaredTotal).toBe(706);
  expect(LEGACY_V113_INVENTORY.baselineReviewRecords+LEGACY_V113_INVENTORY.additionRecords).toBe(706);
  expect(Object.values(LEGACY_V113_INVENTORY.familyActive).reduce((a,b)=>a+b,0)).toBe(704);
  const scan=auditLibrary([]);
  expect(scan).toMatchObject({scanned:0,approvedLocally:0,originalHumanApprovalConfirmed:false,
   factualAccuracyVerified:false,copyrightLicensesApproved:false,productionImportAuthorized:false});
 });
 it('flags original starter placeholder and missing provenance without granting approval',()=>{
  const draft=createDraft('rundenquiz',{id:'g23-placeholder',round:'wissen',
   prompt:'Neue Frage – bitte konkretisieren',answer:'Prüfbare Antwort',
   reference:'Quellenbeleg hinzufügen',durationSeconds:30});
  const scan=auditLibrary([draft]);
  expect(codeList([draft])).toEqual(expect.arrayContaining([
   'PLACEHOLDER_PROMPT','PLACEHOLDER_ANSWER','SOURCE_PLACEHOLDER','RIGHTS_NOT_DOCUMENTED']));
  expect(scan.approvedLocally).toBe(0);
  expect(scan.blockers).toBeGreaterThan(2);
 });
 it('keeps source rights and illustrative survey review separate from G10 locally approved status',()=>{
  const a=make(),approved:ContentItem={...a,status:'approved',
   provenance:{...a.provenance,origin:'legacy',sourceKey:'ligo.quiz.content.library.v1',
    bundleHash:'f'.repeat(64),rights:'owner self-assertion only'},
   review:{reviewer:'Local editor',checkedAt:123,note:'Local editor signed checklist without third-party evidence',
    fingerprint:'a'.repeat(64),checklist:[true,true,true,true]}};
  const scan=auditLibrary([approved]);
  expect(scan.approvedLocally).toBe(1);
  expect(scan.issues.some(x=>x.code==='HISTORIC_APPROVAL_UNVERIFIED')).toBe(true);
  expect(scan.copyrightLicensesApproved).toBe(false);
  expect(scan.originalHumanApprovalConfirmed).toBe(false);
 });
 it('detects duplicate normalized prompts and near-identical rephrasings but excludes independent genres',()=>{
  const one=make('g23-one','Welches chemische Element hat im Periodensystem das Symbol Au und die Ordnungszahl 79?'),
   same=make('g23-two','Welches chemische Element hat im Periodensystem das Symbol Au und die Ordnungszahl 79?');
  const similar=make('g23-three','Welches chemische Element hat im Periodensystem das Symbol Au und die Ordnungszahl 79 !');
  const scan=auditLibrary([one,same,similar]);
  expect(scan.issues.filter(x=>x.code==='EXACT_DUPLICATE').length).toBe(1);
  expect(scan.issues.filter(x=>x.code==='POSSIBLE_DUPLICATE').length).toBeGreaterThan(0);
  expect(scan.issues.some(x=>x.code==='EXACT_DUPLICATE'&&x.other===one.id)).toBe(true);
 });
 it('labels short sources as review; explicit source and self-entered rights never prove factual approval',()=>{
  const one=make('r-1','Welches chemische Element hat das Symbol Au?','Wikipedia');
  const a=auditLibrary([{...one,provenance:{origin:'manual',rights:'Author asserts own permission'}}]);
  expect(a.issues.some(x=>x.code==='SOURCE_PLACEHOLDER')).toBe(true);
  expect(a.issues.some(x=>x.code==='RIGHTS_NOT_DOCUMENTED')).toBe(false);
  expect(a.factualAccuracyVerified).toBe(false);
 });
 it('exports a redacted issue index, not original questions, answers or purported authority',async()=>{
  const item=make('id-sensitive','Super secret original question text 9483 ?',
   'Quellenbeleg hinzufügen');
  const preview=await previewFile(JSON.stringify({format:'ligo-content-pack',items:[
   {id:'legacy-1',game:'rundenquiz',payload:{...(item.payload as object),id:'old'},status:'approved'},
   {id:'legacy-2',game:'other',payload:{prompt:'hidden question'}}]}));
  const audit=auditLibrary([item]);
  const exported=exportAudit(audit,preview);
  expect(exported).not.toContain('Super secret original question text');
  expect(exported).not.toContain('hidden question');
  expect(exported).not.toContain('Gold');
  expect(JSON.parse(exported)).toMatchObject({release:'NO_GO',mergeAuthorized:false,
   deploymentAuthorized:false,sourceRightsApproved:false,original704Imported:false,
   pendingPreview:{records:2,importIsApproval:false}});
  expect(auditPreview(preview).draftCandidates).toBe(1);
 });
});
