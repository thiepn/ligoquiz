import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const output='test-results/ui-copy-evidence';
async function fit(page,screen){
 const widths=await page.evaluate(()=>({viewport:globalThis.document.documentElement.clientWidth,content:globalThis.document.documentElement.scrollWidth}));
 expect(widths.content,screen+' horizontal document overflow').toBeLessThanOrEqual(widths.viewport+3);
}
async function screenshot(page,name){
 await mkdir(output,{recursive:true});
 await page.screenshot({path:output+'/'+name+'.png',fullPage:name.startsWith('desktop')||name==='mobile-setup-program',animations:'disabled'});
}
async function setup(page){
 await page.goto('/#/setup');
 await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
}
test('desktop organizer and mobile lobby contain actions, data and no decorative subtitles',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/#/spielen');
 await expect(page.getByRole('heading',{name:'Spielen'})).toBeVisible();
 await expect(page.locator('.sp-shell-region,.sp-shell-footer,.sp-lobby-eyebrow,.sp-lobby-poster-caption')).toHaveCount(0);
 await expect(page.locator('.sp-lobby-game-grid button')).toHaveCount(5);
 await expect(page.locator('.sp-game-kicker,.sp-game-select')).toHaveCount(0);
 await expect(page.getByRole('link',{name:/Neuen Quizabend vorbereiten/})).toBeVisible();
 await fit(page,'desktop organizer');
 await screenshot(page,'desktop-organizer');
 await page.setViewportSize({width:375,height:812});
 await fit(page,'mobile organizer');
 const menu=page.locator('.sp-shell-mobile-menu');
 await menu.locator('summary').click();
 await expect(menu).toHaveAttribute('open','');
 await expect(menu.getByRole('link',{name:'Einstellungen'})).toBeVisible();
 await screenshot(page,'mobile-organizer-menu');
});
test('setup uses actual inputs and source consent without redundant duplicated preview',async({page})=>{
 await page.setViewportSize({width:1366,height:850});
 await setup(page);
 await expect(page.locator('.sp-prep-aside,.sp-prep-profile-note,.sp-prep-kicker')).toHaveCount(0);
 await expect(page.locator('.sp-prep-local')).toContainText('NOCH NICHT LIVE');
 const textSize=await page.locator('.sp-prep-local').evaluate(e=>Number.parseFloat(globalThis.getComputedStyle(e).fontSize));
 expect(textSize).toBeGreaterThanOrEqual(14);
 await fit(page,'desktop setup');
 await screenshot(page,'desktop-setup-teams');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
 await expect(page.getByRole('radio',{name:/Probeprogramm/})).toBeChecked();
 await page.setViewportSize({width:375,height:812});
 await fit(page,'mobile setup');
 await screenshot(page,'mobile-setup-program');
 await page.getByRole('button',{name:'Weiter'}).click();
 await expect(page.getByRole('checkbox')).toHaveCount(1);
 await expect(page.locator('.sp-prep-safety')).toContainText('Beamer-Sicherheit');
 await fit(page,'mobile setup acknowledgement');
});
test('private host, backstage, technical and recovery screens preserve functional states on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await setup(page);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.locator('.sp-cockpit')).toBeVisible();
 // The base branch may show a functional next-action rail; only reject ornamental captions.
 await expect(page.locator('.sp-cockpit-overline,.g14-eyebrow')).toHaveCount(0);
 const nextAction=page.locator('.u07-rail-next');
 if(await nextAction.count())await expect(nextAction).toContainText('Als Nächstes:');
 await expect(page.locator('.sp-cockpit-scores-grid .sp-score-chip')).toHaveCount(4);
 await expect(page.locator('.sp-cockpit-private-note')).toContainText('nicht auf den Beamer spiegeln');
 await fit(page,'mobile host');
 await screenshot(page,'mobile-host');
 await page.goto('/#/spielen');
 await expect(page.locator('.sp-backstage-desk')).toBeVisible();
 await expect(page.locator('.sp-backstage-workflow')).toHaveCount(4);
 await expect(page.locator('.sp-backstage-privacy')).toContainText('Kein Cloud-Sync');
 await fit(page,'mobile backstage');
 await screenshot(page,'mobile-backstage');
 await page.goto('/#/technik');
 await expect(page.locator('.u10-tech-navigation')).toBeVisible();
 await expect(page.locator('.u10-tech-navigation-title')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'G26 Lesende Cutover- und Rückweg-Vorprüfung'})).toContainText('NO-GO');
 await fit(page,'mobile technical checks');
 await screenshot(page,'mobile-technical-checks');
 await page.goto('/#/einstellungen');
 await expect(page.getByRole('region',{name:'Sicherung und Wiederherstellung'})).toBeVisible();
 await fit(page,'mobile backup');
});
test('mobile five-game copy retains host phase ownership and public stage status',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await setup(page);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.locator('.rq-status')).toHaveCount(0);
 await expect(page.locator('.u07-phase-rail')).toBeVisible();
 await expect(page.getByRole('region',{name:'Moderationsübersicht'})).toBeVisible();
 await expect(page.locator('.sp-cockpit-private-note')).toContainText('nicht auf den Beamer spiegeln');
 await page.goto('/#/stage');
 await expect(page.locator('.stage-topline')).toBeVisible();
 await expect(page.locator('.stage-topline')).not.toContainText('LIGOQUIZ · BEAMER');
 await expect(page.locator('.stage-bottom')).toBeVisible();
 await fit(page,'public stage');
});
