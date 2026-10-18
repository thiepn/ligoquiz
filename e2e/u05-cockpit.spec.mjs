import {test,expect} from '@playwright/test';

async function prepareHost(page){
 await page.goto('/#/setup');
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
 await page.getByRole('textbox',{name:'Team 2'}).fill('Mitte');
 await page.getByRole('textbox',{name:'Team 3'}).fill('Süd');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(page.locator('.sp-cockpit')).toBeVisible();
}

test('U05 original game scores, safe public projector link and host commands',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await prepareHost(page);
 const cockpit=page.locator('.sp-cockpit');
 await expect(cockpit).toHaveAttribute('data-cockpit-game','rundenquiz');
 await expect(cockpit.getByRole('heading',{name:'Punktestand'})).toBeVisible();
 await expect(cockpit).toContainText('Nord');
 await expect(cockpit).toContainText('Mitte');
 await expect(cockpit).toContainText('Süd');
 const stage=cockpit.getByRole('link',{name:/Öffentliches Beamerfenster öffnen/});
 await expect(stage).toHaveAttribute('href',/#\/stage\?event=/);
 await expect(stage).toHaveAttribute('target','_blank');
 await expect(stage).toHaveAttribute('rel',/noopener/);
 await cockpit.getByRole('link',{name:/Zur Originalsteuerung/}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(page.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
 await page.getByRole('button',{name:'Teams bestätigen'}).click();
 await expect(cockpit.getByText('Frage veröffentlichen')).toBeVisible({timeout:12000});
});

test('U05 unauthorized host identity never reveals stale score or controls',async({page})=>{
 await prepareHost(page);
 await page.evaluate(()=>{
  const key='ligoquiz.v2.g4.rundenquiz.host';
  const original=JSON.parse(globalThis.sessionStorage.getItem(key));
  original.hostId='forged-host-id-1234';
  globalThis.sessionStorage.setItem(key,JSON.stringify(original));
 });
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('anderen Sitzung');
 await expect(page.locator('.sp-cockpit')).toHaveCount(0);
 await expect(page.locator('[data-host-game]')).toHaveCount(0);
});

test('U05 mobile cockpit fits viewport and preserves original game controls',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await prepareHost(page);
 await expect(page.locator('.sp-cockpit-scores-grid .sp-score-chip')).toHaveCount(4);
 await expect(page.locator('.rq-scoreboard')).toBeVisible();
 const overflow=await page.evaluate(()=>globalThis.document.documentElement.scrollWidth>globalThis.innerWidth);
 expect(overflow).toBe(false);
 await expect(page.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
});
