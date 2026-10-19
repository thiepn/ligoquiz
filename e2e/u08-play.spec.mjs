import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const shots='test-results/u08-evidence';
async function setup(page,name,n=3){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption(String(n));
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('button',{name:new RegExp(name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 const host=page.locator(name==='Verbindungen'?'.vb-host':'.ll-host');
 await expect(host.locator('.u07-phase-rail')).toBeVisible();
 return host;
}
const step=host=>host.locator('.u07-phase-steps [aria-current="step"]');
async function fits(page){
 const dim=await page.evaluate(()=>({width:globalThis.innerWidth,scroll:globalThis.document.documentElement.scrollWidth}));
 expect(dim.scroll).toBeLessThanOrEqual(dim.width+3);
}
test('U08 Verbindungen progressive clues and actual scoring remain native',async({page})=>{
 await mkdir(shots,{recursive:true});
 const host=await setup(page,'Verbindungen');
 await expect(step(host)).toContainText('Vorbereiten');
 await host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(step(host)).toContainText('Antworten');
 await expect(host.locator('.u08-round-count')).toContainText('1 / 4');
 await expect(host.locator('.u08-private')).toContainText('David');
 await host.getByRole('button',{name:'Nächster Hinweis'}).click();
 await expect(host.locator('.u08-vb-clues p')).toHaveCount(2);
 await expect(host.locator('.u08-round-count')).toContainText('2 / 4');
 await host.screenshot({path:shots+'/verbindungen-clues-desktop.png'});
 await host.getByRole('button',{name:'Richtige Antwort'}).click();
 await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 await expect(step(host)).toContainText('Werten');
 await expect(host.locator('.vb-actions')).toContainText('30 Punkte');
 await host.getByRole('button',{name:'Wertung verbindlich bestätigen'}).click();
 await expect(step(host)).toContainText('Weiter');
 await expect(host.locator('.vb-scorebar strong')).toHaveText(['30','0','0']);
 await host.getByRole('button',{name:'Letzte Wertung korrigieren'}).click();
 await expect(step(host)).toContainText('Werten');
});
test('U08 wall marks distinguish missing link judgment from explicit false',async({page})=>{
 await mkdir(shots,{recursive:true});
 const host=await setup(page,'Verbindungen');
 await host.getByRole('button',{name:'Aufgabenreihenfolge bestätigen'}).click();
 for(let i=0;i<3;i++){
  await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
  await host.getByRole('button',{name:'Keine Antwort'}).click();
  await host.getByRole('button',{name:'Lösung veröffentlichen'}).click();
  await host.getByRole('button',{name:'Wertung verbindlich bestätigen'}).click();
  await host.getByRole('button',{name:'Nächste Aufgabe'}).click();
 }
 await expect(host.locator('.u08-wall-grid>div')).toHaveCount(16);
 await expect(host.locator('.u08-wall-progress')).toContainText('0 / 4');
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 await host.getByRole('button',{name:/Gruppe 1 bewusst auflösen/}).click();
 await expect(step(host)).toContainText('Werten');
 const mark=host.locator('.u08-marking').first();
 const row=mark.getByRole('group',{name:/Gruppenwertung für Team 1/});
 await row.getByRole('button',{name:'Vierergruppe richtig'}).click();
 // MARK_GROUP stores a canonical link:false default until MARK_LINK changes it.
 await expect(row.getByRole('button',{name:'Verbindung nicht richtig'})).toHaveAttribute('aria-pressed','true');
 await row.getByRole('button',{name:'Verbindung richtig'}).click();
 await expect(row.getByRole('button',{name:'Verbindung richtig'})).toHaveAttribute('aria-pressed','true');
 await expect(row.getByRole('button',{name:'Verbindung nicht richtig'})).toHaveAttribute('aria-pressed','false');
 await mark.getByRole('group',{name:/Gruppenwertung für Team 2/}).getByRole('button',{name:'Nicht richtig'}).click();
 await mark.getByRole('group',{name:/Gruppenwertung für Team 3/}).getByRole('button',{name:'Nicht richtig'}).click();
 await expect(mark.locator('.u08-marking-head')).toContainText('3 / 3 Teams bewertet');
 await host.screenshot({path:shots+'/verbindungen-wall-desktop.png'});
});
test('U08 Logikleiter early and late locking and original 10/5/0 scoring',async({page})=>{
 await mkdir(shots,{recursive:true});
 const host=await setup(page,'Logikleiter');
 await expect(host.locator('.u08-rung-strip [aria-current=step]')).toHaveCount(1);
 await host.getByRole('button',{name:'Stufenfolge bestätigen'}).click();
 await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
 await expect(step(host)).toContainText('Antworten');
 await host.locator('.u08-lock-row').nth(0).getByRole('button',{name:'Abgabe jetzt sperren'}).click();
 await expect(host.locator('.u08-lock-row').nth(0)).toHaveAttribute('data-lock-state','early');
 await host.getByRole('button',{name:'Hinweis bewusst veröffentlichen'}).click();
 await host.locator('.u08-lock-row').nth(1).getByRole('button',{name:'Abgabe jetzt sperren'}).click();
 await expect(host.locator('.u08-lock-row').nth(1)).toHaveAttribute('data-lock-state','late');
 await expect(host.locator('.u08-lock-count')).toContainText('2 / 3');
 await host.screenshot({path:shots+'/logikleiter-locks-desktop.png'});
 await host.getByRole('button',{name:'Alle Antworten schließen'}).click();
 await host.getByRole('button',{name:'Lösung und Begründung veröffentlichen'}).click();
 await expect(step(host)).toContainText('Werten');
 await host.locator('.u08-grade-row').nth(0).getByRole('button',{name:'Richtig'}).click();
 await host.locator('.u08-grade-row').nth(1).getByRole('button',{name:'Richtig'}).click();
 await host.locator('.u08-grade-row').nth(2).getByRole('button',{name:'Keine Antwort'}).click();
 await expect(host.locator('.u08-grade-count')).toContainText('3 / 3');
 await host.getByRole('button',{name:'Alle Wertungen verbindlich bestätigen'}).click();
 await expect(step(host)).toContainText('Weiter');
 await expect(host.locator('.ll-scorebar strong')).toHaveText(['10','5','0']);
 await host.screenshot({path:shots+'/logikleiter-awards-desktop.png'});
});
for(const name of ['Verbindungen','Logikleiter']){
 test('U08 375px '+name+' retains native action access and no page overflow',async({page})=>{
  await mkdir(shots,{recursive:true});
  await page.setViewportSize({width:375,height:812});
  await page.emulateMedia({reducedMotion:'reduce'});
  const host=await setup(page,name,5);
  await expect(host.locator('.u07-phase-steps>li')).toHaveCount(4);
  await fits(page);
  await expect(host.getByRole('link',{name:/Beamer öffnen/})).toHaveAttribute('rel',/noopener/);
  await host.getByRole('button',{name:name==='Verbindungen'?'Aufgabenreihenfolge bestätigen':'Stufenfolge bestätigen'}).click();
  await host.getByRole('button',{name:'Aufgabe veröffentlichen'}).click();
  await expect(step(host)).toContainText('Antworten');
  if(name==='Verbindungen'){
   await expect(host.locator('.u08-vb-clues p')).toHaveCount(1);
   await expect(host.locator('.u08-vb-timer')).toBeVisible();
  }else{
   await expect(host.locator('.u08-lock-row')).toHaveCount(5);
   await expect(host.locator('.u08-ll-clock')).toBeVisible();
  }
  await fits(page);
  await host.screenshot({path:shots+'/'+name.toLowerCase()+'-375.png'});
 });
}
