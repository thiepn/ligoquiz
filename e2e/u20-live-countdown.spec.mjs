import {test,expect} from '@playwright/test';

const games=[
 {name:'Quiztafel',host:'.qt-host',clock:'.u07-qt-clock',setup:'Quiztafel auf dem Beamer vorbereiten',
  pause:'Spielleitung pausieren',resume:'Spiel ausdrücklich fortsetzen'},
 {name:'Verbindungen',host:'.vb-host',clock:'.u08-vb-timer',setup:'Aufgabenreihenfolge bestätigen',
  pause:'Pausieren',resume:'Spiel ausdrücklich fortsetzen'},
 {name:'Logikleiter',host:'.ll-host',clock:'.u08-ll-clock',setup:'Stufenfolge bestätigen',
  pause:'Pausieren',resume:'Spiel ausdrücklich fortsetzen'},
 {name:'Umfrageduell',host:'.ud-host',clock:'.u09-clock',setup:'Aufgabenfolge bestätigen',
  pause:'Pausieren',resume:'Spiel ausdrücklich fortsetzen'},
];
async function prepare(page,game){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:new RegExp(game.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator(game.host);
 await expect(host).toBeVisible();
 await host.getByRole('button',{name:game.setup}).click();
 if(game.name==='Quiztafel'){
  await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'}).click();
 }else await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(host.locator(game.clock)).toBeVisible();
 return host;
}
async function seconds(host,selector){
 const label=await host.locator(selector).locator('strong').first().textContent();
 const n=Number(label?.trim().replace(/\s*s$/,''));
 expect(Number.isFinite(n)).toBe(true);
 return n;
}
for(const game of games){
 test('U20 '+game.name+' pauses at earned remaining seconds and only a manual restart resumes',async({page})=>{
  const host=await prepare(page,game);
  const clock=host.locator(game.clock);
  const initial=await seconds(host,game.clock);
  await clock.getByRole('button',{name:'Start'}).click();
  await expect.poll(()=>seconds(host,game.clock),{timeout:7000}).toBeLessThan(initial);
  await host.getByRole('button',{name:game.pause,exact:true}).click();
  const paused=await seconds(host,game.clock);
  expect(paused).toBeLessThan(initial);
  await expect(clock.getByRole('button',{name:'Start'})).toBeDisabled();
  await host.getByRole('button',{name:game.resume}).click();
  await expect(clock).toBeVisible();
  const resumed=await seconds(host,game.clock);
  expect(resumed).toBe(paused);
  await page.waitForTimeout(1200);
  expect(await seconds(host,game.clock)).toBe(resumed);
  await clock.getByRole('button',{name:'Start'}).click();
  await expect.poll(()=>seconds(host,game.clock),{timeout:6000}).toBeLessThan(resumed);
  await clock.getByRole('button',{name:'Stopp'}).click();
  const stopped=await seconds(host,game.clock);
  await page.waitForTimeout(1150);
  expect(await seconds(host,game.clock)).toBe(stopped);
  await clock.getByRole('button',{name:'Zurücksetzen'}).click();
  expect(await seconds(host,game.clock)).toBe(initial);
 });
}
test('U20 Quiztafel first-answer to steal uses original independent 10-second window on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const game=games[0],host=await prepare(page,game);
 const clock=host.locator(game.clock);
 await expect(clock).toContainText('20 s');
 await clock.getByRole('button',{name:'Start'}).click();
 await expect.poll(()=>seconds(host,game.clock),{timeout:6500}).toBeLessThan(20);
 await host.getByRole('button',{name:'Erstantwort falsch'}).click();
 await host.getByRole('button',{name:'Übernahme anbieten'}).click();
 await expect(clock).toContainText('10 s');
 await clock.getByRole('button',{name:'Start'}).click();
 await expect.poll(()=>seconds(host,game.clock),{timeout:6500}).toBeLessThan(10);
 await host.getByRole('button',{name:game.pause}).click();
 await host.getByRole('button',{name:game.resume}).click();
 expect(await seconds(host,game.clock)).toBeLessThan(10);
 const dimensions=await page.evaluate(()=>({
  width:globalThis.innerWidth,scroll:globalThis.document.documentElement.scrollWidth,
 }));
 expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+3);
});
test('U20 Verbindungen new revealed clue still starts its original fresh timing window',async({page})=>{
 const game=games[1],host=await prepare(page,game);
 const clock=host.locator(game.clock);
 const before=await seconds(host,game.clock);
 await clock.getByRole('button',{name:'Start'}).click();
 await expect.poll(()=>seconds(host,game.clock),{timeout:7000}).toBeLessThan(before);
 await host.getByRole('button',{name:'Nächster Hinweis'}).click();
 expect(await seconds(host,game.clock)).toBe(before);
 await expect(clock.getByRole('button',{name:'Start'})).toBeEnabled();
});
