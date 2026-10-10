import {describe,it,expect} from 'vitest';
import {sealTrial} from '../src/features/experience/event-trial';
import {verifyCustody,appendCustody,custodyHandoff,type CustodyStatement} from '../src/features/experience/g20-custody';
import {readG21Parent,parseG21Envelope,verifyG21Envelope,appendG21Ledger,g21DryRun,g21Export,
 type G21Statement} from '../src/features/experience/g21-attestation';
const bytes=(v:Uint8Array)=>Uint8Array.from(v).buffer as ArrayBuffer;
const b64=(v:Uint8Array)=>btoa(Array.from(v,c=>String.fromCharCode(c)).join(''));
const hash=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(v))),n=>n.toString(16).padStart(2,'0')).join('');
async function signer(){
 const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey));
 return {privateKey:keys.privateKey,publicKey:b64(raw),fingerprint:await hash(raw)};
}
async function signG20(statement:CustodyStatement,key:CryptoKey){
 return {format:'ligoquiz-g20-detached-ed25519-v1' as const,statement,
  signature:b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key,bytes(new TextEncoder().encode(JSON.stringify(statement)))))};
}
async function signG21(statement:G21Statement,key:CryptoKey){
 return {format:'ligoquiz-g21-detached-ed25519-v1' as const,statement,
  signature:b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key,bytes(new TextEncoder().encode(JSON.stringify(statement)))))};
}
async function fixture(){
 const source=await sealTrial({},'SYNTHETIC G21 NOT A HUMAN APPROVAL');
 const custodian=await signer(),reviewer=await signer(),reviewer2=await signer(),
  owner=await signer(),other=await signer();
 const rootStatement:CustodyStatement={
  format:'ligoquiz-g20-custody-statement-v1',custodyId:'synthetic-root-21',sequence:1,
  previousDigest:null,sourceG18Checksum:source.checksum,
  sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-21',role:'custodian',action:'root-proposal',signerFingerprint:custodian.fingerprint,
  subjectFingerprint:custodian.fingerprint,nextFingerprint:null,
  scenarioId:'rundenquiz-3',gateId:'rehearsals',receiptSha256:null,
  issuedAt:'2026-10-10T15:00:00Z',note:'SYNTHETIC',decision:'PROPOSED',
 };
 const root=await verifyCustody(await signG20(rootStatement,custodian.privateKey),custodian.publicKey,source);
 const handoff=await custodyHandoff(appendCustody([],root),'synthetic signed G20 root');
 const parent=await readG21Parent(handoff,source);
 const attestation:G21Statement={
  format:'ligoquiz-g21-attestation-statement-v1',caseId:'synthetic-case-21',
  sequence:1,previousDigest:null,sourceG18Checksum:source.checksum,
  g20HandoffChecksum:handoff.checksum,
  qualifiedG20Head:'f066894f11dd96432bfb73e242b97aaf72cc4655',
  actorId:'reviewer-21',role:'reviewer',action:'PIN',
  signerFingerprint:reviewer.fingerprint,subjectFingerprint:custodian.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',receiptSha256:null,
  issuedAt:'2026-10-10T15:01:00Z',note:'SYNTHETIC. Identity not anchored.',finding:'REPORTED',
 };
 return {source,custodian,reviewer,reviewer2,owner,other,rootStatement,root,handoff,parent,attestation};
}
describe('G21 independent root attestation and release dry run',()=>{
 it('authenticates two different disposable witnesses but never confuses signatures with real-world trust',async()=>{
  const f=await fixture();
  const first=await verifyG21Envelope(await signG21(f.attestation,f.reviewer.privateKey),
   f.reviewer.publicKey,f.parent);
  let ledger=appendG21Ledger([],first,f.parent);
  const secondStatement:G21Statement={...f.attestation,actorId:'reviewer-22',
   signerFingerprint:f.reviewer2.fingerprint,sequence:2,previousDigest:first.digest,
   issuedAt:'2026-10-10T15:02:00Z'};
  const second=await verifyG21Envelope(await signG21(secondStatement,f.reviewer2.privateKey),
   f.reviewer2.publicKey,f.parent);
  ledger=appendG21Ledger(ledger,second,f.parent);
  expect(g21DryRun(ledger,f.parent)).toMatchObject({
   independentRootCrossChecks:2,externalIdentityAnchorsVerified:0,
   realRestoreAuthorized:false,rightsAuthorized:false,independentOwnerApproval:false,
   parentG20OriginalSignaturesReverified:false,release:'NO_GO',mergeAuthorized:false,deployAuthorized:false,
  });
  expect((await g21Export(ledger,f.parent,'synthetic')).checksum).toMatch(/^[a-f0-9]{64}$/);
 });
 it('rejects forged Ed25519, key substitution, source rewrites and unknown approval fields',async()=>{
  const f=await fixture(),signed=await signG21(f.attestation,f.reviewer.privateKey);
  await expect(verifyG21Envelope({...signed,statement:{...f.attestation,note:'FORGED'}},
   f.reviewer.publicKey,f.parent)).rejects.toThrow(/INVALID/);
  await expect(verifyG21Envelope(signed,f.owner.publicKey,f.parent)).rejects.toThrow(/fingerprint/);
  expect(()=>parseG21Envelope({...signed,statement:{...f.attestation,approved:true}}))
   .toThrow(/fields invalid/);
  await expect(verifyG21Envelope(signed,f.reviewer.publicKey,
   {...f.parent,checksum:'a'.repeat(64)})).rejects.toThrow(/source\/parent/);
  await expect(readG21Parent({...f.handoff,checksum:'f'.repeat(64)},f.source))
   .rejects.toThrow(/checksum/);
  await expect(readG21Parent(f.handoff,await sealTrial({},'other original')))
   .rejects.toThrow(/source/);
  const altered={...f.handoff,statements:[{...f.handoff.statements[0],trustRoot:'VERIFIED'}]};
  await expect(readG21Parent(altered,f.source)).rejects.toThrow(/checksum/);
 });
 it('requires the actual original bytes for all physical/rights/recovery receipts',async()=>{
  const f=await fixture();
  const original=new TextEncoder().encode('SYNTHETIC disposal backup only');
  const receipt:G21Statement={...f.attestation,actorId:'recovery-21',role:'recovery',
   action:'RECOVERY',gateId:'restore',receiptSha256:await hash(original)};
  const signed=await signG21(receipt,f.other.privateKey);
  // Re-sign with the corresponding original key and original receipt digest.
  const correct={...receipt,signerFingerprint:f.other.fingerprint};
  const authentic=await signG21(correct,f.other.privateKey);
  await expect(verifyG21Envelope(authentic,f.other.publicKey,f.parent))
   .rejects.toThrow(/original bytes required/);
  await expect(verifyG21Envelope(authentic,f.other.publicKey,f.parent,
   bytes(new TextEncoder().encode('TAMPERED')))).rejects.toThrow(/SHA-256/);
  const checked=await verifyG21Envelope(authentic,f.other.publicKey,f.parent,bytes(original));
  expect(checked.attachmentChecked).toBe(true);
  expect(()=>parseG21Envelope({...signed,statement:{...receipt,receiptSha256:null}}))
   .toThrow(/original file digest/);
 });
 it('denies replay, forks, self-review, signer aliasing and owner role reuse',async()=>{
  const f=await fixture();
  const root=await verifyG21Envelope(await signG21(f.attestation,f.reviewer.privateKey),
   f.reviewer.publicKey,f.parent);
  let ledger=appendG21Ledger([],root,f.parent);
  expect(()=>appendG21Ledger(ledger,root,f.parent)).toThrow(/replayed/);
  const fork={...root,digest:'a'.repeat(64),statement:{...root.statement,sequence:2,previousDigest:'f'.repeat(64)}};
  expect(()=>appendG21Ledger(ledger,fork,f.parent)).toThrow(/fork/);
  const self={...root,digest:'b'.repeat(64),statement:{...root.statement,sequence:2,
   previousDigest:root.digest,actorId:'custodian-21',signerFingerprint:f.custodian.fingerprint}};
  expect(()=>appendG21Ledger(ledger,self,f.parent)).toThrow(/custodian/);
  const role={...root,digest:'c'.repeat(64),statement:{...root.statement,sequence:2,
   previousDigest:root.digest,action:'OWNER' as const,role:'owner' as const,gateId:'release'}};
  expect(()=>appendG21Ledger(ledger,role,f.parent)).toThrow(/independent roles/);
  const nextStatement:G21Statement={...f.attestation,sequence:2,previousDigest:root.digest,
   actorId:'owner-21',role:'owner',action:'OWNER',gateId:'release',
   signerFingerprint:f.owner.fingerprint,issuedAt:'2026-10-10T15:03:00Z'};
  const owner=await verifyG21Envelope(await signG21(nextStatement,f.owner.privateKey),
   f.owner.publicKey,f.parent);
  ledger=appendG21Ledger(ledger,owner,f.parent);
  expect(g21DryRun(ledger,f.parent).independentOwnerApproval).toBe(false);
 });
 it('quarantines compromised roots, contradictory incidents and invalid rotation claims',async()=>{
  const f=await fixture();
  const incidentStatement:G21Statement={...f.attestation,action:'INCIDENT',finding:'WITHDRAWN'};
  const incident=await verifyG21Envelope(await signG21(incidentStatement,f.reviewer.privateKey),
   f.reviewer.publicKey,f.parent);
  const ledger=appendG21Ledger([],incident,f.parent);
  const attempted={...incident,digest:'a'.repeat(64),statement:{...f.attestation,sequence:2,
   previousDigest:incident.digest,actorId:'reviewer-22',signerFingerprint:f.reviewer2.fingerprint}};
  expect(()=>appendG21Ledger(ledger,attempted,f.parent)).toThrow(/root compromised|compromised subject/);
  const again={...attempted,statement:{...attempted.statement,action:'INCIDENT' as const,finding:'WITHDRAWN' as const}};
  expect(()=>appendG21Ledger(ledger,again,f.parent)).toThrow(/duplicate compromised/);
  const invalidRotation:G21Statement={...f.attestation,action:'ROTATION',
   nextFingerprint:f.other.fingerprint,finding:'WITHDRAWN'};
  await expect(verifyG21Envelope(await signG21(invalidRotation,f.reviewer.privateKey),
   f.reviewer.publicKey,f.parent)).rejects.toThrow(/rotation lineage/);
  expect(g21DryRun(ledger,f.parent).release).toBe('NO_GO');
 });
});
