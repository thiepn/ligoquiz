
export const G18_SOURCE={
 repository:'thiepn/ligoquiz',
 baseHead:'b2acbdcf560b7dd5ce840276eada2569e5edef40',
 verifyRun:38060118970,browserRun:38060118918,
 artifacts:[11672563173,11672483289,11673330738],
} as const;
export const GAME_MODES=[
 {id:'rundenquiz',label:'Rundenquiz'},
 {id:'quiztafel',label:'Quiztafel'},
 {id:'verbindungen',label:'Verbindungen'},
 {id:'logikleiter',label:'Logikleiter'},
 {id:'umfrageduell',label:'Umfrageduell'},
] as const;
export const TEAM_COUNTS=[3,4,5] as const;
export const CHECKS=[
 {id:'venue',title:'Beamer und Leseabstand',instruction:'Echte 1280 × 720-Projektion, Text aus Publikumsdistanz und ausgeblendete private Antwort vor Freigabe prüfen.'},
 {id:'moderation',title:'Teams und Punktänderungen',instruction:'Mit gewählter Teamzahl spielen, alle Teams bewerten und Punktänderung vor und nach expliziter Bestätigung vergleichen.'},
 {id:'correction',title:'Korrektur und Audit',instruction:'Eine Testwertung begründet korrigieren und Audit-Revision, Teamstand und angezeigte Korrektur nachvollziehen.'},
 {id:'recovery',title:'Absturz und Wiederherstellung',instruction:'Hostfenster während der Frage schließen, pausierte Projektion prüfen und nur nach Sichtkontrolle ausdrücklich fortsetzen.'},
 {id:'backup',title:'Backup und Rückweg',instruction:'Sitzungsbackup prüfen, SHA-256 und Revision mit Quelle vergleichen. Restore nur auf ausdrücklich autorisiertem Teststand ausführen; nie produktiv überschreiben.'},
 {id:'accessibility',title:'Mobilgerät und Barrierefreiheit',instruction:'Reales Android/iOS, Tastatur, Screenreader und Zoom/Lesegröße am physischen Gerät mit benanntem Prüfer getrennt prüfen.'},
 {id:'rights',title:'Quellen und Nutzungsrechte',instruction:'Inhaltspaket, eingefrorene Quellhashes und redaktionelle Rechte vor einer öffentlichen Veranstaltung von autorisierter Person unabhängig prüfen.'},
] as const;
export const RELEASE_GATES=[
 {id:'rehearsals',label:'15 physisch beobachtete Spiele mit 3/4/5 Teams',owner:'Veranstaltungsleitung'},
 {id:'venue',label:'1280 × 720-Beamer und Leseabstand am Veranstaltungsort',owner:'Technikverantwortliche'},
 {id:'devices',label:'Physische Geräte, Tastatur und Screenreader',owner:'Unabhängige Accessibility-Prüfung'},
 {id:'rights',label:'Redaktionelle Quellen, Rechte und Lizenzlage',owner:'Inhaltsverantwortliche'},
 {id:'restore',label:'Unabhängig geprüfte Sicherung und Wiederherstellung',owner:'Recovery-Verantwortliche'},
 {id:'release',label:'Eigene menschliche Eigentümerfreigabe für Merge/Release/Deployment',owner:'Repository-Eigentümer'},
] as const;
export type CheckId=typeof CHECKS[number]['id'];
export type Observation='open'|'reported'|'defect';
export type FileFingerprint={name:string;bytes:number;sha256:string};
export type TrialRow={scenarioId:string;checks:Record<CheckId,Observation>;note:string;evidence:FileFingerprint|null};
export type ReleaseGateId=typeof RELEASE_GATES[number]['id'];
export type ScenarioKey=`${typeof GAME_MODES[number]['id']}-${typeof TEAM_COUNTS[number]}`;
export const SCENARIOS=GAME_MODES.flatMap(mode=>TEAM_COUNTS.map(teams=>({
 id:`${mode.id}-${teams}` as ScenarioKey,game:mode.id,label:mode.label,teams
})));
export const OBSERVATIONS:['open','reported','defect']=['open','reported','defect'];
const blankChecks=():Record<CheckId,Observation>=>Object.fromEntries(CHECKS.map(c=>[c.id,'open'])) as Record<CheckId,Observation>;
export function blankTrialRow(id:string):TrialRow{
 return {scenarioId:id,checks:blankChecks(),note:'',evidence:null};
}
export function scenarioSummary(rows:readonly TrialRow[]){
 const checks=rows.flatMap(row=>CHECKS.map(c=>row.checks[c.id]));
 return {scenarios:rows.length,reported:checks.filter(x=>x==='reported').length,
  defects:checks.filter(x=>x==='defect').length,open:checks.filter(x=>x==='open').length,
  allReported:rows.filter(row=>CHECKS.every(c=>row.checks[c.id]==='reported')).length};
}
export function canonicalTrial(input:Readonly<Record<string,TrialRow>>={},notes=''){
 const keys=new Set<string>(SCENARIOS.map(x=>x.id));
 if(Object.keys(input).some(k=>!keys.has(k)))throw Error('Unknown rehearsal scenario');
 const rows=SCENARIOS.map(s=>{
  const incoming=input[s.id],values=blankChecks();
  if(incoming){
   for(const c of CHECKS){
    const value=incoming.checks?.[c.id];
    if(value!==undefined){
     if(!OBSERVATIONS.includes(value))throw Error('Invalid observed state');
     values[c.id]=value;
    }
   }
  }
  const evidence=incoming?.evidence??null;
  if(evidence&&(!/^[a-f0-9]{64}$/.test(evidence.sha256)||
   !Number.isSafeInteger(evidence.bytes)||evidence.bytes<=0||evidence.bytes>12*1024*1024||
   !evidence.name||evidence.name.length>180))
    throw Error('Invalid local file fingerprint');
  return {scenarioId:s.id,checks:values,note:(incoming?.note??'').slice(0,800).trim(),
   evidence:evidence?{name:evidence.name,bytes:evidence.bytes,sha256:evidence.sha256}:null};
 });
 return {
  format:'ligoquiz-g18-observation-only-v1' as const,source:G18_SOURCE,
  notes:notes.trim().slice(0,1200),rows,summary:scenarioSummary(rows),
  releaseGates:RELEASE_GATES.map(g=>({...g,status:'OPEN' as const})),
  humanApproval:false,physicalDeviceApproved:false,projectorApproved:false,
  editorialApproved:false,restoreApproved:false,ownerApproved:false,
  mergeAuthorized:false,deployAuthorized:false,decision:'NO_GO' as const,
 };
}
export function sha256Buffer(buffer:ArrayBuffer):Promise<string>{
 return crypto.subtle.digest('SHA-256',buffer).then(x=>Array.from(new Uint8Array(x),b=>b.toString(16).padStart(2,'0')).join(''));
}
export async function fingerprint(file:Pick<File,'name'|'size'|'arrayBuffer'>):Promise<FileFingerprint>{
 if(file.size<=0||file.size>12*1024*1024)throw Error('File outside 1 byte–12 MiB limits');
 return {name:file.name.slice(0,180),bytes:file.size,sha256:await sha256Buffer(await file.arrayBuffer())};
}
export type TrialEnvelope={format:'ligoquiz-g18-local-integrity-v1';algorithm:'SHA-256';checksum:string;packet:ReturnType<typeof canonicalTrial>};
export async function sealTrial(input:Readonly<Record<string,TrialRow>>={},notes=''):Promise<TrialEnvelope>{
 const packet=canonicalTrial(input,notes);
 return {format:'ligoquiz-g18-local-integrity-v1',algorithm:'SHA-256',
  checksum:await sha256Buffer(new TextEncoder().encode(JSON.stringify(packet)).buffer as ArrayBuffer),packet};
}
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
export async function reconcileTrial(raw:unknown):Promise<ReturnType<typeof canonicalTrial>>{
 if(!isObject(raw)||Object.keys(raw).sort().join(',')!=='algorithm,checksum,format,packet'||
  raw.format!=='ligoquiz-g18-local-integrity-v1'||raw.algorithm!=='SHA-256'||
  typeof raw.checksum!=='string'||!/^[a-f0-9]{64}$/.test(raw.checksum))
  throw Error('Invalid G18 evidence envelope');
 const packet:unknown=raw.packet;
 if(!isObject(packet)||!Array.isArray(packet.rows)||packet.rows.length!==SCENARIOS.length||
  typeof packet.notes!=='string'||packet.notes.length>1200)
  throw Error('Incomplete G18 evidence packet');
 const rows:Record<string,TrialRow>={};
 for(let i=0;i<SCENARIOS.length;i++){
  const item:unknown=packet.rows[i],s=SCENARIOS[i]!;
  if(!isObject(item)||Object.keys(item).sort().join(',')!=='checks,evidence,note,scenarioId'||
   item.scenarioId!==s.id||typeof item.note!=='string'||item.note.length>800||!isObject(item.checks)||
   Object.keys(item.checks).sort().join(',')!==CHECKS.map(c=>c.id).sort().join(',')||
   CHECKS.some(c=>!OBSERVATIONS.includes((item.checks as Record<string,Observation>)[c.id]??'invalid' as Observation)))
   throw Error('Scenario ordering or checks were modified');
  const ev=item.evidence;
  if(ev!==null&&(!isObject(ev)||Object.keys(ev).sort().join(',')!=='bytes,name,sha256'))
   throw Error('File evidence metadata shape changed');
  rows[s.id]={scenarioId:s.id,checks:item.checks as TrialRow['checks'],
   note:item.note,evidence:ev as FileFingerprint|null};
 }
 const canonical=canonicalTrial(rows,packet.notes);
 if(JSON.stringify(canonical)!==JSON.stringify(packet))throw Error('Changed source, approvals, gates or evidence content');
 const checksum=await sha256Buffer(new TextEncoder().encode(JSON.stringify(packet)).buffer as ArrayBuffer);
 if(checksum!==raw.checksum)throw Error('Local SHA-256 mismatch');
 return canonical;
}
