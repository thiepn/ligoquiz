import {test,expect} from '@playwright/test';
test('built service worker precaches install shell and loads offline after explicit reload',async({page,context})=>{
 await page.goto('/#/technik');
 await expect(page.getByRole('heading',{name:'Technikcheck'})).toBeVisible();
 const sw=await page.evaluate(async()=>{
  const ready=await navigator.serviceWorker.ready;
  await new Promise(resolve=>{
   if(ready.active?.state==='activated'){resolve();return;}
   ready.active?.addEventListener('statechange',()=>{if(ready.active?.state==='activated')resolve();});
  });
  return {scope:ready.scope,active:ready.active?.state};
 });
 expect(sw.active).toBe('activated');
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await page.getByRole('button',{name:'Offline-Vorprüfung erneut ausführen'}).click();
 await expect(page.getByRole('group',{name:'Gerätestatus'})).toContainText('Offline-Paket gespeichert');
 await context.setOffline(true);
 await page.goto('/#/spielen');
 await expect(page.getByRole('heading',{name:'Quizabend organisieren'})).toBeVisible();
 await page.goto('/#/technik');
 await expect(page.getByRole('heading',{name:'Offline-Start und Gerätebereitschaft'})).toBeVisible();
 await context.setOffline(false);
});
test('unapproved automatic updates never force an active client to reload',async({page})=>{
 await page.goto('/#/spielen');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 const active=await page.evaluate(async()=>navigator.serviceWorker.getRegistration());
 expect(active).toBeTruthy();
 // A normal build installs no waiting replacement and never auto-dispatches skipWaiting.
 const status=await page.evaluate(async()=>{
  const r=await navigator.serviceWorker.getRegistration();
  return {waiting:Boolean(r?.waiting),controller:Boolean(navigator.serviceWorker.controller)};
 });
 expect(status.waiting).toBe(false);
});
