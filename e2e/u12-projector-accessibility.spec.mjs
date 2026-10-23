import {test,expect} from '@playwright/test';

const modes=[
 {key:'rundenquiz',name:'Rundenquiz',root:'.rq-host',initial:'Teams bestätigen',publish:'Frage auf Beamer zeigen',publicText:'Wer führte Israel',privateText:'Josua'},
 {key:'quiztafel',name:'Quiztafel',root:'.qt-host',initial:'Quiztafel auf dem Beamer vorbereiten',publish:'Frage ausdrücklich veröffentlichen',publicText:'Wer baute',privateText:'Noah'},
 {key:'verbindungen',name:'Verbindungen',root:'.vb-host',initial:'Aufgabenreihenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'Bethlehem',privateText:'David'},
 {key:'logikleiter',name:'Logikleiter',root:'.ll-host',initial:'Stufenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'Alle Rosen',privateText:'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.'},
 {key:'umfrageduell',name:'Umfrageduell',root:'.ud-host',initial:'Aufgabenfolge bestätigen',publish:'Aufgabe veröffentlichen',publicText:'BEISPIELDATEN',privateText:'Notizblock'},
];

async function start(page,mode){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.key!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page.locator(mode.root).getByRole('button',{name:mode.initial})).toBeEnabled();
 await expect(page.locator('.sp-cockpit-accessible-stage')).toBeVisible();
}

for(const mode of modes){
 test('U12 opt-in live public text and contrast controls: '+mode.name,async({page})=>{
  await start(page,mode);
  const host=page.locator(mode.root);
  const accessibleHref=await page.locator('.sp-cockpit-accessible-stage').getAttribute('href');
  expect(accessibleHref).toMatch(/^#\/stage\?event=[\w-]+&display=accessible$/);
  await expect(page.locator('.sp-cockpit-stage')).toHaveAttribute('href',/^#\/stage\?event=[\w-]+$/);
  const stage=await page.context().newPage();
  await stage.setViewportSize({width:1280,height:720});
  await stage.goto('http://127.0.0.1:4178/'+accessibleHref);
  const projection=stage.locator('.stage-preview');
  await expect(projection).toHaveAttribute('data-stage-display','accessible');
  await expect(projection).toHaveAttribute('data-stage-size','normal');
  await expect(projection).not.toHaveAttribute('data-stage-contrast','high');
  await expect(stage.getByRole('button',{name:'Anzeige'})).toBeVisible();
  await expect(stage.locator('.sp-shell,.rq-host,[data-host-game]')).toHaveCount(0);

  await host.getByRole('button',{name:mode.initial}).click();
  if(mode.key==='quiztafel')await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:mode.publish}).click();
  await expect(stage.locator('.stage-center')).toContainText(mode.publicText);
  await expect(stage.locator('.stage-center')).not.toContainText(mode.privateText);

  const trigger=stage.getByRole('button',{name:'Anzeige'});
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  const original=await stage.locator('.stage-center h1').first().evaluate(e=>Number.parseFloat(globalThis.getComputedStyle(e).fontSize));
  await stage.getByRole('button',{name:'Groß',exact:true}).click();
  await expect(projection).toHaveAttribute('data-stage-size','large');
  const enlarged=await stage.locator('.stage-center h1').first().evaluate(e=>Number.parseFloat(globalThis.getComputedStyle(e).fontSize));
  expect(enlarged,mode.name+' headline should be larger').toBeGreaterThan(original);
  await stage.getByRole('button',{name:'Sehr groß'}).click();
  await expect(projection).toHaveAttribute('data-stage-size','largest');
  await stage.getByRole('button',{name:'Hoher Kontrast'}).click();
  await expect(projection).toHaveAttribute('data-stage-contrast','high');
  await expect(stage.getByRole('button',{name:'Hoher Kontrast'})).toHaveAttribute('aria-pressed','true');
  await stage.getByRole('button',{name:'Schließen'}).click();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(trigger).toBeFocused();
  await expect(stage.locator('.stage-center')).not.toContainText(mode.privateText);

  await stage.setViewportSize({width:375,height:812});
  const size=await stage.evaluate(()=>({
   page:globalThis.document.documentElement.scrollWidth,
   viewport:globalThis.innerWidth,
   center:globalThis.document.querySelector('.stage-center')?.scrollWidth??0,
   visible:globalThis.document.querySelector('.stage-center')?.clientWidth??0,
  }));
  expect(size.page,mode.name+' stage page overflow').toBeLessThanOrEqual(size.viewport+3);
  expect(size.center,mode.name+' stage content overflow').toBeLessThanOrEqual(size.visible+3);
  await stage.reload();
  await expect(projection).toHaveAttribute('data-stage-size','normal');
  await expect(projection).not.toHaveAttribute('data-stage-contrast','high');
  await expect(stage.locator('[data-host-game]')).toHaveCount(0);
  await stage.close();
 });
}

test('U12 legacy public projector URL is unchanged and never opts into controls',async({page})=>{
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/stage?event=isolated-stage-123');
 await expect(page.locator('.stage-preview')).not.toHaveAttribute('data-stage-display','accessible');
 await expect(page.locator('.stage-access-area')).toHaveCount(0);
 await expect(page.locator('.stage-preview')).toHaveAttribute('data-stage-phase','withheld');
 const w=await page.evaluate(()=>({
   x:globalThis.document.documentElement.scrollWidth,
   viewport:globalThis.innerWidth,
 }));
 expect(w.x).toBeLessThanOrEqual(w.viewport+2);
});
