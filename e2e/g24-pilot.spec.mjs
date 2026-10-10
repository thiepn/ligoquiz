import {test,expect} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
const evidence='test-results/g24-evidence';
const storageKey='ligoquiz.v2.g24.local-pilot-draft.v1';

test('G24 real pilot toolbar filters 15 scenarios, gives five-game run cards and retains NO_GO',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:1280,height:720});
 await page.goto('/#/technik');
 const board=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const toolbar=board.getByRole('region',{name:'G24 Spielabend-Operator'});
 const list=board.getByRole('group',{name:'15 Probeszenarien'});
 await expect(toolbar).toContainText('NO-GO');
 await expect(toolbar).toContainText('15');
 await expect(list.getByRole('button')).toHaveCount(15);
 await toolbar.getByRole('combobox',{name:'G24 Spieltyp'}).selectOption('quiztafel');
 await toolbar.getByRole('combobox',{name:'G24 Teamzahl'}).selectOption('4');
 await expect(list.getByRole('button')).toHaveCount(1);
 await expect(list.getByRole('button',{name:/Quiztafel · 4 Teams/})).toBeVisible();
 await list.getByRole('button').click();
 const active=board.getByRole('group',{name:'Ausgewähltes Probeszenario'});
 await expect(active.getByRole('region',{name:'G24 Laufkarte für gewählten Fall'})).toContainText('Übernahme');
 const downloaded=page.waitForEvent('download');
 await active.getByRole('button',{name:'Laufkarte als Text speichern'}).click();
 const file=await downloaded;
 expect(file.suggestedFilename()).toContain('quiztafel-4');
 const text=(await readFile(await file.path())).toString('utf8');
 expect(text).toContain('4 Teams');
 expect(text).toContain('NO_GO');
 expect(text).toContain('Beamer');
 await toolbar.getByRole('combobox',{name:'G24 Statusfilter'}).selectOption('defect');
 await expect(list.getByRole('button')).toHaveCount(0);
 await toolbar.getByRole('combobox',{name:'G24 Spieltyp'}).selectOption('all');
 await toolbar.getByRole('combobox',{name:'G24 Teamzahl'}).selectOption('0');
 await toolbar.getByRole('combobox',{name:'G24 Statusfilter'}).selectOption('all');
 await toolbar.getByRole('button',{name:'Nächsten offenen Fall öffnen'}).click();
 await expect(list.getByRole('button',{name:/Quiztafel · 5 Teams/})).toHaveAttribute('aria-pressed','true');
 await expect(board.getByRole('table',{name:'Release-Status nach Eigentümerschaft'}).getByRole('cell',{name:'OFFEN'})).toHaveCount(6);
 await toolbar.screenshot({path:evidence+'/g24-operator-dashboard-1280.png'});
});

test('G24 deliberate session-local draft restore survives tab reload, clears only G24 data and never approves',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.goto('/#/technik');
 const board=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const active=board.getByRole('group',{name:'Ausgewähltes Probeszenario'});
 await page.evaluate(()=>{globalThis.sessionStorage.setItem('ligo.quiz.content.library.v1','KEEP-LEGACY');
  globalThis.sessionStorage.setItem('other.app.note','KEEP-OTHER');});
 await active.getByRole('combobox',{name:'Status: Beamer und Leseabstand'}).selectOption('reported');
 await active.getByRole('combobox',{name:'Status: Absturz und Wiederherstellung'}).selectOption('defect');
 await active.getByRole('textbox',{name:'Beobachtungen und offene Defekte'}).fill('Synthetisches CI-Problem, kein echtes Ereignis');
 await expect.poll(()=>page.evaluate(key=>globalThis.sessionStorage.getItem(key),storageKey))
  .toContain('Synthetisches CI-Problem');
 await page.reload();
 const board2=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 await expect(board2.getByRole('region',{name:'G24 Spielabend-Operator'})
  .getByRole('group',{name:'G24 lokalen Entwurf wiederherstellen'})).toBeVisible();
 const active2=board2.getByRole('group',{name:'Ausgewähltes Probeszenario'});
 await expect(active2.getByRole('combobox',{name:'Status: Absturz und Wiederherstellung'})).toHaveValue('open');
 await board2.getByRole('button',{name:'Lokalen Entwurf wiederherstellen'}).click();
 await expect(active2.getByRole('combobox',{name:'Status: Absturz und Wiederherstellung'})).toHaveValue('defect');
 await expect(active2.getByRole('textbox',{name:'Beobachtungen und offene Defekte'}))
  .toHaveValue('Synthetisches CI-Problem, kein echtes Ereignis');
 await expect(board2).toContainText('NO-GO · KEINE FREIGABE');
 await board2.getByRole('button',{name:'Nur lokalen Zwischenstand verwerfen'}).click();
 const keys=await page.evaluate(key=>({
  draft:globalThis.sessionStorage.getItem(key),
  legacy:globalThis.sessionStorage.getItem('ligo.quiz.content.library.v1'),
  other:globalThis.sessionStorage.getItem('other.app.note')}),storageKey);
 expect(keys).toEqual({draft:null,legacy:'KEEP-LEGACY',other:'KEEP-OTHER'});
 await expect(active2.getByRole('combobox',{name:'Status: Absturz und Wiederherstellung'})).toHaveValue('defect');
});

test('G24 keyboard and 200-percent mobile runbook are legible and manually navigable',async({page})=>{
 await mkdir(evidence,{recursive:true});
 await page.setViewportSize({width:640,height:800});
 await page.goto('/#/technik');
 await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
 const board=page.getByRole('region',{name:'G18 Generalprobe und Release-Sperren'});
 const toolbar=board.getByRole('region',{name:'G24 Spielabend-Operator'});
 const selector=toolbar.getByRole('combobox',{name:'G24 Spieltyp'});
 await selector.focus();
 await expect(selector).toBeFocused();
 await selector.selectOption('umfrageduell');
 await expect(board.getByRole('group',{name:'15 Probeszenarien'}).getByRole('button')).toHaveCount(3);
 await expect(toolbar).toContainText('Browser-Session-Zwischenstand');
 expect(await toolbar.evaluate(el=>el.scrollWidth<=el.clientWidth+3)).toBe(true);
 await toolbar.screenshot({path:evidence+'/g24-operator-mobile-200pct.png'});
});
