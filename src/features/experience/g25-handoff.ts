import {z} from 'zod';
import {GAME_TYPES,type GameType} from '../../domain/game/contracts';
import {CHECKS,SCENARIOS,reconcileTrial,sha256Buffer} from './event-trial';
import {LEGACY_V113_INVENTORY} from '../../content/editorial-audit';
import type {AuditCode} from '../../content/editorial-audit';

export const G25_PARENT_HEAD='a38e922af3f7e8c1004788205a09d2610b227467' as const;
export const G25_G23_HEAD='d88e8c0289b36d1af7e0253b7f7c0c6a372df183' as const;
const games=z.enum(GAME_TYPES);
const hex=z.string().regex(/^[a-f0-9]{64}$/);
const issueCodes=z.enum([
 'INVALID_PAYLOAD','PLACEHOLDER_PROMPT','PLACEHOLDER_ANSWER','SOURCE_PLACEHOLDER',
 'REFERENCE_UNSPECIFIC','RIGHTS_NOT_DOCUMENTED','HISTORIC_APPROVAL_UNVERIFIED',
 'ILLUSTRATIVE_SURVEY','ANSWER_ECHO','EXACT_DUPLICATE','POSSIBLE_DUPLICATE',
 'SOURCE_ORIGIN_UNKNOWN',
]);
const issue=z.strictObject({
 id:z.string().min(1).max(128),game:games,code:issueCodes,severity:z.enum(['blocker','review']),
 other:z.string().min(1).max(128).optional(),
});
const sourceManifest=z.strictObject({
 sourcePath:z.literal(LEGACY_V113_INVENTORY.sourcePath),
 sourceBlobSha:z.literal(LEGACY_V113_INVENTORY.sourceBlobSha),
 declaredVersion:z.literal('v1.13'),
 declaredContentHash:z.literal(LEGACY_V113_INVENTORY.declaredContentHash),
 declaredTotal:z.literal(706),declaredActive:z.literal(704),declaredRejected:z.literal(2),
 baselineReviewRecords:z.literal(366),additionRecords:z.literal(340),
 familyActive:z.strictObject({cb:z.literal(300),rs:z.literal(192),cl:z.literal(48),cs:z.literal(38),
  cw:z.literal(20),lg:z.literal(54),svg:z.literal(39),svl:z.literal(13)}),
 sourceKinds:z.literal(8),actualVerifiedOriginalQuestions:z.literal(0),
 originalIndependentRightsDecisions:z.literal(0),legacyMappedToV2:z.literal(0),
});
const counts=z.number().int().min(0).max(100000);
const editorialExport=z.strictObject({
 format:z.literal('ligoquiz-g23-content-issues-export-v1'),
 sourceManifest,scannedLocalEntries:counts,localApprovalClaims:counts,blockers:counts,reviewFlags:counts,
 byGame:z.strictObject({rundenquiz:counts,quiztafel:counts,verbindungen:counts,logikleiter:counts,umfrageduell:counts}),
 issueIndex:z.array(issue).max(10000),
 pendingPreview:z.union([z.null(),z.strictObject({
  sourceType:z.string().min(1).max(100),records:counts,draftCandidates:counts,quarantined:counts,
  typedIssueCount:counts,importIsApproval:z.literal(false),
  originalLegacyCoverageCertified:z.literal(false),sourceBytes:counts,bundleHash:hex,
 })]),
 originalQuestionTextIncluded:z.literal(false),originalAnswersIncluded:z.literal(false),
 sourceRightsApproved:z.literal(false),independentFactualReviewCompleted:z.literal(false),
 original704Imported:z.literal(false),mergeAuthorized:z.literal(false),
 deploymentAuthorized:z.literal(false),release:z.literal('NO_GO'),
});
export type RehearsalFinding={scenarioId:string;game:GameType;teams:number;label:string;
 checkId:typeof CHECKS[number]['id'];title:string;status:'open'|'reported'|'defect'};
export type PilotEvidence={name:string;sha256:string;source:'G18 local SHA-256 self-consistency';
 reported:number;open:number;defects:number;findings:RehearsalFinding[];
 originalSignerVerified:false;humanWitnessConfirmed:false;actualPhysicalAcceptance:false};
export type EditorialFinding={id:string;game:GameType;code:AuditCode;severity:'blocker'|'review';other?:string};
export type EditorialEvidence={name:string;sha256:string;source:'G23 local editorial index (self-reported)';
 scanned:number;locallyApproved:number;blockers:number;reviewFlags:number;
 byGame:Record<GameType,number>;issues:EditorialFinding[];
 copyrightLicenseConfirmed:false;factualAccuracyConfirmed:false;independentReviewerConfirmed:false};
export type HandoffInput={pilot:PilotEvidence|null;editorial:EditorialEvidence|null};
export type HandoffIssue={id:string;category:'pilot'|'content';severity:'blocker'|'review';
 label:string;game:GameType|null;scenarioId?:string;checkId?:string;contentId?:string};
const bytes=new TextEncoder();
function parseJson(raw:string,max:number,kind:string):unknown{
 if(bytes.encode(raw).byteLength===0||bytes.encode(raw).byteLength>max)
  throw Error(kind+': Datei leer oder zu groß');
 try{return JSON.parse(raw) as unknown}catch{throw Error(kind+': ungültiges JSON');}
}
async function digest(raw:string){return sha256Buffer(bytes.encode(raw).buffer as ArrayBuffer);}
export async function parsePilotEvidence(raw:string,name:string):Promise<PilotEvidence>{
 const source=parseJson(raw,256*1024,'Generalprobe');
 const report=await reconcileTrial(source);
 const findings:RehearsalFinding[]=[];
 for(const s of SCENARIOS){
  const row=report.rows.find(r=>r.scenarioId===s.id);
  if(!row)throw Error('Generalprobe unvollständig');
  for(const check of CHECKS){
   findings.push({scenarioId:s.id,game:s.game,teams:s.teams,label:s.label,
    checkId:check.id,title:check.title,status:row.checks[check.id]});
  }
 }
 const result={
  name:name.slice(0,150),sha256:await digest(raw),
  source:'G18 local SHA-256 self-consistency' as const,
  reported:findings.filter(f=>f.status==='reported').length,
  open:findings.filter(f=>f.status==='open').length,
  defects:findings.filter(f=>f.status==='defect').length,
  findings,originalSignerVerified:false as const,humanWitnessConfirmed:false as const,
  actualPhysicalAcceptance:false as const,
 };
 if(result.reported!==report.summary.reported||result.defects!==report.summary.defects||
    result.open!==report.summary.open)throw Error('Generalprobe: Zahlendifferenz');
 return result;
}
export async function parseEditorialEvidence(raw:string,name:string):Promise<EditorialEvidence>{
 const parsed=parseJson(raw,512*1024,'Redaktionsindex');
 const data=editorialExport.parse(parsed);
 if(data.scannedLocalEntries!==Object.values(data.byGame).reduce((a,b)=>a+b,0)||
  data.localApprovalClaims>data.scannedLocalEntries||
  data.blockers!==data.issueIndex.filter(x=>x.severity==='blocker').length||
  data.reviewFlags!==data.issueIndex.filter(x=>x.severity==='review').length||
  data.issueIndex.some(x=>!data.byGame[x.game]))
  throw Error('Redaktionsindex: widersprüchliche Summen oder Aufgabenverteilung');
 // An editorial JSON packet is only a self-reported issue index, never a signed original review.
 return {name:name.slice(0,150),sha256:await digest(raw),
  source:'G23 local editorial index (self-reported)',scanned:data.scannedLocalEntries,
  locallyApproved:data.localApprovalClaims,blockers:data.blockers,reviewFlags:data.reviewFlags,
  byGame:{...data.byGame},issues:data.issueIndex.map(v=>({...v})),
  copyrightLicenseConfirmed:false,factualAccuracyConfirmed:false,independentReviewerConfirmed:false,
 };
}
export function assembleHandoff({pilot,editorial}:HandoffInput){
 const issues:HandoffIssue[]=[];
 if(pilot){
  for(const f of pilot.findings.filter(x=>x.status!=='reported')){
   issues.push({id:'pilot:'+f.scenarioId+':'+f.checkId,category:'pilot',
    severity:f.status==='defect'?'blocker':'review',
    label:(f.status==='defect'?'Problem notiert: ':'Noch offen: ')+f.title,
    game:f.game,scenarioId:f.scenarioId,checkId:f.checkId});
  }
 }
 if(editorial){
  for(const f of editorial.issues){
   issues.push({id:'content:'+f.id+':'+f.code,category:'content',severity:f.severity,
    label:f.code.replaceAll('_',' '),game:f.game,contentId:f.id});
  }
 }
 const blockers=issues.filter(x=>x.severity==='blocker').length;
 const missing:string[]=[];
 if(!pilot)missing.push('G18-Originalprotokoll fehlt');
 if(!editorial)missing.push('G23-Redaktionsindex fehlt');
 if(pilot&&pilot.reported!==105)missing.push('15 × 7 real zu prüfende Generalproben nicht vollständig als durchgeführt notiert');
 if(editorial&&(editorial.blockers||editorial.reviewFlags||editorial.scanned===0))
  missing.push('Offene Inhaltsfälle / keine bestätigte freigegebene Fragenbasis');
 // A note, ZIP, CI artifact, screenshot or unsigned local checksum cannot establish release authority.
 missing.push('Unabhängige Original-Hardware-/Saalprüfung fehlt');
 missing.push('Unabhängige Fakten-, Lizenz- und Quellenfreigabe fehlt');
 missing.push('Isoliert autorisierter Original-Backup-Restore fehlt');
 missing.push('Eigentümerfreigabe für Merge, Migration und Deployment fehlt');
 return {format:'ligoquiz-g25-rc-handoff-no-go-v1' as const,head:G25_PARENT_HEAD,
  sourceG23Head:G25_G23_HEAD,pilot:pilot?{name:pilot.name,sha256:pilot.sha256,
   selfReported:pilot.reported,open:pilot.open,defects:pilot.defects}:null,
  editorial:editorial?{name:editorial.name,sha256:editorial.sha256,scanned:editorial.scanned,
   locallyApproved:editorial.locallyApproved,blockers:editorial.blockers,
   reviewFlags:editorial.reviewFlags,byGame:editorial.byGame}:null,
  issues,blockers,missing,sourceFilesEmbedded:false as const,questionTextEmbedded:false as const,
  independentHardwareConfirmed:false as const,independentEditorialConfirmed:false as const,
  originalRestoreApproved:false as const,ownerApproved:false as const,
  mergeAuthorized:false as const,deployAuthorized:false as const,release:'NO_GO' as const,
 };
}
export function handoffJson(input:HandoffInput){return JSON.stringify(assembleHandoff(input),null,2);}
export function handoffCsv(input:HandoffInput){
 const report=assembleHandoff(input),columns=['Kategorie','Schwere','Spiel','Szenario','Prüfpunkt','Inhalt-ID','Code'];
 const safe=(s:string)=>{const trimmed=s.replace(/[\r\n\t]+/g,' ').trim();
  const protectedValue=/^[=+@-]/.test(trimmed)?"'"+trimmed:trimmed;
  return '"'+protectedValue.replace(/"/g,'""')+'"';};
 const rows=report.issues.map(x=>[x.category,x.severity,x.game??'',x.scenarioId??'',
  x.checkId??'',x.contentId??'',x.label]);
 return '\uFEFF'+[columns,...rows].map(r=>r.map(safe).join(';')).join('\r\n')+'\r\n';
}
