import {CHECKS,RELEASE_GATES,SCENARIOS,reconcileTrial,sha256Buffer} from './event-trial';

export const G19_FORMAT='ligoquiz-g19-detached-ed25519-v1' as const;
export type Statement={
 format:'ligoquiz-g19-statement-v1'; witnessId:string;scenarioId:string;gateId:string;
 sequence:number;previousDigest:string|null;operation:'observe'|'revoke'|'rotate';
 keyFingerprint:string;nextKeyFingerprint:string|null;g18Checksum:string;
 issuedAt:string;verdict:'observed'|'defect'|'withdrawn';note:string;
 attachment:{name:string;bytes:number;sha256:string}|null;
};
export type WitnessEnvelope={format:typeof G19_FORMAT;statement:Statement;signature:string};
export type VerifiedWitness={statement:Statement;digest:string;attachmentChecked:boolean;keyTrust:'UNESTABLISHED'};
const hash=/^[0-9a-f]{64}$/;
const only=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const isObject=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const b64=(value:string):Uint8Array=>{
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw Error('Invalid base64 input');
 const decoded=atob(value);return Uint8Array.from(decoded,c=>c.charCodeAt(0));
};
const digest=async (raw:Uint8Array)=>sha256Buffer(Uint8Array.from(raw).buffer as ArrayBuffer);
const utf8=(raw:string)=>new TextEncoder().encode(raw);
const publicKeyLength=32,signatureLength=64;
const statementKeys=['format','witnessId','scenarioId','gateId','sequence','previousDigest',
 'operation','keyFingerprint','nextKeyFingerprint','g18Checksum','issuedAt','verdict','note','attachment'];
export function parseWitness(value:unknown):WitnessEnvelope{
 if(!isObject(value)||!only(value,['format','statement','signature'])||
  value.format!==G19_FORMAT||typeof value.signature!=='string'||!isObject(value.statement))
  throw Error('Witness envelope invalid');
 const s=value.statement;
 if(!only(s,statementKeys)||s.format!=='ligoquiz-g19-statement-v1'||
  typeof s.witnessId!=='string'||!/^[A-Za-z0-9_.-]{6,100}$/.test(s.witnessId)||
  typeof s.scenarioId!=='string'||!SCENARIOS.some(c=>c.id===s.scenarioId)||
  typeof s.gateId!=='string'||!RELEASE_GATES.some(g=>g.id===s.gateId)||
  !Number.isSafeInteger(s.sequence)||Number(s.sequence)<1||Number(s.sequence)>100000||
  !(s.previousDigest===null||(typeof s.previousDigest==='string'&&hash.test(s.previousDigest)))||
  !['observe','revoke','rotate'].includes(String(s.operation))||
  typeof s.keyFingerprint!=='string'||!hash.test(s.keyFingerprint)||
  !(s.nextKeyFingerprint===null||(typeof s.nextKeyFingerprint==='string'&&hash.test(s.nextKeyFingerprint)))||
  typeof s.g18Checksum!=='string'||!hash.test(s.g18Checksum)||
  typeof s.issuedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s.issuedAt)||
  !Number.isFinite(Date.parse(s.issuedAt))||
  !['observed','defect','withdrawn'].includes(String(s.verdict))||
  typeof s.note!=='string'||s.note.length>1000)
  throw Error('Witness statement fields invalid');
 if(s.operation==='rotate'?(typeof s.nextKeyFingerprint!=='string'||s.nextKeyFingerprint===s.keyFingerprint||s.verdict!=='withdrawn'):
    (s.nextKeyFingerprint!==null||(s.operation==='revoke'&&s.verdict!=='withdrawn')))
  throw Error('Rotation or revocation semantics invalid');
 if(!CHECKS.length)throw Error('No evidence checks defined');
 if(s.attachment!==null){
  if(!isObject(s.attachment)||!only(s.attachment,['name','bytes','sha256'])||
   typeof s.attachment.name!=='string'||!s.attachment.name.trim()||s.attachment.name.length>180||
   !Number.isSafeInteger(s.attachment.bytes)||Number(s.attachment.bytes)<=0||
   Number(s.attachment.bytes)>12*1024*1024||
   typeof s.attachment.sha256!=='string'||!hash.test(s.attachment.sha256))
   throw Error('Attachment provenance invalid');
 }
 if(b64(value.signature).length!==signatureLength)throw Error('Ed25519 signature length invalid');
 return value as unknown as WitnessEnvelope;
}
export async function verifyWitness(raw:unknown,keyBase64:string,g18Raw:unknown,attachment?:ArrayBuffer):Promise<VerifiedWitness>{
 const envelope=parseWitness(raw);
 const g18=await reconcileTrial(g18Raw);
 const g18Seal=g18Raw as {checksum:string};
 if(envelope.statement.g18Checksum!==g18Seal.checksum)throw Error('Wrong G18 rehearsal evidence digest');
 if(g18.decision!=='NO_GO')throw Error('Release gate must remain NO_GO');
 const key=b64(keyBase64.trim());
 if(key.length!==publicKeyLength)throw Error('Ed25519 public key length invalid');
 const calculated=await digest(key);
 if(calculated!==envelope.statement.keyFingerprint)throw Error('Witness key fingerprint mismatch');
 let cryptoKey:CryptoKey;
 try{cryptoKey=await crypto.subtle.importKey('raw',Uint8Array.from(key).buffer as ArrayBuffer,
  {name:'Ed25519'},false,['verify']);}catch{throw Error('Ed25519 verification unavailable');}
 const statementBytes=utf8(JSON.stringify(envelope.statement));
 const ok=await crypto.subtle.verify({name:'Ed25519'},cryptoKey,
  Uint8Array.from(b64(envelope.signature)).buffer as ArrayBuffer,
  Uint8Array.from(statementBytes).buffer as ArrayBuffer);
 if(!ok)throw Error('Detached Ed25519 signature INVALID');
 let attachmentChecked=false;
 if(attachment){
  const a=envelope.statement.attachment;
  if(!a||attachment.byteLength!==a.bytes||await sha256Buffer(attachment)!==a.sha256)
   throw Error('Attached local evidence bytes do not match signed digest');
  attachmentChecked=true;
 }
 return {statement:envelope.statement,digest:await digest(statementBytes),
  attachmentChecked,keyTrust:'UNESTABLISHED'};
}
export function appendWitnessChain(existing:readonly VerifiedWitness[],next:VerifiedWitness):VerifiedWitness[]{
 const all=existing.filter(w=>w.statement.witnessId===next.statement.witnessId&&
  w.statement.scenarioId===next.statement.scenarioId&&w.statement.gateId===next.statement.gateId);
 const last=all.at(-1);
 if(existing.some(w=>w.digest===next.digest))throw Error('Duplicate witness statement replay');
 if(last){
  if(last.statement.operation==='revoke')throw Error('Witness revoked: new assertions forbidden');
  if(next.statement.sequence!==last.statement.sequence+1||next.statement.previousDigest!==last.digest)
   throw Error('Witness statement conflict or missing predecessor');
  const expected=last.statement.operation==='rotate'?last.statement.nextKeyFingerprint:last.statement.keyFingerprint;
  if(next.statement.keyFingerprint!==expected)throw Error('Signer key changed without recorded rotation');
  if(Date.parse(next.statement.issuedAt)<Date.parse(last.statement.issuedAt))
   throw Error('Witness chronology regressed');
  if(next.statement.g18Checksum!==last.statement.g18Checksum)
   throw Error('G18 source change requires separate witness chain');
 }else if(next.statement.sequence!==1||next.statement.previousDigest!==null){
  throw Error('Initial witness event must begin at sequence one');
 }
 return [...existing,next];
}
export const decisionForWitnesses=(witnesses:readonly VerifiedWitness[])=>({
 imported:witnesses.length,cryptographicallyVerified:witnesses.length,
 externallyTrusted:0,revoked:witnesses.filter(w=>w.statement.operation==='revoke').length,
 rotated:witnesses.filter(w=>w.statement.operation==='rotate').length,
 release:'NO_GO' as const,ownerAuthorization:false,venueAccepted:false,
 physicalAccessAccepted:false,contentRightsAccepted:false,independentWitnessCustody:false,
 reason:'Public keys supplied within this device have no externally approved trust root or owner authorization'
});
