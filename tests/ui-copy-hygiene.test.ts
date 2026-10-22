import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('functional copy without duplicate game phases',()=>{
 const names=['Rundenquiz','Quiztafel','Verbindungen','Logikleiter','Umfrageduell'];
 it('keeps the original host guide, progression rail, score authority and recovery checks in every game',()=>{
  for(const name of names){
   const host=file('src/features/host/'+name+'Host.tsx');
   expect(host).toContain('<HostGameplayRail');
   expect(host).toContain('<HostModerationGuide');
   expect(host).toContain('hostContentLabel(event)');
   expect(host).toContain('<ScoreDecisionPanel');
   expect(host).toContain('recoveryRequired');
   expect(host).not.toContain('hostPhaseLabel(');
  }
 });
 it('removes third repeated phase summaries but retains two-column selector/team facts',()=>{
  expect(file('src/features/host/RundenquizHost.tsx')).not.toContain('className="rq-status"');
  expect(file('src/features/host/QuiztafelHost.tsx')).not.toContain('<small>SPIELPHASE</small>');
  expect(file('src/features/host/VerbindungenHost.tsx')).not.toContain('<small>SPIELSTATUS</small>');
  expect(file('src/features/host/LogikleiterHost.tsx')).not.toContain('className="ll-status u08-status"');
  expect(file('src/features/host/UmfrageduellHost.tsx')).not.toContain('className="ud-phase u09-status"');
  const base=file('src/styles/base.css');
  expect(base).toContain('.vb-active-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');
  expect(base).toContain('.qt-active-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))');
 });
 it('retains public-stage refusal statuses, source disclosure, backups and setup safety',()=>{
  const stage=file('src/features/stage/StageView.tsx');
  expect(stage).not.toContain('LIGOQUIZ · BEAMER');
  expect(stage).toContain('Widersprüchliche Projektionsdaten');
  expect(stage).toContain('Nur freigegebene Spielinhalte');
  expect(stage).toContain('aria-live="polite"');
  const report=file('src/features/experience/Sessions.tsx');
  expect(report).not.toContain('VERLAUF / REGIEPROTOKOLL');
  expect(report).not.toContain('BACKSTAGE / ARCHIV');
  expect(report).toContain('Ergebnisexporte sind keine vollständigen Sitzungsbackups');
  expect(report).toContain('report.sourceLabel');
  expect(file('src/features/experience/SetupWizard.tsx')).toContain('Beamer-Sicherheit');
  expect(file('src/features/resilience/ResilienceCenter.tsx')).toContain('Spielstand sichern');
 });
});
