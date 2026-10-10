import {test,expect} from '@playwright/test';
import {Buffer} from 'node:buffer';
import {readFile,mkdir} from 'node:fs/promises';
const folder='test-results/g23-evidence';
test('G23 source inventory, actionable content blockers and redacted report in real Chromium',async({page})=>{
 await mkdir(folder,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/inhalte');
 const audit=page.getByRole('region',{name:'G23 Quellen und Rechteprüfung'});
 await expect(audit).toContainText('704 aktive');
 await expect(audit).toContainText('0 geladene Aufgaben');
 await expect(audit).toContainText('NO-GO');
 await page.getByRole('button',{name:'Aufgabe anlegen'}).click();
 await expect(audit).toContainText('PLACEHOLDER_PROMPT');
 await expect(audit).toContainText('PLACEHOLDER_ANSWER');
 await expect(audit).toContainText('SOURCE_PLACEHOLDER');
 await expect(audit).toContainText('RIGHTS_NOT_DOCUMENTED');
 await audit.getByRole('checkbox',{name:'Nur Blocker-Hinweise zeigen'}).check();
 await expect(audit).not.toContainText('RIGHTS_NOT_DOCUMENTED');
 await audit.getByRole('checkbox',{name:'Nur Blocker-Hinweise zeigen'}).uncheck();
 await audit.screenshot({path:folder+'/g23-actual-placeholder-review-1280.png'});
 await page.getByRole('textbox',{name:'Fragestellung'}).fill('Welches chemische Element hat das Symbol Au?');
 await page.getByRole('textbox',{name:'Lösung'}).fill('Gold');
 await page.getByRole('textbox',{name:'Quelle',exact:true}).fill('NIST Chemistry WebBook 2026, Eintrag Gold (Au)');
 await page.getByRole('textbox',{name:'Nutzungsrechte und externe Freigabegrundlage'}).fill('Eigene Testfrage ohne lizenzierte Bilddatei, noch nicht extern bestätigt');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(audit).toContainText('1 geladene Aufgaben');
 await expect(audit).not.toContainText('PLACEHOLDER_PROMPT');
 await expect(audit).not.toContainText('RIGHTS_NOT_DOCUMENTED');
 const downloaded=page.waitForEvent('download');
 await audit.getByRole('button',{name:'Redaktionsindex ohne Fragen und Antworten exportieren'}).click();
 const file=await downloaded,packet=JSON.parse((await readFile(await file.path())).toString('utf8'));
 expect(packet).toMatchObject({scannedLocalEntries:1,original704Imported:false,sourceRightsApproved:false,
  release:'NO_GO',deploymentAuthorized:false});
 const output=JSON.stringify(packet);
 expect(output).not.toContain('Welches chemische Element hat das Symbol Au');
 expect(output).not.toContain('Gold');
 await audit.screenshot({path:folder+'/g23-owner-rights-not-externally-approved-1280.png'});
});
test('G23 inherited v1 import only suggests drafts, detects bad legacy data and does not approve 704',async({page})=>{
 await page.goto('/#/inhalte');
 const audit=page.getByRole('region',{name:'G23 Quellen und Rechteprüfung'});
 const fixture={format:'ligo-content-pack',items:[
  {id:'g23-original',status:'approved',game:'rundenquiz',payload:{id:'old-1',
   round:'wissen',prompt:'Welche Farbe hat ein klarer Himmel oft?',answer:'Blau',
   reference:'Beleg redaktionell ausstehend',durationSeconds:30}},
  {id:'unknown-family',game:'unknown-v1-family',payload:{prompt:'DO NOT IMPORT'}}
 ]};
 await page.getByLabel('Datei prüfen').setInputFiles({name:'legacy-synthetic.json',
  mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await expect(audit).toContainText('2 Datensätze');
 await expect(audit).toContainText('1 Entwurfskandidaten');
 await expect(audit).toContainText('1 Quarantänefälle');
 await expect(page.getByRole('region',{name:'Importvorschau'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).not.toContainText('Welche Farbe');
 await expect(page.getByRole('button',{name:'Vorschau ausdrücklich importieren'})).toBeDisabled();
});
test('G23 200% mobile editor remains keyboard usable and never claims independent approval',async({page})=>{
 await mkdir(folder,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/inhalte');
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const audit=page.getByRole('region',{name:'G23 Quellen und Rechteprüfung'});
 const button=audit.getByRole('button',{name:'Redaktionsindex ohne Fragen und Antworten exportieren'});
 await button.focus();await expect(button).toBeFocused();
 await expect(audit).toContainText('NO-GO');
 await expect(audit).toContainText('Fakten');
 await audit.screenshot({path:folder+'/g23-mobile-200pct-no-go.png'});
});
