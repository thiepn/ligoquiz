import {describe,expect,it} from 'vitest';
import type {EventRecord} from '../src/domain/event/schemas';
import type {EventRepository} from '../src/infrastructure/db/event-repository';
import {
 createPreparedRundenquiz,createPreparedQuiztafel,createPreparedVerbindungen,
 createPreparedLogikleiter,createPreparedUmfrageduell,
} from '../src/features/experience/model';
import {originalAnswerSheetPlan,printableTeamSheets} from '../src/features/host/team-answer-sheets';

const base={teams:['Nord','Mitte','Süd','Vier','Fünf'],count:3 as const,profile:'kurz' as const};
async function original(fn:(repo:EventRepository,input:typeof base)=>Promise<unknown>):Promise<EventRecord>{
 let out:EventRecord|null=null;
 const repo={create:async(e:EventRecord)=>{out=e;}} as unknown as EventRepository;
 await fn(repo,base);
 if(!out)throw Error('Expected original prepared event');
 return out;
}
describe('U17 only original prepared game skeletons can print team answer sheets',()=>{
 it.each([
  ['Rundenquiz',createPreparedRundenquiz,'Wissen'],
  ['Quiztafel',createPreparedQuiztafel,'Spielzug'],
  ['Verbindungen',createPreparedVerbindungen,'Vier Hinweise'],
  ['Logikleiter',createPreparedLogikleiter,'Stufe'],
  ['Umfrageduell',createPreparedUmfrageduell,'Umfrage'],
 ] as const)('%s has actual canonical paper task count with no answer, source, prompts or frozen IDs',
 async(game,fn,label)=>{
  const event=await original(fn);
  const before=JSON.stringify(event);
  const plan=originalAnswerSheetPlan(event);
  expect(plan).not.toBeNull();
  expect(plan?.game).toBe(game);
  expect(plan?.teams.map(t=>t.name)).toEqual(['Nord','Mitte','Süd']);
  const count=event.rundenquiz?.questions.length??event.quiztafel?.tiles.length??
   event.verbindungen?.assignments.length??event.logikleiter?.rungs.length??
   event.umfrageduell?.surveys.length;
  expect(plan?.tasks.length).toBe(count);
  expect(plan?.tasks.some(t=>t.label.includes(label))).toBe(true);
  const html=printableTeamSheets(plan!,{teamId:'all',answerLines:3});
  expect(html).toContain('Antwortbögen drucken');
  expect(html).toContain('break-after:page');
  expect(html).toContain('Antwortbögen · 3 Teams');
  expect((html.match(/class="sheet"/g)??[]).length).toBeGreaterThanOrEqual(3);
  expect(html).toContain('Nord');
  expect(html).toContain('Mitte');
  expect(html).toContain('Süd');
  expect(html).not.toContain(event.hostId);
  expect(html).not.toContain(event.id);
  expect(html).not.toContain(event.frozenTasks[0]!.privateAnswers[0]!);
  // Generic game headings may legitimately appear as paper section labels.
  if(!['Vier Hinweise','Verbindungswand','Folge ergänzen'].includes(event.frozenTasks[0]!.publicPrompt))
   expect(html).not.toContain(event.frozenTasks[0]!.publicPrompt);
  expect(html).not.toContain(event.frozenTasks[0]!.sourceHash);
  expect(JSON.stringify(event)).toBe(before);
 });
 it('provides independent original roster selection and variable physical writing space',async()=>{
  const plan=originalAnswerSheetPlan(await original(createPreparedRundenquiz))!;
  const each=printableTeamSheets(plan,{teamId:plan.teams[1]!.id,answerLines:4});
  expect((each.match(/class="sheet"/g)??[]).length).toBeGreaterThan(0);
  expect(each).toContain('TEAM Mitte');
  expect(each).not.toContain('TEAM Nord');
  expect(each).not.toContain('TEAM Süd');
  const four=(each.match(/class="line"/g)??[]).length;
  const two=printableTeamSheets(plan,{teamId:plan.teams[1]!.id,answerLines:2});
  expect(four).toBe(plan.tasks.length*4);
  expect((two.match(/class="line"/g)??[]).length).toBe(plan.tasks.length*2);
  expect(()=>printableTeamSheets(plan,{teamId:'forged',answerLines:3})).toThrow();
  expect(()=>printableTeamSheets(plan,{teamId:'all',answerLines:5 as 4})).toThrow();
 });
 it('escapes adversarial team names and never adds scripts from editable roster',async()=>{
  const event=await original(createPreparedQuiztafel);
  const modified={...event,teams:event.teams.map((t,i)=>i===0?{
   ...t,name:'<img src=x onerror="alert(1)">&"' }:t)};
  const plan=originalAnswerSheetPlan(modified)!;
  const html=printableTeamSheets(plan,{teamId:'all',answerLines:2});
  expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&quot;');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('src=x onerror="');
  expect(html).toContain('default-src &#39;none&#39;');
 });
 it('rejects completed, abandoned and recovery-locked sessions before any print',async()=>{
  const event=await original(createPreparedLogikleiter);
  for(const alteration of [{lifecycle:'complete' as const},{lifecycle:'abandoned' as const},
   {recoveryRequired:true}]){
   expect(originalAnswerSheetPlan({...event,...alteration})).toBeNull();
  }
  expect(originalAnswerSheetPlan({...event,teams:event.teams.slice(0,2)})).toBeNull();
 });
});
