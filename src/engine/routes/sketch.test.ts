import { describe, expect, it } from 'vitest';
import { EXIT, WALL, tileAt, isWalkable } from '../map';
import { LAYOUTS, type LayoutStyle } from './layout';
import { ROUTE_HEIGHT, ROUTE_WIDTH, sketchRoute, type RouteRequest } from './sketch';
import { validateRoute } from './validate';

const request = (seed: string, routeIndex: number, layout?: LayoutStyle): RouteRequest => ({
  seed,
  routeIndex,
  biomeId: 'wood',
  ...(layout ? { layout } : {}),
});

function signature(seed: string, routeIndex: number): string {
  const route = sketchRoute(request(seed, routeIndex));
  const rows = route.tiles.map((row) => row.join('')).join('/');
  return [
    `${route.width}x${route.height}`,
    `${route.start.x},${route.start.y}->${route.exit.x},${route.exit.y}`,
    rows,
  ].join('|');
}

/** Share of the map that is a solid obstacle (walls), for the density bands. */
function blockedShare(tiles: readonly (readonly number[])[]): number {
  let blocked = 0;
  let total = 0;
  for (const row of tiles) {
    for (const value of row) {
      total += 1;
      if (value === WALL) blocked += 1;
    }
  }
  return blocked / total;
}

const ALL_LAYOUTS: readonly LayoutStyle[] = ['forest'];

describe('sketchRoute', () => {
  it('is a pure function of seed and route index', () => {
    expect(sketchRoute(request('alpha', 3))).toEqual(sketchRoute(request('alpha', 3)));
    expect(signature('alpha', 3)).not.toBe(signature('alpha', 4));
    expect(signature('alpha', 3)).not.toBe(signature('beta', 3));
  });

  it('freezes a known route as a regression seed', () => {
    expect(signature('regression-seed', 0)).toBe(
      '56x32|31,30->7,1|11111111111111111111111111111111111111111111111111111111/10000002000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/11111111111111111111111111111111111111111111111111111111',
    );
  });

  it('always produces a valid, bordered route with an exit', () => {
    for (const layout of ALL_LAYOUTS) {
      for (let routeIndex = 0; routeIndex < 12; routeIndex++) {
        for (const seed of ['one', 'two', 'three']) {
          const route = sketchRoute(request(seed, routeIndex, layout));
          expect(validateRoute(route).ok, `${layout} ${seed} #${routeIndex}`).toBe(true);
          expect(isWalkable(route.tiles, route.start)).toBe(true);
          expect(tileAt(route.tiles, route.exit)).toBe(EXIT);
          expect(route.tiles[0].every((value) => value === WALL)).toBe(true);
          expect(route.tiles[route.height - 1].every((value) => value === WALL)).toBe(true);
          expect(route.tiles.every((row) => row[0] === WALL && row[route.width - 1] === WALL)).toBe(true);
        }
      }
    }
  });

  it('enters and exits each layout on the edges the style declares', () => {
    for (const layout of ALL_LAYOUTS) {
      const spec = LAYOUTS[layout];
      for (const seed of ['edge-a', 'edge-b', 'edge-c']) {
        const route = sketchRoute(request(seed, 4, layout));
        if (spec.startEdge === 'W') {
          expect(route.start.x, `${layout} start`).toBe(1);
          expect(route.exit.x, `${layout} exit`).toBe(ROUTE_WIDTH - 2);
        } else {
          expect(route.start.y, `${layout} start`).toBe(ROUTE_HEIGHT - 2);
          expect(route.exit.y, `${layout} exit`).toBe(1);
        }
      }
    }
  });

  it('leaves the interior open: the border is the only wall', () => {
    for (const layout of ALL_LAYOUTS) {
      for (const seed of ['open-a', 'open-b', 'open-c']) {
        const route = sketchRoute(request(seed, 2, layout));
        expect(blockedShare(route.tiles), `${layout} ${seed}`).toBeLessThan(0.12);
        for (let y = 1; y < route.height - 1; y++) {
          for (let x = 1; x < route.width - 1; x++) {
            expect(route.tiles[y][x], `${layout} ${seed} ${x},${y}`).not.toBe(WALL);
          }
        }
      }
    }
  });

});
