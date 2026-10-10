import {describe,it,expect} from 'vitest';
import {describeHostStep,type HostGame,type HostGuideInput} from '../src/features/host/HostModerationGuide';
const games:HostGame[]=['rundenquiz','quiztafel','verbindungen','logikleiter','umfrageduell'];
function props(game:HostGame,phase:string,other:Partial<HostGuideInput>={}):HostGuideInput{
 return {game,phase,completed:0,total:6,viewers:0,ready:true,busy:false,paused:false,recovery:false,...other};
}
describe('G14 shared host moderation guidance',()=>{
 it.each(games)('%s refuses implicit recovery and pause advancement',game=>{
  const recovery=describeHostStep(props(game,'revealed',{recovery:true,paused:true}));
  expect(recovery.next).toMatch(/Spielstand/);
  expect(recovery.visibility).toBe('Beamer gesperrt');
  expect(describeHostStep(props(game,'revealed',{paused:true})).step).toBe('Pausiert');
  expect(describeHostStep(props(game,'complete')).finished).toBe(true);
 });
 it.each(games)('%s differentiates unpublished and published answers',game=>{
  const initial=describeHostStep(props(game,'setup'));
  expect(initial.visibility).toMatch(/verborgen/);
  const revealed=describeHostStep(props(game,'revealed'));
  expect(revealed.visibility).toMatch(/freigegeben/);
  const graded=describeHostStep(props(game,game==='quiztafel'?'awarded':'graded'));
  expect(graded.scoring).toBe('Punkte verbucht');
 });
 it('covers quiztafel board and one-time steal and Verbindungen partial-wall states',()=>{
  expect(describeHostStep(props('quiztafel','board')).next).toMatch(/Feld/);
  expect(describeHostStep(props('quiztafel','steal')).next).toMatch(/Übernahme/);
  expect(describeHostStep(props('verbindungen','wall-reveal')).visibility).toMatch(/teilweise/);
 });
 it('never displays event question answers or personal data in deterministic state',()=>{
  const guide=describeHostStep(props('rundenquiz','closed'));
  expect(JSON.stringify(guide)).not.toContain('Josua');
  expect(guide.next).toMatch(/Lösung/);
 });
});
