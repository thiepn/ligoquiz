import {test,expect} from '@playwright/test';

test('U03 desktop lobby shows five real game types and selects using existing setup draft',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#/spielen');
 await expect(page.getByRole('heading',{name:'Spielen'})).toBeVisible();
 const gameCards=page.locator('.sp-lobby-game-grid button.sp-game-tile');
 await expect(gameCards).toHaveCount(5);
 await page.getByRole('button',{name:/Quiztafel auswählen/}).click();
 await expect(page).toHaveURL(/#\/setup$/);
 const draft=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('ligoquiz.v2.setup-draft.v1')||'null'));
 expect(draft.game).toBe('quiztafel');
 await expect(page.locator('.sp-shell')).toBeVisible();
});

test('U03 mobile lobby remains navigable without horizontal page overflow',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/spielen');
 await expect(page.getByRole('link',{name:/Neuen Quizabend vorbereiten/})).toBeVisible();
 await expect(page.locator('.sp-lobby-game-grid button.sp-game-tile')).toHaveCount(5);
 const overflow=await page.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.window.innerWidth);
 expect(overflow).toBe(false);
});

test('U03 selection does not silently override an advanced existing draft',async({page})=>{
 await page.goto('/#/spielen');
 await page.evaluate(()=>{
  globalThis.localStorage.setItem('ligoquiz.v2.setup-draft.v1',JSON.stringify({
   teams:['Alpha','Bravo','Charlie','Delta','Echo'],count:3,profile:'kurz',game:'rundenquiz',contentSource:'trial',step:2
  }));
 });
 await page.reload();
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:/Logikleiter auswählen/}).click();
 await expect(page).toHaveURL(/#\/spielen$/);
 const saved=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('ligoquiz.v2.setup-draft.v1')||'null'));
 expect(saved.game).toBe('rundenquiz');
 expect(saved.step).toBe(2);
});
