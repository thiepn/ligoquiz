import {describe,expect,it} from 'vitest';
import type {EventRecord} from '../src/domain/event/schemas';
import {
 describeHostStep,hostPhaseLabel,hostContentLabel,isFocusShortcut,
 type HostGame,
} from '../src/features/host/HostModerationGuide';

const names:HostGame[]=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'];
const source=(rulesVersion:string):Pick<EventRecord,'program'>=>({
 program:[{id:'original-game',order:0,type:'rundenquiz',profile:'kurz',rulesVersion}],
});

describe('UX host flow: canonical semantics not another engine',()=>{
 it('displays original reviewed versus trial source status without claiming all events are test content',()=>{
  expect(hostContentLabel(null)).toBe('INHALTE WERDEN GEPRÜFT');
  expect(hostContentLabel(source('rq-trial-1'))).toMatch(/PROBEINHALTE/);
  expect(hostContentLabel(source('ud-trial-1'))).toMatch(/PROBEINHALTE/);
  expect(hostContentLabel(source('quiztafel-reviewed-v1'))).toBe('REDAKTIONELL FREIGEGEBENE INHALTE');
  expect(hostContentLabel(source('rundenquiz-reviewed-v1'))).toBe('REDAKTIONELL FREIGEGEBENE INHALTE');
  expect(hostContentLabel(source('foo-reviewed-v2'))).toMatch(/PROBEINHALTE/);
 });
 it('labels original phases of all five game hosts in human language, including takeovers and pauses',()=>{
  for(const game of names){
   expect(hostPhaseLabel(game,'setup',false)).toBe('Vorbereitung');
   expect(hostPhaseLabel(game,'revealed',false)).toBe('Wertung prüfen');
   expect(hostPhaseLabel(game,'revealed',true)).toBe('Pausiert');
   expect(hostPhaseLabel(game,'ready',false,true)).toBe('Wiederherstellung');
   expect(hostPhaseLabel(game,'complete',false)).toBe('Abgeschlossen');
   expect(hostPhaseLabel(game,'ready',false)).not.toEqual('ready');
  }
 });
 it('preserves the original explicit publication and grading boundaries',()=>{
  for(const game of names){
   const input={game,phase:'ready',paused:false,recovery:false,completed:0,total:10,
    viewers:0,ready:true,busy:false};
   const state=describeHostStep(input);
   expect(state.visibility).toMatch(/verborgen/);
   expect(state.scoring).toBe('Wertung offen');
   expect(state.finished).toBe(false);
   expect(describeHostStep({...input,phase:'revealed'}).visibility).toMatch(/freigegeben/);
   expect(describeHostStep({...input,recovery:true,phase:'revealed'}).visibility).toBe('Beamer gesperrt');
  }
 });
 it('retains keyboard focus-only guard and blocks edit fields or repeated shortcuts',()=>{
  const k={key:'n',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false,repeat:false,isComposing:false};
  expect(isFocusShortcut(k,false)).toBe(true);
  expect(isFocusShortcut(k,true)).toBe(false);
  expect(isFocusShortcut({...k,repeat:true},false)).toBe(false);
 });
});
