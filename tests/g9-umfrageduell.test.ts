import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {FORMAT_COUNTS,createSession,transition,currentSurvey,pointsFor,scores,publicScene,
  suggestMatch,eveningHalfPoints,validateContent,type Profile,type Session,type Action,type Submission} from '../src/games/umfrageduell/engine';
import {trialUmfrageduell} from '../src/games/umfrageduell/trial-bank';
import {createEvent} from '../src/domain/event/transition';
import {derivePublicStage} from '../src/domain/event/public-projection';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import type {EventRecord} from '../src/domain/event/schemas';

const fixture=(n=3,profile:Profile='standard')=>{
 const teams=Array.from({length:n},(_,i)=>({id:'ud-team-'+i,name:'Team '+i,order:i}));
 return createSession({id:'ud-event',ownerId:'ud-host',profile,teams,surveys:trialUmfrageduell(profile)});
};
const step=(s:Session,action:Action)=>transition(s,{
 id:'ud-command-'+s.revision,ownerId:s.ownerId,epoch:s.epoch,
 expectedRevision:s.revision,at:s.revision+100,action,
});
const answer=(rank:1|2|3|4|5):Submission=>({answers:['Auswahl'],mapped:[rank]});
const none:Submission={answers:[],mapped:[]};
function taskEvent(ud:Session):EventRecord{return createEvent({
 id:ud.id,hostId:ud.ownerId,at:100,umfrageduell:ud,
 teams:ud.teams.map(t=>({...t,colorToken:'neutral'})),
 program:[{id:'ud-game',type:'umfrageduell',profile:ud.profile,order:0,rulesVersion:'ud-trial-1'}],
 frozenTasks:ud.surveys.map(q=>({
  taskId:q.id,gameType:'umfrageduell' as const,publicPrompt:q.prompt,
  publicClues:[],privateAnswers:q.categories.map(x=>x.label),
  moderatorNotes:'PRIVATE',sourceContentId:q.id,sourceHash:'test-data',
 })),
});}
const env=(e:EventRecord,a:Action,id:string)=>({
 protocolVersion:1,eventId:e.id,commandId:id,hostId:e.hostId,
 hostEpoch:e.hostEpoch,expectedRevision:e.revision,issuedAtEpochMs:Date.now(),actor:'host',
 payload:{type:'UD_ACTION',action:a},
});
describe('G9 survey rubric',()=>{
 it('Beliebteste Antwort awards five positive ranks and outside zero',()=>{
  const t=trialUmfrageduell('kurz')[0]!;
  expect([1,2,3,4,5].map(r=>pointsFor(t,answer(r as 1|2|3|4|5)))).toEqual([20,15,10,5,2]);
  expect(pointsFor(t,{answers:['Unbekannt'],mapped:[null]})).toBe(0);
  expect(pointsFor(t,none)).toBe(0);
 });
 it('Top 3 distinguishes exact ranks, wrong positions, non-top3 and duplicate guesses',()=>{
  const t=trialUmfrageduell('standard').at(-1)!;
  expect(t.format).toBe('top3');
  expect(pointsFor(t,{answers:['A','B','C'],mapped:[1,2,3]})).toBe(30);
  expect(pointsFor(t,{answers:['B','A','C'],mapped:[2,1,3]})).toBe(20);
  expect(pointsFor(t,{answers:['C','D','A'],mapped:[3,4,1]})).toBe(10);
  expect(pointsFor(t,{answers:['D','E','X'],mapped:[4,5,null]})).toBe(0);
  expect(pointsFor(t,{answers:['A','A','B'],mapped:[1,1,2]})).toBe(15);
  expect(pointsFor(t,none)).toBe(0);
 });
 it('does not assign categories when answer is ambiguous or absent',()=>{
  const task=trialUmfrageduell('standard')[0]!;
  expect(suggestMatch(task,' KNABBEREIEN ')).toBe(1);
  expect(suggestMatch(task,'Snacks')).toBe(1);
  expect(suggestMatch(task,'keine Zuordnung')).toBe(null);
 });
 it('rejects synonym collisions, missing provenance and spoofed observed surveys',()=>{
  const teams=fixture().teams;
  const tasks=trialUmfrageduell('standard');
  expect(()=>validateContent(teams,'standard',tasks.slice(1))).toThrow();
  const broken=structuredClone(tasks);
  broken[0]!.categories[1]!.synonyms.push('Knabbereien');
  expect(()=>validateContent(teams,'standard',broken)).toThrow();
  const observed=structuredClone(tasks);
  observed[0]!.source={kind:'observed',source:'',population:'',method:'',collectedOn:'',limitations:'',reviewed:true};
  expect(()=>validateContent(teams,'standard',observed)).toThrow();
 });
 for(const n of [3,4,5])for(const profile of ['kurz','standard','lang'] as const)
  it('plays '+n+' teams / '+profile+' without automatic reveal',()=>{
   let s=fixture(n,profile),counts=FORMAT_COUNTS[profile];
   expect(s.surveys.length).toBe(counts.popular+counts.top3);
   s=step(s,{type:'START'});
   for(let i=0;i<s.surveys.length;i++){
    const task=currentSurvey(s);
    s=step(s,{type:'PUBLISH'});
    const prompt=publicScene(s);
    expect(prompt.kind).toBe('prompt');
    expect('categories' in prompt).toBe(false);
    expect(JSON.stringify(prompt)).toContain('illustrative');
    expect(()=>step(s,{type:'REVEAL'})).toThrow();
    s=step(s,{type:'CLOSE'});
    expect(()=>step(s,{type:'REVEAL'})).toThrow();
    for(const team of s.teams){
     const submission=task.format==='popular'?answer(1):
      {answers:['A','B','C'],mapped:[1,2,3]} as Submission;
     s=step(s,{type:'RECORD',teamId:team.id,submission});
    }
    s=step(s,{type:'REVEAL'});
    expect(publicScene(s).kind).toBe('reveal');
    s=step(s,{type:'CONFIRM'});
    s=step(s,{type:'NEXT'});
   }
   expect(s.phase).toBe('complete');
   const max=counts.popular*20+counts.top3*30;
   expect(Object.values(scores(s))).toEqual(Array(n).fill(max));
   expect(Object.values(eveningHalfPoints(s))).toEqual(Array(n).fill(n+1));
  });
 it('locks submissions after reveal and requires reasons to correct/annul',()=>{
  let s=fixture();s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  expect(()=>step(s,{type:'RECORD',teamId:s.teams[0]!.id,submission:answer(1)})).toThrow();
  s=step(s,{type:'CLOSE'});
  for(const team of s.teams)s=step(s,{type:'RECORD',teamId:team.id,submission:answer(1)});
  s=step(s,{type:'REVEAL'});
  expect(()=>step(s,{type:'RECORD',teamId:s.teams[0]!.id,submission:answer(2)})).toThrow();
  s=step(s,{type:'CONFIRM'});
  expect(()=>step(s,{type:'CORRECT',teamId:s.teams[0]!.id,submission:answer(2),reason:''})).toThrow();
  s=step(s,{type:'CORRECT',teamId:s.teams[0]!.id,submission:answer(2),reason:'Falsche Zuordnung'});
  expect(scores(s)[s.teams[0]!.id]).toBe(15);
  expect(s.audit.at(-1)?.action).toBe('CORRECT');
  s=step(s,{type:'ANNUL',reason:'Uneindeutige Antwortkategorien'});
  expect(s.awards.every(a=>a.annulled&&a.points===0)).toBe(true);
  expect(()=>step(s,{type:'CORRECT',teamId:s.teams[0]!.id,submission:answer(1),reason:'Korrigieren'})).toThrow();
 });
 it('pauses safely with authoritative submissions preserved',()=>{
  let s=fixture();s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'CLOSE'});
  s=step(s,{type:'RECORD',teamId:s.teams[0]!.id,submission:answer(2)});
  s=step(s,{type:'PAUSE'});expect(publicScene(s).kind).toBe('paused');
  expect(()=>step(s,{type:'REVEAL'})).toThrow();
  s=step(s,{type:'RESUME'});
  expect(s.submissions[s.teams[0]!.id]?.mapped).toEqual([2]);
 });
});
describe('G9 IDB ledger and projection privacy',()=>{
 it('commits each score once, voids revised scores, fences old hosts',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'ud-test-'+crypto.randomUUID());
  try{
   let e=taskEvent(fixture());
   await repo.create(e);
   const send=async(action:Action,id:string)=>{
    const r=await repo.dispatch(env(e,action,id));e=(await repo.get(e.id))!;return r;
   };
   await send({type:'START'},'start');await send({type:'PUBLISH'},'publish');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('Knabbereien');
   await send({type:'CLOSE'},'close');
   for(const team of e.teams)await send({type:'RECORD',teamId:team.id,submission:answer((team.order+1) as 1|2|3)},'team-'+team.id);
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('Knabbereien');
   await send({type:'REVEAL'},'reveal');
   expect(JSON.stringify(derivePublicStage(e))).toContain('Snacks');
   const cmd=env(e,{type:'CONFIRM'},'confirm');
   expect((await repo.dispatch(cmd)).effect).toBe('committed');
   expect((await repo.dispatch(cmd)).effect).toBe('already-committed');
   e=(await repo.get(e.id))!;
   expect(await repo.getScores(e.id)).toEqual({'ud-team-0':20,'ud-team-1':15,'ud-team-2':10});
   await send({type:'CORRECT',teamId:'ud-team-0',submission:answer(5),reason:'Antwortzuordnung falsch'},'correct');
   expect(await repo.getScores(e.id)).toEqual({'ud-team-0':2,'ud-team-1':15,'ud-team-2':10});
   expect((await repo.getOutcomes(e.id)).filter(o=>o.status==='void')).toHaveLength(3);
   await repo.takeover({eventId:e.id,commandId:'takeover',newHostId:'ud-host-2',
    expectedRevision:e.revision,expectedEpoch:e.hostEpoch,at:300,
    reason:'Wechsel Spielleitung',acknowledged:true});
   const changed=(await repo.get(e.id))!;
   expect(changed.umfrageduell?.submissions['ud-team-0']?.mapped).toEqual([5]);
   expect(changed.umfrageduell?.paused).toBe(true);
   await expect(repo.dispatch({...env(changed,{type:'RESUME'},'old'),hostId:e.hostId}))
    .rejects.toMatchObject({code:'STALE_HOST'});
   await repo.dispatch(env(changed,{type:'RESUME'},'new'));
  }finally{await repo.close();}
 });
});
