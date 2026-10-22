import {test,expect} from '@playwright/test';

async function prepare(page,label='Nord'){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('textbox',{name:'Team 1'}).fill(label);
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 return page.evaluate(()=>{
  const saved=JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  return saved;
 });
}
test('U10 organizer, original host, targeted backup and return continuity',async({page})=>{
 const identity=await prepare(page,'Nord');
 const cockpit=page.locator('.sp-cockpit');
 const backup=cockpit.getByRole('link',{name:'Originalsicherung'});
 await expect(backup).toHaveAttribute('href','#/einstellungen?backup='+identity.eventId);
 await backup.click();
 await expect(page).toHaveURL(/#\/einstellungen\?backup=/);
 await expect(page.getByRole('status')).toContainText('noch kein Export oder Wiederherstellung');
 const region=page.getByRole('region',{name:'Sicherung und Wiederherstellung'});
 const selection=region.getByRole('combobox',{name:'Gespeicherte Sitzung'});
 await expect(selection).toHaveValue(identity.eventId);
 await expect(region.getByRole('button',{name:'Vollständiges Sitzungsbackup exportieren'})).toBeEnabled();
 // Only the existing explicit button can produce a download; the link alone cannot.
 await page.goto('/#/spielen');
 await expect(page.locator('.sp-backstage-desk')).toBeVisible();
 await expect(page.locator('.sp-backstage-counters')).toContainText('1');
 await expect(page.locator('.sp-backstage-recent')).toContainText('Noch kein abgeschlossener Abend');
 await expect(page.locator('.sp-backstage-backup-link')).toHaveAttribute('href','#/einstellungen?backup='+identity.eventId);
 await page.locator('.sp-lobby-resume').getByRole('button',{name:'Vorbereitung fortsetzen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 await expect(cockpit).toContainText('Nord');
 const unchanged=await page.evaluate(()=>JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host')));
 expect(unchanged).toEqual(identity);
});

test('U10 unauthorized takeover dismissal never takes over or changes local host identity',async({page})=>{
 const older=await prepare(page,'Erste');
 const newer=await prepare(page,'Zweite');
 await page.goto('/#/spielen');
 await expect(page.locator('.sp-backstage-counters')).toContainText('2');
 const firstRow=page.locator('.sp-lobby-session-row').filter({hasText:'Erste'});
 await expect(firstRow).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());
 await firstRow.getByRole('button',{name:'Vorbereitung fortsetzen'}).click();
 await expect(page).toHaveURL(/#\/spielen$/);
 const actual=await page.evaluate(()=>JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host')));
 expect(actual.eventId).toBe(newer.eventId);
 expect(actual.hostId).toBe(newer.hostId);
 expect(actual.eventId).not.toBe(older.eventId);
 await firstRow.getByRole('link',{name:/Sichern/}).click();
 await expect(page).toHaveURL(new RegExp('backup='+older.eventId));
 const region=page.getByRole('region',{name:'Sicherung und Wiederherstellung'});
 await expect(region.getByRole('combobox',{name:'Gespeicherte Sitzung'})).toHaveValue(older.eventId);
});

test('U10 at 375px backstage, history and backup remain accessible without global overflow',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.emulateMedia({reducedMotion:'reduce'});
 const identity=await prepare(page,'Nord');
 for(const url of ['/#/spielen','/#/verlauf','/#/einstellungen?backup='+identity.eventId]){
  await page.goto(url);
  await expect(page.locator('.sp-shell')).toBeVisible();
  const measure=await page.evaluate(()=>({
   width:globalThis.document.documentElement.clientWidth,
   scroll:globalThis.document.documentElement.scrollWidth,
  }));
  expect(measure.scroll,'page overflow '+url).toBeLessThanOrEqual(measure.width+3);
 }
 await page.goto('/#/spielen');
 await expect(page.getByRole('link',{name:/Alle Berichte ansehen/})).toBeVisible();
 await expect(page.locator('.sp-backstage-workflow')).toHaveCount(4);
});
