import {test,expect} from '@playwright/test';

async function startHost(page,mode='Rundenquiz'){
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(mode)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.locator('.sp-cockpit')).toBeVisible();
}

test('U11 optional compact cockpit saves space without replacing real host or stage links',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await startHost(page);
 const cockpit=page.locator('.sp-cockpit');
 const toggle=cockpit.getByRole('button',{name:'Kompaktansicht'});
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(cockpit.getByRole('heading',{name:'Punktestand'})).toBeVisible();
 const originalHeight=(await cockpit.boundingBox())?.height??0;
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await expect(cockpit).toHaveClass(/is-compact/);
 await expect(cockpit.getByRole('heading',{name:'Punktestand'})).toBeVisible();
 await expect(cockpit.getByText('ALS NÄCHSTES')).toBeVisible();
 const compactHeight=(await cockpit.boundingBox())?.height??0;
 expect(compactHeight).toBeLessThan(originalHeight-80);
 await expect(cockpit.getByRole('link',{name:/Öffentliches Beamerfenster öffnen/})).toHaveAttribute('rel',/noopener/);
 await cockpit.getByRole('button',{name:/Zur Originalsteuerung/}).click();
 await expect(page.locator('#sp-host-game')).toBeFocused();
 await page.getByRole('button',{name:'Teams bestätigen'}).click();
 await expect(page.getByRole('button',{name:'Frage veröffentlichen'})).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(cockpit).not.toHaveClass(/is-compact/);
});

for(const mode of ['Rundenquiz','Quiztafel','Verbindungen','Logikleiter','Umfrageduell']){
 test('U11 compact '+mode+' remains readable on narrow host without control loss',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await startHost(page,mode);
  const cockpit=page.locator('.sp-cockpit');
  await cockpit.getByRole('button',{name:'Kompaktansicht'}).click();
  await expect(cockpit).toHaveClass(/is-compact/);
  await expect(cockpit.getByRole('heading',{name:'Punktestand'})).toBeVisible();
  await expect(cockpit.getByRole('heading',{name:mode})).toBeVisible();
  await expect(cockpit.getByText('ÖFFENTLICHE AUSGABE')).toBeVisible();
  await expect(cockpit.getByRole('link',{name:/Öffentliches Beamerfenster öffnen/})).toHaveAttribute('href',/#\/stage\?event=/);
  const widths=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   content:document.documentElement.scrollWidth,
  }));
  expect(widths.content,mode+' overflow').toBeLessThanOrEqual(widths.viewport+3);
  await cockpit.getByRole('button',{name:/Zur Originalsteuerung/}).click();
  await expect(page.locator('#sp-host-game')).toBeFocused();
  await expect(page.locator('[data-host-game]')).toBeVisible();
 });
}
