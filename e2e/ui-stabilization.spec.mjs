import {test,expect} from '@playwright/test';

const viewports = [320,390,768,1440];
const shots = 'test-results/ui-stabilization';

async function snapshot(page, width, view) {
 await page.screenshot({path:`${shots}/${width}-${view}.png`,fullPage:true,animations:'disabled'});
 const geometry = await page.evaluate(() => {
  const doc = document.documentElement;
  return {viewport:innerWidth,scroll:doc.scrollWidth};
 });
 expect(geometry.scroll, `${width}px ${view}: ${JSON.stringify(geometry)}`)
  .toBeLessThanOrEqual(geometry.viewport + 2);
}

for(const width of viewports){
 test(`UI stabilization: ${width}px navigation, setup, persistence and host`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto('/#/spielen');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await snapshot(page,width,'lobby');

  if(width<=760){
   const menu=page.locator('.sp-shell-mobile-menu');
   await menu.locator('summary').click();
   await expect(menu).toHaveAttribute('open','');
   const bounds=await page.evaluate(()=>{
    const m=document.querySelector('.sp-shell-mobile-menu>nav').getBoundingClientRect();
    const n=document.querySelector('.sp-shell-mobile-bottom').getBoundingClientRect();
    return {menuBottom:m.bottom,bottomNavTop:n.top};
   });
   expect(bounds.menuBottom,'Mobile menu must not sit under the fixed bottom navigation')
    .toBeLessThanOrEqual(bounds.bottomNavTop+2);
   await menu.getByRole('link',{name:/Backstage/}).first().click();
  }else{
   await page.getByRole('navigation',{name:'Hauptnavigation'})
    .getByRole('link',{name:/Backstage/}).click();
  }
  await expect(page).toHaveURL(/#\/inhalte$/);
  await snapshot(page,width,'content');
  await page.goto('/#/setup');
  await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
  // Setup no longer renders the old desktop sidebar; it must not reserve its column.
  const columns=await page.locator('.sp-prep-layout').evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/));
  expect(columns,'Unrendered setup sidebar must not reserve an empty track').toHaveLength(1);
  await snapshot(page,width,'teams');
  await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
  await page.getByRole('button',{name:'Weiter'}).click();
  await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
  await snapshot(page,width,'game-choice');
  if(width<=760){
   await page.evaluate(()=>scrollTo(0,0));
   const action=page.locator('.sp-prep-actions');
   const bounds=await action.boundingBox();
   expect(bounds).not.toBeNull();
   expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
  }
  await page.reload();
  await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
  await page.getByRole('button',{name:'Weiter'}).click();
  await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
  await snapshot(page,width,'ready');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
  await expect(page).toHaveURL(/#\/host$/);
  await expect(page.locator('#sp-host-game')).toBeVisible();
  await snapshot(page,width,'host');
  const identity=await page.evaluate(()=>sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  expect(identity).toBeTruthy();
  await page.reload();
  await expect(page.locator('#sp-host-game')).toBeVisible();
  expect(await page.evaluate(()=>sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'))).toBe(identity);
  await expect(page.locator('.sp-cockpit-quick-stage')).toHaveAttribute('target','_blank');
  await snapshot(page,width,'resumed-host');
 });
}
