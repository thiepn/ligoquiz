import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence='test-results/u06-stage-evidence';
async function fits(page){
 return page.evaluate(()=>{
  const root=globalThis.document.documentElement,c=globalThis.document.querySelector('.stage-center');
  return {pageX:root.scrollWidth>globalThis.innerWidth+2,pageY:root.scrollHeight>globalThis.innerHeight+2,
   centerX:Boolean(c&&c.scrollWidth>c.clientWidth+3),centerY:Boolean(c&&c.scrollHeight>c.clientHeight+3)};
 });
}
test('U06 standby is public-only and fits 1280 projector',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/stage?event=isolated-stage-123');
 const stage=page.locator('.stage-preview');
 await expect(stage).toHaveAttribute('data-stage-phase','withheld');
 await expect(stage.locator('.sp-stage-phase')).toContainText('BÜHNE BEREIT');
 await expect(page.locator('.sp-shell,.rq-host,.exp-host-header')).toHaveCount(0);
 expect(await fits(page)).toEqual({pageX:false,pageY:false,centerX:false,centerY:false});
});
test('U06 original host explicitly publishes and reveals public scene',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator('.rq-host');
 await expect(host.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
 const href=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
 expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);
 const stagePage=await page.context().newPage();
 await stagePage.setViewportSize({width:1280,height:720});
 await stagePage.goto('http://127.0.0.1:4178/'+href);
 const stage=stagePage.locator('.stage-preview');
 await expect(stage).toHaveAttribute('data-stage-phase','withheld');
 await stagePage.screenshot({path:evidence+'/standby-1280.png'});
 await host.getByRole('button',{name:'Teams bestätigen'}).click();
 await host.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
 await expect(stage).toHaveAttribute('data-stage-phase','question');
 await expect(stagePage.locator('.stage-center')).toContainText('Wer führte Israel');
 await expect(stagePage.locator('.stage-center')).not.toContainText('Josua');
 expect(await fits(stagePage)).toEqual({pageX:false,pageY:false,centerX:false,centerY:false});
 await stagePage.screenshot({path:evidence+'/question-1280.png'});
 await host.getByRole('button',{name:'Antwortphase schließen'}).click();
 await expect(stagePage.locator('.stage-center')).not.toContainText('Josua');
 await host.getByRole('button',{name:'Lösung auf Beamer zeigen'}).click();
 await expect(stage).toHaveAttribute('data-stage-phase','reveal');
 await expect(stagePage.locator('.stage-center')).toContainText('Josua');
 expect(await fits(stagePage)).toEqual({pageX:false,pageY:false,centerX:false,centerY:false});
 await stagePage.screenshot({path:evidence+'/reveal-1280.png'});
 await stagePage.close();
});
test('U06 mobile public stage and reduced-motion keep width',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#/stage?event=isolated-stage-123');
 await expect(page.locator('.stage-preview')).toHaveAttribute('data-stage-phase','withheld');
 await expect(page.locator('.sp-stage-mark span')).toHaveCount(3);
 expect(await fits(page)).toEqual({pageX:false,pageY:false,centerX:false,centerY:false});
 const transform=await page.locator('.sp-stage-mark span').first().evaluate(el=>globalThis.getComputedStyle(el).transform);
 expect(transform).toBe('none');
});
