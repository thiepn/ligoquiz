import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
const directory='test-results/g26-evidence';
const desk=page=>page.getByRole('region',{name:'G26 Lesende Cutover- und Rückweg-Vorprüfung'});
test('G26 uses a genuine generated G25 handoff as source without altering local existing data',async({page})=>{
 await mkdir(directory,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const form=desk(page);
 await expect(form).toContainText('NO-GO · NICHT VERÖFFENTLICHEN');
 await page.evaluate(()=>{
  localStorage.setItem('ligo.quiz.legacy.g26.synthetic','PRESERVE-LEGACY');
  sessionStorage.setItem('unrelated.g26','PRESERVE-OTHER');
 });
 const g25=page.getByRole('region',{name:'G25 Spielabend und Release-Handoff'});
 const wait=page.waitForEvent('download');
 await g25.getByRole('button',{name:'Übergabe als JSON exportieren'}).click();
 const file=await wait;
 const raw=await readFile(await file.path());
 await form.locator('.g26-files > section').nth(1).getByLabel('Originaldatei lokal auswählen')
  .setInputFiles({name:file.suggestedFilename(),mimeType:'application/json',buffer:raw});
 await expect(form).toContainText('Strukturell konsistent');
 await expect(form).toContainText('NUR METADATEN');
 await expect(form).toContainText('Unabhängige Fakten-/Inhalts-/Lizenzfreigabe');
 await form.screenshot({path:directory+'/g26-readonly-cutover-no-go-1280.png'});
 const exportWait=page.waitForEvent('download');
 await form.getByRole('button',{name:'NO-GO-Vorprüfung exportieren'}).click();
 const packet=JSON.parse((await readFile(await (await exportWait).path())).toString('utf8'));
 expect(packet).toMatchObject({format:'ligoquiz-g26-readonly-cutover-NO_GO-v1',
  release:'NO_GO',localWritePerformed:false,deployAuthorized:false,isolatedRestorePerformed:false,
  ownerReleaseAuthorization:false,originalLegacyBrowserPreserved:true});
 expect(packet.handoff.sha256).toMatch(/^[0-9a-f]{64}$/);
 const earlier=await page.evaluate(()=>({
  legacy:localStorage.getItem('ligo.quiz.legacy.g26.synthetic'),
  other:sessionStorage.getItem('unrelated.g26')}));
 expect(earlier).toEqual({legacy:'PRESERVE-LEGACY',other:'PRESERVE-OTHER'});
 await form.locator('.g26-files > section').nth(1).getByRole('button',{name:'Nur diese Vorschau verwerfen'}).click();
 await expect(form).toContainText('Keine Datei geprüft');
 expect(await page.evaluate(()=>localStorage.getItem('ligo.quiz.legacy.g26.synthetic'))).toBe('PRESERVE-LEGACY');
});
test('G26 rejects forged or misplaced release manifests and session backups without imports',async({page})=>{
 await page.goto('/#/technik');
 const form=desk(page),inputs=form.locator('.g26-files > section');
 await inputs.nth(0).getByLabel('Originaldatei lokal auswählen').setInputFiles({
  name:'forged-manifest.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({format:'ligoquiz-g12-build-evidence-v1',gitSha:'main',
   expectedScope:'/',deploymentPath:'production',bundleSha256:'0'.repeat(64)}))});
 await expect(form.getByRole('alert')).toContainText('Build abgelehnt');
 await inputs.nth(2).getByLabel('Originaldatei lokal auswählen').setInputFiles({
  name:'forged-backup.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({payload:{},sha256:'0'.repeat(64)}))});
 await expect(form.getByRole('alert')).toContainText('Backup abgelehnt');
 await expect(form).toContainText('NO-GO · NICHT VERÖFFENTLICHEN');
 const rollback=page.waitForEvent('download');
 await form.getByRole('button',{name:'Rückweg-Anleitung herunterladen'}).click();
 const file=await rollback;
 const text=(await readFile(await file.path())).toString('utf8');
 expect(text).toContain('main/v1.14');
 expect(text).toContain('NO_GO');
 expect(text).toContain('Kein alter ligo.quiz.* Speicher');
 expect(text).not.toContain('rm -rf');
});
test('G26 mobile 200 percent keyboard and overflow stay usable without live action buttons',async({page})=>{
 await mkdir(directory,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const form=desk(page);
 await expect(form).toContainText('V2.0 sicher vorbereiten');
 const input=form.locator('.g26-files > section').first().getByLabel('Originaldatei lokal auswählen');
 await input.focus();await expect(input).toBeFocused();
 expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await expect(form).not.toContainText('Freigabe erteilt');
 await form.screenshot({path:directory+'/g26-readonly-mobile-200pct.png'});
});
