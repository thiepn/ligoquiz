import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {Buffer} from 'node:buffer';
const evidencePath='test-results/g22-evidence';
async function signer(){
 const kp=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const key=Buffer.from(await webcrypto.subtle.exportKey('raw',kp.publicKey));
 return {privateKey:kp.privateKey,publicKey:key.toString('base64'),
  fingerprint:createHash('sha256').update(key).digest('hex')};
}
async function sign(statement,key,format){
 const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',key,
  Buffer.from(JSON.stringify(statement),'utf8'))).toString('base64');
 return {format,statement,signature};
}
const asUpload=(name,bytes)=>({name,mimeType:'application/json',buffer:bytes});
async function setupSources(page){
 const g18=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const downloadG18=page.waitForEvent('download');
 await g18.getByRole('button',{name:'G18-Protokoll als JSON exportieren'}).click();
 const sourceFile=await downloadG18,originalG18=await readFile(await sourceFile.path());
 const source=JSON.parse(originalG18.toString('utf8'));
 const root=await signer();
 const stmt={format:'ligoquiz-g20-custody-statement-v1',custodyId:'synthetic-root-g22',
  sequence:1,previousDigest:null,sourceG18Checksum:source.checksum,
  sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-g22',role:'custodian',action:'root-proposal',
  signerFingerprint:root.fingerprint,subjectFingerprint:root.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:00:00Z',
  note:'SYNTHETIC G22 browser',decision:'PROPOSED'};
 const g20=page.getByRole('region',{name:'G20 Unabhängige Schlüsselverwahrung und Recovery-Handoff'});
 await g20.getByLabel('1. Unverändertes G18-Quellenpaket (JSON)').setInputFiles(asUpload('g18.json',originalG18));
 await g20.getByLabel('2. Separat signierter G20-Custody-Beleg (JSON)').setInputFiles(asUpload('g20.json',
  Buffer.from(JSON.stringify(await sign(stmt,root.privateKey,'ligoquiz-g20-detached-ed25519-v1')))));
 await g20.getByLabel('3. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)').fill(root.publicKey);
 await g20.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'}).click();
 await expect(g20).toContainText('Signatur, Quellenbindung und Chronologie konsistent');
 const downloadG20=page.waitForEvent('download');
 await g20.getByRole('button',{name:'NO-GO-Custody-Paket lokal exportieren'}).click();
 const g20File=await downloadG20,originalG20=await readFile(await g20File.path());
 const g21=page.getByRole('region',{name:'G21 Unabhängige Root-Attestierung und Release-Trockenlauf'});
 await g21.getByLabel('1. G18 Original-Quellenpaket (JSON)').setInputFiles(asUpload('g18.json',originalG18));
 await g21.getByLabel('2. G20 Custody-Handoff (JSON)').setInputFiles(asUpload('g20.json',originalG20));
 await expect(g21).toContainText('Root UNANCHORED');
 const parentG20=JSON.parse(originalG20.toString('utf8'));
 const reviewer=await signer();
 const stmt21={format:'ligoquiz-g21-attestation-statement-v1',
  caseId:'synthetic-g22-g21-case',sequence:1,previousDigest:null,
  sourceG18Checksum:source.checksum,g20HandoffChecksum:parentG20.checksum,
  qualifiedG20Head:'f066894f11dd96432bfb73e242b97aaf72cc4655',
  actorId:'reviewer-g21-g22',role:'reviewer',action:'PIN',
  signerFingerprint:reviewer.fingerprint,subjectFingerprint:root.fingerprint,
  nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:00:30Z',
  note:'SYNTHETIC inherited reviewer, not an authorized witness',finding:'REPORTED'};
 const signed21=await sign(stmt21,reviewer.privateKey,'ligoquiz-g21-detached-ed25519-v1');
 await g21.getByLabel('3. Extern signierte G21-Zeugenaussage (JSON)').setInputFiles(asUpload('g21-witness.json',
  Buffer.from(JSON.stringify(signed21))));
 await g21.getByLabel('4. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)').fill(reviewer.publicKey);
 await g21.getByRole('button',{name:'Signierte Aussage und unabhängige Rollen prüfen'}).click();
 await expect(g21).toContainText('1 signierte Aussagen');
 const downloadG21=page.waitForEvent('download');
 await g21.getByRole('button',{name:'Separates G21 NO-GO-Trockenlaufprotokoll exportieren'}).click();
 const g21File=await downloadG21,originalG21=await readFile(await g21File.path());
 return {source,originalG18,originalG21,g21:JSON.parse(originalG21.toString('utf8'))};
}
test('G22 real signed synthetic original-byte intake, tampering and NO-GO custody export',async({page})=>{
 await mkdir(evidencePath,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const {source,originalG18,originalG21,g21}=await setupSources(page);
 const g22=page.getByRole('region',{name:'G22 Physische Abnahme und Originalbelege'});
 await g22.getByLabel('1. Unverändertes G18-Original (JSON)').setInputFiles(asUpload('g18.json',originalG18));
 await g22.getByLabel('2. Separates G21-NO-GO-Trockenlaufpaket (JSON)').setInputFiles(asUpload('g21.json',originalG21));
 await expect(g22).toContainText('Signaturen aus G20/G21 fehlen');
 const operator=await signer();
 const original=Buffer.from('SYNTHETIC DEVICE EVIDENCE for G22; not a physical test');
 const stmt={format:'ligoquiz-g22-physical-receipt-v1',caseId:'synthetic-g22-e2e',
  receiptId:'g22-physical-receipt-01',sequence:1,previousDigest:null,
  qualifiedG21Head:'1941b9a4f9b3cf55dd0ca749eb457f85a0aab613',
  g21PacketChecksum:g21.checksum,g18Checksum:source.checksum,actorId:'technician-22',
  role:'technician',signerFingerprint:operator.fingerprint,kind:'venue-projector',gateId:'venue',
  scenarioId:null,originalSha256:createHash('sha256').update(original).digest('hex'),
  issuedAt:'2026-10-10T15:01:00Z',action:'observe',targetFingerprint:null,
  finding:'REPORTED',note:'SYNTHETIC ONLY - no actual venue',
 };
 const signed=await sign(stmt,operator.privateKey,'ligoquiz-g22-detached-ed25519-v1');
 const input=g22.getByLabel('3. Extern signierter G22-Originalbeleg (JSON)');
 const pub=g22.getByLabel('4. Separater öffentlicher Ed25519-Schlüssel (Base64)');
 const bytes=g22.getByLabel('5. Tatsächliche unveränderte Originalbeleg-Datei (max. 12 MiB)');
 await input.setInputFiles(asUpload('g22.json',Buffer.from(JSON.stringify(signed))));
 await pub.fill(operator.publicKey);
 await bytes.setInputFiles({name:'synthetic-original.txt',mimeType:'text/plain',buffer:original});
 await g22.getByRole('button',{name:'Signatur, Originalhash, Rollen und Custody-Reihenfolge prüfen'}).click();
 await expect(g22).toContainText('SHA-256 Originalbytes, Ed25519 und Belegfolge konsistent');
 await expect(g22).toContainText('1 lokal signierte Belege');
 await expect(g22).toContainText('0 extern bestätigte Identitäten');
 await g22.screenshot({path:evidencePath+'/g22-original-hash-unanchored-1280.png'});
 await input.setInputFiles(asUpload('replay.json',Buffer.from(JSON.stringify(signed))));
 await pub.fill(operator.publicKey);
 await bytes.setInputFiles({name:'synthetic-original.txt',mimeType:'text/plain',buffer:original});
 await g22.getByRole('button',{name:'Signatur, Originalhash, Rollen und Custody-Reihenfolge prüfen'}).click();
 await expect(g22.getByRole('alert')).toContainText('replayed');
 const forged={...signed,statement:{...stmt,note:'FORGED HUMAN APPROVAL'}};
 await input.setInputFiles(asUpload('forged.json',Buffer.from(JSON.stringify(forged))));
 await g22.getByRole('button',{name:'Signatur, Originalhash, Rollen und Custody-Reihenfolge prüfen'}).click();
 await expect(g22.getByRole('alert')).toContainText('INVALID');
 const exporting=page.waitForEvent('download');
 await g22.getByRole('button',{name:'G22 Original-Custody- und NO-GO-Paket exportieren'}).click();
 const output=await exporting,parsed=JSON.parse((await readFile(await output.path())).toString('utf8'));
 expect(parsed.decision).toMatchObject({staging:'NO_GO',release:'NO_GO',postrelease:'NO_GO',
  deployAuthorized:false,publishAuthorized:false,realDeviceApproved:false,ownerApproved:false});
 expect(JSON.stringify(parsed)).not.toContain(original.toString('utf8'));
});
test('G22 mobile 200-percent zoom, keyboard focus and six independent unopened gates',async({page})=>{
 await mkdir(evidencePath,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const g22=page.getByRole('region',{name:'G22 Physische Abnahme und Originalbelege'});
 const key=g22.getByLabel('4. Separater öffentlicher Ed25519-Schlüssel (Base64)');
 await key.focus();await expect(key).toBeFocused();
 await expect(g22.getByRole('button',{name:'Signatur, Originalhash, Rollen und Custody-Reihenfolge prüfen'})).toBeDisabled();
 await expect(g22.getByRole('table',{name:'G22 unabhängige NO-GO-Matrix'}).getByRole('row')).toHaveCount(6);
 expect(await g22.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await expect(g22).toContainText('Staging, Merge, Release, Deployment');
 await g22.screenshot({path:evidencePath+'/g22-mobile-200pct-no-go.png'});
});
