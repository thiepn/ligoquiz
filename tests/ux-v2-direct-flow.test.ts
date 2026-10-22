import {describe,expect,it} from 'vitest';
import {newSetupDraft,parseSetupDraft,DEFAULT_PREFERENCES} from '../src/features/experience/model';
import {shellZoneFor,PRIMARY_LINKS} from '../src/app/shell-model';

describe('V2 intuitive navigation: original setup and host authority retained',()=>{
 it('keeps a lobby-picked game as an optional bounded flag through original setup draft roundtrip',()=>{
  const draft={...newSetupDraft(),game:'quiztafel' as const,gameFromLobby:true,
   teams:['Nord','Mitte','Süd','West','Ost'],step:1 as const};
  expect(parseSetupDraft(draft)).toMatchObject({game:'quiztafel',gameFromLobby:true,teams:draft.teams,step:1});
  expect(parseSetupDraft({...draft,gameFromLobby:'yes'})?.gameFromLobby).toBeUndefined();
  expect(parseSetupDraft({...draft,gameFromLobby:false})?.gameFromLobby).toBeUndefined();
  expect(parseSetupDraft({...draft,step:3})).toBeNull();
 });
 it('keeps old saved drafts and original source IDs portable',()=>{
  const base=newSetupDraft(DEFAULT_PREFERENCES);
  expect(parseSetupDraft(base)?.gameFromLobby).toBeUndefined();
  const source={...base,qtTileIds:['id:question/1','id:question/2'],game:'quiztafel',gameFromLobby:true};
  expect(parseSetupDraft(source)?.qtTileIds).toEqual(source.qtTileIds);
  expect(parseSetupDraft({...source,qtTileIds:['same','same']})?.qtTileIds).toBeUndefined();
 });
 it('preserves original three top-level zones and distinct public-stage routing',()=>{
  expect(PRIMARY_LINKS.map(l=>l.route)).toEqual(['spielen','host','inhalte']);
  expect(shellZoneFor('setup')).toBe('spielwelt');
  expect(shellZoneFor('host')).toBe('spielleitung');
  expect(shellZoneFor('inhalte')).toBe('backstage');
  expect(shellZoneFor('stage')).toBe('public');
  expect(shellZoneFor('mitspielen')).toBe('backstage');
 });
});
