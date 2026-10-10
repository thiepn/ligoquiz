import {reconcileTrial,sha256Buffer,RELEASE_GATES,SCENARIOS} from './event-trial';
export const G20_SOURCE={
 repository:'thiepn/ligoquiz',qualifiedG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
 verifyRun:38065657548,browserRun:38065657555,
 artifacts:[11674807819,11674747961,11675272253,11674967819,11674698079]
} as const;
export type CustodyAction='root-proposal'|'independent-review'|'rotate'|'revoke'|'compromise'|'recovery-witness'|'rights-review'|'device-review'|'owner-review';
export type CustodyRole='custodian'|'reviewer'|'recovery'|'rights'|'accessibility'|'owner';
export type CustodyStatement={
 format:'ligoquiz-g20-custody-statement-v1';custodyId:string;sequence:number;
 previousDigest:string|null;sourceG18Checksum:string;sourceG19Head:string;
 actorId:string;role:CustodyRole;action:CustodyAction;signerFingerprint:string;
 subjectFingerprint:string;nextFingerprint:string|null;
 scenarioId:string;gateId:string;receiptSha256:string|null;
 issuedAt:string;note:string;decision:'PROPOSED'|'WITHDRAWN';
};
export type CustodyEnvelope={format:'ligoquiz-g20-detached-ed25519-v1';statement:CustodyStatement;signature:string};
export type VerifiedCustody={statement:CustodyStatement;digest:string;signatureValid:true;trustRoot:'UNVERIFIED';attachmentChecked:boolean};
const hash=/^[a-f0-9]{64}$/;
const idPattern=/^[A-Za-z0-9_.-]{6,100}$/;
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(obj:Record<string,unknown>,expected:readonly string[])=>Object.keys(obj).sort().join('|')===[...expected].sort().join('|');
const schema=['format','custodyId','sequence','previousDigest','sourceG18Checksum','sourceG19Head','actorId','role','action','signerFingerprint','subjectFingerprint','nextFingerprint','scenarioId','gateId','receiptSha256','issuedAt','note','decision'];
export const ACTION_ROLES:Record<CustodyAction,CustodyRole>={
 'root-proposal':'custodian','independent-review':'reviewer','rotate':'custodian',
 'revoke':'custodian','compromise':'custodian','recovery-witness':'recovery',
 'rights-review':'rights','device-review':'accessibility','owner-review':'owner'
};
const b64=(v:string)=>{
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(v)||v.length%4!==0)throw Error('Invalid key or signature encoding');
 return Uint8Array.from(atob(v),c=>c.charCodeAt(0));
};
const bytes=(data:Uint8Array)=>Uint8Array.from(data).buffer as ArrayBuffer;
const hex=async(data:Uint8Array)=>sha256Buffer(bytes(data));
export function parseCustody(raw:unknown):CustodyEnvelope{
 if(!object(raw)||!keys(raw,['format','statement','signature'])||
 raw.format!=='ligoquiz-g20-detached-ed25519-v1'||typeof raw.signature!=='string'||!object(raw.statement))
  throw Error('Custody envelope invalid');
 const s=raw.statement;
 if(!keys(s,schema)||s.format!=='ligoquiz-g20-custody-statement-v1'||
 typeof s.custodyId!=='string'||!idPattern.test(s.custodyId)||
 !Number.isSafeInteger(s.sequence)||Number(s.sequence)<1||Number(s.sequence)>100000||
 !(s.previousDigest===null||(typeof s.previousDigest==='string'&&hash.test(s.previousDigest)))||
 typeof s.sourceG18Checksum!=='string'||!hash.test(s.sourceG18Checksum)||
 s.sourceG19Head!==G20_SOURCE.qualifiedG19Head||
 typeof s.actorId!=='string'||!idPattern.test(s.actorId)||
 typeof s.action!=='string'||!(s.action in ACTION_ROLES)||
 typeof s.role!=='string'||s.role!==ACTION_ROLES[s.action as CustodyAction]||
 typeof s.signerFingerprint!=='string'||!hash.test(s.signerFingerprint)||
 typeof s.subjectFingerprint!=='string'||!hash.test(s.subjectFingerprint)||
 !(s.nextFingerprint===null||(typeof s.nextFingerprint==='string'&&hash.test(s.nextFingerprint)))||
 typeof s.scenarioId!=='string'||!SCENARIOS.some(x=>x.id===s.scenarioId)||
 typeof s.gateId!=='string'||!RELEASE_GATES.some(x=>x.id===s.gateId)||
 !(s.receiptSha256===null||(typeof s.receiptSha256==='string'&&hash.test(s.receiptSha256)))||
 typeof s.issuedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s.issuedAt)||
 !Number.isFinite(Date.parse(s.issuedAt))||typeof s.note!=='string'||s.note.length>1000||
 !['PROPOSED','WITHDRAWN'].includes(String(s.decision)))
 throw Error('Custody statement fields invalid');
 if(s.action==='root-proposal'&&(s.sequence!==1||s.previousDigest!==null||
 s.subjectFingerprint!==s.signerFingerprint||s.decision!=='PROPOSED'))
  throw Error('Root proposal must be the first untrusted custodian assertion');
 if(s.action==='rotate'?
  (s.nextFingerprint===null||s.nextFingerprint===s.subjectFingerprint||s.decision!=='WITHDRAWN'):
  s.nextFingerprint!==null)throw Error('Rotation handoff semantics invalid');
 if(['revoke','compromise'].includes(String(s.action))&&s.decision!=='WITHDRAWN')
  throw Error('Revocation/compromise must be withdrawal');
 if(b64(raw.signature).length!==64)throw Error('Ed25519 signature length invalid');
 return raw as unknown as CustodyEnvelope;
}
export async function verifyCustody(raw:unknown,keyBase64:string,g18Raw:unknown,receipt?:ArrayBuffer):Promise<VerifiedCustody>{
 const envelope=parseCustody(raw),g18=await reconcileTrial(g18Raw);
 if(g18.decision!=='NO_GO'||(g18Raw as {checksum:string}).checksum!==envelope.statement.sourceG18Checksum)
  throw Error('G18 source checksum mismatch');
 const key=b64(keyBase64.trim());
 if(key.length!==32||await hex(key)!==envelope.statement.signerFingerprint)
  throw Error('External public key fingerprint mismatch');
 let cryptoKey:CryptoKey;
 try{cryptoKey=await crypto.subtle.importKey('raw',bytes(key),{name:'Ed25519'},false,['verify']);}
 catch{throw Error('Ed25519 public key unavailable');}
 const statementBytes=new TextEncoder().encode(JSON.stringify(envelope.statement));
 if(!await crypto.subtle.verify('Ed25519',cryptoKey,bytes(b64(envelope.signature)),bytes(statementBytes)))
  throw Error('External Ed25519 signature INVALID');
 let attachmentChecked=false;
 if(receipt){
  if(!envelope.statement.receiptSha256||await sha256Buffer(receipt)!==envelope.statement.receiptSha256)
   throw Error('Independent recovery/rights/device receipt hash mismatch');
  attachmentChecked=true;
 }
 return {statement:envelope.statement,digest:await hex(statementBytes),signatureValid:true,
  trustRoot:'UNVERIFIED',attachmentChecked};
}
export function appendCustody(history:readonly VerifiedCustody[],next:VerifiedCustody):VerifiedCustody[]{
 if(history.some(x=>x.digest===next.digest))throw Error('Replay: duplicate custody receipt');
 const s=next.statement,chain=history.filter(x=>x.statement.custodyId===s.custodyId),last=chain.at(-1);
 if(!last){
  if(s.action!=='root-proposal'||s.sequence!==1||s.previousDigest!==null)
   throw Error('Missing external custody root proposal');
 }else{
  if(s.sequence!==last.statement.sequence+1||s.previousDigest!==last.digest)
   throw Error('Custody conflict, gap or missing predecessor');
  if(s.sourceG18Checksum!==last.statement.sourceG18Checksum)
   throw Error('External source changed mid-custody');
  if(Date.parse(s.issuedAt)<Date.parse(last.statement.issuedAt))
   throw Error('Custody chronology regressed');
  const initial=chain[0]!;
  const active=chain.reduce((fp,row)=>row.statement.action==='rotate'?
   row.statement.nextFingerprint!:fp,initial.statement.subjectFingerprint);
  if(['root-proposal','rotate'].includes(s.action)&&s.action!=='rotate')
   throw Error('Duplicate root proposal');
  if(s.action==='rotate'){
   if(s.signerFingerprint!==active||s.subjectFingerprint!==active)
    throw Error('Rotation must be signed by current root holder');
  }
  if(['revoke','compromise'].includes(s.action)){
   if(chain.some(row=>['revoke','compromise'].includes(row.statement.action)&&
      row.statement.subjectFingerprint===s.subjectFingerprint))
    throw Error('Duplicate revocation or compromised signer');
  }
  const denied=new Set(chain.filter(row=>['revoke','compromise'].includes(row.statement.action))
   .map(row=>row.statement.subjectFingerprint));
  if(denied.has(s.signerFingerprint)||denied.has(s.subjectFingerprint))
   throw Error('Revoked or compromised key cannot resume authority');
  if(s.action==='rotate'&&denied.has(s.nextFingerprint!))
   throw Error('Rotated into compromised key');
  if(s.action==='independent-review'&&
   (s.actorId===initial.statement.actorId||s.signerFingerprint===initial.statement.signerFingerprint))
   throw Error('Reviewer cannot self-attest original root');
  if(s.action==='owner-review'){
   const forbidden=chain.filter(x=>x.statement.role!=='owner');
   if(forbidden.some(x=>x.statement.actorId===s.actorId||
    x.statement.signerFingerprint===s.signerFingerprint))
    throw Error('Owner must be separate from reviewer and custodian');
  }
 }
 return [...history,next];
}
export function custodyDecision(history:readonly VerifiedCustody[]){
 const distinct=new Set(history.map(x=>x.statement.actorId));
 const compromised=new Set(history.filter(x=>['compromise','revoke'].includes(x.statement.action))
  .map(x=>x.statement.subjectFingerprint));
 return {statements:history.length,actors:distinct.size,compromised:compromised.size,
  cryptographicChecks:history.length,independentTrustRoots:0,ownerAuthorized:false,
  deviceApproved:false,sourceRightsApproved:false,recoveryApproved:false,
  release:'NO_GO' as const,mergeAuthorized:false,deployAuthorized:false,
  reason:'Locally imported external keys do not establish off-device trust or human authorization'};
}
export async function custodyHandoff(history:readonly VerifiedCustody[],note:string){
 const data={
  format:'ligoquiz-g20-custody-handoff-v1' as const,source:G20_SOURCE,
  note:note.slice(0,1200).trim(),
  statements:history.map(x=>({statement:x.statement,digest:x.digest,receiptOriginalBytesChecked:x.attachmentChecked,
   trustRoot:x.trustRoot})),
  decision:custodyDecision(history),
 };
 return {...data,checksum:await sha256Buffer(bytes(new TextEncoder().encode(JSON.stringify(data))))};
}
