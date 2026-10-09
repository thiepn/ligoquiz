import {test,expect} from '@playwright/test';
import {Buffer} from 'node:buffer';
test('content atelier edits a draft and requires four checks plus named approval',async({page})=>{
 await page.goto('/#/inhalte');
 await expect(page.getByRole('heading',{name:'Inhaltsatelier'})).toBeVisible();
 await page.getByRole('button',{name:'Aufgabe anlegen'}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toContainText('Entwurf');
 await page.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Zahl ist die kleinste Primzahl?');
 await page.getByRole('textbox',{name:'Lösung'}).fill('2');
 await page.getByRole('textbox',{name:'Quelle'}).fill('Mathematische Definition einer Primzahl');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(page.getByRole('status')).toContainText('Entwurf gespeichert');
 await page.getByRole('button',{name:'Zur Prüfung vorlegen'}).click();
 await expect(page.getByRole('group',{name:'Redaktionelle Abnahme'})).toBeVisible();
 const review=page.getByRole('group',{name:'Redaktionelle Abnahme'});
 await expect(review.getByRole('button',{name:'Inhalt verbindlich freigeben'})).toBeDisabled();
 for(const cb of await review.getByRole('checkbox').all())await cb.check();
 await review.getByRole('textbox',{name:'Prüfende Person'}).fill('Editorin');
 await review.getByRole('textbox',{name:/Begründung/}).fill('Faktenlage und Quellenhinweis manuell geprüft.');
 await review.getByRole('button',{name:'Inhalt verbindlich freigeben'}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toContainText('Freigegeben durch Editorin');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 await page.reload();
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).toContainText('Welche Zahl ist die kleinste Primzahl?');
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).toContainText('Freigegeben');
});
test('legacy import is previewed/quarantined before explicit commit and then undoable',async({page})=>{
 await page.goto('/#/inhalte');
 const fixture=JSON.stringify({format:'ligo-content-pack',items:[
  {id:'legacy-rq',game:'rundenquiz',status:'approved',payload:{
    id:'old-rq',round:'wissen',prompt:'Wie viele Kontinente gibt es üblicherweise?',answer:'7',
    reference:'UN M49 Geoscheme',durationSeconds:30,
  }},
  {id:'legacy-unknown',game:'mystery',payload:{hello:'world'}},
 ]});
 await page.locator('input[type=file]').setInputFiles({
  name:'ligo-content-pack.json',mimeType:'application/json',buffer:Buffer.from(fixture),
 });
 await expect(page.getByRole('region',{name:'Importvorschau'})).toContainText('1 gültige Entwürfe');
 await expect(page.getByRole('region',{name:'Importvorschau'})).toContainText('1 Quarantäne');
 const commit=page.getByRole('button',{name:'Vorschau ausdrücklich importieren'});
 await expect(commit).toBeDisabled();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await commit.click();
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).toContainText('Wie viele Kontinente');
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).toContainText('Entwurf');
 await expect(page.getByRole('heading',{name:'Importprotokoll'})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Unveränderten Import zurücknehmen'}).click();
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).not.toContainText('Wie viele Kontinente');
});
test('unrelated and legacy keys remain untouched after raw backup',async({page})=>{
 await page.goto('/#/inhalte');
 await page.evaluate(()=>{
  globalThis.localStorage.setItem('ligo.quiz.content.library.v1','{"legacy":true}');
  globalThis.localStorage.setItem('another.app.secret','unrelated');
 });
 const dl=page.waitForEvent('download');
 await page.getByRole('button',{name:'v1-Rohbackup erstellen'}).click();
 const file=await dl;
 expect(file.suggestedFilename()).toBe('ligoquiz-altbestand-rohbackup.json');
 const raw=await page.evaluate(()=>({
  legacy:globalThis.localStorage.getItem('ligo.quiz.content.library.v1'),
  other:globalThis.localStorage.getItem('another.app.secret'),
 }));
 expect(raw).toEqual({legacy:'{"legacy":true}',other:'unrelated'});
});
test('approved-only setup does not secretly fall back to trial tasks',async({page})=>{
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('radio',{name:/Redaktionell freigegebene Inhaltsbibliothek/}).check();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.getByRole('alert')).toContainText('nicht vollständig');
 await expect(page).toHaveURL(/#\/setup$/);
});
