import {test,expect} from '@playwright/test';

const modes=[
 {name:'Rundenquiz',root:'.rq-host',game:'rundenquiz',start:'Teams bestätigen',
  card:'.rq-control',score:'.rq-scoreboard'},
 {name:'Quiztafel',root:'.qt-host',game:'quiztafel',start:'Quiztafel auf dem Beamer vorbereiten',
  card:'.qt-board-host',score:'.qt-scorebar'},
 {name:'Verbindungen',root:'.vb-host',game:'verbindungen',start:'Aufgabenreihenfolge bestätigen',
  card:'.vb-card',score:'.vb-scorebar'},
 {name:'Logikleiter',root:'.ll-host',game:'logikleiter',start:'Stufenfolge bestätigen',
  card:'.ll-card',score:'.ll-scorebar'},
 {name:'Umfrageduell',root:'.ud-host',game:'umfrageduell',start:'Aufgabenfolge bestätigen',
  card:'.ud-card',score:'.ud-scorebar'},
];

async function openMode(page,mode){
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/setup');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.game!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const host=page.locator(mode.root);
 await expect(host.getByRole('button',{name:mode.start})).toBeEnabled();
 return host;
}
async function progress(host){
 return host.evaluate(root=>{
  const primary=root.querySelector('[data-host-next]:not(:disabled)');
  return {phase:root.getAttribute('data-host-phase'),
   primaryText:primary?.textContent?.trim(),
   scoreText:root.querySelector('.rq-scoreboard,.qt-scorebar,.vb-scorebar,.ll-scorebar,.ud-scorebar')?.textContent};
 });
}

for(const mode of modes){
 test('Host UX '+mode.name+' has an actionable task before passive scoring on 375px',async({page})=>{
  const host=await openMode(page,mode);
  const panel=host.getByRole('region',{name:'Moderationsübersicht'});
  await expect(panel).toContainText('Als Nächstes:');
  await expect(host.locator('.u07-phase-rail')).toBeVisible();
  await expect(host.locator('.g14-current-step')).toContainText('Vorbereitung');
  await expect(host.locator('.g3-tech-tag')).toContainText('PROBEINHALTE');
  const activeCard=host.locator(mode.card).first(),score=host.locator(mode.score);
  await expect(activeCard).toBeVisible();
  await expect(score).toBeVisible();
  const [a,b]=await Promise.all([activeCard.boundingBox(),score.boundingBox()]);
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  expect(a.y+a.height).toBeLessThanOrEqual(b.y+2);
  const before=await progress(host);
  expect(before.phase).toBe('setup');
  const next=host.getByRole('button',{name:mode.start});
  await panel.getByRole('button',{name:/Nächste Aktion fokussieren/}).click();
  await expect(next).toBeFocused();
  expect(await progress(host)).toEqual(before);
  await expect(host.getByRole('button',{name:mode.start})).toHaveCSS('background-color','rgb(40, 91, 255)');
  const width=await page.evaluate(()=>({page:globalThis.document.documentElement.scrollWidth,
   screen:globalThis.innerWidth}));
  expect(width.page).toBeLessThanOrEqual(width.screen+3);
  await next.click();
  await expect(host).not.toHaveAttribute('data-host-phase','setup');
  await expect(host.getByRole('region',{name:'Moderationsübersicht'})).toBeVisible();
 });
}
for(const mode of modes.filter(m=>m.game==='quiztafel'||m.game==='verbindungen')){
 test('Host UX '+mode.name+' gives correct, incorrect and no-answer equal weight, never auto-grades',async({page})=>{
  const host=await openMode(page,mode);
  await host.getByRole('button',{name:mode.start}).click();
  if(mode.game==='quiztafel')await host.locator('.qt-column').first().getByRole('button',{name:'100'}).click();
  await host.getByRole('button',{name:/Frage ausdrücklich veröffentlichen|Aufgabe veröffentlichen/}).click();
  const picks=host.locator('[data-host-choice]:not(:disabled)');
  await expect(picks).toHaveCount(3);
  await expect(host.locator('[data-host-next]:not(:disabled)')).toHaveCount(0);
  const phases=await progress(host);
  const styles=await picks.evaluateAll(nodes=>nodes.map(node=>{
    const x=globalThis.getComputedStyle(node);
    return {background:x.backgroundColor,color:x.color,border:x.borderTopColor,
     height:node.getBoundingClientRect().height};
  }));
  expect(styles[0]).toEqual(styles[1]);
  expect(styles[1]).toEqual(styles[2]);
  expect(styles.every(x=>x.height>=44)).toBe(true);
  await host.getByRole('region',{name:'Moderationsübersicht'})
   .getByRole('button',{name:/Nächste Aktion fokussieren/}).click();
  await expect(picks.first()).toBeFocused();
  expect(await progress(host)).toEqual(phases);
  await picks.last().click();
  await expect(host).not.toHaveAttribute('data-host-phase',phases.phase);
  await expect(host.getByRole('region',{name:'Moderationsübersicht'})).toBeVisible();
 });
}
