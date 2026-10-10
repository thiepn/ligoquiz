import {reconcileTrial,sha256Buffer,RELEASE_GATES,SCENARIOS} from './event-trial';
import {G20_SOURCE,parseCustody,type CustodyStatement} from './g20-custody';

export const G21_PARENT_HEAD='f066894f11dd96432bfb73e242b97aaf72cc4655' as const;
export const G21_ACTION_ROLE={
 PIN:'reviewer',ROTATION:'reviewer',INCIDENT:'reviewer',
 RECOVERY:'recovery',RIGHTS:'rights',DEVICE:'accessibility',
 VENUE:'accessibility',OWNER:'owner',
} as const;
export const G21_ACTION_GATE={
 PIN:'rehearsals',ROTATION:'rehearsals',INCIDENT:'rehearsals',
 RECOVERY:'restore',RIGHTS:'rights',DEVICE:'devices',
 VENUE:'venue',OWNER:'release',
} as const;
export type G21Action=keyof typeof G21_ACTION_ROLE;
export type G21Statement={
 format:'ligoquiz-g21-attestation-statement-v1';
 caseId:string;sequence:number;previousDigest:string|null;
 sourceG18Checksum:string;g20HandoffChecksum:string;qualifiedG20Head:typeof G21_PARENT_HEAD;
 actorId:string;role:typeof G21_ACTION_ROLE[G21Action];action:G21Action;
 signerFingerprint:string;subjectFingerprint:string;nextFingerprint:string|null;
 scenarioId:string;gateId:string;receiptSha256:string|null;
 issuedAt:string;note:string;finding:'REPORTED'|'DEFECT'|'WITHDRAWN';
};
export type G21Envelope={format:'ligoquiz-g21-detached-ed25519-v1';statement:G21Statement;signature:string};
export type G21Verified={statement:G21Statement;digest:string;attachmentChecked:boolean;trust:'UNANCHORED'};
export type G21Parent={
 checksum:string;sourceChecksum:string;custodyId:string;
 activeFingerprint:string;custodianActors:string[];custodianKeys:string[];
 fencedFingerprints:string[];rotations:{from:string;to:string}[];
 originalSignaturesReverified:false;trust:'UNANCHORED';
};
const sha=/^[a-f0-9]{64}$/;
const id=/^[A-Za-z0-9_.-]{6,100}$/;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,expected:readonly string[])=>Object.keys(v).sort().join('|')===[...expected].sort().join('|');
const bytes=(a:Uint8Array)=>Uint8Array.from(a).buffer as ArrayBuffer;
const encode=(s:string)=>bytes(new TextEncoder().encode(s));
const digest=(v:unknown)=>sha256Buffer(encode(JSON.stringify(v)));
function base64(s:string){
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(s)||s.length%4!==0)throw Error('Noncanonical or invalid base64');
 const raw=Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 if(btoa(Array.from(raw,c=>String.fromCharCode(c)).join(''))!==s)throw Error('Noncanonical base64');
 return raw;
}
const statementKeys=['format','caseId','sequence','previousDigest','sourceG18Checksum','g20HandoffChecksum',
 'qualifiedG20Head','actorId','role','action','signerFingerprint','subjectFingerprint','nextFingerprint',
 'scenarioId','gateId','receiptSha256','issuedAt','note','finding'];

export async function readG21Parent(raw:unknown,g18:unknown):Promise<G21Parent>{
 await reconcileTrial(g18);
 if(!object(raw)||!exact(raw,['format','source','note','statements','decision','checksum'])||
  raw.format!=='ligoquiz-g20-custody-handoff-v1'||!object(raw.source)||
  JSON.stringify(raw.source)!==JSON.stringify(G20_SOURCE)||
  typeof raw.note!=='string'||raw.note.length>1200||
  !object(raw.decision)||raw.decision.release!=='NO_GO'||raw.decision.independentTrustRoots!==0||
  raw.decision.mergeAuthorized!==false||raw.decision.deployAuthorized!==false||
  typeof raw.checksum!=='string'||!sha.test(raw.checksum)||
  !Array.isArray(raw.statements)||raw.statements.length===0||raw.statements.length>100)
  throw Error('G20 parent handoff format or explicit NO_GO invalid');
 const {checksum,...unsigned}=raw;
 if(await digest(unsigned)!==checksum)throw Error('G20 handoff checksum changed');
 const sourceChecksum=(g18 as {checksum:string}).checksum;
 const custodianActors:string[]=[],custodianKeys:string[]=[],fencedFingerprints:string[]=[];
 const rotations:{from:string;to:string}[]=[];
 let root='',active='',custodyId='',previous:string|null=null,issuedAt=0;
 for(const [index,value] of raw.statements.entries()){
  if(!object(value)||!exact(value,['statement','digest','receiptOriginalBytesChecked','trustRoot'])||
   !object(value.statement)||typeof value.digest!=='string'||!sha.test(value.digest)||
   typeof value.receiptOriginalBytesChecked!=='boolean'||value.trustRoot!=='UNVERIFIED')
   throw Error('G20 original receipt metadata invalid');
  // G20 handoff omits original detached signatures: validate shape and digest, never claim signer authentication.
  const unsignedEnvelope={format:'ligoquiz-g20-detached-ed25519-v1',
   statement:value.statement,signature:btoa(String.fromCharCode(...new Uint8Array(64)))};
  const s=parseCustody(unsignedEnvelope).statement as CustodyStatement;
  if(s.sourceG18Checksum!==sourceChecksum||await digest(s)!==value.digest)
   throw Error('G20 handoff source or statement digest conflict');
  if(index===0){
   if(s.action!=='root-proposal'||s.sequence!==1||s.previousDigest!==null)
    throw Error('G20 first receipt is not a root proposal');
   root=s.subjectFingerprint;active=root;custodyId=s.custodyId;
  }else{
   if(s.custodyId!==custodyId||s.sequence!==index+1||s.previousDigest!==previous)
    throw Error('G20 custody gaps or mixed roots');
   if(Date.parse(s.issuedAt)<issuedAt)throw Error('G20 chronology regressed');
  }
  if(s.action==='rotate'){
   if(s.signerFingerprint!==active||s.subjectFingerprint!==active||
     fencedFingerprints.includes(active)||!s.nextFingerprint||
     fencedFingerprints.includes(s.nextFingerprint))throw Error('G20 invalid rotation lineage');
   rotations.push({from:active,to:s.nextFingerprint});active=s.nextFingerprint;
  }
  if(s.action==='revoke'||s.action==='compromise'){
   if(fencedFingerprints.includes(s.subjectFingerprint))throw Error('G20 conflicting repeated revocation');
   fencedFingerprints.push(s.subjectFingerprint);
  }
  if(fencedFingerprints.includes(s.signerFingerprint)&&s.action!=='compromise'&&s.action!=='revoke')
   throw Error('G20 revoked signer was reused');
  custodianActors.push(s.actorId);custodianKeys.push(s.signerFingerprint);
  previous=value.digest;issuedAt=Date.parse(s.issuedAt);
 }
 if(!root)throw Error('G20 root missing');
 return {checksum:raw.checksum as string,sourceChecksum,custodyId,activeFingerprint:active,
  custodianActors,custodianKeys,fencedFingerprints,rotations,
  originalSignaturesReverified:false,trust:'UNANCHORED'};
}

export function parseG21Envelope(raw:unknown):G21Envelope{
 if(!object(raw)||!exact(raw,['format','statement','signature'])||
  raw.format!=='ligoquiz-g21-detached-ed25519-v1'||typeof raw.signature!=='string'||!object(raw.statement))
  throw Error('G21 witness envelope invalid');
 const s=raw.statement;
 if(!exact(s,statementKeys)||s.format!=='ligoquiz-g21-attestation-statement-v1'||
  typeof s.caseId!=='string'||!id.test(s.caseId)||
  !Number.isSafeInteger(s.sequence)||Number(s.sequence)<1||Number(s.sequence)>100000||
  !(s.previousDigest===null||(typeof s.previousDigest==='string'&&sha.test(s.previousDigest)))||
  typeof s.sourceG18Checksum!=='string'||!sha.test(s.sourceG18Checksum)||
  typeof s.g20HandoffChecksum!=='string'||!sha.test(s.g20HandoffChecksum)||
  s.qualifiedG20Head!==G21_PARENT_HEAD||
  typeof s.actorId!=='string'||!id.test(s.actorId)||
  typeof s.action!=='string'||!(s.action in G21_ACTION_ROLE)||
  s.role!==G21_ACTION_ROLE[s.action as G21Action]||
  typeof s.signerFingerprint!=='string'||!sha.test(s.signerFingerprint)||
  typeof s.subjectFingerprint!=='string'||!sha.test(s.subjectFingerprint)||
  !(s.nextFingerprint===null||(typeof s.nextFingerprint==='string'&&sha.test(s.nextFingerprint)))||
  typeof s.scenarioId!=='string'||!SCENARIOS.some(x=>x.id===s.scenarioId)||
  s.gateId!==G21_ACTION_GATE[s.action as G21Action]||
  !RELEASE_GATES.some(g=>g.id===s.gateId)||
  !(s.receiptSha256===null||(typeof s.receiptSha256==='string'&&sha.test(s.receiptSha256)))||
  typeof s.issuedAt!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z$/.test(s.issuedAt)||
  !Number.isFinite(Date.parse(s.issuedAt))||
  typeof s.note!=='string'||s.note.length>1000||
  !['REPORTED','DEFECT','WITHDRAWN'].includes(String(s.finding)))
  throw Error('G21 witness fields invalid');
 if(s.action==='ROTATION'?
   (s.nextFingerprint===null||s.nextFingerprint===s.subjectFingerprint):
   s.nextFingerprint!==null)throw Error('G21 rotation semantics invalid');
 if(['RECOVERY','RIGHTS','DEVICE','VENUE'].includes(String(s.action))&&!s.receiptSha256)
  throw Error('Physical, rights or restore original file digest required');
 if(s.action==='INCIDENT'&&s.finding!=='WITHDRAWN')
  throw Error('Compromised signer incident must withdraw credentials');
 if(base64(raw.signature).length!==64)throw Error('G21 Ed25519 signature length invalid');
 return raw as unknown as G21Envelope;
}

export async function verifyG21Envelope(raw:unknown,publicKey:string,parent:G21Parent,
 receipt?:ArrayBuffer):Promise<G21Verified>{
 const envelope=parseG21Envelope(raw),s=envelope.statement;
 if(s.g20HandoffChecksum!==parent.checksum||s.sourceG18Checksum!==parent.sourceChecksum)
  throw Error('G21 changed external source/parent custody');
 if(s.action==='ROTATION'){
  if(!parent.rotations.some(r=>r.from===s.subjectFingerprint&&r.to===s.nextFingerprint))
   throw Error('Unwitnessed G20 rotation lineage');
 }else if(s.action!=='INCIDENT'&&s.subjectFingerprint!==parent.activeFingerprint)
  throw Error('G21 subject is not the current G20 root');
 const rawKey=base64(publicKey.trim());
 if(rawKey.length!==32||await sha256Buffer(bytes(rawKey))!==s.signerFingerprint)
  throw Error('G21 signer public-key fingerprint mismatch');
 let key:CryptoKey;
 try{key=await crypto.subtle.importKey('raw',bytes(rawKey),{name:'Ed25519'},false,['verify']);}
 catch{throw Error('G21 Ed25519 unsupported');}
 if(!await crypto.subtle.verify('Ed25519',key,bytes(base64(envelope.signature)),encode(JSON.stringify(s))))
  throw Error('G21 signature INVALID');
 if(receipt&&(!s.receiptSha256||await sha256Buffer(receipt)!==s.receiptSha256))
  throw Error('G21 original receipt SHA-256 conflict');
 if(['RECOVERY','RIGHTS','DEVICE','VENUE'].includes(s.action)&&!receipt)
  throw Error('G21 original bytes required, not metadata only');
 return {statement:s,digest:await digest(s),attachmentChecked:!!receipt,trust:'UNANCHORED'};
}

export function appendG21Ledger(history:readonly G21Verified[],next:G21Verified,parent:G21Parent):G21Verified[]{
 const s=next.statement,last=history.at(-1);
 if(history.some(v=>v.digest===next.digest))throw Error('G21 replayed receipt');
 if(s.sourceG18Checksum!==parent.sourceChecksum||s.g20HandoffChecksum!==parent.checksum)
  throw Error('G21 parent source changed');
 if(s.sequence!==history.length+1||s.previousDigest!==(last?.digest??null)||
    (last&&s.caseId!==last.statement.caseId))
  throw Error('G21 chain gap, fork, case conflict or previous digest mismatch');
 if(last&&Date.parse(s.issuedAt)<Date.parse(last.statement.issuedAt))
  throw Error('G21 chronology regressed');
 const fenced=new Set([...parent.fencedFingerprints,
  ...history.filter(x=>x.statement.action==='INCIDENT').map(x=>x.statement.subjectFingerprint)]);
 if(fenced.has(s.signerFingerprint))throw Error('G21 compromised/revoked witness signer');
 if(parent.custodianActors.includes(s.actorId)||parent.custodianKeys.includes(s.signerFingerprint)||
    s.signerFingerprint===s.subjectFingerprint)
  throw Error('G21 witness is the G20 custodian or self-attesting root');
 if(history.some(x=>(x.statement.actorId===s.actorId)!==(x.statement.signerFingerprint===s.signerFingerprint)))
  throw Error('G21 contradictory actor/key identity mapping');
 if(history.some(x=>x.statement.actorId===s.actorId&&x.statement.role!==s.role))
  throw Error('G21 reused actor across independent roles');
 if(s.action==='PIN'){
  if(fenced.has(s.subjectFingerprint))throw Error('G21 current root compromised');
  if(history.some(x=>x.statement.action==='PIN'&&
   (x.statement.actorId===s.actorId||x.statement.signerFingerprint===s.signerFingerprint)))
    throw Error('G21 cross-attestation requires distinct witnesses');
 }
 if(s.action==='INCIDENT'&&history.some(x=>x.statement.action==='INCIDENT'&&
   x.statement.subjectFingerprint===s.subjectFingerprint))
  throw Error('G21 duplicate compromised signer incident');
 if(s.action==='OWNER'&&history.some(x=>x.statement.role!=='owner'&&
  (x.statement.actorId===s.actorId||x.statement.signerFingerprint===s.signerFingerprint)))
  throw Error('G21 owner must be independent of witness and custody roles');
 if(['PIN','RECOVERY','RIGHTS','DEVICE','VENUE','OWNER'].includes(s.action)&&fenced.has(s.subjectFingerprint))
  throw Error('G21 evidence tied to compromised subject');
 return [...history,next];
}

export function g21DryRun(history:readonly G21Verified[],parent:G21Parent|null){
 const pins=history.filter(x=>x.statement.action==='PIN');
 const distinctPins=new Set(pins.map(x=>x.statement.signerFingerprint));
 const incidents=history.filter(x=>x.statement.action==='INCIDENT').length+(parent?.fencedFingerprints.length??0);
 const receipts=history.filter(x=>x.attachmentChecked).length;
 const gates=RELEASE_GATES.map(g=>({gateId:g.id,status:'OPEN' as const,
  signedReports:history.filter(x=>x.statement.gateId===g.id).length}));
 return {format:'ligoquiz-g21-no-go-dry-run-v1' as const,
  signedWitnesses:history.length,independentRootCrossChecks:distinctPins.size,
  originalsHashChecked:receipts,compromisedOrRevoked:incidents,
  parentG20OriginalSignaturesReverified:false,externalIdentityAnchorsVerified:0,
  physicalVenueAcceptance:false,realDeviceAcceptance:false,rightsAuthorized:false,
  realRestoreAuthorized:false,independentOwnerApproval:false,
  gates,release:'NO_GO' as const,mergeAuthorized:false,deployAuthorized:false,
  reason:'Independent external identity/root, actual rights, physical-device, restore and owner authority cannot be established by local imports.'};
}
export async function g21Export(history:readonly G21Verified[],parent:G21Parent|null,note:string){
 const data={format:'ligoquiz-g21-dry-run-packet-v1' as const,
  qualifiedG20Head:G21_PARENT_HEAD,parentG20Checksum:parent?.checksum??null,
  note:note.slice(0,1200).trim(),
  witnesses:history.map(x=>({statement:x.statement,digest:x.digest,
   attachmentChecked:x.attachmentChecked,trust:x.trust})),
  decision:g21DryRun(history,parent)};
 return {...data,checksum:await digest(data)};
}
