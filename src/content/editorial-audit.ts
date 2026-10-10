import {GAME_TYPES,type GameType} from '../domain/game/contracts';
import {contentSignature,normalizedKey,validatePayload,type ContentItem} from './contracts';
import type {Preview} from './migration';

/**
 * Read-only transcription of metadata declared inside original main/index.html.
 * These are NOT externally verified counts, rights, accuracy or v2-imported items.
 * The source consists of 366 baseline review keys and 340 addition review keys.
 */
export const LEGACY_V113_INVENTORY={
 sourcePath:'main/index.html',sourceBlobSha:'0dc9c86abd4bda3b67fb7f4774429ba04578c76f',
 declaredVersion:'v1.13',declaredContentHash:'b10e3b9e387f91d9a4efa077d966787bfad67030911aed94dcb619e7446f7664',
 declaredTotal:706,declaredActive:704,declaredRejected:2,
 baselineReviewRecords:366,additionRecords:340,
 familyActive:{cb:300,rs:192,cl:48,cs:38,cw:20,lg:54,svg:39,svl:13},
 sourceKinds:8,actualVerifiedOriginalQuestions:0,originalIndependentRightsDecisions:0,
 legacyMappedToV2:0,
} as const;

export type IssueSeverity='blocker'|'review';
export type AuditCode='INVALID_PAYLOAD'|'PLACEHOLDER_PROMPT'|'PLACEHOLDER_ANSWER'|
 'SOURCE_PLACEHOLDER'|'REFERENCE_UNSPECIFIC'|'RIGHTS_NOT_DOCUMENTED'|
 'HISTORIC_APPROVAL_UNVERIFIED'|'ILLUSTRATIVE_SURVEY'|'ANSWER_ECHO'|
 'EXACT_DUPLICATE'|'POSSIBLE_DUPLICATE'|'SOURCE_ORIGIN_UNKNOWN';
export type AuditIssue={id:string;game:GameType;code:AuditCode;severity:IssueSeverity;message:string;other?:string};
export type EditorialAudit={
 format:'ligoquiz-g23-editorial-audit-v1';scanned:number;approvedLocally:number;
 draft:number;inReview:number;quarantined:number;blockers:number;reviewFlags:number;
 byGame:Record<GameType,number>;issues:AuditIssue[];originalHumanApprovalConfirmed:false;
 factualAccuracyVerified:false;copyrightLicensesApproved:false;productionImportAuthorized:false;
};
const placeholder=/^(?:todo|tbd|unbekannt|neu(?:e|er|es)?\b|beispiel\b|prüfbare antwort\b|einzige richtige lösung\b|eindeutiges ziel\b|quellenbeleg\b|quelle\b|quellenbeleg hinzufügen\b|eine frage\b)/iu;
const refEmpty=/^(?:quelle|quellenbeleg|quellenbeleg hinzufügen|referenz|bibeltext|wikipedia|internet|google|beispiel|unbekannt|todo)(?:[\s:;.!]*|\s+hinzufügen)$/iu;
const sentence=(v:unknown)=>typeof v==='string'?v.trim():'';
const punctuation=(s:string)=>normalizedKey(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const STOP=new Set(['der','die','das','ein','eine','einer','eines','ist','sind','war','waren','was','welche','welcher','welches','wurde','wie','von','und','oder','im','in','am','an','den','des','zu','mit']);
function tokens(s:string){return new Set(punctuation(s).split(' ').filter(v=>v.length>=3&&!STOP.has(v)));}
function similar(a:string,b:string){
 if(!a||!b||Math.min(a.length,b.length)<30)return false;
 const aa=tokens(a),bb=tokens(b);
 if(aa.size<5||bb.size<5)return false;
 let hits=0;for(const token of aa)if(bb.has(token))hits++;
 const union=aa.size+bb.size-hits;
 return union>0&&hits/union>=.83;
}
function prompt(item:ContentItem){
 const p=item.payload as {prompt?:string;target?:string;kind?:string;round?:string};
 if(item.game==='rundenquiz'&&p.round==='hinweise')return '';
 return sentence(p.prompt??p.target);
}
function source(item:ContentItem){
 const p=item.payload as {reference?:string;source?:{kind?:string;source?:string}};
 return sentence(p.reference??p.source?.source);
}
function report(item:ContentItem,code:AuditCode,severity:IssueSeverity,message:string,other?:string):AuditIssue{
 return {id:item.id,game:item.game,code,severity,message,...(other?{other}:{})};
}
export function auditLibrary(items:readonly ContentItem[]):EditorialAudit{
 const issues:AuditIssue[]=[],prior=new Map<string,ContentItem>(),prompts:ContentItem[]=[];
 const byGame=Object.fromEntries(GAME_TYPES.map(game=>[game,0])) as Record<GameType,number>;
 for(const item of items){
  byGame[item.game]++;
  if(item.status==='quarantined')continue;
  const problems=validatePayload(item.game,item.payload);
  if(problems.length)issues.push(report(item,'INVALID_PAYLOAD','blocker','Spielregel-Datensatz ungültig: '+problems[0]));
  const p=item.payload as {answer?:string;source?:{kind?:string;reviewed?:boolean}};
  const text=prompt(item),answer=sentence(p.answer),reference=source(item);
  if(text&&placeholder.test(text))issues.push(report(item,'PLACEHOLDER_PROMPT','blocker','Platzhalter-Frage noch nicht fertiggestellt'));
  if(answer&&placeholder.test(answer))issues.push(report(item,'PLACEHOLDER_ANSWER','blocker','Platzhalter-Antwort nicht geprüft'));
  if(item.game!=='umfrageduell'){
   if(!reference||refEmpty.test(reference))
    issues.push(report(item,'SOURCE_PLACEHOLDER','blocker','Keine überprüfbare konkrete Quellenangabe'));
   else if(!/[0-9/.:§-]/u.test(reference)&&reference.trim().split(/\s+/).length<3)
    issues.push(report(item,'REFERENCE_UNSPECIFIC','review','Quelle ist nicht präzise genug, extern überprüfen'));
   if(answer&&reference&&punctuation(answer)===punctuation(reference))
    issues.push(report(item,'ANSWER_ECHO','review','Quellenfeld wiederholt nur die Antwort'));
  }else if(p.source?.kind==='illustrative'){
   issues.push(report(item,'ILLUSTRATIVE_SURVEY','review',
    'Nur erfundene Spielverteilung; niemals als echte Umfrage behaupten'));
  }
  if(!sentence(item.provenance.rights)){
   issues.push(report(item,'RIGHTS_NOT_DOCUMENTED','review',
    'Urheberschaft, Lizenz oder Nutzungsrecht nicht dokumentiert'));
  }
  if((item.provenance.origin==='legacy'||item.provenance.origin==='pack')&&item.status==='approved')
   issues.push(report(item,'HISTORIC_APPROVAL_UNVERIFIED','review',
    'Alte Inhaltsfreigabe begründet keine unabhängig verifizierte Rechte-/Faktenfreigabe'));
  if((item.provenance.origin==='legacy'||item.provenance.origin==='pack')&&!item.provenance.bundleHash)
   issues.push(report(item,'SOURCE_ORIGIN_UNKNOWN','blocker','Importierter Datensatz ohne Quellbundle-Hash'));
  const signature=contentSignature(item);
  if(signature){
   const found=prior.get(signature);
   if(found&&found.id!==item.id)
    issues.push(report(item,'EXACT_DUPLICATE','blocker','Gleicher Fragenkern wie '+found.id,found.id));
   else prior.set(signature,item);
  }
  if(text&&text.length>=30)prompts.push(item);
 }
 // Pair comparisons use a bounded candidate bucket rather than O(n²) globally.
 const buckets=new Map<string,ContentItem[]>();
 for(const item of prompts){
  const key=item.game+'|'+punctuation(prompt(item)).slice(0,14);
  const bucket=buckets.get(key)??[];
  for(const previous of bucket){
   if(contentSignature(previous)===contentSignature(item))continue;
   if(similar(prompt(item),prompt(previous)))
    issues.push(report(item,'POSSIBLE_DUPLICATE','review',
     'Ähnliche Fragestellung zu '+previous.id+' – Redaktion entscheidet',previous.id));
  }
  if(bucket.length<100)bucket.push(item);
  buckets.set(key,bucket);
 }
 issues.sort((a,b)=>a.id.localeCompare(b.id)||a.code.localeCompare(b.code));
 return {
  format:'ligoquiz-g23-editorial-audit-v1',scanned:items.length,
  approvedLocally:items.filter(x=>x.status==='approved').length,
  draft:items.filter(x=>x.status==='draft').length,
  inReview:items.filter(x=>x.status==='review').length,
  quarantined:items.filter(x=>x.status==='quarantined').length,
  blockers:issues.filter(x=>x.severity==='blocker').length,
  reviewFlags:issues.filter(x=>x.severity==='review').length,byGame,issues,
  originalHumanApprovalConfirmed:false,factualAccuracyVerified:false,
  copyrightLicensesApproved:false,productionImportAuthorized:false,
 };
}
export function auditPreview(preview:Preview){
 return {sourceType:preview.sourceType,records:preview.records,
  draftCandidates:preview.items.length,quarantined:preview.quarantined.length,
  typedIssueCount:auditLibrary(preview.items).issues.length,importIsApproval:false as const,
  originalLegacyCoverageCertified:false as const,
  sourceBytes:preview.sourceBytes,bundleHash:preview.bundleHash};
}
export function exportAudit(audit:EditorialAudit,preview:Preview|null){
 const report={
  format:'ligoquiz-g23-content-issues-export-v1' as const,
  sourceManifest:LEGACY_V113_INVENTORY,scannedLocalEntries:audit.scanned,
  localApprovalClaims:audit.approvedLocally,blockers:audit.blockers,
  reviewFlags:audit.reviewFlags,byGame:audit.byGame,
  issueIndex:audit.issues.map(x=>({id:x.id,game:x.game,code:x.code,
   severity:x.severity,...(x.other?{other:x.other}:{})})),
  pendingPreview:preview?auditPreview(preview):null,
  originalQuestionTextIncluded:false as const,originalAnswersIncluded:false as const,
  sourceRightsApproved:false as const,independentFactualReviewCompleted:false as const,
  original704Imported:false as const,mergeAuthorized:false as const,
  deploymentAuthorized:false as const,release:'NO_GO' as const,
 };
 return JSON.stringify(report,null,2);
}
