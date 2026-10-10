import {describe,it,expect} from 'vitest';
import {indexedDB as fakeIndexedDB} from 'fake-indexeddb';
import {EventRepository} from '../src/infrastructure/db/event-repository';
import {createPreparedRundenquiz,createPreparedQuiztafel,createPreparedVerbindungen,
 createPreparedLogikleiter,createPreparedUmfrageduell,newSetupDraft} from '../src/features/experience/model';
import {scoreDecisionFor,composeScoreRows} from '../src/features/host/score-decision';
import {reviewPacket,evidenceSource} from '../src/features/experience/visual-evidence';
import * as rq from '../src/games/rundenquiz/engine';
import * as vb from '../src/games/verbindungen/engine';
import * as ll from '../src/games/logikleiter/engine';
import * as ud from '../src/games/umfrageduell/engine';

describe('G16 point decisions, no state mutation',()=>{
 it('makes exact before / change / after rows; refuses unknown teams and invalid scores',()=>{
  const teams=[{id:'a',name:'Nord'},{id:'b',name:'Süd'}];
  expect(composeScoreRows(teams,{a:10,b:6},[{teamId:'a',points:12}],false))
   .toEqual([{teamId:'a',name:'Nord',before:10,change:12,after:22},
             {teamId:'b',name:'Süd',before:6,change:0,after:6}]);
  expect(composeScoreRows(teams,{a:22,b:6},[{teamId:'a',points:12}],true)[0])
   .toMatchObject({before:10,change:12,after:22});
  expect(()=>composeScoreRows(teams,{a:0,b:0},[{teamId:'x',points:1}],false)).toThrow(/Unbekannt|Ungült/);
  expect(()=>composeScoreRows(teams,{a:NaN,b:0},[],false)).toThrow(/Punktestand/);
  expect(composeScoreRows(teams,{a:7,b:8},null,false).map(x=>x.after)).toEqual([null,null]);
 });
 it('previews pending versus committed awards from actual Rundenquiz engine',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g16-rq-'+crypto.randomUUID());
  try{
   const id=await createPreparedRundenquiz(db,newSetupDraft());
   const e=await db.get(id.eventId),s=e!.rundenquiz!;
   const first=rq.currentQuestion(s)!;
   const entries=Object.fromEntries(s.teams.map(t=>[t.id,{
    judgement:'richtig' as const,lockLevel:1,estimate:null
   }]));
   const revealed={...s,phase:'revealed' as const,entries};
   const pending=scoreDecisionFor({game:'rundenquiz',session:revealed});
   expect(pending?.status).toBe('pending');
   const generated=rq.taskAwards(revealed);
   const stored={...revealed,phase:'graded' as const,awards:generated};
   const committed=scoreDecisionFor({game:'rundenquiz',session:stored});
   expect(committed?.status).toBe('committed');
   expect(committed?.rows.map(x=>x.after)).toEqual(pending?.rows.map(x=>x.after));
   expect(s.awards).toHaveLength(0);
  }finally{await db.close();}
 });
 it('all five modes render incomplete or actual scorer-backed preliminary results',async()=>{
  const db=new EventRepository(fakeIndexedDB,'g16-modes-'+crypto.randomUUID());
  try{
   const draft=newSetupDraft();
   const ids=await Promise.all([
    createPreparedQuiztafel(db,draft),createPreparedVerbindungen(db,draft),
    createPreparedLogikleiter(db,draft),createPreparedUmfrageduell(db,draft)]);
   const events=await Promise.all(ids.map(id=>db.get(id.eventId)));
   const q=events[0]!.quiztafel!;
   const tile=q.tiles[0]!;
   const quiz=scoreDecisionFor({game:'quiztafel',session:{...q,phase:'revealed',selectedTileId:tile.id,
    primaryResult:'correct',candidate:'selector'}});
   expect(quiz?.status).toBe('pending');
   expect(quiz?.rows.some(row=>row.change===tile.value)).toBe(true);
   const v=events[1]!.verbindungen!;
   const active=vb.active(v);
   const assignment=active.assignment;
   const vbReady={...v,phase:'revealed' as const,judgement:'correct' as const};
   if(active.puzzle.kind!=='wall'&&assignment.teamId){
    const preview=scoreDecisionFor({game:'verbindungen',session:vbReady});
    expect(preview?.status).toBe('pending');
    expect(preview?.rows.some(row=>(row.change??0)>0)).toBe(true);
   }
   const l=events[2]!.logikleiter!;
   const grade={...l,phase:'revealed' as const,
    grades:Object.fromEntries(l.teams.map(t=>[t.id,'correct' as const])),
    locks:Object.fromEntries(l.teams.map(t=>[t.id,{hintRevision:0 as const}]))};
   const lp=scoreDecisionFor({game:'logikleiter',session:grade});
   expect(lp?.status).toBe('pending');
   expect(lp?.rows.every(x=>x.change===ll.rungValue(l.index))).toBe(true);
   const u=events[3]!.umfrageduell!;
   const udReady={...u,phase:'revealed' as const,
    submissions:Object.fromEntries(u.teams.map(t=>[t.id,{answers:[],mapped:[]}]))};
   const up=scoreDecisionFor({game:'umfrageduell',session:udReady});
   expect(up?.status).toBe('pending');
   expect(up?.rows.map(x=>x.change)).toEqual(u.teams.map(()=>0));
   expect(ud.awardsFor(udReady)).toHaveLength(u.teams.length);
  }finally{await db.close();}
 });
});
describe('G16 observed evidence intake is never an approval',()=>{
 it('pins 15 real SHA-256 entries without duplicate names and defaults all to unchecked',()=>{
  expect(evidenceSource.files).toHaveLength(15);
  expect(new Set(evidenceSource.files.map(e=>e.file)).size).toBe(15);
  expect(evidenceSource.files.every(e=>/^[a-f0-9]{64}$/.test(e.sha256))).toBe(true);
  const report=reviewPacket({},'');
  expect(report.summary).toEqual({observed:0,defects:0,unreviewed:15});
  expect(report.releaseAuthorized).toBe(false);
  expect(report.humanApproval).toBe(false);
  expect(report.physicalProjectorApproved).toBe(false);
 });
 it('records operator observation without granting release or inventing pass status',()=>{
  const a=evidenceSource.files[0]!.file,b=evidenceSource.files[1]!.file;
  const packet=reviewPacket({[a]:{observation:'observed',note:'Chromium lesbar'},[b]:{observation:'defect',note:'Korrektur nötig'}},'Nur lokale Sichtung');
  expect(packet.summary).toEqual({observed:1,defects:1,unreviewed:13});
  expect(packet.records.find(x=>x.file===b)?.observation).toBe('defect');
  expect(packet.deployAuthorized).toBe(false);
  expect(()=>reviewPacket({['other.png']:{observation:'observed',note:''}},'')).toThrow(/Unknown/);
 });
});
