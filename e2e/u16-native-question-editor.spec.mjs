import {test,expect} from '@playwright/test';

async function create(page,game){
 await page.goto('/#/inhalte');
 await page.getByRole('combobox',{name:'Neuer Inhalt'}).selectOption(game);
 await page.getByRole('button',{name:'Aufgabe anlegen'}).click();
 const editor=page.getByRole('region',{name:'Frage visuell bearbeiten'});
 await expect(editor).toHaveAttribute('data-u16-mode',game);
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
 return editor;
}
async function savedContent(page,expectedGame){
 return page.evaluate(async(game)=>{
  const db=await new Promise((resolve,reject)=>{
   const req=globalThis.indexedDB.open('ligoquiz.v2.content.g10');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const all=await new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readonly'),req=tx.objectStore('entries').getAll();
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  db.close();
  if(all.length!==1||all[0].game!==game)throw Error('Expected one original standalone content draft');
  return all[0];
 },expectedGame);
}

test('U16 authored Rundenquiz clues and choices survive saved draft reload without automatic approval',async({page})=>{
 const editor=await create(page,'rundenquiz');
 const id=await page.locator('.cx-id').textContent();
 await editor.getByRole('combobox',{name:'Runde'}).selectOption('hinweise');
 await expect(editor.getByRole('alert')).toContainText('Noch nicht speicherbar');
 await editor.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Person ist gesucht?');
 await editor.getByRole('textbox',{name:'Lösung'}).fill('Josua');
 await editor.getByRole('textbox',{name:'Quelle',exact:true}).fill('Eigene Quellenangabe, Prüfung ausstehend');
 for(let i=1;i<=4;i++)await editor.getByRole('textbox',{name:'Hinweis '+i}).fill('Originaler Hinweis '+i);
 await expect(editor.locator('.u16-valid')).toContainText('strukturell gültig');
 const preview=editor.getByRole('region',{name:'Vorschau nur freigegebener Fragefelder'});
 await expect(preview).toContainText('Originaler Hinweis 4');
 await expect(preview).not.toContainText('Josua');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 const saved=await savedContent(page,'rundenquiz');
 expect(saved.id).toBe(id);
 expect(saved.payload.round).toBe('hinweise');
 expect(saved.payload.clues).toEqual([1,2,3,4].map(i=>'Originaler Hinweis '+i));
 expect(saved.status).toBe('draft');
 expect(saved.review).toBeUndefined();
 await page.reload();
 await page.getByRole('button',{name:/Welche Person ist gesucht/}).click();
 await expect(page.getByRole('textbox',{name:'Hinweis 4'})).toHaveValue('Originaler Hinweis 4');
 await expect(page.getByRole('heading',{name:'Entwurf',exact:true})).toBeVisible();
});

test('U16 Quiztafel native point-value selector updates canonical row/value together',async({page})=>{
 const editor=await create(page,'quiztafel');
 await editor.getByRole('combobox',{name:'Feldwert'}).selectOption('4');
 await editor.getByRole('textbox',{name:'Kategorie',exact:true}).fill('Geschichte');
 await editor.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Antwort passt?');
 await editor.getByRole('textbox',{name:'Lösung'}).fill('Eine selbst geprüfte Antwort');
 await editor.getByRole('textbox',{name:'Quelle',exact:true}).fill('Eigener Testbeleg');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 const value=(await savedContent(page,'quiztafel')).payload;
 expect(value.row).toBe(4);
 expect(value.value).toBe(400);
 expect(value.categoryName).toBe('Geschichte');
 expect(value.id).toMatch(/^neu-/);
});

test('U16 Verbindungen builds valid three-element sequence entirely via native controls',async({page})=>{
 const editor=await create(page,'verbindungen');
 await editor.getByRole('combobox',{name:'Aufgabentyp'}).selectOption('sequence');
 await expect(editor.getByRole('alert')).toContainText('Noch nicht speicherbar');
 await editor.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Zahl ergänzt die Folge?');
 for(let i=1;i<=3;i++)await editor.getByRole('textbox',{name:'Folgenelement '+i}).fill(String(i));
 await editor.getByRole('textbox',{name:'Lösung'}).fill('4');
 await editor.getByRole('textbox',{name:'Erklärung'}).fill('Es wird bei jeder Zahl eins addiert.');
 await editor.getByRole('textbox',{name:'Quelle',exact:true}).fill('Eigene Aufgabenentwicklung');
 await expect(editor.locator('.u16-valid')).toContainText('strukturell gültig');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 const item=await savedContent(page,'verbindungen');
 expect(item.payload.kind).toBe('sequence');
 expect(item.payload.items).toEqual(['1','2','3']);
 expect(item.payload.answer).toBe('4');
 expect(item.status).toBe('draft');
});

test('U16 Logikleiter explanation stays private in preview and requires independent review after save',async({page})=>{
 const editor=await create(page,'logikleiter');
 await editor.getByRole('combobox',{name:'Denkaufgabentyp'}).selectOption('constraint');
 await editor.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Schlussfolgerung ist gesichert?');
 await editor.getByRole('textbox',{name:'Lösung'}).fill('Es folgt keine eindeutige Antwort');
 await editor.getByRole('textbox',{name:'Erklärung'}).fill('Die Bedingungen bestimmen nicht alle möglichen Fälle.');
 await editor.getByRole('textbox',{name:'Hinweis'}).fill('Vergleiche mindestens zwei verschiedene Fälle');
 await editor.getByRole('textbox',{name:'Quelle',exact:true}).fill('Eigene Logikaufgabe');
 const preview=editor.getByRole('region',{name:'Vorschau nur freigegebener Fragefelder'});
 await expect(preview).toContainText('Welche Schlussfolgerung');
 await expect(preview).not.toContainText('Es folgt keine eindeutige Antwort');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 const item=await savedContent(page,'logikleiter');
 expect(item.payload.kind).toBe('constraint');
 expect(item.status).toBe('draft');
 expect(item.review).toBeUndefined();
});

test('U16 Umfrageduell edits five rank labels and synonyms without fabricating measured survey source',async({page})=>{
 const editor=await create(page,'umfrageduell');
 await editor.getByRole('combobox',{name:'Umfrageformat'}).selectOption('top3');
 await editor.getByRole('textbox',{name:'Fragestellung'}).fill('Welche Gegenstände nehmen Leute mit?');
 await editor.getByRole('textbox',{name:'Kategorie 1'}).fill('Notizbuch');
 const first=editor.locator('.u16-category').first();
 await first.getByRole('button',{name:'Synonym hinzufügen'}).click();
 await first.getByRole('textbox',{name:'Synonym 1'}).fill('Schreibheft');
 await expect(editor).toContainText('Illustrative Beispieldaten');
 const preview=editor.getByRole('region',{name:'Vorschau nur freigegebener Fragefelder'});
 await expect(preview).not.toContainText('Notizbuch');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 const item=await savedContent(page,'umfrageduell');
 expect(item.payload.categories[0]).toEqual({label:'Notizbuch',synonyms:['Schreibheft']});
 expect(item.payload.source).toEqual({kind:'illustrative'});
 expect(item.status).toBe('draft');
});

test('U16 375px original content authoring does not overflow and invalid JSON fails closed',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const editor=await create(page,'verbindungen');
 await editor.getByRole('combobox',{name:'Aufgabentyp'}).selectOption('wall');
 await expect(editor.locator('.u16-four-grid').first().getByRole('textbox')).toHaveCount(16);
 await expect(editor.getByRole('alert')).toContainText('Noch nicht speicherbar');
 await page.locator('.cx-structured summary').click();
 await page.getByRole('textbox',{name:'JSON-Datensatz'}).fill('{"invalid":');
 await expect(editor.getByRole('alert')).toContainText('Ungültiges JSON');
 await page.getByRole('button',{name:'Änderungen als Entwurf speichern'}).click();
 await expect(page.getByRole('alert').last()).toBeVisible();
 const bounds=await page.evaluate(()=>({scroll:globalThis.document.documentElement.scrollWidth,width:globalThis.innerWidth}));
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+3);
});
