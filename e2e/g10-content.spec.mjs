import {test,expect} from '@playwright/test';
import {Buffer} from 'node:buffer';
import {readFile} from 'node:fs/promises';
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

test('five original trial banks need consent and cannot silently become approved play content',async({page})=>{
 await page.goto('/#/inhalte');
 const button=page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'});
 await button.click();
 const preview=page.getByRole('region',{name:'Importvorschau'});
 await expect(preview).toContainText('79 Quelldatensätze');
 await expect(preview).toContainText('79 gültige Entwürfe');
 await expect(preview).toContainText('0 Quarantäne');
 await expect(preview).toContainText('ungeprüft');
 const commit=page.getByRole('button',{name:'Vorschau ausdrücklich importieren'});
 await expect(commit).toBeDisabled();
 await expect(page.locator('.cx-item')).toHaveCount(0);
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await commit.click();
 await expect(page.locator('.cx-item')).toHaveCount(79);
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 const records=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const q=globalThis.indexedDB.open('ligoquiz.v2.content.g10');
   q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
  const getAll=store=>new Promise((resolve,reject)=>{
   const q=db.transaction(store,'readonly').objectStore(store).getAll();
   q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
  const all=await getAll('entries'),receipts=await getAll('receipts');db.close();
  return {count:all.length,approved:all.filter(x=>x.status==='approved').length,
   reviews:all.filter(x=>x.review).length,rights:all.filter(x=>x.provenance.rights).length,
   origins:[...new Set(all.map(x=>x.provenance.origin))],receipts:receipts.length};
 });
 expect(records).toEqual({count:79,approved:0,reviews:0,rights:0,origins:['sample'],receipts:1});
 await button.click();
 await expect(preview).toContainText('0 gültige Entwürfe');
 await expect(preview).toContainText('79 Quarantäne');
 await expect(commit).toBeDisabled();
 await page.reload();
 await expect(page.locator('.cx-item')).toHaveCount(79);
});

test('G10 original source leads select editor and expire on substantive edits',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await expect(queue.getByRole('combobox',{name:'Prüfgruppe'})).toHaveValue('primary');
 await expect(queue.locator('.cx-source-item')).toHaveCount(12);
 await queue.getByRole('button',{name:/rq-w4/}).click();
 const detail=page.getByRole('region',{name:'Quellenabgleich'});
 await expect(detail.getByRole('link',{name:/Bundes-Verfassungsgesetz/}))
  .toHaveAttribute('href',/ris\.bka\.gv\.at\/Dokument/);
 await expect(detail).toContainText('keine Fakten- oder Rechtefreigabe');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Lösung',exact:true}).fill('Salzburg');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(queue.locator('.cx-source-item')).toHaveCount(11);
 await expect(detail.getByRole('link',{name:/Bundes-Verfassungsgesetz/})).toHaveCount(0);
 await queue.getByRole('combobox',{name:'Prüfgruppe'}).selectOption('illustrative');
 await expect(queue.locator('.cx-source-item')).toHaveCount(10);
 await queue.getByRole('button',{name:/ud-01/}).click();
 await expect(detail).toContainText('Nur illustrative Rangfolge');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
});

test('source queue search narrows original Quiztafel questions without changing approval',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await queue.getByRole('searchbox',{name:'Quellenprüfung durchsuchen'}).fill('qt-geschichte');
 await expect(queue.locator('.cx-source-item')).toHaveCount(4);
 await queue.getByRole('button',{name:/qt-geschichte-4/}).click();
 const ed=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(ed).toContainText('Amphitheater');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await expect(queue).toContainText('4 Treffer');
});

test('editorial queue warns of reused clue targets and opens the corresponding question',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await queue.getByRole('combobox',{name:'Prüfgruppe'}).selectOption('lookup');
 await queue.getByRole('checkbox',{name:'Nur wiederholte Hinweisziele'}).check();
 await expect(queue.locator('.cx-source-item')).toHaveCount(6);
 await queue.getByRole('button',{name:/rq-h1/}).click();
 const panel=page.getByRole('region',{name:'Quellenabgleich'});
 await expect(panel).toContainText('Gleiches Hinweisziel in Verbindungen');
 await panel.getByRole('button',{name:'Zugehörige Frage öffnen: vb-a-david'}).click();
 await expect(panel).toContainText('vb-a-david');
 await expect(panel).toContainText('Gleiches Hinweisziel in Rundenquiz');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('explicit local CSV worksheet exports filtered questions with source warnings but no approvals',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await queue.getByRole('combobox',{name:'Prüfgruppe'}).selectOption('lookup');
 await queue.getByRole('checkbox',{name:'Nur wiederholte Hinweisziele'}).check();
 await expect(queue.locator('.cx-source-item')).toHaveCount(6);
 const wait=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Gefilterte Prüfliste als CSV'}).click();
 const download=await wait;
 expect(download.suggestedFilename()).toBe('ligoquiz-redaktionspruefliste-gefiltert.csv');
 const csv=await readFile(await download.path(),'utf8');
 expect(csv.split('\r\n')).toHaveLength(8);
 expect(csv).toContain('"rq-h1","rundenquiz","draft","lookup"');
 expect(csv).toContain('"vb-a-david"');
 expect(csv).toContain('Ich besiegte Goliat.');
 expect(csv).not.toContain('"rq-w4","rundenquiz"');
 expect(csv).not.toContain('"qt-geschichte-4","quiztafel"');
 const fullWait=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const full=await fullWait;
 expect(full.suggestedFilename()).toBe('ligoquiz-redaktionspruefliste-vollstaendig.csv');
 const whole=await readFile(await full.path(),'utf8');
 expect(whole.split('\r\n')).toHaveLength(81);
 expect(whole).toContain('https://whc.unesco.org/en/list/829/');
 expect(whole).toContain('"ud-01","umfrageduell","draft","illustrative"');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('primary-source suggestion prepares a citation locally, without approval or automatic persistence',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await expect(queue.locator('.cx-source-item')).toHaveCount(12);
 await queue.getByRole('button',{name:/qt-natur-6/}).click();
 const ed=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 const source=ed.getByRole('textbox',{name:'Quelle',exact:true});
 await expect(source).not.toHaveValue(/list\.iupac\.org/);
 await ed.getByRole('button',{name:'Quellenangabe im Entwurf vorbereiten'}).click();
 await expect(source).toHaveValue(/list\.iupac\.org\/reports\/periodic_table/);
 await expect(queue.locator('.cx-source-item')).toHaveCount(12);
 await expect(ed.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await ed.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(queue.locator('.cx-source-item')).toHaveCount(11);
 await page.reload();
 await page.getByRole('region',{name:'Aufgabenbestand'}).getByRole('button',{name:/qt-natur-6/}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})
  .getByRole('textbox',{name:'Quelle',exact:true})).toHaveValue(/list\.iupac\.org/);
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('CSV reviewer notes reopen read-only, find matching source question and block stale records',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const wait=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const downloaded=await wait,csv=await readFile(await downloaded.path(),'utf8');
 const amended=csv.split('\r\n').map(line=>line.startsWith('"rq-w4",')?
  line.replace(/,"","","","",""$/,' ,"","Art. 5 prüfen","","","Noch offen"'.trimStart()):line).join('\r\n');
 const input=queue.getByRole('textbox',{name:'CSV-Prüfnotizen öffnen'});
 await input.setInputFiles({name:'redaktion.csv',mimeType:'text/csv',buffer:Buffer.from(amended)});
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await expect(notes).toContainText('Art. 5 prüfen');
 await notes.getByRole('button',{name:'Aufgabe zu Notizen öffnen'}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toContainText('rq-w4');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'Lösung',exact:true}).fill('Salzburg');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(notes).toContainText('0 zugeordnet · 1 veraltet · 0 fehlen');
 await expect(notes.getByRole('button',{name:'Aufgabe zu Notizen öffnen'})).toBeDisabled();
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});
