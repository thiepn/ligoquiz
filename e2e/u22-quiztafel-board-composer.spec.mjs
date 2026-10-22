import {test,expect} from '@playwright/test';

async function seedFiveCategoryOriginalBoard(page){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('5');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Quiztafel/}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const id=await page.evaluate(()=>{
  const host=JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  return host.eventId;
 });
 await page.goto('/#/inhalte');
 await expect(page.getByRole('heading',{name:'Inhaltsatelier'})).toBeVisible();
 const result=await page.evaluate(async eventId=>{
  const open=name=>new Promise((resolve,reject)=>{
   const r=globalThis.indexedDB.open(name);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const events=await open('ligoquiz.v2.sessions');
  const event=await new Promise((resolve,reject)=>{
   const r=events.transaction('events','readonly').objectStore('events').get(eventId);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  events.close();
  if(!event?.quiztafel?.tiles||event.quiztafel.tiles.length!==15)throw Error('No authentic 5-category Kurz Quiztafel source');
  const original=event.quiztafel;
  const records=await open('ligoquiz.v2.content.g10');
  const sourceIds={};const chosen=['natur','geschichte','geografie'];
  for(const tile of original.tiles){
   const name=original.categories.find(c=>c.id===tile.categoryId)?.name;
   if(!name)throw Error('Original category name missing');
   const payload={...tile,categoryName:name};
   const bytes=new globalThis.TextEncoder().encode(JSON.stringify(payload));
   const fingerprint=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
   const now=Date.now(),item={id:tile.id,game:'quiztafel',payload,
    status:'approved',createdAt:now,updatedAt:now,revision:1,
    provenance:{origin:'manual'},review:{reviewer:'Synthetic test reviewer',
     checkedAt:now,note:'Isolated original-source E2E fixture, not an actual content rights grant',
     checklist:[true,true,true,true],fingerprint},
    audit:[{revision:1,at:now,action:'TEST',note:'Browser fixture only'}]};
   await new Promise((resolve,reject)=>{
    const tx=records.transaction('entries','readwrite');
    tx.objectStore('entries').put(item);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   sourceIds[tile.categoryId+'-'+tile.row]=tile.id;
  }
  const first=original.tiles.find(t=>t.categoryId==='natur'&&t.row===1);
  const categoryName=original.categories.find(c=>c.id==='natur')?.name;
  if(!first||!categoryName)throw Error('Missing original Natur tile');
  const alternate={...first,id:'qt-natur-e2e-alternate',prompt:'Testalternative Natur 100 Punkte',
   categoryName};
  const bytes=new globalThis.TextEncoder().encode(JSON.stringify(alternate));
  const fingerprint=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)))
   .map(b=>b.toString(16).padStart(2,'0')).join('');
  const now=Date.now();
  await new Promise((resolve,reject)=>{
   const tx=records.transaction('entries','readwrite');
   tx.objectStore('entries').put({id:alternate.id,game:'quiztafel',payload:alternate,
    status:'approved',createdAt:now,updatedAt:now,revision:1,
    provenance:{origin:'manual'},review:{reviewer:'Synthetic test reviewer',checkedAt:now,
     note:'Synthetic alternate used only for E2E. No actual source rights approval',
     checklist:[true,true,true,true],fingerprint},
    audit:[{revision:1,at:now,action:'TEST',note:'Browser fixture only'}]});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  records.close();
  return {sourceIds,chosen,eventId,alternateId:alternate.id};
 },id);
 return result;
}
async function openComposer(page){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Quiztafel/}).click();
 await page.getByRole('radio',{name:/Redaktionell freigegebene Inhaltsbibliothek/}).check();
 const composer=page.getByRole('region',{name:'Quiztafel Spielfeld zusammenstellen'});
 await expect(composer.getByRole('button',{name:'Spielfeld selbst zusammenstellen'})).toBeEnabled();
 await composer.getByRole('button',{name:'Spielfeld selbst zusammenstellen'}).click();
 await expect(composer.getByRole('status')).toContainText('Spielfeld unvollständig');
 return composer;
}
async function selectThreeCategories(composer){
 const selections=[
  ['Natur & Technik','natur'],['Geschichte','geschichte'],['Geografie','geografie'],
 ];
 for(const [name,id] of selections){
  void id;
  for(const points of [100,200,300]){
   const select=composer.getByRole('combobox',{name:name+' '+points+' Punkte'});
   if(name==='Natur & Technik'&&points===100)
    await select.selectOption({label:'Testalternative Natur 100 Punkte'});
   else await select.selectOption({index:1});
  }
 }
 await expect(composer.locator('.u22-board-status')).toHaveAttribute('data-board-valid','true');
}
test('U22 manually compose three nondefault approved Quiztafel categories, alternate 100-point cell, reload, canonical frozen board',async({page})=>{
 const source=await seedFiveCategoryOriginalBoard(page);
 const composer=await openComposer(page);
 await expect(composer.locator('.u22-board-category')).toHaveCount(5);
 await selectThreeCategories(composer);
 const disabled= composer.getByRole('combobox',{name:'Bibel 100 Punkte'});
 await expect(disabled).toBeDisabled();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 const reloaded=page.getByRole('region',{name:'Quiztafel Spielfeld zusammenstellen'});
 await expect(reloaded.locator('.u22-board-status')).toHaveAttribute('data-board-valid','true');
 await expect(reloaded.getByRole('combobox',{name:'Natur & Technik 100 Punkte'}))
  .toHaveValue(source.alternateId);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const frozen=await page.evaluate(async()=>{
  const host=JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  const db=await new Promise((resolve,reject)=>{
   const r=globalThis.indexedDB.open('ligoquiz.v2.sessions');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const event=await new Promise((resolve,reject)=>{
   const r=db.transaction('events','readonly').objectStore('events').get(host.eventId);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  db.close();
  return {eventId:event.id,types:event.program.map(x=>x.rulesVersion),
   categories:event.quiztafel.categories.map(x=>x.id),
   tiles:event.quiztafel.tiles.map(x=>({id:x.id,categoryId:x.categoryId,row:x.row,value:x.value})),
   sources:event.frozenTasks.map(x=>({id:x.taskId,sourceId:x.sourceContentId,hash:x.sourceHash}))};
 });
 expect(frozen.eventId).not.toBe(source.eventId);
 expect(frozen.types).toEqual(['quiztafel-reviewed-v1']);
 expect(frozen.categories).toEqual(['geografie','geschichte','natur']);
 expect(frozen.tiles).toHaveLength(9);
 expect(frozen.tiles.some(x=>x.id===source.alternateId&&x.value===100)).toBe(true);
 expect(new Set(frozen.tiles.map(x=>x.id))).toEqual(new Set(frozen.sources.map(x=>x.sourceId)));
 expect(frozen.sources.every(x=>x.id===x.sourceId&&x.hash.length===64)).toBe(true);
 const expected=['natur','geschichte','geografie'].flatMap(category=>
  [1,2,3].map(row=>category==='natur'&&row===1?source.alternateId:
   source.sourceIds[category+'-'+row]));
 expect(new Set(frozen.tiles.map(x=>x.id))).toEqual(new Set(expected));
});
test('U22 incomplete board cannot advance; explicit automatic selection remains available',async({page})=>{
 await seedFiveCategoryOriginalBoard(page);
 const composer=await openComposer(page);
 await composer.getByRole('combobox',{name:'Geschichte 200 Punkte'}).selectOption({index:1});
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('alert')).toContainText('jede Quiztafel-Kategorie');
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await composer.getByRole('button',{name:'Automatische Originaltafel'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
});
test('U22 mobile 375px changed-approved-source after selection fails original final event freeze',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const source=await seedFiveCategoryOriginalBoard(page);
 const composer=await openComposer(page);
 await selectThreeCategories(composer);
 await page.evaluate(async id=>{
  const db=await new Promise((resolve,reject)=>{
   const r=globalThis.indexedDB.open('ligoquiz.v2.content.g10');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const content=await new Promise((resolve,reject)=>{
   const r=db.transaction('entries','readonly').objectStore('entries').get(id);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  content.payload={...content.payload,reference:'Unapproved changed source'};
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readwrite');
   tx.objectStore('entries').put(content);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
 },source.alternateId);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/setup$/);
 await expect(page.getByRole('alert')).toContainText('Inhalt wurde seit der Freigabe geändert');
 const bounds=await page.evaluate(()=>({width:globalThis.innerWidth,
  scroll:globalThis.document.documentElement.scrollWidth}));
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+3);
});
