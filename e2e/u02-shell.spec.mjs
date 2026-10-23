import {test,expect} from '@playwright/test';

test('desktop Studio Pop shell groups original views without losing deep links',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await page.goto('/#/spielen');
 const shell=page.locator('.sp-shell');
 await expect(shell).toHaveAttribute('data-lq-theme','studio-pop');
 await expect(page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('link',{name:'Spielwelt'})).toHaveAttribute('aria-current','page');
 await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('link',{name:'Backstage'}).click();
 await expect(page).toHaveURL(/#\/inhalte$/);
 await expect(page.getByRole('navigation',{name:'Backstage-Bereiche'}).getByRole('link',{name:'Inhaltsatelier'})).toHaveAttribute('aria-current','page');
 await page.getByRole('navigation',{name:'Backstage-Bereiche'}).getByRole('link',{name:'Einstellungen'}).click();
 await expect(page).toHaveURL(/#\/einstellungen$/);
 await expect(page.getByRole('heading',{name:'Einstellungen'})).toBeVisible();
 await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('link',{name:'Spielleitung'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(page.locator('.exp-host-header')).toBeVisible();
 await expect(page.getByText('Keine Spielleitung in diesem Fenster')).toBeVisible();
});

test('mobile menu and backstage navigation are keyboard and tap reachable',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/spielen');
 await expect(page.locator('.sp-shell-mainnav')).toBeHidden();
 const menu=page.locator('.sp-shell-mobile-menu');
 await menu.locator('summary').click();
 await expect(menu).toHaveAttribute('open','');
 await menu.getByRole('link',{name:/Backstage/}).first().click();
 await expect(page).toHaveURL(/#\/inhalte$/);
 await expect(page.locator('.sp-shell-mobile-menu')).not.toHaveAttribute('open','');
 await page.getByRole('navigation',{name:'Backstage-Bereiche'}).getByRole('link',{name:'Beamer & Technik'}).click();
 await expect(page).toHaveURL(/#\/technik$/);
 await expect(page.locator('.sp-shell')).toHaveAttribute('data-lq-theme','studio-pop');
 const headerOverflow=await page.locator('.sp-shell-header').evaluate(el=>el.scrollWidth>el.clientWidth);
 expect(headerOverflow).toBe(false);
});

test('public projector stays chrome-free and no host controls leak',async({page})=>{
 await page.goto('/#/stage?event=isolated-stage-123');
 await expect(page.locator('.stage-preview')).toBeVisible();
 await expect(page.locator('.sp-shell')).toHaveCount(0);
 await expect(page.locator('.sp-shell-header')).toHaveCount(0);
 await expect(page.locator('.exp-host-wrapper')).toHaveCount(0);
});
