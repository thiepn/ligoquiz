import {describe,expect,it} from 'vitest';
import {createTryout,stepTryout,publicTryout,tryoutScores,privateTryout,type TryoutState,type TryoutCommand} from '../src/features/experience/tryout-model';

function advance(state:TryoutState,command:TryoutCommand){return stepTryout(state,command);}

describe('U13 original, disposable five-mode practice',()=>{
 it('runs Quiztafel native first tile, keeps unpublished solution private and awards real points',()=>{
  let s:TryoutState=createTryout('quiztafel');
  expect(s.data.revision).toBe(0);
  s=advance(s,{game:'quiztafel',action:{type:'START'}});
  if(s.game!=='quiztafel')throw Error('wrong mode');
  const tile=s.data.tiles[0]!;
  s=advance(s,{game:'quiztafel',action:{type:'PICK',tileId:tile.id}});
  expect(publicTryout(s).lines).not.toContain(tile.answer);
  s=advance(s,{game:'quiztafel',action:{type:'PUBLISH'}});
  expect(publicTryout(s).lines).toContain(tile.prompt);
  expect(publicTryout(s).lines).not.toContain(tile.answer);
  s=advance(s,{game:'quiztafel',action:{type:'PRIMARY',result:'correct'}});
  s=advance(s,{game:'quiztafel',action:{type:'REVEAL'}});
  expect(publicTryout(s).lines).toContain(tile.answer);
  s=advance(s,{game:'quiztafel',action:{type:'CONFIRM'}});
  expect(tryoutScores(s)['trial-nord']).toBe(tile.value);
  s=advance(s,{game:'quiztafel',action:{type:'NEXT'}});
  expect(s.data.phase).toBe('board');
 });
 it('runs Verbindungen clue scoring from genuine engine and withholds target until reveal',()=>{
  let s:TryoutState=createTryout('verbindungen');
  s=advance(s,{game:'verbindungen',action:{type:'START'}});
  s=advance(s,{game:'verbindungen',action:{type:'PUBLISH'}});
  expect(publicTryout(s).lines).not.toContain('David');
  s=advance(s,{game:'verbindungen',action:{type:'JUDGE',value:'correct'}});
  s=advance(s,{game:'verbindungen',action:{type:'REVEAL'}});
  expect(publicTryout(s).lines).toContain('David');
  s=advance(s,{game:'verbindungen',action:{type:'CONFIRM'}});
  expect(tryoutScores(s)['trial-nord']).toBeGreaterThan(0);
  s=advance(s,{game:'verbindungen',action:{type:'NEXT'}});
  expect(s.data.phase).toBe('ready');
 });
 it('runs Logikleiter early-lock and actual grade awards with a withheld solution',()=>{
  let s:TryoutState=createTryout('logikleiter');
  const answer=privateTryout(s).answer;
  s=advance(s,{game:'logikleiter',action:{type:'START'}});
  s=advance(s,{game:'logikleiter',action:{type:'PUBLISH'}});
  expect(publicTryout(s).lines).not.toContain(answer);
  s=advance(s,{game:'logikleiter',action:{type:'LOCK',teamId:'trial-nord'}});
  s=advance(s,{game:'logikleiter',action:{type:'HINT'}});
  s=advance(s,{game:'logikleiter',action:{type:'CLOSE'}});
  s=advance(s,{game:'logikleiter',action:{type:'REVEAL'}});
  expect(publicTryout(s).lines).toContain(answer);
  for(const team of ['trial-nord','trial-mitte','trial-sued'])
   s=advance(s,{game:'logikleiter',action:{type:'GRADE',teamId:team,value:team==='trial-nord'?'correct':'absent'}});
  s=advance(s,{game:'logikleiter',action:{type:'CONFIRM'}});
  expect(tryoutScores(s)['trial-nord']).toBe(10);
  s=advance(s,{game:'logikleiter',action:{type:'NEXT'}});
  expect(s.data.phase).toBe('ready');
 });
 it('requires original three-team survey receipts before revealing illustrative categories',()=>{
  let s:TryoutState=createTryout('umfrageduell');
  s=advance(s,{game:'umfrageduell',action:{type:'START'}});
  s=advance(s,{game:'umfrageduell',action:{type:'PUBLISH'}});
  expect(publicTryout(s).heading).toContain('Beispieldaten');
  expect(publicTryout(s).lines).not.toContain('Snacks');
  s=advance(s,{game:'umfrageduell',action:{type:'CLOSE'}});
  expect(()=>advance(s,{game:'umfrageduell',action:{type:'REVEAL'}})).toThrow();
  for(const team of ['trial-nord','trial-mitte','trial-sued'])
   s=advance(s,{game:'umfrageduell',action:{type:'RECORD',teamId:team,submission:{answers:['Snacks'],mapped:[1]}}});
  s=advance(s,{game:'umfrageduell',action:{type:'REVEAL'}});
  expect(publicTryout(s).lines).toContain('Snacks');
  s=advance(s,{game:'umfrageduell',action:{type:'CONFIRM'}});
  expect(tryoutScores(s)['trial-nord']).toBe(20);
 });
 it('rejects a cross-game command without mutating any saved event',()=>{
  const state=createTryout('quiztafel');
  expect(()=>stepTryout(state,{game:'logikleiter',action:{type:'START'}})).toThrow(/Spielmodus/);
  expect(state.data.revision).toBe(0);
  expect(createTryout('quiztafel').data.revision).toBe(0);
  expect(publicTryout(state).lines).not.toContain(privateTryout(state).answer);
 });
});
