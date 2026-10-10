import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {Buffer} from 'node:buffer';
const evidence='test-results/g19-evidence';
async function syntheticWitness(checksum){
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const raw=Buffer.from(await webcrypto.subtle.exportKey('raw',keys.publicKey));
 const statement={
  format:'ligoquiz-g19-statement-v1',witnessId:'synthetic-reviewer-01',scenarioId:'rundenquiz-3',
  gateId:'venue',sequence:1,previousDigest:null,operation:'observe',
  keyFingerprint:createHash('sha256').update(raw).digest('hex'),nextKeyFingerprint:null,
  g18Checksum:checksum,issuedAt:'2026-10-10T14:00:00Z',verdict:'observed',
  note:'SYNTHETIC BROWSER TEST — NOT HUMAN OR PHYSICAL EVIDENCE',attachment:null
 };
 const sig=Buffer.from(await webcrypto.subtle.sign({name:'Ed25519'},keys.privateKey,
  new TextEncoder().encode(JSON.stringify(statement))));
 return {publicKey:raw.toString('base64'),
  envelope:{format:'ligoquiz-g19-detached-ed25519-v1',statement,signature:sig.toString('base64')}};
}
test('G19 signed synthetic witness verifies without release; replay and tampering rejected',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const g18=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const exported=page.waitForEvent('download');
 await g18.getByRole('button',{name:'G18-Protokoll als JSON exportieren'}).click();
 const file=await exported;
 const reportBytes=await readFile(await file.path());
 const report=JSON.parse(reportBytes.toString('utf8'));
 const signed=await syntheticWitness(report.checksum);
 const panel=page.getByRole('region',{name:'G19 Externe Zeugennachweise prüfen'});
 await expect(panel).toContainText('NO-GO · ALLE FREIGABEN OFFEN');
 await panel.getByLabel('1. G18-Protokoll importieren (JSON)').setInputFiles({
  name:'g18-local.json',mimeType:'application/json',buffer:reportBytes});
 const statementBytes=Buffer.from(JSON.stringify(signed.envelope));
 const witnessInput=panel.getByLabel('2. Externes Zeugenpaket importieren (JSON)');
 await witnessInput.setInputFiles({name:'synthetic-witness.json',mimeType:'application/json',buffer:statementBytes});
 await panel.getByLabel('3. Separat bezogenen Ed25519-öffentlichen Schlüssel (Base64) eingeben').fill(signed.publicKey);
 await panel.getByRole('button',{name:'Ed25519-Signatur und Zeugenchronologie prüfen'}).click();
 await expect(panel).toContainText('Ed25519 korrekt');
 await expect(panel).toContainText('1 kryptografisch verifiziert');
 await expect(panel).toContainText('0 extern vertrauensbestätigt');
 await expect(panel).toContainText('NO-GO');
 await panel.screenshot({path:evidence+'/g19-verified-untrusted-1280x720.png'});
 await witnessInput.setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:statementBytes});
 await panel.getByRole('button',{name:'Ed25519-Signatur und Zeugenchronologie prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('replay');
 const forged={...signed.envelope,statement:{...signed.envelope.statement,note:'FORGED HUMAN APPROVAL'}};
 await witnessInput.setInputFiles({name:'forged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(forged))});
 await panel.getByRole('button',{name:'Ed25519-Signatur und Zeugenchronologie prüfen'}).click();
 await expect(panel.getByRole('alert')).toContainText('INVALID');
 await expect(panel.getByRole('table',{name:'G19 externe Freigabesperren'}).getByRole('cell',{name:'OFFEN'})).toHaveCount(6);
});
test('G19 keyboard and 200 percent mobile witness preparation cannot claim trust',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const panel=page.getByRole('region',{name:'G19 Externe Zeugennachweise prüfen'});
 const control=panel.getByLabel('3. Separat bezogenen Ed25519-öffentlichen Schlüssel (Base64) eingeben');
 await control.focus();await expect(control).toBeFocused();
 await control.fill('invalid-synthetic-key');
 await expect(panel.getByRole('button',{name:'Ed25519-Signatur und Zeugenchronologie prüfen'})).toBeDisabled();
 await expect(panel).toContainText('NO-GO');
 expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await panel.screenshot({path:evidence+'/g19-mobile-200pct-denied.png'});
});
