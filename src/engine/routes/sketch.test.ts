import { describe, expect, it } from 'vitest';
import { EXIT, WALL, tileAt, isWalkable } from '../map';
import type { Tile } from '../grid';
import { ROUTE_SHAPES, SHAPES, entryIndex, type AccessEdge, type RouteShape } from './layout';
import { ROUTE_HEIGHT, ROUTE_WIDTH, sketchRoute, type RouteRequest } from './sketch';
import { validateRoute } from './validate';

const request = (seed: string, routeIndex: number, shape?: RouteShape): RouteRequest => ({
  seed,
  routeIndex,
  biomeId: 'wood',
  ...(shape ? { shape } : {}),
});

function signature(seed: string, routeIndex: number): string {
  const route = sketchRoute(request(seed, routeIndex));
  const rows = route.tiles.map((row) => row.join('')).join('/');
  const exits = route.exits.map((exit) => `${exit.x},${exit.y}`).join('+');
  return [
    `${route.width}x${route.height}`,
    `${route.shape}`,
    `${route.entry.x},${route.entry.y}->${exits}`,
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

/** True when `tile` sits on the map's `edge` (inside the one-tile border). */
function onEdge(tile: Tile, edge: AccessEdge): boolean {
  switch (edge) {
    case 'W':
      return tile.x === 1;
    case 'E':
      return tile.x === ROUTE_WIDTH - 2;
    case 'N':
      return tile.y === 1;
    case 'S':
      return tile.y === ROUTE_HEIGHT - 2;
  }
}

/** The entry edge and the edge of the opening its primary link joins it to. */
function primaryEdges(shape: RouteShape): Readonly<{ entry: AccessEdge; exit: AccessEdge }> {
  const spec = SHAPES[shape];
  const entry = entryIndex(spec);
  const link = spec.links.find((pair) => pair.includes(entry)) ?? spec.links[0];
  const exit = link[0] === entry ? link[1] : link[0];
  return { entry: spec.openings[entry].edge, exit: spec.openings[exit].edge };
}

describe('sketchRoute', () => {
  it('is a pure function of seed and route index', () => {
    expect(sketchRoute(request('alpha', 3))).toEqual(sketchRoute(request('alpha', 3)));
    expect(signature('alpha', 3)).not.toBe(signature('alpha', 4));
    expect(signature('alpha', 3)).not.toBe(signature('beta', 3));
  });

  it('freezes a known route as a regression seed', () => {
    expect(signature('regression-seed', 0)).toBe(
      '56x32|straight|1,17->54,5|11111111111111111111111111111111111111111111111111111111/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000021/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/11111111111111111111111111111111111111111111111111111111',
    );
  });

  it('always produces a valid, bordered route with its exits', () => {
    for (const shape of ROUTE_SHAPES) {
      for (let routeIndex = 0; routeIndex < 12; routeIndex++) {
        for (const seed of ['one', 'two', 'three']) {
          const route = sketchRoute(request(seed, routeIndex, shape));
          expect(validateRoute(route).ok, `${shape} ${seed} #${routeIndex}`).toBe(true);
          expect(route.shape, `${shape} ${seed} #${routeIndex}`).toBe(shape);
          expect(isWalkable(route.tiles, route.entry)).toBe(true);
          expect(route.exits.length).toBeGreaterThanOrEqual(1);
          for (const exit of route.exits) expect(tileAt(route.tiles, exit)).toBe(EXIT);
          expect(route.tiles[0].every((value) => value === WALL)).toBe(true);
          expect(route.tiles[route.height - 1].every((value) => value === WALL)).toBe(true);
          expect(route.tiles.every((row) => row[0] === WALL && row[route.width - 1] === WALL)).toBe(true);
        }
      }
    }
  });

  it('places the entry and the primary exit on the edges the shape declares', () => {
    for (const shape of ROUTE_SHAPES) {
      const edges = primaryEdges(shape);
      for (const seed of ['edge-a', 'edge-b', 'edge-c']) {
        const route = sketchRoute(request(seed, 4, shape));
        expect(onEdge(route.entry, edges.entry), `${shape} ${seed} entry`).toBe(true);
        expect(route.exits.length, `${shape} ${seed} exits`).toBe(1);
        expect(onEdge(route.exits[0], edges.exit), `${shape} ${seed} exit`).toBe(true);
      }
    }
  });

  it('leaves the interior open: the border is the only wall', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['open-a', 'open-b', 'open-c']) {
        const route = sketchRoute(request(seed, 2, shape));
        expect(blockedShare(route.tiles), `${shape} ${seed}`).toBeLessThan(0.12);
        for (let y = 1; y < route.height - 1; y++) {
          for (let x = 1; x < route.width - 1; x++) {
            expect(route.tiles[y][x], `${shape} ${seed} ${x},${y}`).not.toBe(WALL);
          }
        }
      }
    }
  });
});
