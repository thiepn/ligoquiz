import {z} from 'zod';
import {decodeBackup,MAX_BACKUP_BYTES} from '../../resilience/backup';
import {sha256} from '../../content/migration';
import {G25_PARENT_HEAD,G25_G23_HEAD} from './g25-handoff';

export const G26_QUALIFIED_PARENT='0a1e54320554ad63db7ca8073fd22bb0a201f3f1' as const;
export const G26_PARENT_BUNDLE='00d06decc4bf813dfc5ef7af0a7830286b0b5465f45f1a6009a9f66983dedcf9' as const;
const jsonObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const gitCommitHash=z.string().regex(/^[a-f0-9]{40}$/);
const relative=z.string().min(1).max(200).refine(v=>!v.startsWith('/')&&!v.startsWith('http')&&
 !v.includes('..')&&!v.includes('\\')&&!v.includes('?')&&!v.includes('#'),'Nicht relativer Pfad');
const manifest=z.strictObject({
 format:z.literal('ligoquiz-g12-build-evidence-v1'),
 gitSha:z.literal(G26_QUALIFIED_PARENT),validatedCheckoutSha:gitCommitHash,
 deploymentPath:z.literal('relative'),expectedScope:z.literal('./'),
 offlinePrecache:z.array(relative).min(4).max(30),
 files:z.array(z.strictObject({path:relative,sha256:hash})).length(7),
 bundleSha256:z.literal(G26_PARENT_BUNDLE),
 rollbackRules:z.array(z.string().min(1).max(300)).min(3).max(6),
});
const release=z.strictObject({
 format:z.literal('ligoquiz-g25-rc-handoff-no-go-v1'),
 head:z.literal(G25_PARENT_HEAD),sourceG23Head:z.literal(G25_G23_HEAD),
 pilot:z.union([z.null(),z.strictObject({name:z.string().max(150),sha256:hash,
  selfReported:z.number().int().min(0).max(105),open:z.number().int().min(0).max(105),
  defects:z.number().int().min(0).max(105)})]),
 editorial:z.union([z.null(),z.strictObject({name:z.string().max(150),sha256:hash,
  scanned:z.number().int().min(0),locallyApproved:z.number().int().min(0),
  blockers:z.number().int().min(0),reviewFlags:z.number().int().min(0),
  byGame:z.strictObject({rundenquiz:z.number().int().min(0),
   quiztafel:z.number().int().min(0),verbindungen:z.number().int().min(0),
   logikleiter:z.number().int().min(0),umfrageduell:z.number().int().min(0)})})]),
 issues:z.array(z.strictObject({id:z.string().max(300),category:z.enum(['pilot','content']),
  severity:z.enum(['blocker','review']),label:z.string().max(300),
  game:z.union([z.literal('rundenquiz'),z.literal('quiztafel'),z.literal('verbindungen'),
   z.literal('logikleiter'),z.literal('umfrageduell'),z.null()]),
  scenarioId:z.string().max(100).optional(),checkId:z.string().max(100).optional(),
  contentId:z.string().max(128).optional()})).max(15000),
 blockers:z.number().int().min(0),missing:z.array(z.string().max(300)).max(40),
 sourceFilesEmbedded:z.literal(false),questionTextEmbedded:z.literal(false),
 independentHardwareConfirmed:z.literal(false),independentEditorialConfirmed:z.literal(false),
 originalRestoreApproved:z.literal(false),ownerApproved:z.literal(false),
 mergeAuthorized:z.literal(false),deployAuthorized:z.literal(false),release:z.literal('NO_GO'),
});
const enc=new TextEncoder();
function parseBounded(text:string,max:number,label:string){
 if(enc.encode(text).byteLength<2||enc.encode(text).byteLength>max)
  throw Error(label+': leeres oder zu großes Original');
 let out:unknown;try{out=JSON.parse(text)}catch{throw Error(label+': ungültiges JSON');}
 return out;
}
export type ReadOnlyManifest={sha256:string;qualifiedHead:typeof G26_QUALIFIED_PARENT;
 bundleSha256:typeof G26_PARENT_BUNDLE;fileCount:7;relativeScope:true;originalAssetBytesCompared:false};
export type ReadOnlyHandoff={sha256:string;pilotSelfReported:number|null;pilotDefects:number|null;
 editorialBlockers:number|null;openDefects:number;missingCount:number;
 independentReviewConfirmed:false};
export type ReadOnlyBackup={sha256:string;eventId:string;game:string;teams:number;revision:number;
 currentLifecycle:string;outcomes:number;checkpoints:number;recoveryPlan:'paused'|'completed';
 originalBytesWritten:false;restoreExecuted:false;originalIdentityStored:false};
export type CutoverInputs={manifest:ReadOnlyManifest|null;handoff:ReadOnlyHandoff|null;backup:ReadOnlyBackup|null};
export async function inspectManifest(text:string):Promise<ReadOnlyManifest>{
 const value=manifest.parse(parseBounded(text,64*1024,'Build-Nachweis'));
 const known=new Set(value.files.map(x=>x.path));
 if(known.size!==7||!['index.html','sw.js','manifest.webmanifest','icons/ligoquiz.svg'].every(k=>known.has(k))||
    value.offlinePrecache.some(f=>!known.has(f))||!value.offlinePrecache.includes('index.html')||
    !value.offlinePrecache.includes('manifest.webmanifest')||
    !value.offlinePrecache.includes('icons/ligoquiz.svg'))
  throw Error('Build-Nachweis: Dateiliste oder Offlineumfang inkonsistent');
 return {sha256:await sha256(text),qualifiedHead:G26_QUALIFIED_PARENT,
  bundleSha256:G26_PARENT_BUNDLE,fileCount:7,relativeScope:true,originalAssetBytesCompared:false};
}
export async function inspectHandoff(text:string):Promise<ReadOnlyHandoff>{
 const v=release.parse(parseBounded(text,1024*1024,'G25-Übergabe'));
 if(v.pilot&&v.pilot.selfReported+v.pilot.open+v.pilot.defects!==105)
  throw Error('G25-Übergabe: 105 Prüfpunkte inkonsistent');
 if(v.editorial&&(v.editorial.locallyApproved>v.editorial.scanned||
 Object.values(v.editorial.byGame).reduce((a,b)=>a+b,0)!==v.editorial.scanned))
  throw Error('G25-Übergabe: Quellenzählung inkonsistent');
 if(v.blockers!==v.issues.filter(x=>x.severity==='blocker').length)
  throw Error('G25-Übergabe: Widerspruch zwischen Einzelproblemen und Blockern');
 return {sha256:await sha256(text),pilotSelfReported:v.pilot?.selfReported??null,
  pilotDefects:v.pilot?.defects??null,editorialBlockers:v.editorial?.blockers??null,
  openDefects:v.blockers,missingCount:v.missing.length,independentReviewConfirmed:false};
}
export async function inspectBackup(text:string):Promise<ReadOnlyBackup>{
 if(enc.encode(text).byteLength>MAX_BACKUP_BYTES)throw Error('Backup größer als 20 MiB');
 const raw=parseBounded(text,MAX_BACKUP_BYTES,'G11-Sitzungsbackup');
 if(!jsonObject(raw))throw Error('G11-Sitzungsbackup: ungültiger Umschlag');
 const file=await decodeBackup(text);
 const event=file.event;
 return {sha256:await sha256(text),eventId:event.id,
  game:event.program[0]?.type??'unbekannt',teams:event.teams.length,revision:event.revision,
  currentLifecycle:event.lifecycle,outcomes:file.outcomes.length,checkpoints:file.checkpoints.length,
  recoveryPlan:event.lifecycle==='complete'?'completed':'paused',originalBytesWritten:false,
  restoreExecuted:false,originalIdentityStored:false};
}
export function releaseCutoverStatus(inputs:CutoverInputs){
 const {manifest,handoff,backup}=inputs;
 const checks=[
  {id:'parent',label:'Qualifizierter G25-Quellstand unverändert',state:'verified-code' as const},
  {id:'artifact',label:'Originales G25-Buildmanifest dieser Sitzung',state:manifest?'metadata-only' as const:'missing' as const},
  {id:'pilot',label:'Originales G25-Operatorübergabepaket',state:handoff?'metadata-only' as const:'missing' as const},
  {id:'backup',label:'Lokale G11-Sicherung nur lesend geprüft',state:backup?'metadata-only' as const:'missing' as const},
  {id:'legal',label:'Unabhängige Fakten-/Inhalts-/Lizenzfreigabe',state:'external-open' as const},
  {id:'physical',label:'15 echte Spiele, Saal, Beamer, Geräte und Screenreader',state:'external-open' as const},
  {id:'restore',label:'Separat autorisierter Restore in isolierter Wegwerf-Umgebung',state:'external-open' as const},
  {id:'authority',label:'Eigentümer gibt konkreten Merge/Staging/Deploy frei',state:'external-open' as const},
 ];
 return {format:'ligoquiz-g26-readonly-cutover-NO_GO-v1' as const,qualifiedParent:G26_QUALIFIED_PARENT,
  artifact:manifest?{sha256:manifest.sha256,bundleSha256:manifest.bundleSha256,assetBytesVerified:false}:null,
  handoff:handoff?{sha256:handoff.sha256,independentReviewConfirmed:false,
    pilotSelfReported:handoff.pilotSelfReported,pilotDefects:handoff.pilotDefects,
    editorialBlockers:handoff.editorialBlockers,openDefects:handoff.openDefects}:null,
  backup:backup?{sha256:backup.sha256,game:backup.game,teams:backup.teams,revision:backup.revision,
    lifecycle:backup.currentLifecycle,pausedOnRecovery:backup.recoveryPlan==='paused'}:null,
  checks,release:'NO_GO' as const,hostedAtOriginalDomainVerified:false as const,
  originalLegacyBrowserPreserved:true as const,originalSourceUploaded:false as const,
  localWritePerformed:false as const,isolatedRestorePerformed:false as const,
  ownerReleaseAuthorization:false as const,deployAuthorized:false as const};
}
export function rollbackInstructions(){
 return [
  'LiGoQuiz G26 — KONTROLLIERTER RÜCKWEG (VORBEREITUNG, KEINE AUTORISIERUNG)',
  '1. Im originalen Produktivstand main/v1.14 nichts überschreiben; Legacy-Quelle und originale Browserprofile sichern.',
  '2. G10 Original-Inhalte, G11 vollständige Event-Sicherungen und originalen Legacy-Browser-Export separat bewahren.',
  '3. V2 nur in einer unabhängig autorisierten isolierten HTTPS-Umgebung mit eigenem Browserprofil erproben.',
  '4. Relative PWA-Scope ./ und Dienst-Worker-Wartezustand separat auf diesem konkreten Pfad prüfen.',
  '5. Kein alter ligo.quiz.* Speicher darf kopiert, gelöscht, importiert oder automatisch migriert werden.',
  '6. Bei einem echten Defekt alle aktiven Spiele vor einem Update stoppen. Ursprungskopie und originären v1.14-Stand unter eigener Eigentümerkontrolle wieder anbieten.',
  '7. Originale Sitzungsdateien niemals in bestehende Ereigniskennungen restoren; Testrestore nur autorisiert, isoliert, pausiert und unabhängig verifiziert.',
  '8. Echte Geräte-, Redaktions-, Beamer-, Veranstaltungsleitungs- und Owner-Abnahmen unabhängig einholen.',
  '9. Produktions-Merge, DNS, Deployment, Migration und Rollback nur nach gesonderter, expliziter Freigabe des Eigentümers.',
  'STATUS NO_GO / das Dokument führt keine Aktionen aus / es ist kein Rollback-Nachweis.',
 ].join('\n');
}
