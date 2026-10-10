import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {Buffer} from 'node:buffer';
const evidencePath='test-results/g21-evidence';
async function signer(){
 const pair=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const key=Buffer.from(await webcrypto.subtle.exportKey('raw',pair.publicKey));
 return {privateKey:pair.privateKey,publicKey:key.toString('base64'),
  fingerprint:createHash('sha256').update(key).digest('hex')};
}
async function signed(statement,privateKey,format){
 const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',privateKey,
  Buffer.from(JSON.stringify(statement),'utf8'))).toString('base64');
 return {format,statement,signature};
}
async function setupFiles(page){
 const g18=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const g18Download=page.waitForEvent('download');
 await g18.getByRole('button',{name:'G18-Protokoll als JSON exportieren'}).click();
 const g18File=await g18Download;
 const rawG18=await readFile(await g18File.path());
 const source=JSON.parse(rawG18.toString('utf8'));
 const custodian=await signer(),reviewer=await signer();
 const statement={format:'ligoquiz-g20-custody-statement-v1',
  custodyId:'synthetic-e2e-root-21',sequence:1,previousDigest:null,
  sourceG18Checksum:source.checksum,sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-e2e-21',role:'custodian',action:'root-proposal',
  signerFingerprint:custodian.fingerprint,subjectFingerprint:custodian.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',receiptSha256:null,
  issuedAt:'2026-10-10T15:00:00Z',note:'SYNTHETIC E2E TEST',decision:'PROPOSED'};
 const envelope=await signed(statement,custodian.privateKey,'ligoquiz-g20-detached-ed25519-v1');
 const g20=page.getByRole('region',{name:'G20 Unabhängige Schlüsselverwahrung und Recovery-Handoff'});
 await g20.getByLabel('1. Unverändertes G18-Quellenpaket (JSON)').setInputFiles({
  name:'g18.json',mimeType:'application/json',buffer:rawG18});
 await g20.getByLabel('2. Separat signierter G20-Custody-Beleg (JSON)').setInputFiles({
  name:'g20.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(envelope))});
 await g20.getByLabel('3. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)').fill(custodian.publicKey);
 await g20.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'}).click();
 await expect(g20).toContainText('Signatur, Quellenbindung und Chronologie konsistent');
 const g20Download=page.waitForEvent('download');
 await g20.getByRole('button',{name:'NO-GO-Custody-Paket lokal exportieren'}).click();
 const handoffFile=await g20Download,rawG20=await readFile(await handoffFile.path());
 const handoff=JSON.parse(rawG20.toString('utf8'));
 return {rawG18,rawG20,source,handoff,custodian,reviewer};
}
test('G21 real browser two-party signed attestations, forged signature denial and no-go export',async({page})=>{
 await mkdir(evidencePath,{recursive:true});
 await page.setViewportSize({width:1280,height:720});await page.goto('/#/technik');
 const f=await setupFiles(page),panel=page.getByRole('region',{name:'G21 Unabhängige Root-Attestierung und Release-Trockenlauf'});
 await panel.getByLabel('1. G18 Original-Quellenpaket (JSON)').setInputFiles({
  name:'g18.json',mimeType:'application/json',buffer:f.rawG18});
 await panel.getByLabel('2. G20 Custody-Handoff (JSON)').setInputFiles({
  name:'g20.json',mimeType:'application/json',buffer:f.rawG20});
 await expect(panel).toContainText('Root UNANCHORED');
 const base={
  format:'ligoquiz-g21-attestation-statement-v1',caseId:'synthetic-g21-e2e',
  sequence:1,previousDigest:null,sourceG18Checksum:f.source.checksum,
  g20HandoffChecksum:f.handoff.checksum,qualifiedG20Head:'f066894f11dd96432bfb73e242b97aaf72cc4655',
  actorId:'reviewer-e2e-21',role:'reviewer',action:'PIN',
  signerFingerprint:f.reviewer.fingerprint,subjectFingerprint:f.custodian.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:01:00Z',note:'SYNTHETIC ONLY',finding:'REPORTED'};
 const first=await signed(base,f.reviewer.privateKey,'ligoquiz-g21-detached-ed25519-v1');
 const load=panel.getByLabel('3. Extern signierte G21-Zeugenaussage (JSON)');
 const pub=panel.getByLabel('4. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)');
 await load.setInputFiles({name:'first.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(first))});
 await pub.fill(f.reviewer.publicKey);
 await panel.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'}).click();
 await expect(panel).toContainText('1 signierte Aussagen');
 await expect(panel).toContainText('Release: NO-GO');
 const secondSigner=await signer();
 const digest=createHash('sha256').update(JSON.stringify(base)).digest('hex');
 const second={...base,sequence:2,previousDigest:digest,actorId:'reviewer-e2e-22',
  signerFingerprint:secondSigner.fingerprint,issuedAt:'2026-10-10T15:02:00Z'};
 const secondEnvelope=await signed(second,secondSigner.privateKey,'ligoquiz-g21-detached-ed25519-v1');
 await load.setInputFiles({name:'second.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(secondEnvelope))});
 await pub.fill(secondSigner.publicKey);
 await panel.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'}).click();
 await expect(panel).toContainText('2 verschiedene Root-Prüfschlüssel');
 await panel.screenshot({path:evidencePath+'/g21-two-unanchored-witnesses-1280x720.png'});
 await load.setInputFiles({name:'replay.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(secondEnvelope))});
 await pub.fill(secondSigner.publicKey);
 await panel.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('replayed receipt');
 const forged={...secondEnvelope,statement:{...second,note:'FAKE APPROVAL'}};
 await load.setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
 await panel.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('signature INVALID');
 const event=page.waitForEvent('download');
 await panel.getByRole('button',{name:'Separates G21 NO-GO-Trockenlaufprotokoll exportieren'}).click();
 const file=await event,exported=JSON.parse((await readFile(await file.path())).toString('utf8'));
 expect(exported.decision).toMatchObject({independentRootCrossChecks:2,
  externalIdentityAnchorsVerified:0,release:'NO_GO',mergeAuthorized:false,deployAuthorized:false});
});
test('G21 zoomed keyboard, mobile layout and denied release are visibly accessible',async({page})=>{
 await mkdir(evidencePath,{recursive:true});
 await page.setViewportSize({width:640,height:800});await page.goto('/#/technik');
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const panel=page.getByRole('region',{name:'G21 Unabhängige Root-Attestierung und Release-Trockenlauf'});
 const key=panel.getByLabel('4. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)');
 await key.focus();await expect(key).toBeFocused();
 await expect(panel.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'})).toBeDisabled();
 await expect(panel.getByRole('table',{name:'G21 NO-GO Freigabematrix'}).getByRole('row')).toHaveCount(6);
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await expect(panel).toContainText('NO-GO');
 await panel.screenshot({path:evidencePath+'/g21-zoomed-mobile-denied.png'});
});
