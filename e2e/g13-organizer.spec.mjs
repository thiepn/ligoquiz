import {test,expect} from '@playwright/test';

async function createDraft(page,team){
 await page.goto('/#/setup');
 await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('textbox',{name:'Team 1'}).fill(team);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
}
test('organizer searches all saved sessions and supports clearing an empty result',async({page})=>{
 await createDraft(page,'Nordgruppe');
 await createDraft(page,'Suedgruppe');
 await page.goto('/#/spielen');
 const search=page.getByRole('searchbox',{name:'Spielstände durchsuchen'});
 await expect(search).toBeVisible();
 await expect(page.locator('.sp-lobby-search [aria-live="polite"]')).toHaveText('2 von 2');
 await search.fill('Nordgruppe');
 await expect(page.locator('.sp-lobby-search [aria-live="polite"]')).toHaveText('1 von 2');
 await expect(page.locator('.sp-lobby-featured')).toContainText('Nordgruppe');
 await expect(page.locator('.sp-lobby-session-row')).toHaveCount(0);
 await search.fill('Unbekannte Mannschaft');
 await expect(page.getByRole('status')).toContainText('Keine passenden Spielstände');
 await search.fill('');
 await expect(page.locator('.sp-lobby-featured')).toBeVisible();
 await expect(page.locator('.sp-lobby-session-row')).toHaveCount(1);
});
