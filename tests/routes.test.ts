import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from '../src/app/routes';
import { GAME_MANIFESTS } from '../src/games/registry';

describe('G1 routes and inventory', () => {
  it('registers all five games without falsely marking them playable', () => {
    expect(GAME_MANIFESTS).toHaveLength(5);
    expect(new Set(GAME_MANIFESTS.map((game) => game.id)).size).toBe(5);
    expect(GAME_MANIFESTS.filter((game) => game.ready).map((game) => game.id)).toEqual(['rundenquiz']);
  });
  it('uses Pages-compatible hash routes', () => {
    expect(parseRoute('#/inhalte')).toBe('inhalte');
    expect(parseRoute('#/stage')).toBe('stage');
    expect(parseRoute('#/unknown')).toBe('spielen');
    expect(routeHref('verlauf')).toBe('#/verlauf');
  });
});
