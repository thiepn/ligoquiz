import {RELEASE_GATES,SCENARIOS,reconcileTrial,sha256Buffer} from './event-trial';
import {G21_PARENT_HEAD,parseG21Envelope} from './g21-attestation';

export const G22_QUALIFIED_G21_HEAD='1941b9a4f9b3cf55dd0ca749eb457f85a0aab613' as const;
export const G22_KIND={
 'venue-projector':{role:'technician',gate:'venue'},
 'android-device':{role:'accessibility',gate:'devices'},
 'ios-device':{role:'accessibility',gate:'devices'},
 'keyboard':{role:'accessibility',gate:'devices'},
 'talkback':{role:'accessibility',gate:'devices'},
 'voiceover':{role:'accessibility',gate:'devices'},
 'rights-object':{role:'editor',gate:'rights'},
 'rights-license':{role:'editor',gate:'rights'},
 'restore-input':{role:'recovery',gate:'restore'},
 'restore-output':{role:'recovery',gate:'restore'},
 'rehearsal':{role:'organizer',gate:'rehearsals'},
 'owner-custody':{role:'owner',gate:'release'},
} as const;
export type G22Kind=keyof typeof G22_KIND;
export type G22Role=typeof G22_KIND[G22Kind]['role'];
export type G22Action='observe'|'withdraw'|'compromise';
export type G22Statement={
 format:'ligoquiz-g22-physical-receipt-v1';caseId:string;receiptId:string;
 sequence:number;previousDigest:string|null;
 qualifiedG21Head:typeof G22_QUALIFIED_G21_HEAD;
 g21PacketChecksum:string;g18Checksum:string;actorId:string;role:G22Role;
 signerFingerprint:string;kind:G22Kind;gateId:string;
 scenarioId:string|null;originalSha256:string;issuedAt:string;
 action:G22Action;targetFingerprint:string|null;
 finding:'REPORTED'|'DEFECT'|'WITHDRAWN';note:string;
};
export type G22Envelope={format:'ligoquiz-g22-detached-ed25519-v1';statement:G22Statement;signature:string};
export type G22Original={sha256:string;byteLength:number};
export type G22Verified={statement:G22Statement;digest:string;originalBytesChecked:true;keyTrust:'UNANCHORED'};
export type G22Parent={
 packetChecksum:string;g18Checksum:string;g20Checksum:string;g21Witnesses:number;
 inheritedSignerFingerprints:string[];inheritedActors:string[];
 actualOriginalG20SignaturesChecked:false;actualOriginalG21SignaturesChecked:false;
 identityAnchors:0;release:'NO_GO';
};
const hash=/^[a-f0-9]{64}$/;
const id=/^[A-Za-z0-9_.-]{6,100}$/;
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const exact=(obj:Record<string,unknown>,members:readonly string[])=>Object.keys(obj).sort().join('|')===[...members].sort().join('|');
const arrayBuffer=(data:Uint8Array)=>Uint8Array.from(data).buffer as ArrayBuffer;
const toBytes=(value:string)=>arrayBuffer(new TextEncoder().encode(value));
const checksum=(v:unknown)=>sha256Buffer(toBytes(JSON.stringify(v)));
function strictBase64(value:string){
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw Error('Invalid base64');
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 if(btoa(Array.from(bytes,c=>String.fromCharCode(c)).join(''))!==value)
  throw Error('Noncanonical base64');
 return bytes;
}
export async function readG22Parent(raw:unknown,g18Original:unknown):Promise<G22Parent>{
 await reconcileTrial(g18Original);
 if(!isObject(raw)||!exact(raw,['format','qualifiedG20Head','parentG20Checksum','note','witnesses','decision','checksum'])||
  raw.format!=='ligoquiz-g21-dry-run-packet-v1'||raw.qualifiedG20Head!==G21_PARENT_HEAD||
  typeof raw.parentG20Checksum!=='string'||!hash.test(raw.parentG20Checksum)||
  typeof raw.note!=='string'||raw.note.length>1200||
  !Array.isArray(raw.witnesses)||raw.witnesses.length===0||raw.witnesses.length>100||
  !isObject(raw.decision)||raw.decision.release!=='NO_GO'||
  raw.decision.mergeAuthorized!==false||raw.decision.deployAuthorized!==false||
  raw.decision.parentG20OriginalSignaturesReverified!==false||
  raw.decision.externalIdentityAnchorsVerified!==0||
  typeof raw.checksum!=='string'||!hash.test(raw.checksum))
  throw Error('G21 source format or mandatory NO_GO gates invalid');
 const {checksum:claimed,...rest}=raw;
 if(await checksum(rest)!==claimed)throw Error('G21 source checksum mismatch');
 const g18Checksum=(g18Original as {checksum:string}).checksum;
 const inheritedSignerFingerprints:string[]=[],inheritedActors:string[]=[];
 let prior:string|null=null,caseId:string|null=null;
 for(const [i,w] of raw.witnesses.entries()){
  if(!isObject(w)||!exact(w,['statement','digest','attachmentChecked','trust'])||
   !isObject(w.statement)||typeof w.digest!=='string'||!hash.test(w.digest)||
   typeof w.attachmentChecked!=='boolean'||w.trust!=='UNANCHORED')
   throw Error('G21 inherited witness metadata invalid');
  const stub={format:'ligoquiz-g21-detached-ed25519-v1',statement:w.statement,
   signature:btoa(String.fromCharCode(...new Uint8Array(64)))};
  const s=parseG21Envelope(stub).statement;
  if(s.sourceG18Checksum!==g18Checksum||s.g20HandoffChecksum!==raw.parentG20Checksum||
    s.sequence!==i+1||s.previousDigest!==prior||(caseId!==null&&s.caseId!==caseId)||
    await checksum(s)!==w.digest)throw Error('G21 inherited custody conflict');
  caseId=s.caseId;prior=w.digest;
  inheritedSignerFingerprints.push(s.signerFingerprint);inheritedActors.push(s.actorId);
 }
 return {packetChecksum:claimed as string,g18Checksum,
  g20Checksum:raw.parentG20Checksum as string,g21Witnesses:raw.witnesses.length,
  inheritedSignerFingerprints,inheritedActors,
  actualOriginalG20SignaturesChecked:false,actualOriginalG21SignaturesChecked:false,
  identityAnchors:0,release:'NO_GO'};
}
const statementKeys=['format','caseId','receiptId','sequence','previousDigest','qualifiedG21Head',
 'g21PacketChecksum','g18Checksum','actorId','role','signerFingerprint','kind','gateId',
 'scenarioId','originalSha256','issuedAt','action','targetFingerprint','finding','note'];
export function parseG22(raw:unknown):G22Envelope{
 if(!isObject(raw)||!exact(raw,['format','statement','signature'])||
  raw.format!=='ligoquiz-g22-detached-ed25519-v1'||!isObject(raw.statement)||typeof raw.signature!=='string')
  throw Error('G22 signed receipt envelope invalid');
 const s=raw.statement;
 if(!exact(s,statementKeys)||s.format!=='ligoquiz-g22-physical-receipt-v1'||
  typeof s.caseId!=='string'||!id.test(s.caseId)||
  typeof s.receiptId!=='string'||!id.test(s.receiptId)||
  !Number.isSafeInteger(s.sequence)||Number(s.sequence)<1||Number(s.sequence)>100000||
  !(s.previousDigest===null||(typeof s.previousDigest==='string'&&hash.test(s.previousDigest)))||
  s.qualifiedG21Head!==G22_QUALIFIED_G21_HEAD||
  typeof s.g21PacketChecksum!=='string'||!hash.test(s.g21PacketChecksum)||
  typeof s.g18Checksum!=='string'||!hash.test(s.g18Checksum)||
  typeof s.actorId!=='string'||!id.test(s.actorId)||
  typeof s.kind!=='string'||!(s.kind in G22_KIND)||
  s.role!==G22_KIND[s.kind as G22Kind].role||
  s.gateId!==G22_KIND[s.kind as G22Kind].gate||
  !RELEASE_GATES.some(g=>g.id===s.gateId)||
  !(s.scenarioId===null||(typeof s.scenarioId==='string'&&SCENARIOS.some(x=>x.id===s.scenarioId)))||
  (s.kind==='rehearsal'&&s.scenarioId===null)||
  typeof s.originalSha256!=='string'||!hash.test(s.originalSha256)||
  typeof s.signerFingerprint!=='string'||!hash.test(s.signerFingerprint)||
  typeof s.issuedAt!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z$/.test(s.issuedAt)||
  !Number.isFinite(Date.parse(s.issuedAt))||
  !['observe','withdraw','compromise'].includes(String(s.action))||
  !(s.targetFingerprint===null||(typeof s.targetFingerprint==='string'&&hash.test(s.targetFingerprint)))||
  (s.action==='compromise'&&s.targetFingerprint===null)||
  (s.action!=='compromise'&&s.targetFingerprint!==null)||
  !['REPORTED','DEFECT','WITHDRAWN'].includes(String(s.finding))||
  (s.action!=='observe'&&s.finding!=='WITHDRAWN')||
  typeof s.note!=='string'||s.note.length>1000)
  throw Error('G22 signed physical receipt fields invalid');
 if(strictBase64(raw.signature).length!==64)throw Error('G22 Ed25519 signature length invalid');
 return raw as unknown as G22Envelope;
}
export async function verifyG22(raw:unknown,keyBase64:string,original:ArrayBuffer,parent:G22Parent):Promise<G22Verified>{
 const {statement:s,signature}=parseG22(raw);
 if(s.g21PacketChecksum!==parent.packetChecksum||s.g18Checksum!==parent.g18Checksum)
  throw Error('G22 changed canonical parent/source');
 if(original.byteLength===0||original.byteLength>12*1024*1024||
  await sha256Buffer(original)!==s.originalSha256)
  throw Error('G22 original evidence bytes/hash conflict');
 const keyBytes=strictBase64(keyBase64.trim());
 if(keyBytes.length!==32||await sha256Buffer(arrayBuffer(keyBytes))!==s.signerFingerprint)
  throw Error('G22 public key fingerprint conflict');
 let key:CryptoKey;
 try{key=await crypto.subtle.importKey('raw',arrayBuffer(keyBytes),{name:'Ed25519'},false,['verify']);}
 catch{throw Error('G22 Ed25519 unavailable');}
 if(!await crypto.subtle.verify('Ed25519',key,arrayBuffer(strictBase64(signature)),
  toBytes(JSON.stringify(s))))throw Error('G22 detached signature INVALID');
 return {statement:s,digest:await checksum(s),originalBytesChecked:true,keyTrust:'UNANCHORED'};
}
export function appendG22(ledger:readonly G22Verified[],entry:G22Verified,parent:G22Parent):G22Verified[]{
 const s=entry.statement,last=ledger.at(-1);
 if(s.g21PacketChecksum!==parent.packetChecksum||s.g18Checksum!==parent.g18Checksum)
  throw Error('G22 source drift');
 if(ledger.some(x=>x.digest===entry.digest||x.statement.receiptId===s.receiptId))
  throw Error('G22 replayed or duplicate original receipt');
 if(s.sequence!==ledger.length+1||s.previousDigest!==(last?.digest??null)||
  (last&&s.caseId!==last.statement.caseId))
  throw Error('G22 receipt chain gap or fork');
 if(last&&Date.parse(s.issuedAt)<Date.parse(last.statement.issuedAt))
  throw Error('G22 chronology conflict');
 if(parent.inheritedActors.includes(s.actorId)||parent.inheritedSignerFingerprints.includes(s.signerFingerprint))
  throw Error('G22 witness identity collides with inherited custody reviewer');
 if(ledger.some(x=>(x.statement.actorId===s.actorId)!==(x.statement.signerFingerprint===s.signerFingerprint)))
  throw Error('G22 conflicting reviewer identity/key aliases');
 if(ledger.some(x=>x.statement.actorId===s.actorId&&x.statement.role!==s.role))
  throw Error('G22 same actor cannot impersonate independent role');
 const compromised=new Set(ledger.filter(x=>x.statement.action==='compromise')
  .map(x=>x.statement.targetFingerprint!));
 if(compromised.has(s.signerFingerprint))throw Error('G22 revoked/compromised signer fenced');
 if(s.action==='compromise'&&compromised.has(s.targetFingerprint!))
  throw Error('G22 duplicate compromise incident');
 if(s.role==='owner'&&ledger.some(x=>x.statement.role!=='owner'&&
  (x.statement.actorId===s.actorId||x.statement.signerFingerprint===s.signerFingerprint)))
  throw Error('G22 independent owner identity conflict');
 return [...ledger,entry];
}
export function g22Decision(ledger:readonly G22Verified[],parent:G22Parent|null){
 const gates=RELEASE_GATES.map(g=>({gate:g.id,status:'OPEN' as const,
  candidateReceipts:ledger.filter(x=>x.statement.gateId===g.id).length}));
 const kinds=Object.keys(G22_KIND).map(kind=>({kind,
  signedReports:ledger.filter(x=>x.statement.kind===kind).length}));
 return {format:'ligoquiz-g22-physical-preparation-no-go-v1' as const,
  parentOriginalSignaturesIndependentlyReverified:false,
  actualAuthorizedHumanWitnesess:0,independentIdentityAnchors:0,
  verifiedLocalOriginalHashes:ledger.length,syntheticOrUntrustedSignedReports:ledger.length,
  inheritedG21Witnesses:parent?.g21Witnesses??0,
  compromisedCredentialReports:ledger.filter(x=>x.statement.action==='compromise').length,
  gates,kinds,staging:'NO_GO' as const,release:'NO_GO' as const,
  postrelease:'NO_GO' as const,mergeAuthorized:false,deployAuthorized:false,
  publishAuthorized:false,originalRightsApproved:false,realDeviceApproved:false,
  physicalProjectorApproved:false,realRestoreApproved:false,ownerApproved:false,
  reason:'Local signatures, statement roles and matching original file hashes cannot establish off-device reviewer identity, physical acceptance or owner release authority.'};
}
export async function g22Export(ledger:readonly G22Verified[],parent:G22Parent|null,note:string){
 const data={format:'ligoquiz-g22-original-custody-preparation-v1' as const,
  sourceG21Head:G22_QUALIFIED_G21_HEAD,parentChecksum:parent?.packetChecksum??null,
  note:note.trim().slice(0,1200),
  statements:ledger.map(x=>({statement:x.statement,digest:x.digest,
   originalBytesChecked:x.originalBytesChecked,keyTrust:x.keyTrust})),
  decision:g22Decision(ledger,parent)};
 return {...data,checksum:await checksum(data)};
}
