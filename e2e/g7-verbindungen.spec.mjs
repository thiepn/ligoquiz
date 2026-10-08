import {test,expect} from '@playwright/test';
async function setup(page,n=3){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption(String(n));
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Verbindungen/}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator('.vb-host');
 await expect(host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'})).toBeEnabled();
 return host;
}
async function stage(page,host){
 const uri=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
 expect(uri).toMatch(/^#\/stage\?event=[\w-]+$/);
 const stage=await page.context().newPage();
 await stage.goto('http://127.0.0.1:4178/'+uri);
 await expect(host.locator('.vb-host-toolbar')).toContainText('1 Beamer bestätigt');
 return stage;
}
async function finishClue(host,result='none'){
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 if(result==='correct')await host.getByRole('button',{name:'Richtige Antwort'}).click();
 else await host.getByRole('button',{name:'Keine Antwort'}).click();
 await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 await host.getByRole('button',{name:'Wertung verbindlich bestätigen'}).click();
 await host.getByRole('button',{name:'Nächste Aufgabe'}).click();
}
test('four progressive hints, locked attempt and private/public solution',async({page})=>{
 const host=await setup(page,3),projector=await stage(page,host);
 await host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(projector.locator('main')).toContainText('Bethlehem');
 await expect(projector.locator('main')).not.toContainText('David');
 await host.getByRole('button',{name:'Nächster Hinweis'}).click();
 await expect(projector.locator('.stage-clues p')).toHaveCount(2);
 await host.getByRole('button',{name:'Richtige Antwort'}).click();
 await expect(host.getByRole('button',{name:'Nächster Hinweis'})).toHaveCount(0);
 await expect(projector.locator('main')).not.toContainText('David');
 await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 await expect(projector.locator('.stage-reveal')).toContainText('David');
 await host.getByRole('button',{name:'Wertung verbindlich bestätigen'}).click();
 await expect(host.locator('.vb-scorebar strong')).toHaveText(['30','0','0']);
 await host.getByRole('button',{name:'Letzte Wertung korrigieren'}).click();
 await host.getByRole('button',{name:'Wertung verbindlich bestätigen'}).click();
 await expect(host.locator('.vb-scorebar strong')).toHaveText(['30','0','0']);
 await projector.close();
});
test('shared wall reveals one grouping at a time with group+link per team',async({page})=>{
 const host=await setup(page,3),projector=await stage(page,host);
 await host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'}).click();
 for(let i=0;i<3;i++)await finishClue(host);
 await expect(host.locator('.vb-card')).toContainText('Verbindungswand');
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(projector.locator('.vb-stage-tile')).toHaveCount(16);
 await expect(projector.locator('main')).not.toContainText('Grundrechenarten');
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 for(let i=0;i<4;i++){
  await host.getByRole('button',{name:/Gruppe \d+ bewusst auflösen/}).click();
  await expect(projector.locator('.vb-stage-links span')).toHaveCount(i+1);
  await host.locator('.vb-mark-row').nth(0).getByRole('button',{name:'Vierergruppe richtig'}).click();
  await host.locator('.vb-mark-row').nth(0).getByRole('button',{name:'Verbindung richtig'}).click();
  for(let j=1;j<3;j++)await host.locator('.vb-mark-row').nth(j).getByRole('button',{name:'Nicht richtig'}).click();
 }
 await expect(host.getByRole('button',{name:'Alle Gruppenwertungen bestätigen'})).toBeEnabled();
 await host.getByRole('button',{name:'Alle Gruppenwertungen bestätigen'}).click();
 await expect(host.locator('.vb-scorebar strong')).toHaveText(['40','0','0']);
 await host.getByRole('button',{name:'Verbindungen abschließen'}).click();
 await expect(host.locator('.vb-final')).toContainText('Verbindungen abgeschlossen');
 await page.goto('/#/verlauf');
 await expect(page.getByRole('link',{name:/Verbindungen/})).toBeVisible();
 await projector.close();
});
test('refresh during open clue pauses the moderator and blanks the projector',async({page})=>{
 const host=await setup(page,3),projector=await stage(page,host);
 await host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await page.reload();
 await expect(host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'})).toBeEnabled();
 await expect(projector.locator('main')).toContainText('Pause');
 await expect(projector.locator('main')).not.toContainText('David');
 await host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'}).click();
 await expect(host.getByRole('button',{name:'Richtige Antwort'})).toBeEnabled();
 await projector.close();
});
