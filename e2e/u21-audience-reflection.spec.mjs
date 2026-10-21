import {test,expect} from '@playwright/test';

const games=[
 {name:'Rundenquiz',root:'.rq-host',begin:'Teams bestätigen',publish:'Frage auf Beamer zeigen',answer:'Josua'},
 {name:'Quiztafel',root:'.qt-host',begin:'Quiztafel auf dem Beamer vorbereiten',
  publish:'Frage ausdrücklich veröffentlichen',answer:'Noah'},
 {name:'Verbindungen',root:'.vb-host',begin:'Aufgabenreihenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',answer:'David'},
 {name:'Logikleiter',root:'.ll-host',begin:'Stufenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',answer:'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.'},
 {name:'Umfrageduell',root:'.ud-host',begin:'Aufgabenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',answer:'Notizblock'},
];

async function createHost(page,game){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(game.name!=='Rundenquiz')await page.getByRole('button',{name:new RegExp(game.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator(game.root);
 await expect(host.getByRole('button',{name:game.begin})).toBeEnabled();
 return host;
}
async function reveal(host,game){
 if(game.name==='Rundenquiz'){
  await host.getByRole('button',{name:'Antwortphase schließen'}).click();
  await host.getByRole('button',{name:'Lösung auf Beamer zeigen'}).click();
 }else if(game.name==='Quiztafel'){
  await host.getByRole('button',{name:'Erstantwort richtig'}).click();
  await host.getByRole('button',{name:'Lösung ausdrücklich zeigen'}).click();
 }else if(game.name==='Verbindungen'){
  await host.getByRole('button',{name:'Richtige Antwort'}).click();
  await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 }else if(game.name==='Logikleiter'){
  await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
  await host.getByRole('button',{name:'Lösung und Begründung veröffentlichen'}).click();
 }else{
  await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
  for(let i=0;i<3;i++){
   const team=host.locator('.ud-team').nth(i);
   if(i===0)await team.getByRole('textbox',{name:'Antwort 1'}).fill('Snacks');
   await team.getByRole('button',{name:'Antwort erfassen'}).click();
  }
  await host.getByRole('button',{name:'Kategorien und Rangfolge veröffentlichen'}).click();
 }
}
for(const game of games){
 test('U21 '+game.name+' manually compares a locked same-browser guess only after original public reveal',async({page})=>{
  const host=await createHost(page,game);
  const href=await page.locator('.sp-cockpit-playalong').getAttribute('href');
  const spectator=await page.context().newPage();
  await spectator.setViewportSize({width:390,height:844});
  await spectator.goto('http://127.0.0.1:4178/'+href);
  await host.getByRole('button',{name:game.begin}).click();
  if(game.name==='Quiztafel')await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:game.publish}).click();
  const view=spectator.locator('.u14-playalong');
  await expect(view).toHaveAttribute('data-audience-phase','question');
  await expect(view.getByRole('region',{name:'Eigene Antwort selbst vergleichen'})).toHaveCount(0);
  await spectator.getByRole('textbox',{name:'Eigene Antwort'}).fill('Mein privater Tipp');
  await spectator.getByRole('button',{name:'Tipp festhalten'}).click();
  await expect(view.getByRole('region',{name:'Eigene Antwort selbst vergleichen'})).toHaveCount(0);
  await expect(host.locator('.g14-connect strong')).toHaveText('0');
  await reveal(host,game);
  await expect(view).toHaveAttribute('data-audience-phase','reveal');
  const comparison=view.getByRole('region',{name:'Eigene Antwort selbst vergleichen'});
  await expect(comparison).toContainText('Mein privater Tipp');
  await expect(comparison).toContainText(game.answer);
  await expect(comparison.getByRole('button',{name:'Passt'})).toHaveAttribute('aria-pressed','false');
  await comparison.getByRole('button',{name:'Teilweise'}).click();
  await expect(comparison.getByRole('button',{name:'Teilweise'})).toHaveAttribute('aria-pressed','true');
  await expect(comparison.getByRole('status')).toContainText('Nur deine Selbsteinschätzung');
  await comparison.getByRole('button',{name:'Anders'}).click();
  await expect(comparison.getByRole('button',{name:'Anders'})).toHaveAttribute('aria-pressed','true');
  await expect(host.locator('.g14-connect strong')).toHaveText('0');
  await expect(view.locator('.sp-shell,.rq-host,.exp-host-header')).toHaveCount(0);
  const size=await spectator.evaluate(()=>({width:globalThis.innerWidth,
   documentWidth:globalThis.document.documentElement.scrollWidth,storage:globalThis.sessionStorage.length}));
  expect(size.documentWidth).toBeLessThanOrEqual(size.width+3);
  expect(size.storage).toBe(0);
  await spectator.reload();
  await expect(view.getByRole('region',{name:'Eigene Antwort selbst vergleichen'})).toHaveCount(0);
  await expect(view.locator('.u14-answer')).not.toContainText('Mein privater Tipp');
  await spectator.close();
 });
}
test('U21 lost original host removes private self-reflection instead of retaining an answer across sessions',async({page})=>{
 const host=await createHost(page,games[0]);
 const href=await page.locator('.sp-cockpit-playalong').getAttribute('href');
 const spectator=await page.context().newPage();
 await spectator.setViewportSize({width:375,height:812});
 await spectator.goto('http://127.0.0.1:4178/'+href);
 await host.getByRole('button',{name:'Teams bestätigen'}).click();
 await host.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
 await spectator.getByRole('textbox',{name:'Eigene Antwort'}).fill('Only this tab');
 await spectator.getByRole('button',{name:'Tipp festhalten'}).click();
 await reveal(host,games[0]);
 const comparison=spectator.getByRole('region',{name:'Eigene Antwort selbst vergleichen'});
 await expect(comparison).toBeVisible();
 await comparison.getByRole('button',{name:'Passt'}).click();
 await page.close();
 await expect(spectator.locator('.u14-playalong')).toHaveAttribute('data-public-scene','withheld',{timeout:15000});
 await expect(comparison).toHaveCount(0);
 await spectator.reload();
 await expect(spectator.locator('.u14-answer')).not.toContainText('Only this tab');
 await spectator.close();
});
