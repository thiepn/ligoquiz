import {test,expect} from '@playwright/test';
async function setup(page,n=3){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption(String(n));
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Logikleiter/}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator('.ll-host');
 await expect(host.getByRole('button',{name:'Stufenfolge bestätigen'})).toBeEnabled();
 return host;
}
async function stage(page,host){
 const uri=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
 expect(uri).toMatch(/^#\/stage\?event=[\w-]+$/);
 const projector=await page.context().newPage();
 await projector.goto('http://127.0.0.1:4178/'+uri);
 await expect(host.locator('.ll-toolbar')).toContainText('1 Beamer bestätigt');
 return projector;
}
test('early lock, hint, late lock, explicit reveal, score correction and private-safe stage',async({page})=>{
 const host=await setup(page,3),projector=await stage(page,host);
 await host.getByRole('button',{name:'Stufenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(projector.locator('.ll-stage-ladder')).toContainText('Alle Rosen');
 await expect(projector.locator('main')).not.toContainText('Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.');
 await expect(projector.locator('.ll-stage-hint')).toHaveCount(0);
 await host.locator('.ll-team-row').nth(0).getByRole('button',{name:'Abgabe jetzt sperren'}).click();
 await host.getByRole('button',{name:'Hinweis bewusst veröffentlichen'}).click();
 await expect(projector.locator('.ll-stage-hint')).toContainText('Verbindet');
 await host.locator('.ll-team-row').nth(1).getByRole('button',{name:'Abgabe jetzt sperren'}).click();
 await expect(host.locator('.ll-team-row').nth(0)).toContainText('VOR HINWEIS');
 await expect(host.locator('.ll-team-row').nth(1)).toContainText('NACH HINWEIS');
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 await expect(projector.locator('.ll-stage-ladder')).toBeVisible();
 await host.getByRole('button',{name:'Lösung und Begründung veröffentlichen'}).click();
 await expect(projector.locator('.ll-stage-answer .stage-reveal')).toContainText('Nein');
 await host.locator('.ll-grades').nth(0).getByRole('button',{name:'Richtig'}).click();
 await host.locator('.ll-grades').nth(1).getByRole('button',{name:'Richtig'}).click();
 await host.locator('.ll-grades').nth(2).getByRole('button',{name:'Keine Antwort'}).click();
 await host.getByRole('button',{name:'Alle Wertungen verbindlich bestätigen'}).click();
 await expect(host.locator('.ll-scorebar strong')).toHaveText(['10','5','0']);
 await host.getByRole('button',{name:'Letzte Wertung korrigieren'}).click();
 await host.locator('.ll-grades').nth(0).getByRole('button',{name:'Falsch'}).click();
 await host.getByRole('button',{name:'Alle Wertungen verbindlich bestätigen'}).click();
 await expect(host.locator('.ll-scorebar strong')).toHaveText(['0','5','0']);
 await projector.close();
});
test('reload of live rung safely pauses without disclosing hidden solution',async({page})=>{
 const host=await setup(page,3),projector=await stage(page,host);
 await host.getByRole('button',{name:'Stufenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(projector.locator('.ll-stage-ladder')).toContainText('Alle Rosen');
 await host.locator('.ll-team-row').nth(0).getByRole('button',{name:'Abgabe jetzt sperren'}).click();
 await expect(host.locator('.ll-team-row').nth(0)).toContainText('VOR HINWEIS');
 await page.reload();
 await expect(host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'})).toBeEnabled();
 await expect(projector.locator('main')).toContainText('Pause');
 await expect(projector.locator('.ll-stage-answer')).toHaveCount(0);
 await host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'}).click();
 await expect(host.locator('.ll-team-row').nth(0)).toContainText('VOR HINWEIS');
 await expect(host.getByRole('button',{name:'Hinweis bewusst veröffentlichen'})).toBeEnabled();
 await projector.close();
});
