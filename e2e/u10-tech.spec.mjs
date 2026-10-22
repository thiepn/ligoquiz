import {test,expect} from '@playwright/test';
const desktop=(page)=>page.getByRole('navigation',{name:'Regie Arbeitsablauf'});
test('U10 technical workflow navigates real checks without replacing or hiding original controls',async({page})=>{
 await page.goto('/#/technik');
 const nav=desktop(page);
 await expect(nav.getByRole('button')).toHaveCount(3);
 await nav.getByRole('button',{name:/Offline-Start/}).click();
 await expect(page.locator('#u10-offline-check')).toBeFocused();
 await expect(page.getByRole('button',{name:'Offline-Vorprüfung erneut ausführen'})).toBeVisible();
 await nav.getByRole('button',{name:/Beamerprobe/}).click();
 await expect(page.locator('#u10-projector-check')).toBeFocused();
 await expect(page.getByRole('region',{name:'Beamer-Techniktest'})).toBeVisible();
 await nav.getByRole('button',{name:/Originalnachweise/}).click();
 await expect(page.locator('#u10-g26-evidence')).toBeFocused();
 const original=page.getByRole('region',{name:'G26 Lesende Cutover- und Rückweg-Vorprüfung'});
 await expect(original).toBeVisible();
 await expect(original).toContainText('NO-GO · NICHT VERÖFFENTLICHEN');
 await expect(page).toHaveURL(/#\/technik$/);
});
test('U10 backstage handoffs are native and do not implicitly start or take over a session',async({page})=>{
 await page.goto('/#/technik');
 await expect(desktop(page).getByRole('link',{name:/Backup exportieren/})).toHaveAttribute('href','#/einstellungen');
 await expect(desktop(page).getByRole('link',{name:/Spielabend fortsetzen/})).toHaveAttribute('href','#/spielen');
 await expect(desktop(page).getByRole('link',{name:/Abendberichte/})).toHaveAttribute('href','#/verlauf');
 await desktop(page).getByRole('link',{name:/Backup exportieren/}).click();
 await expect(page).toHaveURL(/#\/einstellungen$/);
 await expect(page.getByRole('region',{name:'Sicherung und Wiederherstellung'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Vollständiges Sitzungsbackup exportieren'})).toBeDisabled();
});
test('U10 tech on mobile retains jump targets, no overflow and reduced motion',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#/technik');
 await expect(desktop(page).getByRole('button')).toHaveCount(3);
 await desktop(page).getByRole('button',{name:/Originalnachweise/}).click();
 await expect(page.locator('#u10-g26-evidence')).toBeFocused();
 const widths=await page.evaluate(()=>({
  viewport:globalThis.document.documentElement.clientWidth,
  content:globalThis.document.documentElement.scrollWidth,
 }));
 expect(widths.content).toBeLessThanOrEqual(widths.viewport+2);
 await expect(page.getByRole('region',{name:'G26 Lesende Cutover- und Rückweg-Vorprüfung'})).toContainText('NO-GO');
});
