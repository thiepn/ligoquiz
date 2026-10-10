import {test,expect} from '@playwright/test';
const modes=[
 {name:'Rundenquiz',root:'.rq-host',setup:'Teams bestätigen',publish:'Frage auf Beamer zeigen',
  judge:async host=>{
   await host.getByRole('button',{name:'Antwortphase schließen'}).click();
   await host.getByRole('button',{name:'Lösung auf Beamer zeigen'}).click();
   for(let i=0;i<3;i++)await host.locator('.rq-judge').nth(i).getByRole('button',{name:i===0?'richtig':'falsch'}).click();
  },confirm:'Punkte verbindlich bestätigen'},
 {name:'Quiztafel',root:'.qt-host',setup:'Quiztafel auf dem Beamer vorbereiten',
  judge:async host=>{
   await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
   await host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'}).click();
   await host.getByRole('button',{name:'Erstantwort richtig'}).click();
   await host.getByRole('button',{name:'Lösung ausdrücklich zeigen'}).click();
  },confirm:'Punkte verbindlich bestätigen'},
 {name:'Verbindungen',root:'.vb-host',setup:'Aufgabenreihenfolge bestätigen',publish:'Aufgabe veröffentlichen',
  judge:async host=>{
   await host.getByRole('button',{name:'Richtige Antwort'}).click();
   await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
  },confirm:'Wertung verbindlich bestätigen'},
 {name:'Logikleiter',root:'.ll-host',setup:'Stufenfolge bestätigen',publish:'Aufgabe veröffentlichen',
  judge:async host=>{
   await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
   await host.getByRole('button',{name:'Lösung und Begründung veröffentlichen'}).click();
   for(let i=0;i<3;i++)await host.locator('.ll-grades').nth(i).getByRole('button',{name:'Keine Antwort'}).click();
  },confirm:'Alle Wertungen verbindlich bestätigen'},
 {name:'Umfrageduell',root:'.ud-host',setup:'Aufgabenfolge bestätigen',publish:'Aufgabe veröffentlichen',
  judge:async host=>{
   await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
   for(let i=0;i<3;i++)await host.locator('.ud-team').nth(i).getByRole('button',{name:'Antwort erfassen'}).click();
   await host.getByRole('button',{name:'Kategorien und Rangfolge veröffentlichen'}).click();
  },confirm:'Teamwertungen verbindlich bestätigen'}
];
for(const mode of modes)test('G16 preview is read-only and committed after explicit confirmation: '+mode.name,async({page})=>{
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.name!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator(mode.root);
 await host.getByRole('button',{name:mode.setup}).click();
 if(mode.publish)await host.getByRole('button',{name:mode.publish}).click();
 await mode.judge(host);
 const preview=host.getByTestId('g16-score-preview');
 await expect(preview).toHaveAttribute('data-decision-status','pending');
 await expect(preview.getByRole('row')).toHaveCount(4);
 await expect(preview).toContainText('NOCH NICHT GEBUCHT');
 await preview.getByText('Korrektur und sichere Entscheidung').click();
 await expect(preview).toContainText('keine Sitzung');
 const before=await preview.locator('[role=row]').nth(1).innerText();
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 await expect(preview).toBeVisible();
 await expect(preview.locator('[role=row]').nth(1)).toContainText(before.split('\n')[0]);
 await host.getByRole('button',{name:mode.confirm}).click();
 await expect(preview).toHaveAttribute('data-decision-status','committed');
 await expect(preview).toContainText('VERBUCHT');
});
test('G16 observation packet is locally controlled and always denies approval',async({page})=>{
 await page.goto('/#/technik');
 const review=page.getByRole('region',{name:'Visuelle Evidenzprüfung'});
 await expect(review).toContainText('KEINE FREIGABE');
 await review.getByRole('button',{name:'15 Bildnachweise sichten'}).click();
 const selects=review.getByRole('combobox',{name:'Status'});
 await expect(selects).toHaveCount(15);
 await selects.nth(0).selectOption('observed');
 await selects.nth(1).selectOption('defect');
 await expect(review).toContainText('1 von 15 gesichtet');
 await expect(review).toContainText('1 Probleme');
 const download=page.waitForEvent('download');
 await review.getByRole('button',{name:'Notizen lokal als JSON exportieren'}).click();
 const file=await download;
 const {readFile}=await import('node:fs/promises');
 const data=JSON.parse(await readFile(await file.path(),'utf8'));
 expect(data.source.artifactId).toBe(11665502348);
 expect(data.summary).toEqual({observed:1,defects:1,unreviewed:13});
 expect(data.releaseAuthorized).toBe(false);
 expect(data.humanApproval).toBe(false);
 expect(data.physicalProjectorApproved).toBe(false);
});
