import {describe,it,expect} from 'vitest';
import {sealTrial} from '../src/features/experience/event-trial';
import {verifyCustody,appendCustody,custodyHandoff,type CustodyStatement} from '../src/features/experience/g20-custody';
import {readG21Parent,g21Export} from '../src/features/experience/g21-attestation';
import {readG22Parent,parseG22,verifyG22,appendG22,g22Decision,g22Export,
 type G22Statement,type G22Parent,type G22Verified} from '../src/features/experience/g22-physical-custody';
const buffer=(v:Uint8Array)=>Uint8Array.from(v).buffer as ArrayBuffer;
const b64=(v:Uint8Array)=>btoa(Array.from(v,c=>String.fromCharCode(c)).join(''));
const sha=async(v:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer(v))),b=>b.toString(16).padStart(2,'0')).join('');
async function signer(){
 const kp=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey));
 return {secret:kp.privateKey,publicKey:b64(raw),fingerprint:await sha(raw)};
}
async function signG20(statement:CustodyStatement,key:CryptoKey){
 const data=new TextEncoder().encode(JSON.stringify(statement));
 return {format:'ligoquiz-g20-detached-ed25519-v1' as const,statement,
  signature:b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key,buffer(data))))};
}
async function signG22(statement:G22Statement,key:CryptoKey){
 const data=new TextEncoder().encode(JSON.stringify(statement));
 return {format:'ligoquiz-g22-detached-ed25519-v1' as const,statement,
  signature:b64(new Uint8Array(await crypto.subtle.sign('Ed25519',key,buffer(data))))};
}
async function fixture(){
 const source=await sealTrial({},'SYNTHETIC G22 test source, not acceptance');
 const custodian=await signer(),witness=await signer(),witness2=await signer(),owner=await signer();
 const sourceStatement:CustodyStatement={
  format:'ligoquiz-g20-custody-statement-v1',custodyId:'synthetic-g22-root',
  sequence:1,previousDigest:null,sourceG18Checksum:source.checksum,
  sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-g22',role:'custodian',action:'root-proposal',
  signerFingerprint:custodian.fingerprint,subjectFingerprint:custodian.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:00:00Z',note:'SYNTHETIC',decision:'PROPOSED',
 };
 const root=await verifyCustody(await signG20(sourceStatement,custodian.secret),custodian.publicKey,source);
 const g20=await custodyHandoff(appendCustody([],root),'synthetic');
 const g21Parent=await readG21Parent(g20,source),g21=await g21Export([],g21Parent,'synthetic');
 const parent=await readG22Parent(g21,source);
 const original=new TextEncoder().encode('SYNTHETIC original file only, NOT A REAL HARDWARE WITNESS');
 const statement:G22Statement={
  format:'ligoquiz-g22-physical-receipt-v1',caseId:'synthetic-case-22',
  receiptId:'synthetic-receipt-01',sequence:1,previousDigest:null,
  qualifiedG21Head:'1941b9a4f9b3cf55dd0ca749eb457f85a0aab613',
  g21PacketChecksum:g21.checksum,g18Checksum:source.checksum,
  actorId:'technician-g22',role:'technician',signerFingerprint:witness.fingerprint,
  kind:'venue-projector',gateId:'venue',scenarioId:null,originalSha256:await sha(original),
  issuedAt:'2026-10-10T15:01:00Z',action:'observe',targetFingerprint:null,
  finding:'REPORTED',note:'SYNTHETIC ONLY, not a physical acceptance',
 };
 return {source,g20,g21,parent,custodian,witness,witness2,owner,original,statement};
}
describe('G22 source-backed physical/original review and release quarantine',()=>{
 it('verifies real synthetic Ed25519 bytes and original file SHA without creating human approvals',async()=>{
  const f=await fixture();
  const receipt=await verifyG22(await signG22(f.statement,f.witness.secret),
   f.witness.publicKey,buffer(f.original),f.parent);
  const ledger=appendG22([],receipt,f.parent);
  expect(receipt).toMatchObject({originalBytesChecked:true,keyTrust:'UNANCHORED'});
  expect(g22Decision(ledger,f.parent)).toMatchObject({
   verifiedLocalOriginalHashes:1,actualAuthorizedHumanWitnesess:0,independentIdentityAnchors:0,
   release:'NO_GO',staging:'NO_GO',postrelease:'NO_GO',mergeAuthorized:false,deployAuthorized:false,
   originalRightsApproved:false,realRestoreApproved:false,ownerApproved:false,
  });
  const output=await g22Export(ledger,f.parent,'synthetic only');
  expect(output.checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(output)).not.toContain('SYNTHETIC original file only');
 });
 it('rejects mismatched G21 parent, altered source, rewritten statement, forged signer and extras',async()=>{
  const f=await fixture(),raw=await signG22(f.statement,f.witness.secret);
  await expect(readG22Parent({...f.g21,checksum:'a'.repeat(64)},f.source)).rejects.toThrow(/checksum/);
  await expect(readG22Parent(f.g21,await sealTrial({},'different source'))).rejects.toThrow(/source|conflict/);
  await expect(verifyG22({...raw,statement:{...f.statement,note:'FORGED'}},
   f.witness.publicKey,buffer(f.original),f.parent)).rejects.toThrow(/INVALID/);
  await expect(verifyG22(raw,f.witness2.publicKey,buffer(f.original),f.parent))
   .rejects.toThrow(/fingerprint/);
  await expect(verifyG22(raw,f.witness.publicKey,buffer(f.original),
   {...f.parent,packetChecksum:'a'.repeat(64)})).rejects.toThrow(/parent/);
  expect(()=>parseG22({...raw,statement:{...f.statement,ownerApproved:true}}))
   .toThrow(/fields invalid/);
  expect(()=>parseG22({...raw,statement:{...f.statement,gateId:'release'}}))
   .toThrow(/fields invalid/);
 });
 it('rejects absent, mutated and oversized originals; no metadata-only acceptance',async()=>{
  const f=await fixture(),raw=await signG22(f.statement,f.witness.secret);
  await expect(verifyG22(raw,f.witness.publicKey,buffer(new Uint8Array()),f.parent))
   .rejects.toThrow(/original evidence/);
  await expect(verifyG22(raw,f.witness.publicKey,buffer(new TextEncoder().encode('tampered')),f.parent))
   .rejects.toThrow(/original evidence/);
  await expect(verifyG22(raw,f.witness.publicKey,new Uint8Array(12*1024*1024+1).buffer,f.parent))
   .rejects.toThrow(/original evidence/);
  expect(()=>parseG22({...raw,statement:{...f.statement,originalSha256:null}}))
   .toThrow(/fields invalid/);
 });
 it('rejects replays, forked history, source changes, inherited witness impersonation and reused independent actors',async()=>{
  const f=await fixture(),first=await verifyG22(await signG22(f.statement,f.witness.secret),
   f.witness.publicKey,buffer(f.original),f.parent);
  let ledger=appendG22([],first,f.parent);
  expect(()=>appendG22(ledger,first,f.parent)).toThrow(/replayed/);
  const bad: G22Verified={...first,digest:'c'.repeat(64),statement:{...f.statement,
   receiptId:'synthetic-receipt-02',sequence:2,previousDigest:'e'.repeat(64)}};
  expect(()=>appendG22(ledger,bad,f.parent)).toThrow(/fork/);
  const source: G22Verified={...bad,statement:{...bad.statement,previousDigest:first.digest,
   g21PacketChecksum:'a'.repeat(64)}};
  expect(()=>appendG22(ledger,source,f.parent)).toThrow(/source drift/);
  const inherited={...bad,statement:{...bad.statement,previousDigest:first.digest,
   actorId:'custodian-g22',signerFingerprint:f.custodian.fingerprint}};
  expect(()=>appendG22(ledger,inherited,f.parent)).toThrow(/inherited custody/);
  const fakeOwner={...bad,statement:{...bad.statement,previousDigest:first.digest,
   actorId:f.statement.actorId,role:'owner' as const,kind:'owner-custody' as const,gateId:'release'}};
  expect(()=>appendG22(ledger,fakeOwner,f.parent)).toThrow(/independent role/);
  const second:G22Statement={...f.statement,receiptId:'synthetic-receipt-03',
   sequence:2,previousDigest:first.digest,actorId:'owner-g22',role:'owner',
   signerFingerprint:f.owner.fingerprint,kind:'owner-custody',gateId:'release',
   issuedAt:'2026-10-10T15:02:00Z'};
  const accepted=await verifyG22(await signG22(second,f.owner.secret),
   f.owner.publicKey,buffer(f.original),f.parent);
  ledger=appendG22(ledger,accepted,f.parent);
  expect(g22Decision(ledger,f.parent).ownerApproved).toBe(false);
 });
 it('fences signed compromise targets, rejects contradictory claims and never elevates rights or devices',async()=>{
  const f=await fixture();
  const incident:G22Statement={...f.statement,action:'compromise',finding:'WITHDRAWN',
   targetFingerprint:f.witness2.fingerprint};
  const first=await verifyG22(await signG22(incident,f.witness.secret),
   f.witness.publicKey,buffer(f.original),f.parent);
  const ledger=appendG22([],first,f.parent);
  const next:G22Verified={...first,digest:'a'.repeat(64),statement:{...f.statement,
   receiptId:'synthetic-receipt-03',sequence:2,previousDigest:first.digest,
   signerFingerprint:f.witness2.fingerprint,actorId:'reviewer-two-22'}};
  expect(()=>appendG22(ledger,next,f.parent)).toThrow(/compromised signer/);
  const duplicate:G22Verified={...next,statement:{...next.statement,signerFingerprint:f.owner.fingerprint,
   actorId:'owner-g22',targetFingerprint:f.witness2.fingerprint,action:'compromise',finding:'WITHDRAWN'}};
  expect(()=>appendG22(ledger,duplicate,f.parent)).toThrow(/duplicate compromise/);
  expect(g22Decision(ledger,f.parent).realDeviceApproved).toBe(false);
 });
});
