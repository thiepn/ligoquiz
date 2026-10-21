import {test,expect} from '@playwright/test';

async function seedReviewedRundenquiz(page){
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('combobox',{name:'Umfang'}).selectOption('standard');
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
 const source=await page.evaluate(async eventId=>{
  const open=name=>new Promise((resolve,reject)=>{
   const r=globalThis.indexedDB.open(name);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const db=await open('ligoquiz.v2.sessions');
  const original=await new Promise((resolve,reject)=>{
   const r=db.transaction('events','readonly').objectStore('events').get(eventId);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  db.close();
  if(original?.rundenquiz?.questions.length!==11)throw Error('Original Standard round bank not available');
  const records=await open('ligoquiz.v2.content.g10');
  const qs=original.rundenquiz.questions,groups={wissen:[],hinweise:[],schaetzen:[],finale:[]};
  for(const payload of qs){
   groups[payload.round].push(payload.id);
   const bytes=new globalThis.TextEncoder().encode(JSON.stringify(payload));
   const fingerprint=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
   const at=Date.now();
   const item={id:payload.id,game:'rundenquiz',payload,status:'approved',createdAt:at,updatedAt:at,revision:1,
    provenance:{origin:'manual'},
    review:{reviewer:'Synthetic browser fixture',checkedAt:at,
     note:'Test-only editorial receipt; no actual rights review',
     checklist:[true,true,true,true],fingerprint},
    audit:[{revision:1,at,action:'TEST',note:'Disposable isolated test browser only'}]};
   await new Promise((resolve,reject)=>{
    const tx=records.transaction('entries','readwrite');
    tx.objectStore('entries').put(item);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
  }
  records.close();
  return {groups,eventId};
 },id);
 return source;
}
async function setupReviewed(page){
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('radio',{name:/Redaktionell freigegebene Inhaltsbibliothek/}).check();
 const selector=page.getByRole('region',{name:'Rundenquiz Fragen zusammenstellen'});
 await expect(selector).toBeVisible();
 await expect(selector.getByRole('button',{name:'Fragen selbst auswählen'})).toBeEnabled();
 return selector;
}
async function chooseLastByRound(lineup){
 await lineup.getByRole('button',{name:'Fragen selbst auswählen'}).click();
 const groups=lineup.locator('.u19-lineup-round');
 const amounts=[3,2,2,0];
 const selected=[];
 for(let i=0;i<amounts.length;i++){
  const boxes=groups.nth(i).getByRole('checkbox');
  const count=await boxes.count();
  if(amounts[i]===0)continue;
  expect(count).toBeGreaterThanOrEqual(amounts[i]);
  for(let j=count-amounts[i];j<count;j++){
   await boxes.nth(j).check();
   selected.push({round:i,index:j});
  }
 }
 await expect(lineup.locator('.u19-lineup-status')).toHaveAttribute('data-lineup-valid','true');
 return selected;
}

test('U19 custom original SHA-approved lineup survives reload and freezes exactly chosen 7 task IDs',async({page})=>{
 const source=await seedReviewedRundenquiz(page);
 const lineup=await setupReviewed(page);
 const selected=await chooseLastByRound(lineup);
 expect(selected).toHaveLength(7);
 const expected=['wissen','hinweise','schaetzen'].flatMap((round,i)=>
  source.groups[round].slice(-[3,2,2][i]));
 expect(expected).toHaveLength(7);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 const refreshed=page.getByRole('region',{name:'Rundenquiz Fragen zusammenstellen'});
 await expect(refreshed.locator('.u19-lineup-status')).toHaveAttribute('data-lineup-valid','true');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const result=await page.evaluate(async()=>{
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
  return {id:event.id,rulesVersion:event.program[0].rulesVersion,
   questionIds:event.rundenquiz.questions.map(x=>x.id),
   frozen:event.frozenTasks.map(x=>({id:x.taskId,sourceId:x.sourceContentId,hash:x.sourceHash}))};
 });
 expect(result.id).not.toBe(source.eventId);
 expect(result.rulesVersion).toBe('rundenquiz-reviewed-v1');
 expect(result.questionIds).toEqual(expected);
 expect(result.frozen.map(x=>x.id)).toEqual(expected);
 expect(result.frozen.every(x=>x.id===x.sourceId&&x.hash.length===64)).toBe(true);
});

test('U19 rejects missing manual round picks before setup advances and remains reversible',async({page})=>{
 await seedReviewedRundenquiz(page);
 const lineup=await setupReviewed(page);
 await lineup.getByRole('button',{name:'Fragen selbst auswählen'}).click();
 await expect(lineup.locator('.u19-lineup-status')).toHaveAttribute('data-lineup-valid','false');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('alert')).toContainText('alle Fragen je Runde');
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await lineup.getByRole('button',{name:'Automatische Originalauswahl'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
});
test('U19 mobile 375px retains manual source choice and prevents edited approval at final host freeze',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const source=await seedReviewedRundenquiz(page);
 const lineup=await setupReviewed(page);
 await chooseLastByRound(lineup);
 await page.evaluate(async id=>{
  const db=await new Promise((resolve,reject)=>{
   const r=globalThis.indexedDB.open('ligoquiz.v2.content.g10');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const task=await new Promise((resolve,reject)=>{
   const r=db.transaction('entries','readonly').objectStore('entries').get(id);
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  task.payload={...task.payload,reference:'Unreviewed changed source'};
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('entries','readwrite');
   tx.objectStore('entries').put(task);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
 },source.groups.wissen.at(-1));
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/setup$/);
 await expect(page.getByRole('alert')).toContainText('Inhalt wurde seit der Freigabe geändert');
 const size=await page.evaluate(()=>({width:globalThis.innerWidth,scroll:globalThis.document.documentElement.scrollWidth}));
 expect(size.scroll).toBeLessThanOrEqual(size.width+3);
});
