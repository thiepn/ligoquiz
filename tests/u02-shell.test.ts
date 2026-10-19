import {describe,it,expect} from 'vitest';
import {parseRoute,routeHref} from '../src/app/routes';
import {
 PRIMARY_LINKS,BACKSTAGE_LINKS,shellZoneFor,backstageActiveRoute,
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
 it('keeps functional route names rather than redundant zone headings',()=>{
  expect(PRIMARY_LINKS.map(x=>x.route)).toEqual(['spielen','host','inhalte']);
  expect(BACKSTAGE_LINKS.map(x=>x.route)).toEqual(['inhalte','verlauf','technik','einstellungen']);
  for(const link of [...PRIMARY_LINKS,...BACKSTAGE_LINKS]){
   expect(link.label.length).toBeGreaterThan(0);
   expect(parseRoute(routeHref(link.route))).toBe(link.route);
  }
 });
});
