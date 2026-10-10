import {describe,it,expect} from 'vitest';
import {sealTrial} from '../src/features/experience/event-trial';
import {verifyWitness,appendWitnessChain,decisionForWitnesses,parseWitness,
 type Statement} from '../src/features/experience/g19-witness';
const toB64=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const bytes=(v:BufferSource)=>new Uint8Array(v instanceof ArrayBuffer?v:v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength));
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(b).buffer as ArrayBuffer)),x=>x.toString(16).padStart(2,'0')).join('');
async function signer(){
 const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=bytes(await crypto.subtle.exportKey('raw',keys.publicKey));
 return {privateKey:keys.privateKey,publicKey:toB64(pub),fingerprint:await hash(pub)};
}
async function sealStatement(stmt:Statement,privateKey:CryptoKey){
 const sig=bytes(await crypto.subtle.sign({name:'Ed25519'},privateKey,new TextEncoder().encode(JSON.stringify(stmt))));
 return {format:'ligoquiz-g19-detached-ed25519-v1' as const,statement:stmt,signature:toB64(sig)};
}
async function fixture(){
 const g18=await sealTrial({},'Unapproved synthetic test evidence');
 const key=await signer();
 const data=new TextEncoder().encode('disposable synthetic fixture');
 const attachment={name:'synthetic-trial.txt',bytes:data.length,sha256:await hash(data)};
 const statement:Statement={format:'ligoquiz-g19-statement-v1',witnessId:'test-reviewer-1',
  scenarioId:'rundenquiz-3',gateId:'venue',sequence:1,previousDigest:null,
  operation:'observe',keyFingerprint:key.fingerprint,nextKeyFingerprint:null,
  g18Checksum:g18.checksum,issuedAt:'2026-10-10T14:00:00Z',verdict:'observed',
  note:'SYNTHETIC TEST ONLY, not a real venue observation',attachment};
 const envelope=await sealStatement(statement,key.privateKey);
 return {g18,key,statement,envelope,attachmentBytes:data};
}
describe('G19 detached verification and source custody',()=>{
 it('accepts genuinely verified disposable Ed25519 bytes but never grants trust',async()=>{
  const f=await fixture();
  const checked=await verifyWitness(f.envelope,f.key.publicKey,f.g18,
   Uint8Array.from(f.attachmentBytes).buffer as ArrayBuffer);
  expect(checked).toMatchObject({attachmentChecked:true,keyTrust:'UNESTABLISHED'});
  expect(checked.digest).toMatch(/^[a-f0-9]{64}$/);
  const unverifiedAttachment=await verifyWitness(f.envelope,f.key.publicKey,f.g18);
  expect(unverifiedAttachment.attachmentChecked).toBe(false);
  const report=decisionForWitnesses([checked]);
  expect(report).toMatchObject({externallyTrusted:0,release:'NO_GO',ownerAuthorization:false,
   physicalAccessAccepted:false,independentWitnessCustody:false});
 });
 it('rejects message mutation, forgery, untrusted key substitution, wrong report and wrong original bytes',async()=>{
  const f=await fixture();
  await expect(verifyWitness({...f.envelope,statement:{...f.statement,note:'FORGED PASS'}},
   f.key.publicKey,f.g18)).rejects.toThrow(/INVALID/);
  const other=await signer();
  await expect(verifyWitness(f.envelope,other.publicKey,f.g18)).rejects.toThrow(/fingerprint/);
  await expect(verifyWitness(f.envelope,f.key.publicKey,await sealTrial({},'Different report')))
   .rejects.toThrow(/Wrong G18/);
  const wrong=new TextEncoder().encode('tampered synthetic contents');
  await expect(verifyWitness(f.envelope,f.key.publicKey,f.g18,
   Uint8Array.from(wrong).buffer as ArrayBuffer)).rejects.toThrow(/do not match/);
  await expect(verifyWitness({...f.envelope,signature:'AAAA'},f.key.publicKey,f.g18))
   .rejects.toThrow(/length/);
  expect(()=>parseWitness({...f.envelope,statement:{...f.statement,ownerApproved:true}}))
   .toThrow(/fields invalid/);
 });
 it('enforces monotonic chain, signed rotation, revoked owner and collision rejection',async()=>{
  const f=await fixture(),newKey=await signer();
  const first=await verifyWitness(f.envelope,f.key.publicKey,f.g18);
  const chain=appendWitnessChain([],first);
  expect(()=>appendWitnessChain(chain,first)).toThrow(/replay/);
  const rotate:Statement={...f.statement,sequence:2,previousDigest:first.digest,
   operation:'rotate',nextKeyFingerprint:newKey.fingerprint,verdict:'withdrawn',
   issuedAt:'2026-10-10T14:01:00Z'};
  const rotated=await verifyWitness(await sealStatement(rotate,f.key.privateKey),f.key.publicKey,f.g18);
  const after=appendWitnessChain(chain,rotated);
  const brokenStatement:Statement={...f.statement,sequence:3,previousDigest:rotated.digest,
   issuedAt:'2026-10-10T14:02:00Z'};
  const broken=await verifyWitness(await sealStatement(brokenStatement,f.key.privateKey),
   f.key.publicKey,f.g18);
  expect(()=>appendWitnessChain(after,broken)).toThrow(/rotation/);
  const revoke:Statement={...rotate,sequence:3,previousDigest:rotated.digest,
   operation:'revoke',keyFingerprint:newKey.fingerprint,nextKeyFingerprint:null,
   issuedAt:'2026-10-10T14:02:00Z'};
  const revoked=await verifyWitness(await sealStatement(revoke,newKey.privateKey),newKey.publicKey,f.g18);
  const ended=appendWitnessChain(after,revoked);
  expect(decisionForWitnesses(ended)).toMatchObject({revoked:1,rotated:1,release:'NO_GO'});
  const later={...revoked,digest:'f'.repeat(64),statement:{...revoke,sequence:4,previousDigest:revoked.digest}};
  expect(()=>appendWitnessChain(ended,later)).toThrow(/revoked/);
 });
});
