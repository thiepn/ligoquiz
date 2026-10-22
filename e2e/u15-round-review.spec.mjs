import {test,expect} from '@playwright/test';

const MODES=[
 {name:'Rundenquiz',engine:'rundenquiz',answer:'Josua'},
 {name:'Quiztafel',engine:'quiztafel',answer:'Noah'},
 {name:'Verbindungen',engine:'verbindungen',answer:'David'},
 {name:'Logikleiter',engine:'logikleiter',answer:null},
 {name:'Umfrageduell',engine:'umfrageduell',answer:'Snacks'},
];

async function createOriginal(page,mode){
 await page.goto('/#/setup');
 await page.getByRole('combobox',{name:'Anzahl der Teams'}).selectOption('3');
 await page.getByRole('button',{name:'Weiter'}).click();
 if(mode.engine!=='rundenquiz')await page.getByRole('button',{name:new RegExp(mode.name)}).click();
 await page.getByRole('button',{name:'Weiter'}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Spielleitung öffnen'}).click();
 await expect(page).toHaveURL(/#\/host$/);
 return page.evaluate(()=>{
  const x=JSON.parse(globalThis.sessionStorage.getItem('ligoquiz.v2.g4.rundenquiz.host'));
  if(!x?.eventId)throw Error('No original host event');
  return x.eventId;
 });
}

/** Synthetic COMPLETED fixture constructed from the app's ORIGINAL prepared question bank.
 * Browser tests exercise archive presentation, not fabricate a completed live host history. */
async function seedCompletedBrowserFixture(page,eventId,engine){
 return page.evaluate(async({eventId,engine})=>{
  const db=await new Promise((resolve,reject)=>{
   const request=globalThis.indexedDB.open('ligoquiz.v2.sessions');
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  const read=await new Promise((resolve,reject)=>{
   const tx=db.transaction('events','readonly');
   const request=tx.objectStore('events').get(eventId);
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>reject(request.error);
  });
  if(!read||!read[engine])throw Error('Missing canonical engine');
  const original=read[engine],teams=original.teams;
  const teamId=teams[0].id;
  let firstAnswer='';
  if(engine==='rundenquiz'){
   const questions=original.questions;
   firstAnswer=questions[0].answer;
   read.rundenquiz={...original,phase:'complete',index:questions.length-1,
    awards:questions.flatMap((q,i)=>teams.map((t,j)=>({
     questionId:q.id,teamId:t.id,points:i===0&&j===0?10:0,
     judgement:i===0&&j===0?'richtig':'keine',
    })))};
  }else if(engine==='quiztafel'){
   const tiles=[...original.tiles].reverse();
   firstAnswer=tiles[0].answer;
   read.quiztafel={...original,phase:'complete',turn:tiles.length,
    usedTileIds:tiles.map(t=>t.id),
    outcomes:tiles.map((t,i)=>({
     tileId:t.id,selectorId:teamId,stealerId:null,winnerId:i===0?teamId:null,
     points:i===0?t.value:0,annulled:false,
    }))};
  }else if(engine==='verbindungen'){
   const a=original.assignments,p=original.puzzles;
   firstAnswer=p.find(t=>t.id===a[0].puzzleId).target;
   read.verbindungen={...original,phase:'complete',index:a.length,
    awards:a.flatMap((task,i)=>task.teamId?[{
     puzzleId:task.puzzleId,teamId:task.teamId,points:i===0?40:0,annulled:false,
    }]:teams.map(t=>({puzzleId:task.puzzleId,teamId:t.id,points:0,annulled:false})))};
  }else if(engine==='logikleiter'){
   const rungs=original.rungs;
   firstAnswer=rungs[0].answer;
   read.logikleiter={...original,phase:'complete',index:rungs.length,
    awards:rungs.flatMap((r,i)=>teams.map((t,j)=>({
     rungId:r.id,teamId:t.id,points:i===0&&j===0?10:0,annulled:false,
    })))};
  }else if(engine==='umfrageduell'){
   const surveys=original.surveys;
   firstAnswer=surveys[0].categories[0].label;
   read.umfrageduell={...original,phase:'complete',index:surveys.length,
    awards:surveys.flatMap((s,i)=>teams.map((t,j)=>({
     surveyId:s.id,teamId:t.id,points:i===0&&j===0?20:0,annulled:false,
    })))};
  }
  read.lifecycle='complete';
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('events','readwrite');
   tx.objectStore('events').put(read);
   tx.oncomplete=resolve;
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
  return {answer:firstAnswer,snapshot:JSON.stringify(read)};
 },{eventId,engine});
}

for(const mode of MODES){
 test('U15 completed original '+mode.name+' question recap, source reveal and read-only team filters',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  const eventId=await createOriginal(page,mode);
  const {answer,snapshot}=await seedCompletedBrowserFixture(page,eventId,mode.engine);
  await page.goto('/#/bericht?event='+eventId);
  const review=page.getByRole('region',{name:'Rundenrückblick'});
  await expect(review).toBeVisible();
  await expect(review).toHaveAttribute('data-review-game',mode.name);
  await expect(review.locator('.u15-review-task-list button').first()).toBeVisible();
  await expect(review.locator('.u15-review-detail')).not.toContainText(answer);
  await review.getByRole('button',{name:'Lösung und Quelle prüfen'}).click();
  await expect(review.locator('.u15-review-solution')).toContainText(answer);
  await expect(review.locator('.u15-review-source')).not.toBeEmpty();
  await review.getByRole('button',{name:'Nächste Aufgabe'}).click();
  await expect(review.getByRole('button',{name:'Lösung und Quelle prüfen'})).toBeVisible();
  await expect(review.locator('.u15-review-solution')).toHaveCount(0);

  const teamOptions=await review.getByRole('combobox',{name:'Team im Rückblick'}).locator('option').allTextContents();
  expect(teamOptions.length).toBeGreaterThanOrEqual(4);
  await review.getByRole('combobox',{name:'Team im Rückblick'}).selectOption({index:1});
  await review.getByRole('combobox',{name:'Aufgaben filtern'}).selectOption('scored');
  await expect(review.locator('.u15-review-task-list button')).toHaveCount(1);
  await expect(review.locator('.u15-review-points-row')).toHaveCount(1);
  await expect(review.locator('.u15-review-detail')).toContainText(teamOptions[1]);
  await expect(review.locator('.u15-review-standings')).toContainText(teamOptions[2]);
  const width=await page.evaluate(()=>({
   actual:globalThis.document.documentElement.scrollWidth,window:globalThis.innerWidth,
  }));
  expect(width.actual,mode.name+' 375px archive overflow').toBeLessThanOrEqual(width.window+3);
  const after=await page.evaluate(async(id)=>{
   const db=await new Promise((resolve,reject)=>{
    const req=globalThis.indexedDB.open('ligoquiz.v2.sessions');
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   const value=await new Promise((resolve,reject)=>{
    const tx=db.transaction('events','readonly'),req=tx.objectStore('events').get(id);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   db.close();
   return JSON.stringify(value);
  },eventId);
  expect(after).toBe(snapshot);
 });
}

test('U15 never renders unrevealed original questions for an unfinished session',async({page})=>{
 const eventId=await createOriginal(page,MODES[0]);
 await page.goto('/#/bericht?event='+eventId);
 await expect(page.getByRole('region',{name:'Rundenrückblick'})).toHaveCount(0);
 await expect(page.getByRole('alert')).toContainText('Kein abgeschlossener Bericht');
});
