import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {Buffer} from 'node:buffer';
const path='test-results/g20-evidence';
async function synth(checksum){
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey));
 const fp=createHash('sha256').update(raw).digest('hex');
 const statement={format:'ligoquiz-g20-custody-statement-v1',custodyId:'synthetic-root-01',
  sequence:1,previousDigest:null,sourceG18Checksum:checksum,
  sourceG19Head:'e45cbb99e07f89ff4b663afb0026bf75768758a4',
  actorId:'custodian-01',role:'custodian',action:'root-proposal',signerFingerprint:fp,
  subjectFingerprint:fp,nextFingerprint:null,scenarioId:'rundenquiz-3',gateId:'rehearsals',
  receiptSha256:null,issuedAt:'2026-10-10T15:00:00Z',note:'SYNTHETIC TEST only',decision:'PROPOSED'};
 const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',keys.privateKey,
  Buffer.from(JSON.stringify(statement),'utf8'))).toString('base64');
 return {publicKey:raw.toString('base64'),envelope:{format:'ligoquiz-g20-detached-ed25519-v1',statement,signature}};
}
test('G20 actual operator verifies proposed root but keeps NO-GO, replay and forgery denied',async({page})=>{
 await mkdir(path,{recursive:true});await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const g18=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const download=page.waitForEvent('download');
 await g18.getByRole('button',{name:'G18-Protokoll als JSON exportieren'}).click();
 const d=await download,bytes=await readFile(await d.path()),packet=JSON.parse(bytes.toString('utf8'));
 const signed=await synth(packet.checksum);
 const panel=page.getByRole('region',{name:'G20 Unabhängige Schlüsselverwahrung und Recovery-Handoff'});
 await expect(panel).toContainText('NO-GO · KEINE ROOT-AKTIVIERUNG');
 await panel.getByLabel('1. Unverändertes G18-Quellenpaket (JSON)').setInputFiles({
  name:'g18-source.json',mimeType:'application/json',buffer:bytes});
 const input=panel.getByLabel('2. Separat signierter G20-Custody-Beleg (JSON)');
 const data=Buffer.from(JSON.stringify(signed.envelope));
 await input.setInputFiles({name:'g20-root.json',mimeType:'application/json',buffer:data});
 await panel.getByLabel('3. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)').fill(signed.publicKey);
 await panel.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'}).click();
 await expect(panel).toContainText('Signatur, Quellenbindung und Chronologie konsistent');
 await expect(panel).toContainText('1 signierte Belege');
 await expect(panel).toContainText('0 bestätigte Trust-Roots');
 await panel.screenshot({path:path+'/g20-untrusted-root-1280x720.png'});
 await input.setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:data});
 await panel.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('Replay');
 const forged={...signed.envelope,statement:{...signed.envelope.statement,note:'FORGED EXTERNAL APPROVAL'}};
 await input.setInputFiles({name:'tampered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
 await panel.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('INVALID');
 await expect(panel.getByRole('table',{name:'G20 NO-GO-Matrix'}).getByRole('cell',{name:'OFFEN'})).toHaveCount(6);
 const exported=page.waitForEvent('download');
 await panel.getByRole('button',{name:'NO-GO-Custody-Paket lokal exportieren'}).click();
 const file=await exported;const note=JSON.parse((await readFile(await file.path())).toString('utf8'));
 expect(note.decision.release).toBe('NO_GO');
 expect(note.decision.independentTrustRoots).toBe(0);
 expect(note.decision.mergeAuthorized).toBe(false);
});
test('G20 accessible mobile 200 percent keyboard, offline-untrusted and no overflow',async({page})=>{
 await mkdir(path,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const panel=page.getByRole('region',{name:'G20 Unabhängige Schlüsselverwahrung und Recovery-Handoff'});
 const publicKey=panel.getByLabel('3. Öffentlicher Ed25519-Schlüssel, separat erhalten (Base64)');
 await publicKey.focus();await expect(publicKey).toBeFocused();
 await publicKey.fill('not-a-verified-key');
 await expect(panel.getByRole('button',{name:'Signatur und unabhängige Custody-Reihenfolge prüfen'})).toBeDisabled();
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await expect(panel).toContainText('NO-GO');
 await panel.screenshot({path:path+'/g20-mobile-200pct-no-go.png'});
});
