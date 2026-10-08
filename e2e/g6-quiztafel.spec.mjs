import { test, expect } from '@playwright/test';

async function setup(host, teams = 4) {
  await host.goto('/#/setup');
  if(teams!==4) await host.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption(String(teams));
  await host.getByRole('button',{name:'Weiter'}).click();
  await host.getByRole('button',{name:/Quiztafel/}).click();
  await host.getByRole('button',{name:'Weiter'}).click();
  await host.getByRole('checkbox').check();
  await host.getByRole('button',{name:'Spielleitung öffnen'}).click();
  await expect(host).toHaveURL(/#\/host$/);
  await expect(host.locator('.qt-host .qt-grid')).toBeVisible();
  return host.locator('.qt-host');
}
async function stageFor(host,workbench) {
  const uri=await workbench.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
  expect(uri).toMatch(/^#\/stage\?event=[\w-]+$/);
  const stage=await host.context().newPage();
  await stage.goto('http://127.0.0.1:4178/'+uri);
  await expect(workbench.locator('.qt-host-toolbar')).toContainText('1 Beamer bestätigt');
  return stage;
}
test('private selection, one designated steal, commit, correction and next selector',async({page})=>{
 const host=await setup(page,4);
 const stage=await stageFor(page,host);
 await host.getByRole('button',{name:'Quiztafel auf dem Beamer vorbereiten'}).click();
 await expect(stage.locator('.qt-stage-grid')).toBeVisible();
 await expect(stage.locator('.qt-stage-column')).toHaveCount(4);
 await expect(stage.locator('.qt-stage-cell')).toHaveCount(12);
 await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
 await expect(host.getByText('PRIVATE FELDAUSWAHL')).toBeVisible();
 await expect(stage.locator('.qt-stage-grid')).toBeVisible();
 await expect(stage.locator('main')).not.toContainText('Noah');
 await host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'}).click();
 await expect(stage.locator('.qt-stage-prompt')).toContainText('Wer baute');
 await expect(stage.locator('.qt-stage-prompt')).not.toContainText('Noah');
 await host.getByRole('button',{name:'Erstantwort falsch'}).click();
 await expect(stage.locator('main')).not.toContainText('Noah');
 await host.getByRole('button',{name:'Übernahme anbieten'}).click();
 await expect(stage.locator('.qt-stage-team')).toContainText('Team 2');
 await host.getByRole('button',{name:'Übernahme richtig'}).click();
 await host.getByRole('button',{name:'Lösung ausdrücklich zeigen'}).click();
 await expect(stage.locator('.stage-reveal')).toContainText('Noah');
 await host.getByRole('button',{name:'Punkte verbindlich bestätigen'}).click();
 await expect(host.locator('.qt-scorebar strong')).toHaveText(['0','100','0','0']);
 await expect(stage.locator('.qt-stage-cell.closed')).toHaveCount(1);
 await host.getByRole('button',{name:'Wertung auditiert korrigieren'}).click();
 await host.getByRole('button',{name:'Wertung: 0 Punkte'}).click();
 await host.getByRole('button',{name:'Punkte verbindlich bestätigen'}).click();
 await expect(host.locator('.qt-scorebar strong')).toHaveText(['0','0','0','0']);
 await host.getByRole('button',{name:/Zurück zur Tafel/}).click();
 await expect(host.locator('.qt-active-row')).toContainText('Team 2');
 await expect(host.locator('.qt-column .qt-cell.used')).toHaveCount(1);
 await stage.close();
});
test('reload during an open tile pauses the host without revealing a solution',async({page})=>{
 const host=await setup(page,3);
 const stage=await stageFor(page,host);
 await host.getByRole('button',{name:'Quiztafel auf dem Beamer vorbereiten'}).click();
 await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
 await host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'}).click();
 await expect(stage.locator('.qt-stage-prompt')).toContainText('Wer baute');
 await page.reload();
 await expect(host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'})).toBeEnabled();
 await expect(stage.locator('main')).toContainText('Pause');
 await expect(stage.locator('main')).not.toContainText('Noah');
 await host.getByRole('button',{name:'Spiel ausdrücklich fortsetzen'}).click();
 await expect(host.getByRole('button',{name:'Erstantwort richtig'})).toBeEnabled();
 await expect(host.locator('.qt-clock strong')).toHaveText('20 s');
 await stage.close();
});
