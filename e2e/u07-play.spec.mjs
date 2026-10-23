import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const evidence='test-results/u07-evidence';
async function preparedHost(page,game='rundenquiz',count=3){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption(String(count));
 await page.getByRole('button',{name:'Weiter'}).click();
 if(game==='quiztafel')await page.getByRole('button',{name:/Quiztafel/}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator(game==='rundenquiz'?'.rq-host':'.qt-host');
 await expect(host).toBeVisible();
 return host;
}
function current(host){return host.locator('.u07-phase-steps [aria-current="step"]');}
async function fits(page){
 return page.evaluate(()=>({
   viewport:globalThis.innerWidth,
   scrollWidth:globalThis.document.documentElement.scrollWidth,
 }));
}

test('U07 Rundenquiz native phase rail, private question, team judgement and actual confirmed scores',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:1365,height:850});
 const host=await preparedHost(page,'rundenquiz',3);
 await expect(host.locator('.u07-mode-head h2')).toContainText('Rundenquiz');
 await expect(current(host)).toContainText('Vorbereiten');
 await expect(host.locator('.rq-scoreboard strong')).toHaveText(['0','0','0']);
 await host.getByRole('button',{name:'Teams bestätigen'}).click();
 await host.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
 await expect(current(host)).toContainText('Antworten');
 await expect(host.locator('.u07-question-kicker')).toContainText('Aufgabe 1 / 7');
 await expect(host.locator('.u07-private-panel')).toContainText('Josua');
 await host.screenshot({path:evidence+'/rundenquiz-desktop-answer-phase.png'});
 await host.getByRole('button',{name:'Antwortphase schließen'}).click();
 await expect(current(host)).toContainText('Antworten');
 await host.getByRole('button',{name:'Lösung auf Beamer zeigen'}).click();
 await expect(current(host)).toContainText('Werten');
 const first=host.locator('.rq-judge').first();
 await first.getByRole('button',{name:'richtig'}).click();
 await expect(first.getByRole('button',{name:'richtig'})).toHaveAttribute('aria-pressed','true');
 await expect(host.locator('.u07-judgement-count')).toContainText('1 von 3');
 await host.locator('.rq-judge').nth(1).getByRole('button',{name:'falsch'}).click();
 await host.locator('.rq-judge').nth(2).getByRole('button',{name:'keine'}).click();
 await expect(host.locator('.u07-judgement-count')).toContainText('3 von 3');
 await expect(host.getByRole('button',{name:'Punkte verbindlich bestätigen'})).toBeEnabled();
 await host.getByRole('button',{name:'Punkte verbindlich bestätigen'}).click();
 await expect(current(host)).toContainText('Weiter');
 await expect(host.locator('.rq-scoreboard strong')).toHaveText(['10','0','0']);
 await host.screenshot({path:evidence+'/rundenquiz-desktop-confirmed.png'});
});

test('U07 Quiztafel real field, one-shot steal, candidate decision and score ledger remain authoritative',async({page})=>{
 await mkdir(evidence,{recursive:true});
 const host=await preparedHost(page,'quiztafel',3);
 await expect(current(host)).toContainText('Vorbereiten');
 await host.getByRole('button',{name:'Quiztafel auf dem Beamer vorbereiten'}).click();
 const firstCell=host.locator('.qt-column').first().getByRole('button',{name:'100'});
 await firstCell.click();
 await expect(firstCell).toHaveAttribute('aria-pressed','true');
 await expect(host.locator('.u07-qt-prepared')).toContainText('NUR SPIELLEITUNG');
 await host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'}).click();
 await expect(current(host)).toContainText('Antworten');
 await expect(host.getByRole('group',{name:/Erstantwort bewerten/})).toBeVisible();
 await host.getByRole('button',{name:'Erstantwort falsch'}).click();
 await host.getByRole('button',{name:'Übernahme anbieten'}).click();
 await expect(host.getByRole('group',{name:/Übernahme bewerten/})).toBeVisible();
 await host.getByRole('button',{name:'Übernahme richtig'}).click();
 await host.getByRole('button',{name:'Lösung ausdrücklich zeigen'}).click();
 await expect(current(host)).toContainText('Werten');
 await expect(host.locator('.u07-qt-award')).toContainText('Team 2 erhält +100 Punkte');
 await expect(host.getByRole('button',{name:'Wertung: Übernahme'})).toHaveAttribute('aria-pressed','true');
 await host.screenshot({path:evidence+'/quiztafel-desktop-award.png'});
 await host.getByRole('button',{name:'Punkte verbindlich bestätigen'}).click();
 await expect(current(host)).toContainText('Weiter');
 await expect(host.locator('.qt-scorebar strong')).toHaveText(['0','100','0']);
 await expect(host.getByRole('button',{name:'Wertung auditiert korrigieren'})).toBeEnabled();
});

for(const game of ['rundenquiz','quiztafel']){
 test('U07 375px mobile native '+game+' stays within page and original actions work',async({page})=>{
  await mkdir(evidence,{recursive:true});
  await page.setViewportSize({width:375,height:812});
  await page.emulateMedia({reducedMotion:'reduce'});
  const host=await preparedHost(page,game,5);
  await expect(host.locator('.u07-phase-steps > li')).toHaveCount(4);
  await expect(current(host)).toContainText('Vorbereiten');
  let dimensions=await fits(page);
  expect(dimensions.scrollWidth,'mobile host page overflow before start').toBeLessThanOrEqual(dimensions.viewport+3);
  if(game==='rundenquiz'){
    await host.getByRole('button',{name:'Teams bestätigen'}).click();
    await host.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
    await expect(host.locator('.u07-rq-timer')).toBeVisible();
    await expect(host.getByRole('button',{name:'Antwortphase schließen'})).toBeEnabled();
  }else{
    await host.getByRole('button',{name:'Quiztafel auf dem Beamer vorbereiten'}).click();
    await expect(host.locator('.u07-qt-grid')).toBeVisible();
    const grid=await host.locator('.u07-qt-grid').evaluate(el=>({viewport:el.clientWidth,content:el.scrollWidth}));
    expect(grid.content).toBeGreaterThanOrEqual(grid.viewport);
    await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
    await expect(host.getByRole('button',{name:'Frage ausdrücklich veröffentlichen'})).toBeEnabled();
  }
  dimensions=await fits(page);
  expect(dimensions.scrollWidth,'mobile host page overflow during play').toBeLessThanOrEqual(dimensions.viewport+3);
  await host.screenshot({path:evidence+'/'+game+'-mobile-375.png'});
 });
}
