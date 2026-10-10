import {describe,it,expect} from 'vitest';
import {G18_SOURCE,CHECKS,SCENARIOS,RELEASE_GATES,canonicalTrial,blankTrialRow,
 fingerprint,sealTrial,reconcileTrial,scenarioSummary} from '../src/features/experience/event-trial';

describe('G18 fifteen-game-night scenario evidence',()=>{
 it('has all 5 engines × 3, 4, 5 teams, seven specific checks and six open release owners',()=>{
  expect(SCENARIOS).toHaveLength(15);
  expect(new Set(SCENARIOS.map(x=>x.id)).size).toBe(15);
  expect(SCENARIOS.filter(x=>x.teams===3)).toHaveLength(5);
  expect(SCENARIOS.filter(x=>x.teams===4)).toHaveLength(5);
  expect(SCENARIOS.filter(x=>x.teams===5)).toHaveLength(5);
  expect(CHECKS.map(c=>c.id)).toEqual(['venue','moderation','correction','recovery','backup','accessibility','rights']);
  expect(RELEASE_GATES).toHaveLength(6);
  const report=canonicalTrial();
  expect(report.rows).toHaveLength(15);
  expect(report.summary).toEqual({scenarios:15,reported:0,defects:0,open:105,allReported:0});
  expect(report.releaseGates.every(g=>g.status==='OPEN')).toBe(true);
  expect(report.decision).toBe('NO_GO');
  expect(report.source.baseHead).toBe('b2acbdcf560b7dd5ce840276eada2569e5edef40');
  expect(report.source.artifacts).toEqual([11672563173,11672483289,11673330738]);
  expect(G18_SOURCE.browserRun).toBe(38060118918);
 });
 it('allows actual notes and defects without granting human, device or owner release',()=>{
  const a=blankTrialRow(SCENARIOS[0]!.id);
  for(const c of CHECKS)a.checks[c.id]='reported';
  const b=blankTrialRow(SCENARIOS[1]!.id);b.checks.recovery='defect';
  const r=canonicalTrial({[a.scenarioId]:a,[b.scenarioId]:b},'Unabhängige Prüfung ist weiterhin offen');
  expect(r.summary).toMatchObject({reported:7,defects:1,allReported:1,open:97});
  for(const key of ['humanApproval','physicalDeviceApproved','projectorApproved','editorialApproved',
    'restoreApproved','ownerApproved','mergeAuthorized','deployAuthorized'] as const)
   expect(r[key]).toBe(false);
  expect(r.decision).toBe('NO_GO');
  expect(()=>canonicalTrial({'unknown-5':blankTrialRow('unknown-5')})).toThrow(/Unknown/);
  a.checks.rights='FAKE_PASS' as typeof a.checks.rights;
  expect(()=>canonicalTrial({[a.scenarioId]:a})).toThrow(/Invalid observed/);
 });
 it('records only digest and bounded metadata, without retaining uploaded bytes',async()=>{
  const bytes=new TextEncoder().encode('non-sensitive synthetic fixture');
  const f={name:'trial-note.txt',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
  const digest=await fingerprint(f);
  expect(digest.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(digest.bytes).toBe(bytes.length);
  expect(JSON.stringify(digest)).not.toContain('non-sensitive synthetic fixture');
  await expect(fingerprint({name:'x',size:13*1024*1024,arrayBuffer:f.arrayBuffer})).rejects.toThrow(/outside/);
 });
 it('round-trips local self-consistency; refuses altered evidence, counts, approvals and sources',async()=>{
  const a=blankTrialRow(SCENARIOS[0]!.id);a.note='Tatsächlicher Test noch nicht abgenommen';
  a.checks.venue='reported';
  const env=await sealTrial({[a.scenarioId]:a},'Sichtungsnotiz');
  const output=await reconcileTrial(env);
  expect(output.rows[0]?.checks.venue).toBe('reported');
  expect(output.decision).toBe('NO_GO');
  const cases:[
    string,(packet:Record<string,unknown>)=>void
  ][]=[
    ['forged owner',p=>{p.ownerApproved=true;}],
    ['forged release decision',p=>{p.decision='GO';}],
    ['tampered source',p=>{(p.source as Record<string,unknown>).baseHead='a'.repeat(40);}],
    ['deleted scenario',p=>{(p.rows as unknown[]).pop();}],
    ['edited notes',p=>{p.notes='changed';}],
    ['false gate',p=>{(p.releaseGates as Record<string,unknown>[])[0]!.status='APPROVED';}],
  ];
  for(const [,change] of cases){
   const copy=structuredClone(env) as unknown as {packet:Record<string,unknown>};
   change(copy.packet);
   await expect(reconcileTrial(copy)).rejects.toThrow();
  }
  await expect(reconcileTrial({...env,checksum:'0'.repeat(64)})).rejects.toThrow(/SHA-256/);
  await expect(reconcileTrial({format:env.format,checksum:env.checksum,packet:env.packet}))
    .rejects.toThrow(/Invalid G18/);
 });
 it('compares independent scenario summaries and refuses missing evidence',()=>{
  const rows=SCENARIOS.map(s=>blankTrialRow(s.id));
  rows[0]!.checks.backup='defect';
  expect(scenarioSummary(rows)).toMatchObject({defects:1,open:104,reported:0});
  const a=blankTrialRow(SCENARIOS[0]!.id);
  a.evidence={name:'test.png',bytes:5,sha256:'wrong'};
  expect(()=>canonicalTrial({[a.scenarioId]:a})).toThrow(/fingerprint/);
 });
});
