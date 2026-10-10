import {describe,it,expect} from 'vitest';
import {sealTrial} from '../src/features/experience/event-trial';
import {parseCustody,verifyCustody,appendCustody,custodyDecision,custodyHandoff,
 type CustodyStatement,type VerifiedCustody} from '../src/features/experience/g20-custody';
const bytes=(x:Uint8Array)=>Uint8Array.from(x).buffer as ArrayBuffer;
const b64=(x:Uint8Array)=>btoa(Array.from(x,c=>String.fromCharCode(c)).join(''));
const hash=async(x:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(x))),c=>c.toString(16).padStart(2,'0')).join('');
async function signer(){
 const key=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
 return {key:key.privateKey,base64:b64(raw),fingerprint:await hash(raw)};
}
async function fixture(){
 const source=await sealTrial({},'SYNTHETIC TEST — not a human approval');
 const root=await signer(),reviewer=await signer(),owner=await signer(),replacement=await signer();
 const stmt:CustodyStatement={
  format:'ligoquiz-g20-custody-statement-v1',custodyId:'synthetic-root-01',
  sequence:1,previousDigest:null,sourceG18Checksum:source.checksum,
  sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-01',role:'custodian',action:'root-proposal',
  signerFingerprint:root.fingerprint,subjectFingerprint:root.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:00:00Z',note:'Proposed only',decision:'PROPOSED'};
 return {source,root,reviewer,owner,replacement,stmt};
}
async function sign(s:CustodyStatement,key:CryptoKey){
 const raw=new TextEncoder().encode(JSON.stringify(s));
 const sig=new Uint8Array(await crypto.subtle.sign('Ed25519',key,bytes(raw)));
 return {format:'ligoquiz-g20-detached-ed25519-v1' as const,statement:s,signature:b64(sig)};
}
describe('G20 external root and recovery custody',()=>{
 it('checks genuine disposable Ed25519 bytes but never accepts a proposed trust root',async()=>{
  const f=await fixture();
  const first=await verifyCustody(await sign(f.stmt,f.root.key),f.root.base64,f.source);
  expect(first.trustRoot).toBe('UNVERIFIED');
  expect(first.signatureValid).toBe(true);
  const ledger=appendCustody([],first),status=custodyDecision(ledger);
  expect(status).toMatchObject({cryptographicChecks:1,independentTrustRoots:0,
    ownerAuthorized:false,recoveryApproved:false,release:'NO_GO',mergeAuthorized:false,deployAuthorized:false});
  const exportPacket=await custodyHandoff(ledger,'synthetic only');
  expect(exportPacket.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(exportPacket.decision.release).toBe('NO_GO');
 });
 it('rejects forged key, source, checksum, extra fields, altered message, original receipt bytes',async()=>{
  const f=await fixture(),envelope=await sign(f.stmt,f.root.key);
  await expect(verifyCustody({...envelope,statement:{...f.stmt,note:'FORGED'}},
   f.root.base64,f.source)).rejects.toThrow(/INVALID/);
  await expect(verifyCustody(envelope,f.reviewer.base64,f.source)).rejects.toThrow(/fingerprint/);
  await expect(verifyCustody(envelope,f.root.base64,await sealTrial({},'Changed')))
   .rejects.toThrow(/checksum/);
  expect(()=>parseCustody({...envelope,statement:{...f.stmt,ownerApproved:true}}))
   .toThrow(/fields invalid/);
  const data=new TextEncoder().encode('Original test backup, NOT production');
  const attached:CustodyStatement={...f.stmt,receiptSha256:await hash(data)};
  const signed=await sign(attached,f.root.key);
  const checked=await verifyCustody(signed,f.root.base64,f.source,bytes(data));
  expect(checked.attachmentChecked).toBe(true);
  await expect(verifyCustody(signed,f.root.base64,f.source,bytes(new TextEncoder().encode('tampered'))))
   .rejects.toThrow(/receipt hash mismatch/);
 });
 it('enforces separate reviewers and independent owner identities, chain and no replay',async()=>{
  const f=await fixture(),first=await verifyCustody(await sign(f.stmt,f.root.key),f.root.base64,f.source);
  let ledger=appendCustody([],first);
  expect(()=>appendCustody(ledger,first)).toThrow(/Replay/);
  const review:CustodyStatement={...f.stmt,sequence:2,previousDigest:first.digest,
   role:'reviewer',action:'independent-review',actorId:'reviewer-01',
   signerFingerprint:f.reviewer.fingerprint,issuedAt:'2026-10-10T15:01:00Z'};
  const ownReview:VerifiedCustody={...first,digest:'a'.repeat(64),
   statement:{...review,actorId:f.stmt.actorId,signerFingerprint:f.root.fingerprint}};
  expect(()=>appendCustody(ledger,ownReview)).toThrow(/self-attest/);
  const checked=await verifyCustody(await sign(review,f.reviewer.key),f.reviewer.base64,f.source);
  ledger=appendCustody(ledger,checked);
  const owner:CustodyStatement={...review,sequence:3,previousDigest:checked.digest,
   role:'owner',action:'owner-review',actorId:'owner-01',signerFingerprint:f.owner.fingerprint,
   issuedAt:'2026-10-10T15:02:00Z'};
  const signed=await verifyCustody(await sign(owner,f.owner.key),f.owner.base64,f.source);
  ledger=appendCustody(ledger,signed);
  expect(ledger).toHaveLength(3);
  expect(custodyDecision(ledger).ownerAuthorized).toBe(false);
  const conflict={...signed,digest:'b'.repeat(64),statement:{...owner,sequence:6,previousDigest:signed.digest}};
  expect(()=>appendCustody(ledger,conflict)).toThrow(/conflict/);
 });
 it('requires root-authorized rotation, blocks compromised key restart and contradictory revocations',async()=>{
  const f=await fixture();
  const first=await verifyCustody(await sign(f.stmt,f.root.key),f.root.base64,f.source);
  let ledger=appendCustody([],first);
  const rotate:CustodyStatement={...f.stmt,sequence:2,previousDigest:first.digest,
   action:'rotate',decision:'WITHDRAWN',nextFingerprint:f.replacement.fingerprint,
   issuedAt:'2026-10-10T15:01:00Z'};
  const rotated=await verifyCustody(await sign(rotate,f.root.key),f.root.base64,f.source);
  ledger=appendCustody(ledger,rotated);
  const invalidRotate={...rotated,digest:'b'.repeat(64),statement:{...rotate,sequence:3,previousDigest:rotated.digest,
   signerFingerprint:f.reviewer.fingerprint,subjectFingerprint:f.reviewer.fingerprint,
   nextFingerprint:f.owner.fingerprint,issuedAt:'2026-10-10T15:02:00Z'}};
  expect(()=>appendCustody(ledger,invalidRotate)).toThrow(/current root/);
  const revoke:CustodyStatement={...rotate,sequence:3,previousDigest:rotated.digest,
   action:'compromise',nextFingerprint:null,subjectFingerprint:f.replacement.fingerprint,
   signerFingerprint:f.replacement.fingerprint,issuedAt:'2026-10-10T15:02:00Z'};
  const compromised=await verifyCustody(await sign(revoke,f.replacement.key),f.replacement.base64,f.source);
  ledger=appendCustody(ledger,compromised);
  expect(custodyDecision(ledger).compromised).toBe(1);
  const resume:CustodyStatement={...revoke,sequence:4,previousDigest:compromised.digest,
   action:'root-proposal',decision:'PROPOSED',issuedAt:'2026-10-10T15:03:00Z'};
  const resumeEnvelope=await sign(f.stmt,f.root.key);
  expect(()=>parseCustody({...resumeEnvelope,statement:resume})).toThrow(/Root proposal/);
  const again={...compromised,digest:'f'.repeat(64),statement:{...revoke,sequence:4,
   previousDigest:compromised.digest,issuedAt:'2026-10-10T15:04:00Z'}};
  expect(()=>appendCustody(ledger,again)).toThrow(/Duplicate revocation/);
 });
});
