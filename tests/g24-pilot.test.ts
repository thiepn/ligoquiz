import {describe,it,expect} from 'vitest';
import {SCENARIOS,blankTrialRow,CHECKS,sealTrial,reconcileTrial,
 type TrialRow} from '../src/features/experience/event-trial';
import {G24_DRAFT_KEY,readPilotDraft,serializePilotDraft,savePilotDraft,clearPilotDraft,
 pilotRowStatus,pilotSummary,pilotVisible,nextPilotScenario,pilotCue,pilotCard} from '../src/features/experience/g24-pilot';
function store(){
 const map=new Map<string,string>();
 return {map,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},
  removeItem:(k:string)=>{map.delete(k)}};
}
const id=SCENARIOS[0]!.id;
const complete=():TrialRow=>{const item=blankTrialRow(id);
 for(const c of CHECKS)item.checks[c.id]='reported';
 return item;};
describe('G24 practical pilot and tab-local draft safety',()=>{
 it('round-trips one explicitly recovered canonical G18 rehearsal without granting authority',async()=>{
  const st=store();const draft=blankTrialRow(id);draft.checks.venue='reported';draft.note='Synthetic observation only';
  await savePilotDraft(st,{[id]:draft},'Unsignierter, lokaler Test',1234);
  const before=st.map.get(G24_DRAFT_KEY)!;
  expect(st.map.size).toBe(1);
  const loaded=await readPilotDraft(st,1240);
  expect(loaded?.report.rows[0]?.checks.venue).toBe('reported');
  expect(loaded?.report.notes).toBe('Unsignierter, lokaler Test');
  expect(loaded?.report).toMatchObject({decision:'NO_GO',humanApproval:false,
   physicalDeviceApproved:false,ownerApproved:false,mergeAuthorized:false,deployAuthorized:false});
  expect(st.map.get(G24_DRAFT_KEY)).toBe(before);
 });
 it('rejects malformed, stale and approval-forged local drafts without deleting originals',async()=>{
  const st=store();st.setItem(G24_DRAFT_KEY,'{broken');
  await expect(readPilotDraft(st)).rejects.toThrow(/beschädigt/);
  expect(st.getItem(G24_DRAFT_KEY)).toBe('{broken');
  const old=JSON.parse(await serializePilotDraft({},'',1234));
  st.setItem(G24_DRAFT_KEY,JSON.stringify(old));
  await expect(readPilotDraft(st,1234+31*86400_000)).rejects.toThrow(/alt/);
  const altered={...old,envelope:{...old.envelope,packet:{...old.envelope.packet,ownerApproved:true}}};
  st.setItem(G24_DRAFT_KEY,JSON.stringify(altered));
  await expect(readPilotDraft(st,1240)).rejects.toThrow();
  expect(st.getItem(G24_DRAFT_KEY)).toContain('ownerApproved');
  st.setItem(G24_DRAFT_KEY,'a'.repeat(256*1024+1));
  await expect(readPilotDraft(st)).rejects.toThrow(/zu groß/);
 });
 it('never touches v1, original G18 or other applications when G24 local draft cleared',async()=>{
  const st=store();st.setItem('ligo.quiz.content.library.v1','ORIGINAL');
  st.setItem('another.app.secret','KEEP');
  st.setItem('ligoquiz.g18.original','HUMAN FILE');
  await savePilotDraft(st,{},'',1234);
  clearPilotDraft(st);
  expect(st.getItem(G24_DRAFT_KEY)).toBeNull();
  expect(st.getItem('ligo.quiz.content.library.v1')).toBe('ORIGINAL');
  expect(st.getItem('another.app.secret')).toBe('KEEP');
  expect(st.getItem('ligoquiz.g18.original')).toBe('HUMAN FILE');
 });
 it('classifies all 15 explicit scenarios and never turns self-report into acceptance',()=>{
  const row=blankTrialRow(id);expect(pilotRowStatus(row)).toBe('open');
  row.checks.moderation='reported';expect(pilotRowStatus(row)).toBe('partial');
  row.checks.recovery='defect';expect(pilotRowStatus(row)).toBe('defect');
  const results=pilotSummary({[id]:row});
  expect(results).toEqual({open:14,partial:0,reported:0,defect:1});
  expect(pilotVisible({[id]:row},{filter:'defect'})).toHaveLength(1);
  expect(pilotVisible({[id]:row},{game:'rundenquiz',teams:3})).toHaveLength(1);
  expect(pilotVisible({[id]:row},{game:'rundenquiz',teams:4})).toHaveLength(1);
  expect(pilotVisible({[id]:row},{teams:5})).toHaveLength(5);
  expect(pilotVisible({[id]:row},{filter:'reported'})).toHaveLength(0);
 });
 it('next-case jump wraps without mutating evidence or picking a fully-noted item',()=>{
  const rows:Record<string,TrialRow>={};SCENARIOS.forEach(x=>{const v=complete();v.scenarioId=x.id;rows[x.id]=v;});
  expect(nextPilotScenario(id,rows)).toBeNull();
  const gap=SCENARIOS[2]!.id;rows[gap]!.checks.rights='open';
  expect(nextPilotScenario(id,rows)).toBe(gap);
  expect(nextPilotScenario(gap,rows)).toBe(gap);
  expect(nextPilotScenario(SCENARIOS.at(-1)!.id,rows)).toBe(gap);
  expect(rows[gap]!.checks.rights).toBe('open');
 });
 it('run cards are per-game, contain real operator actions and always deny releases',()=>{
  const cards=SCENARIOS.map(s=>pilotCard(s.id));
  expect(cards).toHaveLength(15);
  for(const card of cards){
   expect(card).toContain('NO_GO');
   expect(card).toContain('keine Abnahme');
   expect(card).toContain('Beamer');
   expect(card).not.toContain('PASS');
  }
  expect(new Set(cards).size).toBe(15);
  expect(pilotCue('quiztafel-4').scoring).toMatch(/Übernahme/);
  expect(pilotCue('logikleiter-5').failure).toMatch(/Revision/);
  expect(()=>pilotCard('wrong-id' as typeof id)).toThrow(/Unbekanntes/);
 });
 it('reuses original G18 checksum reconciliation; cannot rewrite a signature or external gate',async()=>{
  const raw=await sealTrial({[id]:complete()},'Synthetic, no human witnessed');
  const recovered=await reconcileTrial(raw);
  expect(recovered.releaseGates.every(x=>x.status==='OPEN')).toBe(true);
  const st=store();await savePilotDraft(st,{[id]:complete()},'Synthetic',1234);
  const stored=JSON.parse(st.getItem(G24_DRAFT_KEY)!);
  stored.envelope.packet.decision='GO';
  st.setItem(G24_DRAFT_KEY,JSON.stringify(stored));
  await expect(readPilotDraft(st,1240)).rejects.toThrow();
 });
});
