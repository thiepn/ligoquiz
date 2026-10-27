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
 await page.getByLabel('Datei prüfen').setInputFiles({
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
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen')
  .setInputFiles({name:'redaktion.csv',mimeType:'text/csv',buffer:Buffer.from(amended)});
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

test('manual CSV source proposal stages a citation without losing unsaved work or approving content',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const waiting=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Gefilterte Prüfliste als CSV'}).click();
 const output=await waiting,csv=await readFile(await output.path(),'utf8');
 const amended=csv.split('\r\n').map(line=>line.startsWith('"rq-w4",')?
  line.replace(/,"","","","",""$/,' ,"","https://example.org/research/rq-w4","","",""'.trimStart()):line)
  .join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'review-links.csv',mimeType:'text/csv',buffer:Buffer.from(amended),
 });
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await queue.getByRole('button',{name:/rq-w4/}).click();
 const answer=page.getByRole('textbox',{name:'Lösung',exact:true});
 await answer.fill('Ungespeicherter Entwurf');
 await notes.getByRole('button',{name:'Quellenlink im Entwurf vorbereiten'}).click();
 await expect(answer).toHaveValue('Ungespeicherter Entwurf');
 await answer.fill('Wien');
 await notes.getByRole('button',{name:'Quellenlink im Entwurf vorbereiten'}).click();
 await expect(page.getByRole('textbox',{name:'Quelle',exact:true}))
  .toHaveValue(/example\.org\/research\/rq-w4/);
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('region',{name:'Aufgabenbestand'}).getByRole('button',{name:/rq-w4/}).click();
 await expect(page.getByRole('textbox',{name:'Quelle',exact:true}))
  .not.toHaveValue(/example\.org\/research\/rq-w4/);
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig'))
  .toHaveCount(5);
});

test('offline CSV answer correction prepares unsaved draft without grading or approval',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const downloading=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const file=await downloading,csv=await readFile(await file.path(),'utf8');
 const reviewed=csv.split('\r\n').map(line=>line.startsWith('"rq-w4",')?
  line.replace(/,"","","","",""$/,' ,"Vorschlag: Redaktioneller Testwert","https://example.org/primary","","",""'.trimStart()):line)
  .join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'answer-review.csv',mimeType:'text/csv',buffer:Buffer.from(reviewed),
 });
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await expect(notes).toContainText('Bisher: Wien');
 await expect(notes).toContainText('Vorgeschlagen: Redaktioneller Testwert');
 await notes.getByRole('button',{name:'Antwort und Quelle im Entwurf vorbereiten'}).click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(editor.getByRole('textbox',{name:'Lösung',exact:true})).toHaveValue('Redaktioneller Testwert');
 await expect(editor.getByRole('textbox',{name:'Quelle',exact:true})).toHaveValue(/example.org\/primary/);
 await expect(editor.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('region',{name:'Aufgabenbestand'}).getByRole('button',{name:/rq-w4/}).click();
 await expect(page.getByRole('textbox',{name:'Lösung',exact:true})).toHaveValue('Wien');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('CSV source-grounded wording revision stages exact current question prompt without auto-save',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const waiting=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const download=await waiting,csv=await readFile(await download.path(),'utf8');
 const amended=csv.split('\r\n').map(line=>line.startsWith('"rq-w4",')?
  line.replace(/,"","","","",""$/,' ,"","https://example.org/wien","","Fragevorschlag: Welche Stadt ist die Hauptstadt Österreichs?",""'.trimStart()):line)
  .join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'wording-review.csv',mimeType:'text/csv',buffer:Buffer.from(amended),
 });
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await expect(notes).toContainText('Vorgeschlagen: Welche Stadt ist die Hauptstadt Österreichs?');
 await notes.getByRole('button',{name:'Formulierung und Quelle im Entwurf vorbereiten'}).click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(editor.getByRole('textbox',{name:'Fragestellung'}))
  .toHaveValue('Welche Stadt ist die Hauptstadt Österreichs?');
 await expect(editor.getByRole('textbox',{name:'Quelle',exact:true})).toHaveValue(/example.org\/wien/);
 await expect(editor.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('region',{name:'Aufgabenbestand'}).getByRole('button',{name:/rq-w4/}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'}).getByRole('textbox',{name:'Fragestellung'}))
  .not.toHaveValue('Welche Stadt ist die Hauptstadt Österreichs?');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('offline CSV structural wall corrections stage tile and group without changing source IDs or approvals',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const start=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const download=await start,source=await readFile(await download.path(),'utf8');
 const note='Wandfeld 1: Redaktionell präzisierter Begriff\nVerbindung 1: Evangelien des Neuen Testaments';
 const reviewCells=['','https://example.org/primary','',note,'']
  .map(value=>'"'+value.replace(/"/g,'""')+'"').join(',');
 const csv=source.split('\r\n').map(line=>line.startsWith('"vb-wall-1",')?
  line.replace(/,"","","","",""$/,','+reviewCells):line).join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'original-wall.csv',mimeType:'text/csv',buffer:Buffer.from(csv),
 });
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await expect(notes).toContainText('Wandfeld 1 bisher');
 await notes.getByRole('button',{name:'Detailkorrekturen im Entwurf vorbereiten'}).click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(editor.getByRole('textbox',{name:'Feld 1',exact:true}))
  .toHaveValue('Redaktionell präzisierter Begriff');
 await expect(editor.getByRole('textbox',{name:'Verbindung',exact:false}).first())
  .toHaveValue('Evangelien des Neuen Testaments');
 await expect(editor.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('region',{name:'Aufgabenbestand'}).getByRole('button',{name:/vb-wall-1/}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})
  .getByRole('textbox',{name:'Feld 1',exact:true})).not.toHaveValue('Redaktionell präzisierter Begriff');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G27 repeated CSV reviewer visit rejects an outdated draft note after saved edit',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 const dl=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const file=await dl,source=await readFile(await file.path(),'utf8');
 const annotated=source.split('\r\n').map(line=>line.startsWith('"rq-w4",')?
  line.replace(/,"","","","",""$/,',"","https://example.org/g27","","",""'):line).join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'g27.csv',mimeType:'text/csv',buffer:Buffer.from(annotated)});
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 const saved=page.waitForEvent('download');
 await notes.getByRole('button',{name:'Nur aktuelle Prüfliste neu exportieren'}).click();
 const second=await saved,round2=await readFile(await second.path(),'utf8');
 expect(round2).toContain('https://example.org/g27');
 await queue.getByRole('button',{name:/rq-w4/}).click();
 await page.getByRole('region',{name:'Aufgabe bearbeiten'}).getByRole('textbox',{name:'Lösung',exact:true})
  .fill('Andere ungeprüfte Antwort');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(notes).toContainText('0 zugeordnet · 1 veraltet · 0 fehlen');
 await expect(notes.getByRole('button',{name:'Nur aktuelle Prüfliste neu exportieren'})).toBeDisabled();
 await notes.getByRole('button',{name:'Prüfnotizen schließen'}).click();
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'reopen.csv',mimeType:'text/csv',buffer:Buffer.from(round2)});
 await expect(notes).toContainText('0 zugeordnet · 1 veraltet · 0 fehlen');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G28 launch inventory exposes real source counts and actionable five-engine gaps without approval',async({page})=>{
 await page.goto('/#/inhalte');
 const panel=page.getByRole('region',{name:'G28 Startinhalte und Quellenzuordnung'});
 await expect(panel).toContainText('704');
 await expect(panel).toContainText('Keine quellgebundenen Zuordnungskandidaten');
 await expect(panel.getByRole('combobox',{name:'G28 Profil'})).toHaveValue('lang');
 await expect(panel.getByRole('combobox',{name:'G28 Teams'})).toHaveValue('5');
 await expect(panel).toContainText('Strukturell unvollständig');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await expect(panel).toContainText('79');
 await expect(panel).toContainText('Valide, noch nicht freigegebene V2-Entwürfe');
 await expect(panel).toContainText('Strukturell vollständig');
 await panel.getByRole('combobox',{name:'G28 Spiel'}).selectOption('verbindungen');
 await expect(panel).toContainText('Vier Hinweise');
 await expect(panel).toContainText('16er-Wand');
 await panel.getByRole('combobox',{name:'G28 Spiel'}).selectOption('umfrageduell');
 await expect(panel).toContainText('Top 3');
 await expect(panel).toContainText('10 lokale');
 await panel.getByRole('combobox',{name:'G28 Spiel'}).selectOption('rundenquiz');
 await panel.getByRole('button',{name:/rq-w4/}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toContainText('Österreich');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 await expect(panel).toContainText('NO_GO');
});

test('G29 native editorial correction combines source-linked hints and accepted variants in a draft',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const queue=page.getByRole('region',{name:'Quellenprüfung'});
 await queue.getByRole('combobox',{name:'Prüfgruppe'}).selectOption('lookup');
 await queue.getByRole('checkbox',{name:'Nur Qualitätsrisiken'}).check();
 await queue.getByRole('button',{name:/rq-h1/}).click();
 await expect(page.getByRole('region',{name:'Quellenabgleich'})).toContainText('Gleiches Hinweisziel');
 const waiting=page.waitForEvent('download');
 await queue.getByRole('button',{name:'Alle Aufgaben als CSV'}).click();
 const file=await waiting,csv=await readFile(await file.path(),'utf8');
 const corrections=['Antwortvarianten: König David','https://example.org/source','',
  'Hinweis 1: Angepasster erster Hinweis.\nHinweis 2: Angepasster zweiter Hinweis.','']
  .map(value=>'"'+value.replace(/"/g,'""')+'"').join(',');
 const notesCsv=csv.split('\r\n').map(line=>line.startsWith('"rq-h1",')?
  line.replace(/,"","","","",""$/,','+corrections):line).join('\r\n');
 const notes=page.getByRole('region',{name:'CSV-Prüfnotizen'});
 await notes.getByLabel('CSV-Prüfnotizen öffnen').setInputFiles({
  name:'g29.csv',mimeType:'text/csv',buffer:Buffer.from(notesCsv),
 });
 await expect(notes).toContainText('1 zugeordnet · 0 veraltet · 0 fehlen');
 await notes.getByRole('button',{name:'Qualitätskorrekturen im Entwurf vorbereiten'}).click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(editor.getByRole('textbox',{name:'Lösung',exact:true})).toHaveValue('David / König David');
 await expect(editor).toContainText('Angepasster erster Hinweis.');
 await expect(editor).toContainText('Angepasster zweiter Hinweis.');
 await expect(editor.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 await editor.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(notes).toContainText('0 zugeordnet · 1 veraltet · 0 fehlen');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G30 actual five-game pack source assignments and G10 editor handoff stay NO_GO',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await expect(plan).toContainText('NO_GO');
 await expect(plan).toContainText('Regelstruktur erfüllt');
 await expect(plan).toContainText('ohne lokale Freigabe');
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const id=await plan.getByRole('combobox',{name:'G30 wissen 1'}).inputValue();
 expect(id).toMatch(/^rq-/);
 const exportPromise=page.waitForEvent('download');
 await plan.getByRole('button',{name:'Quell-IDs als Packplan exportieren'}).click();
 const out=await exportPromise;
 const content=JSON.parse(await readFile(await out.path(),'utf8'));
 expect(content).toMatchObject({format:'ligoquiz-g30-source-ids-only-v1',status:'NO_GO',
  publicationAuthorized:false,rightsVerified:false,game:'rundenquiz',profile:'lang',teams:5});
 expect(content.sourceIds).toContain(id);
 expect(JSON.stringify(content)).not.toContain('"answer"');
 await plan.getByRole('button',{name:id+' in G10 prüfen'}).first().click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toContainText(id);
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 const selector=page.getByRole('combobox',{name:'G28 Spiel'});
 await selector.selectOption('quiztafel');
 await expect(plan).toContainText('Regelstruktur erfüllt');
 await expect(plan.getByRole('combobox',{name:/G30 Team 5 · 600 Punkte/})).toBeVisible();
 await selector.selectOption('verbindungen');
 await expect(plan).toContainText('16er-Wand');
 await selector.selectOption('logikleiter');
 await expect(plan.getByRole('combobox',{name:'G30 Stufe 7'})).toBeVisible();
 await selector.selectOption('umfrageduell');
 await expect(plan.getByRole('combobox',{name:/G30 Top 3 · 2/})).toBeVisible();
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G31 original game-night moderation and public-only projection rehearsal across five games',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const panel=page.getByRole('region',{name:'G31 Moderationsprobe'});
 await expect(panel).toContainText('NO_GO');
 await expect(panel).toContainText('Gleich verteilt');
 const host=panel.getByRole('region',{name:'G31 Spielleitung'});
 const stage=panel.getByRole('region',{name:'G31 Beamer-Probe'});
 await expect(host).toContainText('Schritt 1 /');
 await expect(stage).toContainText('Warteschirm');
 await expect(stage).not.toContainText('rq-w');
 await panel.getByRole('button',{name:'Nächster Schritt'}).click();
 await expect(stage).toContainText('Aufgabe läuft');
 await expect(stage).not.toContainText('Antwort');
 await panel.getByRole('button',{name:'Nächsten Prüffall zeigen'}).click();
 await expect(host).toContainText('SOURCE_');
 const game=page.getByRole('combobox',{name:'G28 Spiel'});
 await game.selectOption('quiztafel');
 await expect(panel).toContainText('Team 5: 6');
 await game.selectOption('verbindungen');
 await expect(panel).toContainText('Team 5: 4');
 await game.selectOption('logikleiter');
 await expect(panel).toContainText('Stufe 1');
 await game.selectOption('umfrageduell');
 await expect(host).toContainText('Beliebteste Antwort');
 await expect(panel).toContainText('NO_GO');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});
test('G31 source continuity refuses to discard unsaved G10 edits without explicit human choice',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const pack=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await pack.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const first=await pack.getByRole('combobox',{name:'G30 wissen 1'}).inputValue();
 const second=await pack.getByRole('combobox',{name:'G30 wissen 2'}).inputValue();
 expect(first).not.toBe(second);
 await pack.getByRole('button',{name:first+' in G10 prüfen'}).first().click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 await expect(editor).toContainText(first);
 await editor.getByRole('textbox',{name:/Nutzungsrechte und externe Freigabegrundlage/}).fill('Ungespeicherte Prüfung');
 page.once('dialog',dialog=>dialog.dismiss());
 await pack.getByRole('button',{name:second+' in G10 prüfen'}).first().click();
 await expect(editor).toContainText(first);
 await expect(editor.getByRole('textbox',{name:/Nutzungsrechte und externe Freigabegrundlage/})).toHaveValue('Ungespeicherte Prüfung');
 page.once('dialog',dialog=>dialog.accept());
 await pack.getByRole('button',{name:second+' in G10 prüfen'}).first().click();
 await expect(editor).toContainText(second);
 await expect(editor.getByRole('textbox',{name:/Nutzungsrechte und externe Freigabegrundlage/})).toHaveValue('');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
});

test('G32 original five-game run sheet offers reversible source repairs without approving questions',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const run=page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'});
 await expect(run).toContainText('NO_GO');
 const navigation=run.getByRole('navigation',{name:'G32 Spiele wechseln'});
 await expect(navigation.getByRole('button')).toHaveCount(5);
 await navigation.getByRole('button',{name:/Quiztafel/}).click();
 await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('quiztafel');
 await navigation.getByRole('button',{name:/Rundenquiz/}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 const repair=page.getByRole('region',{name:'G32 Quellenreparatur'});
 await expect(repair).toContainText('Offene Aufgaben');
 await repair.getByRole('button',{name:/hinweise 1.*CROSS_GAME_SPOILER/}).click();
 const chooser=repair.getByRole('button',{name:/auswählen ·/}).first();
 await expect(chooser).toBeEnabled();
 const choiceName=await chooser.textContent();
 const chosenId=choiceName?.trim().split(' ')[0]??'';
 await chooser.click();
 await expect(repair.getByRole('button',{name:'Letzte Quellwahl rückgängig'})).toBeEnabled();
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await expect(plan.getByRole('combobox',{name:'G30 hinweise 1'})).toHaveValue(chosenId);
 await repair.getByRole('button',{name:'Letzte Quellwahl rückgängig'}).click();
 await expect(plan.getByRole('combobox',{name:'G30 hinweise 1'})).toHaveValue('rq-h1');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 await expect(run).toContainText('NO_GO');
});

test('G33 durable original five-game source choices and moderator step recover after reload without approval',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 await page.getByRole('combobox',{name:'G28 Spiel'}).selectOption('verbindungen');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const source=plan.getByRole('combobox',{name:'G30 Hinweise · Runde 1 / Team 1'});
 const initial=await source.inputValue();
 const alternatives=await source.locator('option').evaluateAll(options=>
  options.map(x=>x.value).filter(Boolean));
 const other=alternatives.find(x=>x!==initial);
 expect(other).toBeTruthy();
 await source.selectOption(other);
 const rehearsal=page.getByRole('region',{name:'G31 Moderationsprobe'});
 await rehearsal.getByRole('button',{name:'Nächster Schritt'}).click();
 await rehearsal.getByRole('button',{name:'Nächster Schritt'}).click();
 await expect(rehearsal).toContainText('Schritt 3 /');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await page.reload();
 await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('verbindungen');
 await expect(page.getByRole('combobox',{name:'G28 Profil'})).toHaveValue('kurz');
 await expect(page.getByRole('combobox',{name:'G28 Teams'})).toHaveValue('3');
 await expect(rehearsal).toContainText('Schritt 3 /');
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await expect(source).toHaveValue(other);
 await expect(saved).toContainText('Revision 1');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
});
test('G33 stale original question revision blocks saved plan recovery and requires explicit discard',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const first=await plan.getByRole('combobox',{name:'G30 wissen 1'}).inputValue();
 await plan.getByRole('button',{name:first+' in G10 prüfen'}).first().click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 const question=editor.getByRole('textbox',{name:'Fragestellung'});
 await question.fill((await question.inputValue())+' (redaktioneller Entwurf)');
 await editor.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(saved).toContainText('Quellen geändert');
 await expect(saved).toContainText(first+': Inhalt oder Revision geändert');
 await expect(saved.getByRole('button',{name:'Abendplan lokal speichern'})).toBeDisabled();
 await page.reload();
 await expect(saved).toContainText('Quellen geändert');
 await expect(saved.getByRole('button',{name:'Abendplan lokal speichern'})).toBeDisabled();
 page.once('dialog',dialog=>dialog.accept());
 await saved.getByRole('button',{name:'Gespeicherten Plan verwerfen'}).click();
 await expect(saved).toContainText('Nicht gespeichert');
 await expect(page.getByRole('region',{name:'Aufgabenbestand'})).toContainText(first);
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G34 recover unchanged five-game assignments but clear only revised question in original G10',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 const persisted=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await persisted.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(persisted).toContainText('Revision 1');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 const q1=await plan.getByRole('combobox',{name:'G30 wissen 1'}).inputValue();
 const q2=await plan.getByRole('combobox',{name:'G30 wissen 2'}).inputValue();
 await plan.getByRole('button',{name:q1+' in G10 prüfen'}).first().click();
 const editor=page.getByRole('region',{name:'Aufgabe bearbeiten'});
 const question=editor.getByRole('textbox',{name:'Fragestellung'});
 await question.fill((await question.inputValue())+' – geänderte Fragestellung');
 await editor.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(persisted).toContainText('Quellen geändert');
 const recover=persisted.getByRole('region',{name:'G34 Teilwiederherstellung'});
 await recover.getByRole('button',{name:'Gültige Quellen prüfen'}).click();
 const affected=recover.getByLabel('G34 Betroffene Quellplätze');
 await expect(affected).toContainText('wissen:1');
 await expect(affected).toContainText(q1);
 await expect(affected).not.toContainText(q2);
 await expect(plan.getByRole('combobox',{name:'G30 wissen 2'})).toHaveValue(q2);
 page.once('dialog',dialog=>dialog.accept());
 await recover.getByRole('button',{name:/Quellen behalten · .* Plätze leeren/}).click();
 await expect(persisted).toContainText('Revision 2');
 await expect(persisted).not.toContainText('Quellen geändert');
 await expect(plan.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue('');
 await expect(plan.getByRole('combobox',{name:'G30 wissen 2'})).toHaveValue(q2);
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
 await page.reload();
 await expect(persisted).toContainText('Revision 2');
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await expect(plan.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue('');
 await expect(plan.getByRole('combobox',{name:'G30 wissen 2'})).toHaveValue(q2);
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G35 editor completes original empty Rundenquiz slot with source validation and saved local rehearsal',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const plan=page.getByRole('region',{name:'G30 Original-Packplanung'});
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await plan.getByRole('combobox',{name:'G30 wissen 1'}).selectOption('');
 const five=page.getByRole('region',{name:'G35 Fünf-Spiele-Quellenwahl'});
 const selector=five.getByRole('combobox',{name:'G35 Quellenplatz'});
 await selector.selectOption('rundenquiz/wissen:1');
 const choices=five.getByRole('region',{name:'G35 Alternative Originalquellen'});
 const option=choices.getByRole('button',{name:/als Entwurf wählen/}).first();
 await expect(option).toBeEnabled();
 const label=await option.textContent();
 const id=label?.trim().split(' ')[0];
 expect(id).toMatch(/^rq-/);
 await option.click();
 await expect(plan.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue(id);
 const rehearsal=page.getByRole('region',{name:'G31 Moderationsprobe'});
 await expect(rehearsal).toContainText('Schritt 1 /');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await page.reload();
 await expect(saved).toContainText('Revision 1');
 await plan.getByText(/Aufgabenplätze und Originalquellen wählen/).click();
 await expect(plan.getByRole('combobox',{name:'G30 wissen 1'})).toHaveValue(id);
 await expect(five).toContainText('NO_GO');
 await expect(page.getByRole('region',{name:'Spielbare Inhalte'}).getByText('Unvollständig')).toHaveCount(5);
});

test('G36 original five-game cue desk traverses boundaries, reviews source and restores local saved phase',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const queue=page.getByRole('region',{name:'G36 Fünf-Spiele-Moderationslauf'});
 await expect(queue).toContainText('NO_GO');
 await expect(queue).toContainText('Team 3:');
 await expect(queue).toContainText('1 / ');
 const stage=queue.getByLabel('G36 Öffentliche Phasenvorschau');
 await expect(stage).toContainText('Warteschirm');
 await expect(stage).not.toContainText('Josua');
 await queue.getByRole('button',{name:'Nächste Phase'}).click();
 await expect(queue).toContainText('2 / ');
 await expect(stage).toContainText('Aufgabe läuft');
 await queue.getByRole('button',{name:'Nächste Quelle prüfen'}).click();
 await expect(queue).toContainText('Quelle redaktionell offen');
 await queue.getByRole('button',{name:'Originalquelle in G10 öffnen'}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toBeVisible();
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 const before=await queue.locator('.g36-cue>div').first().textContent();
 await page.reload();
 await expect(saved).toContainText('Revision 1');
 await expect(queue.locator('.g36-cue>div').first()).toContainText(before?.split(' · ')[0]??'');
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
});

test('G37 source-bound moderator rehearsal marks persist and team routing stays editor only',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const desk=page.getByRole('region',{name:'G36 Fünf-Spiele-Moderationslauf'});
 await expect(desk).toContainText('Moderationsprobe: 0 /');
 await desk.getByRole('button',{name:'Aufgabe probeweise durchgespielt'}).click();
 await expect(desk).toContainText('Moderationsprobe: 1 /');
 await desk.getByRole('button',{name:'Nächste ungetestete Aufgabe'}).click();
 await expect(desk).toContainText('6 / 132 · Rundenquiz');
 await expect(desk).toContainText('wissen 2 · ready');
 await desk.getByRole('combobox',{name:'G37 Teamfilter'}).selectOption('2');
 await desk.getByRole('button',{name:'Nächste Teamaufgabe'}).click();
 await expect(desk).toContainText('Team 2');
 await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('quiztafel');
 await expect(desk.getByLabel('G36 Öffentliche Phasenvorschau')).not.toContainText('Josua');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await page.reload();
 await expect(saved).toContainText('Revision 1');
 await expect(desk).toContainText('Moderationsprobe: 1 /');
 await expect(page.getByRole('combobox',{name:'G28 Spiel'})).toHaveValue('quiztafel');
 await page.getByRole('combobox',{name:'G28 Spiel'}).selectOption('rundenquiz');
 await expect(desk.getByRole('button',{name:'Probenmarkierung zurücknehmen'})).toBeVisible();
 await desk.getByRole('button',{name:'Probenmarkierung zurücknehmen'}).click();
 await expect(desk).toContainText('Moderationsprobe: 0 /');
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
});

test('G38 original team round-robin, source-specific rights hold and editor continuity persist locally',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 const desk=page.getByRole('region',{name:'G36 Fünf-Spiele-Moderationslauf'});
 const rotation=page.getByRole('region',{name:'G38 Teamrotation und Korrektur'});
 await expect(rotation).toContainText('0/');
 await rotation.getByRole('button',{name:'Nächster fairer Teamturn'}).click();
 await expect(desk.locator('.g36-cue').first()).toContainText('Team 1');
 await rotation.getByRole('button',{name:'Aufgabe proben und Teamwechsel'}).click();
 await expect(desk.locator('.g36-cue').first()).toContainText('Team 2');
 await expect(rotation).toContainText('1/');
 await rotation.getByRole('combobox',{name:'G38 Prüfgrund'}).selectOption('rights');
 await rotation.getByRole('button',{name:'Korrekturvermerk setzen'}).click();
 await expect(rotation).toContainText('G10-Korrektur offen · rights');
 await expect(desk.getByLabel('G36 Öffentliche Phasenvorschau')).toContainText('Warteschirm');
 await expect(desk.getByLabel('G36 Öffentliche Phasenvorschau')).not.toContainText('sourceId');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await page.reload();
 await expect(saved).toContainText('Revision 1');
 await expect(rotation).toContainText('1/');
 await expect(rotation).toContainText('G10-Korrektur offen · rights');
 await rotation.getByRole('button',{name:/rights · G10/}).click();
 await expect(page.getByRole('region',{name:'Aufgabe bearbeiten'})).toBeVisible();
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
});


test('G39 rehearsal isolates held questions, resets team filter and recovers local correction',async({page})=>{
 await page.goto('/#/inhalte');
 await page.getByRole('button',{name:'Probeaufgaben als Entwürfe prüfen'}).click();
 await page.getByRole('checkbox',{name:/Ich bestätige die Vorschau/}).check();
 await page.getByRole('button',{name:'Vorschau ausdrücklich importieren'}).click();
 await page.getByRole('combobox',{name:'G28 Profil'}).selectOption('kurz');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('5');
 const desk=page.getByRole('region',{name:'G36 Fünf-Spiele-Moderationslauf'});
 const rotation=page.getByRole('region',{name:'G38 Teamrotation und Korrektur'});
 const work=rotation.getByLabel('G39 Aktionsfähige Teamliste');
 await expect(work).toContainText('probefähig');
 await desk.getByRole('combobox',{name:'G37 Teamfilter'}).selectOption('5');
 await page.getByRole('combobox',{name:'G28 Teams'}).selectOption('3');
 await expect(desk.getByRole('combobox',{name:'G37 Teamfilter'})).toHaveValue('0');
 await rotation.getByRole('button',{name:'Nächster fairer Teamturn'}).click();
 await expect(desk.locator('.g36-cue').first()).toContainText('Team 1');
 await rotation.getByRole('combobox',{name:'G38 Prüfgrund'}).selectOption('rights');
 await rotation.getByRole('button',{name:'Korrekturvermerk setzen'}).click();
 await expect(work).toContainText('1 mit Korrekturvermerk');
 await expect(rotation.getByRole('button',{name:'Aufgabe proben und Teamwechsel'})).toBeDisabled();
 await rotation.getByRole('button',{name:'Nächster fairer Teamturn'}).click();
 await expect(desk.locator('.g36-cue').first()).toContainText('Team 2');
 await rotation.getByRole('button',{name:'Nächsten Korrekturfall anzeigen'}).click();
 await expect(desk.locator('.g36-cue').first()).toContainText('Team 1');
 await expect(rotation).toContainText('G10-Korrektur offen · rights');
 const saved=page.getByRole('region',{name:'G33 Lokaler Abendplan'});
 await saved.getByRole('button',{name:'Abendplan lokal speichern'}).click();
 await expect(saved).toContainText('Revision 1');
 await page.reload();
 await expect(work).toContainText('1 mit Korrekturvermerk');
 await expect(rotation.getByRole('button',{name:'Aufgabe proben und Teamwechsel'})).toBeDisabled();
 await expect(page.getByRole('region',{name:'G32 Fünf-Spiele-Abendplan'})).toContainText('NO_GO');
});
