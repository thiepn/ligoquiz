import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
const evidence='test-results/g25-evidence';

test('G25 combines real G18/G23 on-page exports into a source-bound, never-authorized handoff',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const g18=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 await g18.getByRole('group',{name:'Ausgewähltes Probeszenario'})
  .getByRole('combobox',{name:'Status: Absturz und Wiederherstellung'}).selectOption('defect');
 const dlG18=page.waitForEvent('download');
 await g18.getByRole('button',{name:'G18-Protokoll als JSON exportieren'}).click();
 const original=await readFile(await (await dlG18).path());
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Aufgabe anlegen'}).click();
 const dlG23=page.waitForEvent('download');
 await page.getByRole('region',{name:'G23 Quellen und Rechteprüfung'})
  .getByRole('button',{name:'Redaktionsindex ohne Fragen und Antworten exportieren'}).click();
 const content=await readFile(await (await dlG23).path());
 await page.goto('/#/technik');
 const desk=page.getByRole('region',{name:'G25 Spielabend und Release-Handoff'});
 await expect(desk).toContainText('NO-GO');
 await desk.getByLabel('G18 Originalprotokoll').setInputFiles({
  name:'g18-original.json',mimeType:'application/json',buffer:original});
 await expect(desk).toContainText('Gemeldete Probenprobleme');
 await expect(desk).toContainText('Lokal geprüft: g18-original.json');
 await desk.getByLabel('G23 redaktionellen Prüfindex').setInputFiles({
  name:'g23-original.json',mimeType:'application/json',buffer:content});
 await expect(desk).toContainText('Lokal geprüft: g23-original.json');
 const issues=desk.getByRole('region',{name:'G25 konkrete Prüfprobleme'});
 await expect(issues).toContainText('Problem notiert: Absturz und Wiederherstellung');
 await desk.screenshot({path:evidence+'/g25-two-original-packets-no-go-1280.png'});
 await issues.getByRole('combobox',{name:'G25 Spiel filtern'}).selectOption('rundenquiz');
 await issues.getByRole('combobox',{name:'G25 Schwere filtern'}).selectOption('blocker');
 await expect(issues).toContainText('Absturz und Wiederherstellung');
 const packetDl=page.waitForEvent('download');
 await desk.getByRole('button',{name:'Übergabe als JSON exportieren'}).click();
 const packet=JSON.parse((await readFile(await (await packetDl).path())).toString('utf8'));
 expect(packet).toMatchObject({format:'ligoquiz-g25-rc-handoff-no-go-v1',release:'NO_GO',
  sourceFilesEmbedded:false,questionTextEmbedded:false,ownerApproved:false,
  deployAuthorized:false,mergeAuthorized:false});
 expect(packet.pilot.defects).toBe(1);
 expect(packet.issues).toEqual(expect.arrayContaining([expect.objectContaining({
  id:'pilot:rundenquiz-3:recovery',severity:'blocker'})]));
 const csvDl=page.waitForEvent('download');
 await desk.getByRole('button',{name:'Prüfliste für Excel (CSV)'}).click();
 const csv=(await readFile(await (await csvDl).path())).toString('utf8');
 expect(csv).toContain('rundenquiz-3');
 expect(csv).not.toContain('Neue Frage – bitte konkretisieren');
 expect(packet.missing).toContain('Eigentümerfreigabe für Merge, Migration und Deployment fehlt');
});

test('G25 refuses forged permissions and damaged original index; previous source is invalidated',async({page})=>{
 await page.goto('/#/technik');
 const desk=page.getByRole('region',{name:'G25 Spielabend und Release-Handoff'});
 const input=desk.getByLabel('G23 redaktionellen Prüfindex');
 await input.setInputFiles({name:'fake.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({format:'ligoquiz-g23-content-issues-export-v1',
   sourceRightsApproved:true,release:'GO'}))});
 await expect(desk.getByRole('alert')).toContainText('Datei abgelehnt');
 await expect(desk).toContainText('Kein G23-Prüfindex geladen');
 await input.setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
 await expect(desk.getByRole('alert')).toContainText('ungültiges JSON');
 await expect(desk).toContainText('NO-GO');
});

test('G25 200-percent mobile evidence readout is keyboard navigable and never presents a GO button',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const desk=page.getByRole('region',{name:'G25 Spielabend und Release-Handoff'});
 const game=desk.getByRole('combobox',{name:'G25 Spiel filtern'});
 await game.focus();await expect(game).toBeFocused();
 await game.selectOption('quiztafel');
 expect(await desk.evaluate(e=>e.scrollWidth<=e.clientWidth+3)).toBe(true);
 await expect(desk).toContainText('Eigentümerfreigabe');
 await expect(desk).toContainText('NO-GO');
 await desk.screenshot({path:evidence+'/g25-200percent-mobile-source-missing.png'});
});
