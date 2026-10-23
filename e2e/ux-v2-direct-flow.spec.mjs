import {test,expect} from '@playwright/test';

async function completeOriginalSetup(page){
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(page.locator('.sp-cockpit')).toBeVisible();
}

test('UX game choice from lobby has one obvious selected game and preserves editable team setup',async({page})=>{
 await page.setViewportSize({width:1280,height:850});
 await page.goto('/#/spielen');
 await page.getByRole('button',{name:/Quiztafel auswählen/}).click();
 await expect(page).toHaveURL(/#\/setup$/);
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.locator('.sp-prep-game')).toHaveCount(1);
 await expect(page.getByRole('button',{name:/Quiztafel/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Anderes Spiel wählen'})).toBeVisible();
 await page.reload();
 await expect(page.locator('.sp-prep-game')).toHaveCount(1);
 await page.getByRole('button',{name:'Anderes Spiel wählen'}).click();
 await expect(page.locator('.sp-prep-game')).toHaveCount(5);
 await page.getByRole('button',{name:/Logikleiter/}).click();
 await expect(page.getByRole('button',{name:/Logikleiter/})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Schritt 1: Teams'}).click();
 await expect(page.getByRole('textbox',{name:'Team 1'})).toHaveValue('Nord');
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('button',{name:/Logikleiter/})).toHaveAttribute('aria-pressed','true');
});

test('UX mobile setup exposes persistent next action and prevents bypassing validation',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/setup');
 const focused=page.getByRole('navigation',{name:'Vorbereitung',exact:true});
 await expect(focused).toContainText('Quizabend vorbereiten');
 await expect(page.getByRole('navigation',{name:'Mobile Schnellnavigation'})).toHaveCount(0);
 const next=page.getByRole('button',{name:'Weiter'});
 await expect(next).toBeVisible();
 await expect(page.getByRole('button',{name:'Schritt 3: Bereit'})).toBeDisabled();
 await page.getByRole('textbox',{name:'Team 2'}).fill('Team 1');
 await next.click();
 await expect(page.getByRole('alert')).toContainText('eindeutigen Namen');
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('textbox',{name:'Team 2'}).fill('Bravo');
 await next.click();
 await expect(page.locator('.sp-prep-game')).toHaveCount(5);
 await page.evaluate(()=>globalThis.scrollTo(0,0));
 const nextBox=await next.boundingBox();
 expect(nextBox).not.toBeNull();
 expect(nextBox.y+nextBox.height).toBeLessThanOrEqual(750);
 expect(nextBox.y).toBeGreaterThanOrEqual(0);
 await next.click();
 await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Schritt 2: Programm'})).toBeEnabled();
 await page.getByRole('button',{name:'Schritt 2: Programm'}).click();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 const widths=await page.evaluate(()=>({
  doc:globalThis.document.documentElement.scrollWidth,width:globalThis.innerWidth,
  context:globalThis.document.querySelector('.sp-shell-context')?.getBoundingClientRect().width,
 }));
 expect(widths.doc).toBeLessThanOrEqual(widths.width+3);
 expect(widths.context).toBeLessThanOrEqual(widths.width);
});

test('UX host shows real controls before overview and keeps a verified quick projector action',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await completeOriginalSetup(page);
 const direct=page.locator('#sp-host-game'),overview=page.locator('.sp-cockpit');
 const top=await direct.boundingBox(),below=await overview.boundingBox();
 expect(top).not.toBeNull();expect(below).not.toBeNull();
 expect(top.y).toBeLessThan(below.y);
 expect(top.y).toBeLessThan(350);
 const quick=page.locator('.sp-cockpit-topline .sp-cockpit-quick-stage');
 await expect(quick).toHaveAttribute('href',/#\/stage\?event=/);
 await expect(quick).toHaveAttribute('target','_blank');
 await expect(quick).toHaveAttribute('rel',/noopener/);
 await expect(page.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
 await expect(overview.getByRole('heading',{name:'Punktestand'})).toBeVisible();
 await expect(overview.getByRole('link',{name:/Öffentliches Beamerfenster öffnen/})).toBeVisible();
 const context=page.getByRole('navigation',{name:'Aktuelle Spielleitung'});
 await expect(context).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Mobile Schnellnavigation'})).toHaveCount(0);
 await context.getByRole('link',{name:/Spiele/}).click();
 await expect(page).toHaveURL(/#\/spielen$/);
 await page.getByRole('navigation',{name:'Mobile Schnellnavigation'}).getByRole('link',{name:'Inhalte'}).click();
 await expect(page).toHaveURL(/#\/inhalte$/);
});

test('UX return to a verified original session appears first without creating another event',async({page})=>{
 await completeOriginalSetup(page);
 const identity=await page.evaluate(()=>JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host')));
 await page.goto('/#/spielen');
 const primary=page.locator('.sp-lobby-actions>.exp-primary');
 await expect(primary).toHaveCount(1);
 await expect(primary).toContainText('fortsetzen');
 await primary.click();
 await expect(page).toHaveURL(/#\/host$/);
 const resumed=await page.evaluate(()=>JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host')));
 expect(resumed).toEqual(identity);
 const events=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{
   const request=globalThis.indexedDB.open('ligoquiz.v2.sessions');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const count=await new Promise((resolve,reject)=>{
   const request=db.transaction('events','readonly').objectStore('events').count();
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  db.close();
  return count;
 });
 expect(events).toBe(1);
});

test('UX forged host identity still cannot expose game controls or a public stage launcher',async({page})=>{
 await completeOriginalSetup(page);
 await page.evaluate(()=>{
  const key='ligoquiz.v2.g4.rundenquiz.host';
  const stored=JSON.parse(globalThis.sessionStorage.getItem(key));
  stored.hostId='unrecognized-host-id-123456';
  globalThis.sessionStorage.setItem(key,JSON.stringify(stored));
 });
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('anderen Sitzung');
 await expect(page.locator('#sp-host-game')).toHaveCount(0);
 await expect(page.locator('.sp-cockpit-quick-stage')).toHaveCount(0);
 await expect(page.locator('.sp-cockpit')).toHaveCount(0);
});
