import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {
 createSession,transition,active,publicScene,wallAwards,eveningHalfPoints,NEEDS,
 type Session,type Profile,type Action,
} from '../src/games/verbindungen/engine';
import {trialVerbindungen} from '../src/games/verbindungen/trial-bank';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createEvent} from '../src/domain/event/transition';
import {derivePublicStage} from '../src/domain/event/public-projection';
import type {EventRecord} from '../src/domain/event/schemas';
const fixture=(n=4,profile:Profile='kurz')=>{
 const teams=Array.from({length:n},(_,i)=>({id:'team-'+i,name:'Team '+i,order:i}));
 return createSession({id:'vb-event',ownerId:'vb-host',profile,teams,puzzles:trialVerbindungen(profile,teams)});
};
const step=(s:Session,action:Action)=>transition(s,{id:'cmd-'+s.revision,ownerId:s.ownerId,
 epoch:s.epoch,expectedRevision:s.revision,at:100+s.revision,action});
const visibleClueCount=(s:Session)=>{const scene=publicScene(s);if(scene.kind!=='clues')throw Error('Expected clue scene');return scene.clues.length;};
const eventFor=(vb:Session):EventRecord=>createEvent({
 id:vb.id,hostId:vb.ownerId,at:100,verbindungen:vb,
 teams:vb.teams.map(t=>({...t,colorToken:'neutral'})),
 program:[{id:'vb-game',type:'verbindungen',profile:vb.profile,order:0,rulesVersion:'vb-trial-1'}],
 frozenTasks:vb.puzzles.map(p=>({
  taskId:p.id,gameType:'verbindungen' as const,
  publicPrompt:p.kind==='sequence'?p.prompt:p.kind==='clues'?'Vier Hinweise':'Verbindungswand',
  publicClues:p.kind==='clues'?[...p.clues]:[],
  privateAnswers:p.kind==='clues'?[p.target]:p.kind==='sequence'?[p.answer]:p.groups.map(g=>g.link),
  sourceContentId:p.id,sourceHash:'trial-content',moderatorNotes:'PRIVATE',
 })),
});
const envelope=(e:EventRecord,a:Action,id:string)=>({
 protocolVersion:1,eventId:e.id,commandId:id,hostId:e.hostId,hostEpoch:e.hostEpoch,
 expectedRevision:e.revision,issuedAtEpochMs:Date.now(),actor:'host',payload:{type:'VB_ACTION',action:a},
});
describe('G7 fair profiles',()=>{
 for(const profile of ['kurz','standard','lang'] as const)
  for(const n of [3,4,5])
   it('completes '+profile+' for '+n+' teams with equal opportunities',()=>{
    let s=fixture(n,profile);const planned=s.assignments;
    expect(planned).toHaveLength(n*(NEEDS[profile].clues+NEEDS[profile].sequences)+1);
    const counts:Record<string,{a:number;b:number}>=Object.fromEntries(s.teams.map(t=>[t.id,{a:0,b:0}]));
    for(const a of planned){
     if(!a.teamId)continue;
     const target=counts[a.teamId]!;
     if(a.kind==='clues')target.a++; else target.b++;
    }
    for(const entry of Object.values(counts)){
     expect(entry.a).toBe(NEEDS[profile].clues);
     expect(entry.b).toBe(NEEDS[profile].sequences);
    }
    s=step(s,{type:'START'});
    while(s.phase!=='complete'){
     const {puzzle}=active(s);
     s=step(s,{type:'PUBLISH'});
     if(puzzle.kind==='clues'){
      s=step(s,{type:'JUDGE',value:'correct'});
      s=step(s,{type:'REVEAL'});
      s=step(s,{type:'CONFIRM'});
      expect(s.awards.at(-1)?.points).toBe(40);
     } else if(puzzle.kind==='sequence'){
      s=step(s,{type:'JUDGE',value:'correct'});
      s=step(s,{type:'REVEAL'});
      s=step(s,{type:'CONFIRM'});
      expect(s.awards.at(-1)?.points).toBe(20);
     } else {
      s=step(s,{type:'CLOSE_WALL'});
      for(const group of puzzle.groups){
       s=step(s,{type:'REVEAL_WALL_GROUP'});
       for(const team of s.teams){
        s=step(s,{type:'MARK_GROUP',teamId:team.id,groupId:group.id,correct:true});
        s=step(s,{type:'MARK_LINK',teamId:team.id,groupId:group.id,correct:true});
       }
      }
      expect(wallAwards(s).map(x=>x.points)).toEqual(Array(n).fill(40));
      s=step(s,{type:'CONFIRM'});
     }
     s=step(s,{type:'NEXT'});
    }
    expect(s.awards).toHaveLength(planned.length-1+n);
    expect(s.index).toBe(planned.length);
   });
 it('clue lock is final and scores only its actual disclosed clue count',()=>{
  let s=fixture(3);s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  expect(visibleClueCount(s)).toBe(1);
  s=step(s,{type:'NEXT_CLUE'});
  expect(visibleClueCount(s)).toBe(2);
  s=step(s,{type:'JUDGE',value:'correct'});
  expect(()=>step(s,{type:'NEXT_CLUE'})).toThrow();
  expect(()=>step(s,{type:'JUDGE',value:'wrong'})).toThrow();
  expect(JSON.stringify(publicScene(s))).not.toContain('David');
  s=step(s,{type:'REVEAL'});
  expect(JSON.stringify(publicScene(s))).toContain('David');
  s=step(s,{type:'CONFIRM'});expect(s.awards[0]?.points).toBe(30);
 });
 it('wrong one-shot guess blocks more clues and earns zero',()=>{
  let s=fixture(3);s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'JUDGE',value:'wrong'});
  expect(()=>step(s,{type:'NEXT_CLUE'})).toThrow();
  s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});
  expect(s.awards[0]?.points).toBe(0);
 });
 it('rejects overlapping wall groups or too few puzzles',()=>{
  const s=fixture(3),wall=s.puzzles.find(p=>p.kind==='wall')!;
  if(wall.kind!=='wall')throw Error('missing wall');
  const bad={...wall,groups:wall.groups.map((g,i)=>i===1?{...g,tileIds:wall.groups[0]!.tileIds}:g)};
  expect(()=>createSession({...s,puzzles:s.puzzles.map(p=>p.id===wall.id?bad:p)})).toThrow();
  expect(()=>createSession({...s,puzzles:s.puzzles.slice(1)})).toThrow();
 });
 it('rejects a wall link score without its correct four-item group',()=>{
  let s=fixture(3);s=step(s,{type:'START'});
  while(active(s).puzzle.kind!=='wall'){
   s=step(s,{type:'PUBLISH'});s=step(s,{type:'JUDGE',value:'none'});
   s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});s=step(s,{type:'NEXT'});
  }
  s=step(s,{type:'PUBLISH'});s=step(s,{type:'CLOSE_WALL'});s=step(s,{type:'REVEAL_WALL_GROUP'});
  const puzzle=active(s).puzzle;const group=puzzle.kind==='wall'?puzzle.groups[0]!.id:'none';
  expect(()=>step(s,{type:'MARK_LINK',teamId:s.teams[0]!.id,groupId:group,correct:true})).toThrow();
  s=step(s,{type:'MARK_GROUP',teamId:s.teams[0]!.id,groupId:group,correct:false});
  expect(()=>step(s,{type:'MARK_LINK',teamId:s.teams[0]!.id,groupId:group,correct:true})).toThrow();
 });
 it('does not reveal wall connections before host closes and reveals each group',()=>{
  let s=fixture(3);s=step(s,{type:'START'});
  while(active(s).puzzle.kind!=='wall'){
   s=step(s,{type:'PUBLISH'});s=step(s,{type:'JUDGE',value:'none'});
   s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});s=step(s,{type:'NEXT'});
  }
  s=step(s,{type:'PUBLISH'});
  const initial=JSON.stringify(publicScene(s));
  expect(initial).not.toContain('Evangelien');
  expect(()=>step(s,{type:'REVEAL_WALL_GROUP'})).toThrow();
  s=step(s,{type:'CLOSE_WALL'});
  expect(JSON.stringify(publicScene(s))).not.toContain('Himmelsrichtungen');
  s=step(s,{type:'REVEAL_WALL_GROUP'});
  expect(()=>step(s,{type:'REVEAL_WALL_GROUP'})).toThrow();
  expect(JSON.stringify(publicScene(s))).toContain('Evangelien');
  expect(JSON.stringify(publicScene(s))).not.toContain('Himmelsrichtungen');
 });
 it('an unrevealed annulment remains zero and cannot subsequently leak answer by correction',()=>{
  let s=fixture(3);s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'ANNUL',reason:'Ambiguous puzzle'});
  expect(s.awards[0]).toMatchObject({points:0,annulled:true});
  expect(()=>step(s,{type:'CORRECT'})).toThrow();
  expect(JSON.stringify(publicScene(s))).not.toContain('David');
 });
 it('supports pause and correctly shared evening half-point ranks',()=>{
  let s=fixture(4);s=step(s,{type:'START'});s=step(s,{type:'PUBLISH'});
  s=step(s,{type:'PAUSE'});expect(publicScene(s).kind).toBe('paused');
  expect(()=>step(s,{type:'NEXT_CLUE'})).toThrow();
  s=step(s,{type:'RESUME'});s=step(s,{type:'JUDGE',value:'correct'});
  s=step(s,{type:'REVEAL'});s=step(s,{type:'CONFIRM'});
  expect(eveningHalfPoints(s)).toEqual({'team-0':8,'team-1':4,'team-2':4,'team-3':4});
 });
});
describe('G7 authoritative G2 ledger and stage privacy',()=>{
 it('atomically commits and corrects awards with idempotent retry',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'vb-db-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture(3));await repo.create(e);
   const send=async(a:Action,id:string)=>{
    const result=await repo.dispatch(envelope(e,a,id));
    e=(await repo.get(e.id))!;
    return result;
   };
   await send({type:'START'},'start');await send({type:'PUBLISH'},'publish');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('David');
   await send({type:'JUDGE',value:'correct'},'judge');
   expect(JSON.stringify(derivePublicStage(e))).not.toContain('David');
   await send({type:'REVEAL'},'reveal');
   expect(JSON.stringify(derivePublicStage(e))).toContain('David');
   const cmd=envelope(e,{type:'CONFIRM'},'commit');
   expect((await repo.dispatch(cmd)).effect).toBe('committed');
   expect((await repo.dispatch(cmd)).effect).toBe('already-committed');
   e=(await repo.get(e.id))!;
   expect((await repo.getScores(e.id))['team-0']).toBe(40);
   await send({type:'CORRECT'},'correct');
   expect((await repo.getScores(e.id))['team-0']).toBe(0);
   await send({type:'CONFIRM'},'reconfirm');
   expect((await repo.getScores(e.id))['team-0']).toBe(40);
   expect((await repo.getOutcomes(e.id)).filter(x=>x.status==='void')).toHaveLength(1);
   expect((await repo.getOutcomes(e.id)).filter(x=>x.status==='active')).toHaveLength(1);
   expect((await repo.getAudit(e.id)).some(x=>x.kind==='VB_ACTION')).toBe(true);
  }finally{await repo.close();}
 });
 it('fences original host after explicit takeover',async()=>{
  const repo=new EventRepository(fakeIndexedDB,'vb-takeover-'+crypto.randomUUID());
  try{
   let e=eventFor(fixture(3));await repo.create(e);
   await repo.dispatch(envelope(e,{type:'START'},'start'));
   e=(await repo.get(e.id))!;
   await repo.takeover({eventId:e.id,commandId:'handoff',newHostId:'new-host',
     expectedRevision:e.revision,expectedEpoch:e.hostEpoch,at:300,
     reason:'Moderatorfenster ersetzt',acknowledged:true});
   const next=(await repo.get(e.id))!;
   expect(next.verbindungen).toMatchObject({ownerId:'new-host',epoch:2,paused:true});
   await expect(repo.dispatch({...envelope(next,{type:'RESUME'},'stale'),hostId:e.hostId}))
     .rejects.toMatchObject({code:'STALE_HOST'});
   await repo.dispatch(envelope(next,{type:'RESUME'},'resume'));
   expect((await repo.get(e.id))?.lifecycle).toBe('active');
  }finally{await repo.close();}
 });
});
