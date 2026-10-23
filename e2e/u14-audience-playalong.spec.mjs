import {test,expect} from '@playwright/test';

const modes=[
 {name:'Rundenquiz',root:'.rq-host',start:'Teams bestätigen',publish:'Frage auf Beamer zeigen',
  publicText:'Wer führte Israel',privateText:'Josua',key:'rundenquiz'},
 {name:'Quiztafel',root:'.qt-host',start:'Quiztafel auf dem Beamer vorbereiten',
  publish:'Frage ausdrücklich veröffentlichen',publicText:'Wer baute',privateText:'Noah',key:'quiztafel'},
 {name:'Verbindungen',root:'.vb-host',start:'Aufgabenreihenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',publicText:'Bethlehem',privateText:'David',key:'verbindungen'},
 {name:'Logikleiter',root:'.ll-host',start:'Stufenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',publicText:'Alle Rosen',privateText:'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.',key:'logikleiter'},
 {name:'Umfrageduell',root:'.ud-host',start:'Aufgabenfolge bestätigen',
  publish:'Aufgabe veröffentlichen',publicText:'Nenne eine typische Sache',privateText:'Notizblock',key:'umfrageduell'},
];

async function hostSession(page,mode){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.key!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator(mode.root);
 await expect(host.getByRole('button',{name:mode.start})).toBeEnabled();
 return host;
}

async function reveal(host,mode){
 if(mode.key==='rundenquiz'){
  await host.getByRole('button',{name:'Antwortphase schließen'}).click();
  await host.getByRole('button',{name:'Lösung auf Beamer zeigen'}).click();
 }else if(mode.key==='quiztafel'){
  await host.getByRole('button',{name:'Erstantwort richtig'}).click();
  await host.getByRole('button',{name:'Lösung ausdrücklich zeigen'}).click();
 }else if(mode.key==='verbindungen'){
  await host.getByRole('button',{name:'Richtige Antwort'}).click();
  await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 }else if(mode.key==='logikleiter'){
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

for(const mode of modes){
 test('U14 original publisher, no projector ACK, spectator private tip and public reveal: '+mode.name,async({page})=>{
  const host=await hostSession(page,mode);
  const link=page.locator('.sp-cockpit-playalong');
  await expect(link).toBeVisible();
  const href=await link.getAttribute('href');
  expect(href).toMatch(/^#\/mitspielen\?event=[\w-]+$/);
  await expect(host.locator('.g14-connect strong')).toHaveText('0');

  const spectator=await page.context().newPage();
  await spectator.setViewportSize({width:390,height:844});
  await spectator.goto('http://127.0.0.1:4178/'+href);
  const view=spectator.locator('.u14-playalong');
  await expect(view).toHaveAttribute('data-public-scene',/^(withheld|waiting)$/);
  await expect(spectator.getByRole('textbox',{name:'Eigene Antwort'})).toHaveCount(0);
  await expect(host.locator('.g14-connect strong')).toHaveText('0');

  await host.getByRole('button',{name:mode.start}).click();
  if(mode.key==='quiztafel')await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:mode.publish}).click();
  await expect(view).toHaveAttribute('data-audience-phase','question');
  await expect(view.locator('.u14-question')).toContainText(mode.publicText);
  await expect(view.locator('.u14-question')).not.toContainText(mode.privateText);
  await spectator.getByRole('textbox',{name:'Eigene Antwort'}).fill('Mein privater Tipp');
  await spectator.getByRole('button',{name:'Tipp festhalten'}).click();
  await expect(view.locator('.u14-locked')).toContainText('Mein privater Tipp');
  await expect(host.locator('.g14-connect strong')).toHaveText('0');
  await reveal(host,mode);
  await expect(view).toHaveAttribute('data-audience-phase','reveal');
  await expect(view.locator('.u14-reveal')).toContainText(mode.privateText);
  await expect(view.locator('.u14-locked')).toContainText('Mein privater Tipp');
  await expect(spectator.getByRole('textbox',{name:'Eigene Antwort'})).toHaveCount(0);
  await expect(view.locator('.sp-shell,.rq-host,.exp-host-header')).toHaveCount(0);
  await expect(host.locator('.g14-connect strong')).toHaveText('0');

  const bounds=await spectator.evaluate(()=>({
   documentWidth:globalThis.document.documentElement.scrollWidth,viewport:globalThis.innerWidth,
  }));
  expect(bounds.documentWidth,mode.name+' spectator mobile overflow').toBeLessThanOrEqual(bounds.viewport+3);

  await spectator.reload();
  await expect(view.locator('.u14-locked')).toHaveCount(0);
  await expect(view.locator('.u14-answer')).not.toContainText('Mein privater Tipp');
  await spectator.close();
 });
}

test('U14 same-browser mobile audience entry is erased after lost host, and never persists as an event',async({page})=>{
 const host=await hostSession(page,modes[0]);
 const href=await page.locator('.sp-cockpit-playalong').getAttribute('href');
 const spectator=await page.context().newPage();
 await spectator.setViewportSize({width:375,height:812});
 await spectator.goto('http://127.0.0.1:4178/'+href);
 await host.getByRole('button',{name:'Teams bestätigen'}).click();
 await host.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
 await spectator.getByRole('textbox',{name:'Eigene Antwort'}).fill('Nur in diesem Tab');
 await spectator.getByRole('button',{name:'Tipp festhalten'}).click();
 await expect(spectator.locator('.u14-locked')).toContainText('Nur in diesem Tab');

 await page.close();
 await expect(spectator.locator('.u14-playalong')).toHaveAttribute('data-public-scene','withheld',{timeout:15000});
 await expect(spectator.locator('.u14-locked')).toHaveCount(0);
 await spectator.reload();
 await expect(spectator.locator('.u14-answer')).not.toContainText('Nur in diesem Tab');
 expect(await spectator.evaluate(()=>globalThis.sessionStorage.length)).toBe(0);
 await spectator.close();
});

test('U14 forged or missing event cannot open spectator channel or saved host views',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/mitspielen?event=../different');
 await expect(page.locator('.u14-playalong')).toHaveAttribute('data-public-scene','withheld');
 await expect(page.getByRole('status')).toContainText('Ungültiger Veranstaltungslink');
 await expect(page.locator('.u14-playalong [data-host-game],.sp-shell')).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Eigene Antwort'})).toHaveCount(0);
 expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(378);
});
