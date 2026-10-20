import {test,expect} from '@playwright/test';

async function setupApproved(page){
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('radio',{name:/Redaktionell freigegebene Inhaltsbibliothek/}).check();
 return page.getByRole('region',{name:'Freigegebene Programme finden'});
}
/** A real original original-bank prepared session supplies the source payloads.
 * Only this disposable test browser receives synthetic approval receipts. */
async function seedActualOriginalLadder(page,{tamper=false}={}){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:/Logikleiter/}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const eventId=await page.evaluate(()=>{
  const data=JSON.parse(sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  return data.eventId;
 });
 await page.goto('/#/inhalte');
 await expect(page.getByRole('heading',{name:'Inhaltsatelier'})).toBeVisible();
 const result=await page.evaluate(async({eventId,tamper})=>{
  const open=(name)=>new Promise((resolve,reject)=>{
   const req=indexedDB.open(name);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const read=(db,store,id)=>new Promise((resolve,reject)=>{
   const req=db.transaction(store,'readonly').objectStore(store).get(id);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const original=await open('ligoquiz.v2.sessions');
  const event=await read(original,'events',eventId);
  original.close();
  if(!event?.logikleiter?.rungs?.length)throw Error('Missing original ladder source');
  const contentDb=await open('ligoquiz.v2.content.g10');
  const now=Date.now(),ids=[],rungs=event.logikleiter.rungs;
  for(let i=0;i<rungs.length;i++){
   const payload=rungs[i];
   const encoded=new TextEncoder().encode(JSON.stringify(payload));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
   const item={id:payload.id,game:'logikleiter',payload,status:'approved',
    createdAt:now,updatedAt:now,revision:1,
    provenance:{origin:'manual'},
    review:{reviewer:'Nur E2E-Test',checkedAt:now,
      note:'Synthetische Browserfixture, keine echte Rechtefreigabe.',
      checklist:[true,true,true,true],fingerprint:tamper&&i===0?'f'.repeat(64):hash},
    audit:[{revision:1,at:now,action:'FIXTURE',note:'Nur lokaler Browserintegrationstest'}]};
   await new Promise((resolve,reject)=>{
    const tx=contentDb.transaction('entries','readwrite');
    tx.objectStore('entries').put(item);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   ids.push(payload.id);
  }
  contentDb.close();
  return {ids,eventId};
 },{eventId,tamper});
 return result;
}

test('U18 original setup shows actual fail-closed approved inventory with no silent trial fallback',async({page})=>{
 const finder=await setupApproved(page);
 await expect(finder).toContainText('Derzeit nicht spielbar');
 await expect(finder).toContainText('wissen: 0 / 3');
 await expect(finder).toContainText('Kein vollständig freigegebenes Programm verfügbar');
 await expect(finder.getByRole('button',{name:/Teams auswählen/})).toHaveCount(0);
 await finder.getByRole('button',{name:'Bestand neu prüfen'}).click();
 await expect(finder).toContainText('Derzeit nicht spielbar');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.getByRole('alert')).toContainText('Kein Rückfall auf Probeinhalte');
 await expect(page).toHaveURL(/#\/setup$/);
});

test('U18 chooses real original SHA-qualified ladder profile and prepares reviewed-only canonical game',async({page})=>{
 const seed=await seedActualOriginalLadder(page);
 const finder=await setupApproved(page);
 await expect(finder).toContainText('Freigegebene Programme');
 await expect(finder).toContainText('Rundenquiz · Kurz · 4 Teams');
 await expect(finder).toContainText('Derzeit nicht spielbar');
 const choice=finder.getByRole('button',{name:'Logikleiter Kurz 4 Teams auswählen'});
 await expect(choice).toBeVisible();
 await choice.click();
 await expect(page.getByRole('button',{name:/Logikleiter/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('combobox',{name:'Umfang'})).toHaveValue('kurz');
 await expect(finder.getByLabel('Aktuelle Programmauswahl')).toContainText('Originalauswahl möglich');
 await page.reload();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Logikleiter/})).toHaveAttribute('aria-pressed','true');
 const reloaded=page.getByRole('region',{name:'Freigegebene Programme finden'});
 await expect(reloaded.getByLabel('Aktuelle Programmauswahl')).toContainText('Originalauswahl möglich');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.locator('.exp-summary')).toContainText('Logikleiter');
 await expect(page.locator('.exp-summary')).toContainText('freigegebene Bibliothek');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const frozen=await page.evaluate(async()=>{
  const host=JSON.parse(sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('ligoquiz.v2.sessions');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const event=await new Promise((resolve,reject)=>{
   const req=db.transaction('events','readonly').objectStore('events').get(host.eventId);
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  db.close();
  return {id:event.id,version:event.program[0].rulesVersion,
   frozen:event.frozenTasks.map(t=>({id:t.taskId,sourceId:t.sourceContentId,hash:t.sourceHash}))};
 });
 expect(frozen.id).not.toBe(seed.eventId);
 expect(frozen.version).toBe('logikleiter-reviewed-v1');
 expect(frozen.frozen.map(t=>t.id)).toEqual(seed.ids);
 expect(frozen.frozen.every(t=>t.id===t.sourceId&&t.hash.length===64)).toBe(true);
});

test('U18 mobile planner rejects tampered approved source hashes with precise missing counts',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await seedActualOriginalLadder(page,{tamper:true});
 const finder=await setupApproved(page);
 await expect(finder.getByRole('alert')).toContainText('1 Freigaben');
 await expect(finder).toContainText('Kein vollständig freigegebenes Programm verfügbar');
 await page.getByRole('button',{name:/Logikleiter/}).click();
 await expect(finder.getByLabel('Aktuelle Programmauswahl')).toContainText('rungs: 2 / 3');
 await expect(finder.getByRole('button',{name:/Teams auswählen/})).toHaveCount(0);
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
 expect(dims.scroll).toBeLessThanOrEqual(dims.width+3);
});
