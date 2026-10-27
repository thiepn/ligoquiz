import {test,expect} from '@playwright/test';

const viewports = [320,390,768,1440];
const shots = 'test-results/ui-stabilization';

async function snapshot(page, width, view) {
 // A focus shortcut can leave sticky/fixed chrome composited midway down
 // Playwright's full-page screenshot. Capture the actual top-of-page layout.
 await page.evaluate(()=>globalThis.scrollTo(0,0));
 await page.screenshot({path:`${shots}/${width}-${view}.png`,fullPage:true,animations:'disabled'});
 const geometry = await page.evaluate(() => {
  const doc = globalThis.document.documentElement;
  return {viewport:globalThis.innerWidth,scroll:doc.scrollWidth};
 });
 expect(geometry.scroll, `${width}px ${view}: ${JSON.stringify(geometry)}`)
  .toBeLessThanOrEqual(geometry.viewport + 2);
 if(view.includes('host')||view.endsWith('-started')){
  const heading=page.locator('.g14-guide h3').first();
  if(await heading.count()){
   const blockWidth=await heading.evaluate(el=>el.getBoundingClientRect().width);
   expect(blockWidth, `${width}px host step should not split each word into fragments`)
    .toBeGreaterThan(Math.min(185,width-110));
  }
 }
}

for(const width of viewports){
 test(`UI stabilization: ${width}px navigation, setup, persistence and host`,async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto('/#/spielen');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await snapshot(page,width,'lobby');

  if(width<=760){
   const menu=page.locator('.sp-shell-mobile-menu');
   await menu.locator('summary').click();
   await expect(menu).toHaveAttribute('open','');
   const bounds=await page.evaluate(()=>{
    const m=globalThis.document.querySelector('.sp-shell-mobile-menu>nav').getBoundingClientRect();
    const n=globalThis.document.querySelector('.sp-shell-mobile-bottom').getBoundingClientRect();
    return {menuBottom:m.bottom,bottomNavTop:n.top};
   });
   expect(bounds.menuBottom,'Mobile menu must not sit under the fixed bottom navigation')
    .toBeLessThanOrEqual(bounds.bottomNavTop+2);
   await menu.getByRole('link',{name:/Backstage/}).first().click();
  }else{
   await page.getByRole('navigation',{name:'Hauptnavigation'})
    .getByRole('link',{name:/Backstage/}).click();
  }
  await expect(page).toHaveURL(/#\/inhalte$/);
  await snapshot(page,width,'content');
  await page.goto('/#/setup');
  await expect(page.getByRole('heading',{name:'Teams festlegen'})).toBeVisible();
  // Setup no longer renders the old desktop sidebar; it must not reserve its column.
  const columns=await page.locator('.sp-prep-layout').evaluate(el=>globalThis.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/));
  expect(columns,'Unrendered setup sidebar must not reserve an empty track').toHaveLength(1);
  await snapshot(page,width,'teams');
  await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
  await page.getByRole('button',{name:'Weiter'}).click();
  await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
  await snapshot(page,width,'game-choice');
  if(width<=760){
   await page.evaluate(()=>globalThis.scrollTo(0,0));
   const action=page.locator('.sp-prep-actions');
   const bounds=await action.boundingBox();
   expect(bounds).not.toBeNull();
   expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
   expect(bounds.y+bounds.height,'Focused setup has no bottom nav; action should sit near the viewport edge').toBeGreaterThan(765);
  }
  await page.reload();
  await expect(page.getByRole('heading',{name:'Programm wählen'})).toBeVisible();
  await page.getByRole('button',{name:'Weiter'}).click();
  await expect(page.getByRole('heading',{name:'Bereit zum Spielen'})).toBeVisible();
  await snapshot(page,width,'ready');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
  await expect(page).toHaveURL(/#\/host$/);
  await expect(page.locator('#sp-host-game')).toBeVisible();
  if(width<=760){
   await expect(page.locator('.u07-rail-guidance')).toBeHidden();
   await expect(page.locator('.g14-progress')).toBeHidden();
   await expect(page.locator('.u07-phase-steps>li')).toHaveCount(4);
   const focus=page.locator('.g14-guide button.g14-focus');
   await expect(focus).toBeVisible();
   await focus.click();
   await expect(page.locator('[data-host-game="rundenquiz"] [data-host-next]:not(:disabled)').first()).toBeFocused();
  }
  await snapshot(page,width,'host');
  const identity=await page.evaluate(()=>globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  expect(identity).toBeTruthy();
  await page.reload();
  await expect(page.locator('#sp-host-game')).toBeVisible();
  expect(await page.evaluate(()=>globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'))).toBe(identity);
  await expect(page.locator('.sp-cockpit-quick-stage')).toHaveAttribute('target','_blank');
  await snapshot(page,width,'resumed-host');
  // Actual original Rundenquiz transition, with a connected public stage:
  // private solutions remain guarded even after a live prompt and host reload.
  const href=await page.locator('.sp-cockpit-quick-stage').getAttribute('href');
  expect(href).toMatch(/^#.*stage.*event=[a-zA-Z0-9_-]+$/);
  const stage=await page.context().newPage();
  await stage.setViewportSize({width,height:844});
  await stage.goto('/'+href);
  await expect(page.locator('.rq-utility')).toContainText('1 Beamer verbunden');
  await page.getByRole('button',{name:'Teams bestätigen'}).click();
  await page.getByRole('button',{name:'Frage auf Beamer zeigen'}).click();
  await expect(stage.locator('main')).toContainText('Wer führte Israel nach Mose');
  await expect(stage.locator('main')).not.toContainText('Josua');
  await snapshot(page,width,'rundenquiz-active');
  await snapshot(stage,width,'rundenquiz-projector-active');
  await page.reload();
  await expect(page.getByRole('button',{name:'Spiel fortsetzen'})).toBeEnabled();
  await expect(stage.locator('main')).not.toContainText('Josua');
  await stage.close();
  await snapshot(page,width,'rundenquiz-reload-paused');
 });
}

const otherGames=[
 {name:'Quiztafel',host:'.qt-host',first:'Quiztafel auf dem Beamer vorbereiten'},
 {name:'Verbindungen',host:'.vb-host',first:'Aufgabenreihenfolge bestätigen'},
 {name:'Logikleiter',host:'.ll-host',first:'Stufenfolge bestätigen'},
 {name:'Umfrageduell',host:'.ud-host',first:'Aufgabenfolge bestätigen'},
];

for(const width of viewports){
 for(const game of otherGames){
  test(`UI stabilization: ${game.name} host, stage and reload at ${width}px`,async({page,context})=>{
   await page.setViewportSize({width,height:844});
   await page.goto('/#/setup');
   await page.getByRole('button',{name:'Weiter'}).click();
   await page.getByRole('button',{name:new RegExp(game.name)}).click();
   await page.getByRole('button',{name:'Weiter'}).click();
   await page.getByRole('checkbox').check();
   await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
   await expect(page).toHaveURL(/#.*host$/);
   const host=page.locator(game.host);
   await expect(host).toBeVisible();
   await expect(host.getByRole('button',{name:game.first})).toBeEnabled();
   if(width<=760){
    await expect(host.locator('.u07-rail-guidance')).toBeHidden();
    await expect(host.locator('.g14-progress')).toBeHidden();
    await expect(host.locator('.u07-phase-steps>li')).toHaveCount(4);
    const focus=host.locator('.g14-guide button.g14-focus');
    await expect(focus).toBeVisible();
    await focus.click();
    await expect(host.locator('[data-host-next]:not(:disabled)').first()).toBeFocused();
   }
   await snapshot(page,width,game.name.toLowerCase()+'-host');
   await host.getByRole('button',{name:game.first}).click();
   await expect(host).toBeVisible();
   await snapshot(page,width,game.name.toLowerCase()+'-started');
   const href=await page.locator('.sp-cockpit-quick-stage').getAttribute('href');
   expect(href).toMatch(/^#.*stage.*event=[a-zA-Z0-9_-]+$/);
   const stage=await context.newPage();
   await stage.setViewportSize({width,height:844});
   await stage.goto('/'+href);
   await expect(stage.locator('.stage-preview')).toBeVisible();
   await snapshot(stage,width,game.name.toLowerCase()+'-projector');
   // Exercise the first actual game interaction on each device width. A private
   // Quiztafel selection never publishes its solution; the other three engines
   // may publish their prompt but must not reveal the guarded answer.
   if(game.name==='Quiztafel'){
    await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
    await expect(host).toHaveAttribute('data-host-phase','prepared');
    await expect(stage.locator('.qt-stage-grid')).toBeVisible();
    await expect(stage.locator('main')).not.toContainText('Noah');
   }else{
    await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
    await expect(host).toHaveAttribute('data-host-phase',
      game.name==='Verbindungen'?'clue-open':'open');
    const privateAnswer=game.name==='Verbindungen'?'David':
      game.name==='Umfrageduell'?'Notizblock':
      'Alle Rosen sind Pflanzen, und keine Pflanze ist ein Metall.';
    await expect(stage.locator('main')).not.toContainText(privateAnswer);
    if(game.name==='Verbindungen')await expect(stage.locator('main')).toContainText('Bethlehem');
    if(game.name==='Logikleiter')await expect(stage.locator('.ll-stage-ladder')).toContainText('Alle Rosen');
    if(game.name==='Umfrageduell')await expect(stage.locator('.ud-stage')).toContainText('BEISPIELDATEN');
   }
   await snapshot(page,width,game.name.toLowerCase()+'-active');
   await snapshot(stage,width,game.name.toLowerCase()+'-projector-active');
   await page.reload();
   await expect(page.locator(game.host)).toBeVisible();
   await expect(page.locator('.sp-cockpit-quick-stage')).toHaveAttribute('href',href);
   if(game.name!=='Quiztafel'){
    await expect(host.getByRole('button',{name:/Spiel.*fortsetzen/})).toBeEnabled();
    await expect(stage.locator('main')).toContainText('Pause');
   }
   await stage.close();
   await snapshot(page,width,game.name.toLowerCase()+'-resumed');
  });
 }
}
