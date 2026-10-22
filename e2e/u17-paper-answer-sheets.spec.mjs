import {test,expect} from '@playwright/test';

const modes=[
 {name:'Rundenquiz',game:'rundenquiz'},
 {name:'Quiztafel',game:'quiztafel'},
 {name:'Verbindungen',game:'verbindungen'},
 {name:'Logikleiter',game:'logikleiter'},
 {name:'Umfrageduell',game:'umfrageduell'},
];
async function prepared(page,mode){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('textbox',{name:'Team 1'}).fill('Nord');
 await page.getByRole('textbox',{name:'Team 2'}).fill('Mitte');
 await page.getByRole('textbox',{name:'Team 3'}).fill('Süd');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.game!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 const cockpit=page.locator('.sp-cockpit');
 await expect(cockpit).toHaveAttribute('data-cockpit-game',mode.game);
 return cockpit;
}
for(const mode of modes){
 test('U17 '+mode.name+' host opens isolated printed team responses without frozen source disclosure',async({page})=>{
  const host=await prepared(page,mode);
  const section=host.getByRole('region',{name:'Papier-Antwortbögen'});
  await section.getByRole('button',{name:'Antwortbögen vorbereiten'}).click();
  await expect(section).toContainText('3 Teams · DIN A4');
  const open=section.getByRole('link',{name:/Druckansicht öffnen/});
  await expect(open).toHaveAttribute('target','_blank');
  await expect(open).toHaveAttribute('rel',/noopener/);
  await expect(open).toHaveAttribute('href',/^blob:/);
  const docPromise=page.context().waitForEvent('page');
  await open.click();
  const paper=await docPromise;
  await paper.waitForLoadState('domcontentloaded');
  await expect(paper.getByRole('button',{name:'Antwortbögen drucken'})).toBeVisible();
  await expect(paper.locator('.sheet').first()).toContainText('TEAM Nord');
  await expect(paper.locator('.sheet')).toHaveCount(await paper.locator('.sheet').count());
  await expect(paper.locator('.sheet').last()).toContainText('Süd');
  const pageSource=await paper.content();
  expect(pageSource).toContain('class="line"');
  expect(pageSource).not.toContain('privateAnswers');
  expect(pageSource).not.toContain('frozenTasks');
  expect(pageSource).not.toContain('moderatorNotes');
  expect(pageSource).not.toContain('sourceHash');
  expect(pageSource).not.toContain('hostEpoch');
  expect(pageSource).not.toContain('sessionStorage');
  expect(pageSource).not.toContain('indexedDB');
  await paper.evaluate(()=>{globalThis.__u17Printed=false;globalThis.print=()=>{globalThis.__u17Printed=true;};});
  await paper.getByRole('button',{name:'Antwortbögen drucken'}).click();
  expect(await paper.evaluate(()=>globalThis.__u17Printed)).toBe(true);
  await paper.emulateMedia({media:'print'});
  await expect(paper.locator('.print-actions')).toBeHidden();
  await paper.close();
  await expect(page).toHaveURL(/#\/host$/);
 });
}
test('U17 mobile specific team selection, four-line answers and original host actions remain intact',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const host=await prepared(page,modes[0]);
 const section=host.getByRole('region',{name:'Papier-Antwortbögen'});
 await section.getByRole('button',{name:'Antwortbögen vorbereiten'}).click();
 await section.getByRole('combobox',{name:'Antwortbogen für Team'}).selectOption({label:'Mitte'});
 await section.getByRole('combobox',{name:'Antwortzeilen je Aufgabe'}).selectOption('4');
 await expect(section).toContainText('1 Team · DIN A4');
 const docPromise=page.context().waitForEvent('page');
 await section.getByRole('link',{name:/Druckansicht öffnen/}).click();
 const paper=await docPromise;
 await paper.waitForLoadState('domcontentloaded');
 await expect(paper.locator('.sheet').first()).toContainText('TEAM Mitte');
 await expect(paper.locator('.sheet')).not.toContainText('TEAM Nord');
 await expect(paper.locator('.sheet')).not.toContainText('TEAM Süd');
 const count=await paper.locator('.task').count();
 expect(count).toBeGreaterThan(0);
 await expect(paper.locator('.line')).toHaveCount(count*4);
 await paper.close();
 const bounds=await page.evaluate(()=>({
  width:globalThis.innerWidth,scroll:globalThis.document.documentElement.scrollWidth,
 }));
 expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+3);
 await section.getByRole('button',{name:'Antwortbögen vorbereiten'}).click();
 await expect(host.getByRole('button',{name:/Zur Originalsteuerung/})).toBeEnabled();
 await expect(page.getByRole('button',{name:'Teams bestätigen'})).toBeEnabled();
});
test('U17 forged host identity cannot show answer-sheet builder',async({page})=>{
 const host=await prepared(page,modes[0]);
 await expect(host.getByRole('button',{name:'Antwortbögen vorbereiten'})).toBeVisible();
 await page.evaluate(()=>{
  const key='ligoquiz.v2.g4.rundenquiz.host';
  const original=JSON.parse(globalThis.sessionStorage.getItem(key));
  original.hostId='forged-host-id-1234';
  globalThis.sessionStorage.setItem(key,JSON.stringify(original));
 });
 await page.reload();
 await expect(page.locator('.sp-cockpit')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Antwortbögen vorbereiten'})).toHaveCount(0);
});
