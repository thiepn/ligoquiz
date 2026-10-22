import {test,expect} from '@playwright/test';

test('U13 all five modes rehearse native decisions, scoring and public-only reveal without a saved event',async({page})=>{
 await page.setViewportSize({width:1366,height:850});
 await page.goto('/#/demo');
 await expect(page.locator('.u13-mode-picker button')).toHaveCount(5);
 await expect(page.locator('.exp-demo-private')).toContainText('Josua');
 await expect(page.locator('.exp-demo-stage')).not.toContainText('Josua');

 const nav=page.locator('.u13-mode-picker');
 await nav.getByRole('button',{name:'Quiztafel'}).click();
 let area=page.locator('.u13-practice');
 await expect(area).toHaveAttribute('data-u13-game','quiztafel');
 await area.getByRole('button',{name:'Quiztafel starten'}).click();
 await area.locator('.u13-pick button').first().click();
 await expect(area.locator('.u13-private-task')).toContainText('Noah');
 await expect(area.locator('.u13-public')).not.toContainText('Noah');
 await area.getByRole('button',{name:'Frage zeigen'}).click();
 await expect(area.locator('.u13-public')).toContainText('Wer baute');
 await expect(area.locator('.u13-public')).not.toContainText('Noah');
 await area.getByRole('button',{name:'Erstantwort richtig'}).click();
 await area.getByRole('button',{name:'Lösung veröffentlichen'}).click();
 await expect(area.locator('.u13-public')).toContainText('Noah');
 await area.getByRole('button',{name:'Punkte bestätigen'}).click();
 await expect(area.locator('.u13-points')).toContainText('100');

 await nav.getByRole('button',{name:'Verbindungen'}).click();
 area=page.locator('.u13-practice');
 await area.getByRole('button',{name:'Verbindungen starten'}).click();
 await area.getByRole('button',{name:'Aufgabe zeigen'}).click();
 await expect(area.locator('.u13-private-task')).toContainText('David');
 await expect(area.locator('.u13-public')).not.toContainText('David');
 await area.getByRole('button',{name:'Antwort richtig'}).click();
 await area.getByRole('button',{name:'Lösung zeigen'}).click();
 await expect(area.locator('.u13-public')).toContainText('David');
 await area.getByRole('button',{name:'Wertung bestätigen'}).click();
 await expect(area.locator('.u13-points')).toContainText('40');

 await nav.getByRole('button',{name:'Logikleiter'}).click();
 area=page.locator('.u13-practice');
 await area.getByRole('button',{name:'Logikleiter starten'}).click();
 await area.getByRole('button',{name:'Stufe veröffentlichen'}).click();
 await area.locator('.u13-team-decision').first().getByRole('button',{name:'Antwort sperren'}).click();
 await area.getByRole('button',{name:'Hinweis zeigen'}).click();
 await area.getByRole('button',{name:'Antwortphase schließen'}).click();
 await area.getByRole('button',{name:'Lösung auflösen'}).click();
 await area.locator('.u13-team-decision').first().getByRole('button',{name:'Richtig'}).click();
 for(let i=1;i<3;i++)await area.locator('.u13-team-decision').nth(i).getByRole('button',{name:'Keine Antwort'}).click();
 await area.getByRole('button',{name:'Punkte bestätigen'}).click();
 await expect(area.locator('.u13-points')).toContainText('10');

 await nav.getByRole('button',{name:'Umfrageduell'}).click();
 area=page.locator('.u13-practice');
 await area.getByRole('button',{name:'Umfrageduell starten'}).click();
 await area.getByRole('button',{name:'Umfrage zeigen'}).click();
 await expect(area.locator('.u13-public')).not.toContainText('Snacks');
 await area.getByRole('button',{name:'Antwortphase schließen'}).click();
 await expect(area.getByRole('button',{name:'Kategorien auflösen'})).toBeDisabled();
 for(let i=0;i<3;i++)await area.locator('.u13-team-decision').nth(i).getByRole('button',{name:'Snacks'}).click();
 await area.getByRole('button',{name:'Kategorien auflösen'}).click();
 await expect(area.locator('.u13-public')).toContainText('Snacks');
 await area.getByRole('button',{name:'Teamwertungen bestätigen'}).click();
 await expect(area.locator('.u13-points')).toContainText('20');

 await page.goto('/#/verlauf');
 await expect(page.locator('.exp-empty')).toContainText('Noch kein abgeschlossener Quizabend');
 await page.evaluate(async()=>{
  const data=await new Promise((resolve,reject)=>{
   const req=globalThis.indexedDB.open('ligoquiz.v2.sessions');
   req.onerror=()=>reject(req.error);
   req.onsuccess=()=>{
    const db=req.result,tx=db.transaction('events','readonly'),read=tx.objectStore('events').getAll();
    read.onerror=()=>reject(read.error);
    read.onsuccess=()=>{resolve(read.result);db.close();};
   };
  });
  if(data.length)throw Error('U13 trial accidentally persisted real events');
 });
});

test('U13 375px five-mode rehearsal preserves responsive controls and reset clears only local practice',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/demo');
 const games=['Rundenquiz','Quiztafel','Verbindungen','Logikleiter','Umfrageduell'];
 for(const game of games){
  await page.locator('.u13-mode-picker').getByRole('button',{name:game}).click();
  const overflow=await page.evaluate(()=>({
   width:globalThis.document.documentElement.scrollWidth,viewport:globalThis.innerWidth,
  }));
  expect(overflow.width,game+' mobile overflow').toBeLessThanOrEqual(overflow.viewport+3);
  if(game==='Rundenquiz')continue;
  const area=page.locator('.u13-practice');
  await expect(area.locator('.u13-public')).toBeVisible();
  await area.getByRole('button',{name:'Übung neu starten'}).click();
  await expect(area.locator('.u13-practice-head')).toContainText(game);
  await expect(area.locator('.u13-public')).toContainText('Warte auf die Spielleitung');
 }
});
