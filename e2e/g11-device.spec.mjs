import {test,expect} from '@playwright/test';
test('preflight, backup controls and projector remain keyboard-reachable without mouse',async({page})=>{
 await page.goto('/#/technik');
 const check=page.getByRole('button',{name:'Offline-Vorprüfung erneut ausführen'});
 await expect(check).toBeVisible();
 await check.focus();
 expect(await check.evaluate(x=>x===globalThis.document.activeElement)).toBe(true);
 await page.keyboard.press('Enter');
 await expect(page.getByRole('group',{name:'Gerätestatus'})).toBeVisible();
 await page.goto('/#/einstellungen');
 await expect(page.getByRole('region',{name:'Sicherung und Wiederherstellung'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Vollständiges Sitzungsbackup exportieren'})).toBeDisabled();
 await expect(page.locator('input[type=file]')).toBeAttached();
});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1280,height:720}]){
 test('no horizontal overflow on organizer and tech at '+viewport.width+'×'+viewport.height,async({page})=>{
  await page.setViewportSize(viewport);
  for(const route of ['spielen','technik','einstellungen']){
   await page.goto('/#/'+route);
   await expect(page.locator('main')).toBeVisible();
   const width=await page.evaluate(()=>({
    screen:globalThis.document.documentElement.clientWidth,
    content:globalThis.document.documentElement.scrollWidth,
   }));
   expect(width.content).toBeLessThanOrEqual(width.screen+2);
  }
 });
}
test('projector protected pause and 200% text remains within 1280x720 viewport',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/stage?event=unrecognized-G11');
 await expect(page.getByRole('main',{name:'Beamer-Ansicht'})).toBeVisible();
 await expect(page.locator('.stage-preview')).toContainText('Warte auf');
 const initial=await page.evaluate(()=>globalThis.document.documentElement.scrollWidth);
 expect(initial).toBeLessThanOrEqual(1282);
 await page.evaluate(()=>{globalThis.document.documentElement.style.fontSize='32px';});
 await expect(page.locator('.stage-preview')).toBeVisible();
});
test('reduced motion eliminates transitions in critical shell',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#/technik');
 const transition=await page.locator('.g11-preflight').evaluate(el=>
  globalThis.getComputedStyle(el).transitionDuration);
 expect(transition).toMatch(/0s/);
});
