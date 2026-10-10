import {describe,it,expect} from 'vitest';
import {isFocusShortcut,describeHostStep,type HostGame} from '../src/features/host/HostModerationGuide';
const keyboard=(overrides:Partial<Parameters<typeof isFocusShortcut>[0]>={})=>({
 key:'n',altKey:true,shiftKey:true,ctrlKey:false,metaKey:false,repeat:false,isComposing:false,...overrides
});
describe('G15 moderation hotkey safety',()=>{
 it('allows a deliberate focus-only shortcut outside editor inputs',()=>{
  expect(isFocusShortcut(keyboard(),false)).toBe(true);
  expect(isFocusShortcut(keyboard({key:'N'}),false)).toBe(true);
 });
 it('never captures native text editing, repeats, IME or competing shortcut modifiers',()=>{
  expect(isFocusShortcut(keyboard(),true)).toBe(false);
  expect(isFocusShortcut(keyboard({repeat:true}),false)).toBe(false);
  expect(isFocusShortcut(keyboard({isComposing:true}),false)).toBe(false);
  expect(isFocusShortcut(keyboard({ctrlKey:true}),false)).toBe(false);
  expect(isFocusShortcut(keyboard({metaKey:true}),false)).toBe(false);
  expect(isFocusShortcut(keyboard({shiftKey:false}),false)).toBe(false);
  expect(isFocusShortcut(keyboard({key:'x'}),false)).toBe(false);
 });
 it('all five modes stay withheld during unapproved recovery even when a phase says revealed',()=>{
  for(const game of ['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'] as HostGame[]){
   const guide=describeHostStep({game,phase:'revealed',paused:false,recovery:true,
    ready:true,busy:false,completed:1,total:4,viewers:0});
   expect(guide.visibility).toBe('Beamer gesperrt');
   expect(guide.next).toMatch(/prüfen/);
  }
 });
});
