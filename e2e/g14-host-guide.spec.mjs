import {test,expect} from '@playwright/test';

const games=[
 {name:'Rundenquiz',root:'.rq-host',start:'Teams bestätigen'},
 {name:'Quiztafel',root:'.qt-host',start:'Quiztafel auf dem Beamer vorbereiten'},
 {name:'Verbindungen',root:'.vb-host',start:'Aufgabenreihenfolge bestätigen'},
 {name:'Logikleiter',root:'.ll-host',start:'Stufenfolge bestätigen'},
 {name:'Umfrageduell',root:'.ud-host',start:'Aufgabenfolge bestätigen'},
];
for(const game of games){
 test(`G14 keyboard guide focuses (never activates) ${game.name} moderator action`,async({page})=>{
  await page.goto('/#/setup');
  await page.getByRole('button',{name:'Weiter'}).click();
  if(game.name!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(game.name)}).click();
  await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
  const host=page.locator(game.root);
  const panel=host.getByRole('region',{name:'Moderationsübersicht'});
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Wertung offen');
  await expect(panel.locator('.g14-connect strong')).toHaveText('0');
  await expect(panel.locator('.g14-connect')).toHaveAttribute('aria-atomic','true');
  await expect(panel.locator('.g14-connect')).toHaveAttribute('aria-live','polite');
  await expect(panel.locator('.g14-connect span')).toHaveText('Kein Beamerfenster bestätigt');
  const primary=host.getByRole('button',{name:game.start});
  await expect(primary).toBeEnabled();
  await page.keyboard.press('Alt+Shift+N');
  await expect(primary).toBeFocused();
  // The shortcut must not run a transaction or reveal any question.
  await expect(primary).toBeVisible();
  await expect(panel).toContainText('Antwort verborgen');
  await host.getByRole('button',{name:/Nächste Aktion fokussieren/}).click();
  await expect(primary).toBeFocused();
  await primary.click();
  await expect(panel).not.toContainText('Wertung abgeschlossen');
  // At 200% CSS scale, panel controls remain reachable in a small moderator viewport.
  await page.setViewportSize({width:640,height:800});
  await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
  await expect(panel).toBeVisible();
  await expect(host.getByRole('button',{name:/Nächste Aktion fokussieren/})).toBeVisible();
 });
}

test('G32 original host announces genuine connected projector and never assumes viewer from launch link',async({page})=>{
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator('.rq-host');
 const indicator=host.getByRole('region',{name:'Moderationsübersicht'}).locator('.g14-connect[aria-live="polite"]');
 await expect(indicator).toContainText('Kein Beamerfenster bestätigt');
 const link=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
 expect(link).toMatch(/^#\/stage\?event=[\w-]+$/);
 const stage=await page.context().newPage();
 await stage.goto('http://127.0.0.1:4178/'+link);
 await expect(indicator.locator('strong')).toHaveText('1',{timeout:12000});
 await expect(indicator.locator('span')).toHaveText('Beamerfenster bestätigt');
 await expect(host.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
 await stage.close();
});
