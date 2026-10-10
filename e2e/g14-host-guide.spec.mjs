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
  await expect(panel).toContainText('0 Beamerfenster bestätigt');
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
