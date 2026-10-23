import {test,expect} from '@playwright/test';
const modes=['Rundenquiz','Quiztafel','Verbindungen','Logikleiter','Umfrageduell'];
for(const name of modes){
 test('U10 200-percent zoom keeps complete '+name+' cockpit game title inside its frame',async({page})=>{
  await page.setViewportSize({width:640,height:800});
  await page.goto('/#/setup');
  await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
  await page.getByRole('button',{name:'Weiter'}).click();
  if(name!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(name)}).click();
  await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
  await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
  const heading=page.locator('.sp-cockpit-hero h2');
  await expect(heading).toContainText(name);
  const metrics=await heading.evaluate(el=>({
   content:el.scrollWidth,visible:el.clientWidth,
   frame:el.closest('.sp-cockpit-hero')?.clientWidth??0,
  }));
  expect(metrics.content,name+' heading clipped by its own layout').toBeLessThanOrEqual(metrics.visible+2);
  expect(metrics.visible).toBeLessThanOrEqual(metrics.frame+2);
  await expect(page.locator('.sp-cockpit-actions .sp-cockpit-stage')).toHaveAttribute('rel',/noopener/);
 });
}
