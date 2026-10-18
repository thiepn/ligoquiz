import {describe,it,expect} from 'vitest';
import {parseRoute,routeHref} from '../src/app/routes';
import {
 PRIMARY_LINKS,BACKSTAGE_LINKS,shellZoneFor,backstageActiveRoute,shellShortcutsFor,shellHeadingFor,
} from '../src/app/shell-model';

describe('U02 shell routes preserve all original path contracts',()=>{
 it('keeps public projection completely outside the organizer shell',()=>{
  expect(shellZoneFor(parseRoute('#/stage?event=public_123'))).toBe('public');
  expect(shellZoneFor(parseRoute('#/host'))).toBe('spielleitung');
  expect(shellZoneFor(parseRoute('#/demo'))).toBe('spielwelt');
 });
 it('groups original routes without aliases or URL migrations',()=>{
  for(const route of ['spielen','setup','demo'] as const)expect(shellZoneFor(route)).toBe('spielwelt');
  for(const route of ['inhalte','verlauf','bericht','technik','einstellungen'] as const)
   expect(shellZoneFor(route)).toBe('backstage');
  for(const link of [...PRIMARY_LINKS,...BACKSTAGE_LINKS]){
   expect(parseRoute(routeHref(link.route))).toBe(link.route);
  }
  expect(backstageActiveRoute('bericht')).toBe('verlauf');
 });
 it('uses only known real navigation destinations and does not claim a connected stage',()=>{
  for(const route of ['spielen','setup','host','inhalte','verlauf','bericht','technik','einstellungen'] as const){
   expect(shellHeadingFor(route).headline.length).toBeGreaterThan(0);
   for(const link of shellShortcutsFor(route))expect(parseRoute(routeHref(link.route))).toBe(link.route);
  }
  expect(shellShortcutsFor('spielen').map(x=>x.route)).toEqual(['setup','demo']);
  expect(shellShortcutsFor('host').map(x=>x.route)).toEqual(['spielen','technik']);
 });
});
