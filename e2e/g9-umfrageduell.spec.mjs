import {test,expect} from '@playwright/test';
async function setup(page,profile=null){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Umfrageduell/}).click();
 if(profile)await page.getByRole('combobox',{name:'Umfang'}).selectOption(profile);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator('.ud-host');
 await expect(host.getByRole('button',{name:'Aufgabenfolge bestätigen'})).toBeEnabled();
 return host;
}
async function projector(page,host){
 const href=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
 expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);
 const p=await page.context().newPage();
 await p.goto('http://127.0.0.1:4178/'+href);
 await expect(host.locator('.ud-toolbar')).toContainText('1 Beamer bestätigt');
 return p;
}
test('illustrative source, delayed reveal, manual canonical mapping and audited corrections',async({page})=>{
 const host=await setup(page),stage=await projector(page,host);
 await host.getByRole('button',{name:'Aufgabenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(stage.locator('.ud-stage')).toContainText('BEISPIELDATEN – KEINE ECHTE UMFRAGE');
 await expect(stage.locator('.ud-stage-results')).toHaveCount(0);
 await expect(stage.locator('.ud-stage')).not.toContainText('Notizblock');
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 await expect(stage.locator('.ud-stage-results')).toHaveCount(0);
 await host.locator('.ud-team').nth(0).getByRole('textbox',{name:'Antwort 1'}).fill('Snacks');
 await host.locator('.ud-team').nth(0).getByRole('button',{name:'Antwort erfassen'}).click();
 await host.locator('.ud-team').nth(1).getByRole('textbox',{name:'Antwort 1'}).fill('Getränke');
 await host.locator('.ud-team').nth(1).getByRole('button',{name:'Antwort erfassen'}).click();
 await host.locator('.ud-team').nth(2).getByRole('button',{name:'Antwort erfassen'}).click();
 await host.getByRole('button',{name:'Kategorien und Rangfolge veröffentlichen'}).click();
 await expect(stage.locator('.ud-stage-results li')).toHaveCount(5);
 await expect(stage.locator('.ud-stage-results')).toContainText('Snacks');
 await host.getByRole('button',{name:'Teamwertungen verbindlich bestätigen'}).click();
 await expect(host.locator('.ud-scorebar strong')).toHaveText(['20','15','0']);
 await host.locator('.ud-team').nth(0).getByRole('combobox',{name:'Zuordnung'}).selectOption('5');
 page.once('dialog',dialog=>dialog.accept('Zuordnung korrigiert'));
 await host.locator('.ud-team').nth(0).getByRole('button',{name:'Begründet korrigieren'}).click();
 await expect(host.locator('.ud-scorebar strong')).toHaveText(['2','15','0']);
 await stage.close();
});
test('reload pauses projector and recovers saved team adjudications',async({page})=>{
 const host=await setup(page),stage=await projector(page,host);
 await host.getByRole('button',{name:'Aufgabenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(stage.locator('.ud-stage')).toContainText('BEISPIELDATEN');
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 await host.locator('.ud-team').nth(0).getByRole('textbox',{name:'Antwort 1'}).fill('Snacks');
 await host.locator('.ud-team').nth(0).getByRole('button',{name:'Antwort erfassen'}).click();
 await expect(host.locator('.ud-team').nth(0)).toContainText('Erfasst: 20 Punkte');
 await page.reload();
 await expect(host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'})).toBeEnabled();
 await expect(stage.locator('main')).toContainText('Pause');
 await expect(stage.locator('.ud-stage-results')).toHaveCount(0);
 await host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'}).click();
 await expect(host.locator('.ud-team').nth(0)).toContainText('Erfasst: 20 Punkte');
 await stage.close();
});

test('Standard Top 3 maps rank positions and duplicate-category guesses accurately',async({page})=>{
 const host=await setup(page,'standard'),stage=await projector(page,host);
 await host.getByRole('button',{name:'Aufgabenfolge bestätigen'}).click();
 for(let i=0;i<5;i++){
  await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
  await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
  for(const team of await host.locator('.ud-team').all())
   await team.getByRole('button',{name:'Antwort erfassen'}).click();
  await host.getByRole('button',{name:'Kategorien und Rangfolge veröffentlichen'}).click();
  await host.getByRole('button',{name:'Teamwertungen verbindlich bestätigen'}).click();
  await host.getByRole('button',{name:'Nächste Aufgabe'}).click();
 }
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(stage.locator('.ud-stage')).toContainText('TOP 3');
 await expect(stage.locator('.ud-stage-results')).toHaveCount(0);
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 const teams=host.locator('.ud-team');
 for(const [i,word] of ['Spieleabend','Ausflug','Gemeinsames Kochen'].entries())
  await teams.nth(0).getByRole('textbox',{name:'Antwort '+(i+1)}).fill(word);
 await teams.nth(0).getByRole('button',{name:'Antwort erfassen'}).click();
 for(const [i,word] of ['Ausflug','Ausflug','Spieleabend'].entries())
  await teams.nth(1).getByRole('textbox',{name:'Antwort '+(i+1)}).fill(word);
 await teams.nth(1).getByRole('button',{name:'Antwort erfassen'}).click();
 await teams.nth(2).getByRole('button',{name:'Antwort erfassen'}).click();
 await host.getByRole('button',{name:'Kategorien und Rangfolge veröffentlichen'}).click();
 await expect(stage.locator('.ud-stage-results li')).toHaveCount(5);
 await host.getByRole('button',{name:'Teamwertungen verbindlich bestätigen'}).click();
 await expect(host.locator('.ud-scorebar strong')).toHaveText(['30','10','0']);
 await stage.close();
});
