import { test, expect } from '@playwright/test';

test('saved setup survives reload and transfers to the authoritative host',async({page})=>{
 await page.goto('/#/setup');
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
 await page.getByRole('textbox',{name:'Team 2'}).fill('Mitte');
 await page.getByRole('textbox',{name:'Team 3'}).fill('Süd');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await page.getByRole('combobox',{name:'Umfang'}).selectOption('kurz');
 await page.reload();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
 await expect(page.locator('.exp-summary')).toContainText('Nord');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(page.locator('.rq-scoreboard')).toContainText('Nord');
 await expect(page.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
 await page.locator('.exp-host-header').getByRole('link',{name:'Spielen'}).click();
 await expect(page).toHaveURL(/#\/spielen$/);
 await expect(page.getByRole('button',{name:'Vorbereitung fortsetzen'})).toBeVisible();
 await expect(page.locator('.exp-active')).toContainText('Vorbereitung');
});

test('demo never persists history or a live session',async({page})=>{
 await page.goto('/#/spielen');
 await page.getByRole('link',{name:'Demo ausprobieren'}).click();
 await expect(page).toHaveURL(/#\/demo$/);
 await expect(page.locator('.exp-demo-private')).toContainText('Josua');
 await expect(page.locator('.exp-demo-stage')).not.toContainText('Josua');
 await page.getByRole('button',{name:'Frage zeigen'}).click();
 await expect(page.locator('.exp-demo-stage')).toContainText('Wer führte Israel nach Mose');
 await expect(page.locator('.exp-demo-stage')).not.toContainText('Josua');
 await page.getByRole('button',{name:'Antwortphase schließen'}).click();
 await page.getByRole('button',{name:'Lösung zeigen'}).click();
 await expect(page.locator('.exp-demo-stage')).toContainText('Josua');
 for(let i=0;i<3;i++)await page.locator('.exp-demo-judge').nth(i).getByRole('button',{name:'richtig'}).click();
 await page.getByRole('button',{name:'Punkte bestätigen'}).click();
 await expect(page.locator('.exp-demo-stage')).toContainText('10');
 await page.getByRole('button',{name:'Endstand zeigen'}).click();
 await page.getByRole('link',{name:'Zurück zu Spielen'}).click();
 await expect(page).toHaveURL(/#\/spielen$/);
 await page.goto('/#/verlauf');
 await expect(page.locator('.exp-empty')).toContainText('Noch kein abgeschlossener Quizabend');
 await page.evaluate(async()=>{
   if('databases' in indexedDB){
     const dbs=await indexedDB.databases();
     if(dbs.some(x=>x.name==='ligoquiz.v2.sessions'))throw Error('Demo created a real session database');
   }
 });
});

test('saved organizer preferences become setup defaults and motion applies',async({page})=>{
 await page.goto('/#/einstellungen');
 await page.getByRole('combobox',{name:'Teams (Vorgabe)'}).selectOption('5');
 await page.getByRole('combobox',{name:'Rundenquiz-Umfang (Vorgabe)'}).selectOption('standard');
 await page.getByRole('combobox',{name:'Animationen'}).selectOption('reduce');
 await page.getByRole('button',{name:'Einstellungen speichern'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-ligo-motion','reduce');
 await page.goto('/#/setup');
 await expect(page.getByRole('combobox',{name:'Anzahl der Teams'})).toHaveValue('5');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('combobox',{name:'Umfang'})).toHaveValue('standard');
});
