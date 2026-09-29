import { describe, expect, it } from 'vitest';
import { EXIT, TALL_GRASS, WALL, tileAt, isWalkable } from '../map';
import { sketchRoute, type RouteRequest } from './sketch';
import { validateRoute } from './validate';
import { seesPlayer, sightLine } from './trainers';

const request = (seed: string, routeIndex: number): RouteRequest => ({
  seed,
  routeIndex,
  biomeId: 'wood',
  trainerArchetypeIds: ['youngster', 'lass', 'bugcatcher'],
  trainerCount: 3,
  itemCount: 2,
});

function signature(seed: string, routeIndex: number): string {
  const route = sketchRoute(request(seed, routeIndex));
  const rows = route.tiles.map((row) => row.join('')).join('/');
  const trainers = route.trainers
    .map((trainer) => `${trainer.position.x},${trainer.position.y}${trainer.facing}`)
    .join(';');
  return [
    `${route.width}x${route.height}`,
    `${route.start.x},${route.start.y}->${route.exit.x},${route.exit.y}`,
    rows,
    trainers,
    route.items.map((item) => `${item.position.x},${item.position.y}:${item.itemId}`).join(';'),
  ].join('|');
}

describe('sketchRoute', () => {
  it('is a pure function of seed and route index', () => {
    expect(sketchRoute(request('alpha', 3))).toEqual(sketchRoute(request('alpha', 3)));
    expect(signature('alpha', 3)).not.toBe(signature('alpha', 4));
    expect(signature('alpha', 3)).not.toBe(signature('beta', 3));
  });

  it('freezes a known route as a regression seed', () => {
    expect(signature('regression-seed', 0)).toBe(
      '24x16|1,8->22,2|111111111111111111111111/111111001111011111111111/100000000000000000000021/101110011011110000008881/101111111111111100008181/101111111111000011111101/101111111111000011111101/101111100001000611111101/101111190001066611111101/111111109900088800000001/111111100001118800111111/111111100001118800111111/111111111000008880111111/111111111111118880111111/111111111111111111111111/111111111111111111111111|8,2W;9,7W;22,8N|17,13:pokeball;12,2:potion',
    );
  });

  it('always produces a valid, bordered route with an exit and grass', () => {
    for (let routeIndex = 0; routeIndex < 12; routeIndex++) {
      for (const seed of ['one', 'two', 'three']) {
        const route = sketchRoute(request(seed, routeIndex));
        expect(validateRoute(route).ok).toBe(true);
        expect(isWalkable(route.tiles, route.start)).toBe(true);
        expect(tileAt(route.tiles, route.exit)).toBe(EXIT);
        expect(route.tiles.some((row) => row.includes(TALL_GRASS))).toBe(true);
        expect(route.tiles[0].every((value) => value === WALL)).toBe(true);
        expect(route.tiles[route.height - 1].every((value) => value === WALL)).toBe(true);
      }
    }
  });

  it('places trainers that can actually see down an open lane, and items', () => {
    const route = sketchRoute(request('lanes', 1));
    expect(route.trainers.length).toBeGreaterThan(0);
    expect(route.items.length).toBeGreaterThan(0);
    for (const trainer of route.trainers) {
      const line = sightLine(route, trainer);
      const ahead = line[0];
      if (ahead) {
        expect(seesPlayer(route, trainer, ahead)).toBe(true);
      }
    }
  });
});
