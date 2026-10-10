import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const modes=[
 {key:'rundenquiz',name:'Rundenquiz',root:'.rq-host',initial:'Teams bestätigen',publish:'Frage auf Beamer zeigen',publicText:'Wer führte Israel',privateText:'Josua'},
 {key:'quiztafel',name:'Quiztafel',root:'.qt-host',initial:'Quiztafel auf dem Beamer vorbereiten',publish:'Frage ausdrücklich veröffentlichen',publicText:'Wer baute',privateText:'Noah'},
 {key:'verbindungen',name:'Verbindungen',root:'.vb-host',initial:'Aufgabenreihenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'Bethlehem',privateText:'David'},
 {key:'logikleiter',name:'Logikleiter',root:'.ll-host',initial:'Stufenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'Alle Rosen',privateText:'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.'},
 {key:'umfrageduell',name:'Umfrageduell',root:'.ud-host',initial:'Aufgabenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'BEISPIELDATEN',privateText:'Notizblock'},
];
const evidence='test-results/g15-evidence';
async function metrics(page){
 return page.evaluate(()=>{
  const root=globalThis.document.documentElement;
  const stage=globalThis.document.querySelector('.stage-preview');
  const content=globalThis.document.querySelector('.stage-center');
  const rect=stage?.getBoundingClientRect();
  return {overflowX:root.scrollWidth>globalThis.innerWidth+2,
   overflowY:root.scrollHeight>globalThis.innerHeight+2,
   contentOverflowX:Boolean(content&&content.scrollWidth>content.clientWidth+3),
   contentOverflowY:Boolean(content&&content.scrollHeight>content.clientHeight+3),
   stageWidth:rect?.width??0,
   width:globalThis.innerWidth,
   publicScene:stage?.getAttribute('data-public-scene')??''};
 });
}
for(const mode of modes){
 test('G15 public 1280x720 visual and 200%-zoom host accessibility: '+mode.name,async({page})=>{
  await mkdir(evidence,{recursive:true});
  await page.goto('/#/setup');
  await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
  await page.getByRole('button',{name:'Weiter'}).click();
  if(mode.key!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
  await page.getByRole('button',{name:'Weiter'}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
  const host=page.locator(mode.root);
  await expect(host.getByRole('button',{name:mode.initial})).toBeEnabled();
  const href=await host.getByRole('link',{name:/Beamer öffnen/}).getAttribute('href');
  expect(href).toMatch(/^#\/stage\?event=[\w-]+$/);
  const stage=await page.context().newPage();
  await stage.setViewportSize({width:1280,height:720});
  await stage.goto('http://127.0.0.1:4178/'+href);
  await expect(stage.getByRole('main',{name:'Beamer-Ansicht'})).toBeVisible();
  await expect(stage.locator('.stage-preview')).toHaveAttribute('data-public-scene',/^(withheld|waiting)$/);
  await expect(stage.locator('.stage-center')).not.toContainText(mode.privateText);
  await host.getByRole('button',{name:mode.initial}).click();
  if(mode.key==='quiztafel')await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:mode.publish}).click();
  await expect(stage.locator('.stage-center')).toContainText(mode.publicText);
  await expect(stage.locator('.stage-center')).not.toContainText(mode.privateText);
  const stageSize=await metrics(stage);
  expect(stageSize.publicScene).not.toBe('withheld');
  expect(stageSize.overflowX,'stage page horizontal overflow').toBe(false);
  expect(stageSize.overflowY,'stage page vertical overflow').toBe(false);
  expect(stageSize.contentOverflowX,'stage content horizontal overflow').toBe(false);
  expect(stageSize.contentOverflowY,'stage content vertical overflow').toBe(false);
  await stage.screenshot({path:`${evidence}/${mode.key}-projector-1280x720.png`,fullPage:true});
  // A solution may appear ONLY after the moderator invokes its existing explicit reveal command.
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
  await expect(stage.locator('.stage-center')).toContainText(mode.privateText);
  const revealedSize=await metrics(stage);
  expect(revealedSize.overflowX,'revealed page horizontal overflow').toBe(false);
  expect(revealedSize.overflowY,'revealed page vertical overflow').toBe(false);
  expect(revealedSize.contentOverflowY,'revealed answer must fit in 720px without inner scrolling').toBe(false);
  await stage.screenshot({path:`${evidence}/${mode.key}-revealed-1280x720.png`,fullPage:true});
  await page.setViewportSize({width:640,height:800});
  await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
  await expect(host.getByRole('region',{name:'Moderationsübersicht'})).toBeVisible();
  const hostSize=await page.evaluate(()=>({
   fullWidth:globalThis.document.documentElement.scrollWidth,
   viewport:globalThis.innerWidth,
   active:globalThis.document.activeElement?.tagName
  }));
  expect(hostSize.fullWidth,'host causes horizontal page overflow under 200% zoom').toBeLessThanOrEqual(hostSize.viewport+3);
  const focus=host.getByRole('button',{name:/Nächste Aktion fokussieren/});
  await expect(focus).toBeVisible();
  await expect(focus).toHaveCSS('background-color','rgb(35, 48, 57)');
  await focus.focus();
  await expect(focus).toBeFocused();
  await page.screenshot({path:`${evidence}/${mode.key}-host-200pct.png`,fullPage:true});
  await stage.close();
 });
}
test('G15 projector contrast and focus styles are inspectable',async({page})=>{
 await page.goto('/#/technik');
 await page.getByRole('button',{name:'Techniktest anlegen'}).click();
 const href=await page.getByRole('link',{name:/Beamer-Fenster öffnen/}).getAttribute('href');
 const stage=await page.context().newPage();
 await stage.setViewportSize({width:1280,height:720});
 await stage.goto('http://127.0.0.1:4178/'+href);
 await expect(stage.locator('.stage-preview')).toBeVisible();
 const palette=await stage.evaluate(()=>{
  const a=globalThis.document.querySelector('.stage-bottom');
  const b=globalThis.document.querySelector('.stage-topline>span:last-child');
  return {footer:globalThis.getComputedStyle(a).color,header:globalThis.getComputedStyle(b).color};
 });
 // Stage labels must be light, not muted near-black on the dark projection.
 expect(palette.footer).toBe('rgb(197, 207, 221)');
 expect(palette.header).toBe('rgb(197, 207, 221)');
 await stage.close();
});
