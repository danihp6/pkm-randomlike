import { describe, expect, it } from 'vitest';
import { EXIT, WALL, tileAt, isWalkable } from '../map';
import type { Tile } from '../grid';
import { ROUTE_SHAPES, SHAPES, type AccessEdge, type RouteShape } from './layout';
import { ROUTE_HEIGHT, ROUTE_WIDTH, sketchRoute, type RouteRequest } from './sketch';
import { reachableTiles, validateRoute } from './validate';

const CARDINAL_DIRS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

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

/** The edge of each opening a shape declares: one entry, then its exits in order. */
function shapeEdges(shape: RouteShape): Readonly<{ entry: AccessEdge; exits: readonly AccessEdge[] }> {
  const spec = SHAPES[shape];
  return {
    entry: spec.openings.find((opening) => opening.role === 'entry')!.edge,
    exits: spec.openings
      .filter((opening) => opening.role === 'exit')
      .map((opening) => opening.edge),
  };
}

/** True when the spine set is cardinally connected from the entry to every exit. */
function spineReaches(spine: readonly Tile[], entry: Tile, exits: readonly Tile[]): boolean {
  const set = new Set(spine.map((tile) => `${tile.x},${tile.y}`));
  const seen = new Set([`${entry.x},${entry.y}`]);
  const queue: Tile[] = [entry];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const dir of CARDINAL_DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const key = `${next.x},${next.y}`;
      if (seen.has(key) || !set.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return exits.every((exit) => seen.has(`${exit.x},${exit.y}`));
}

describe('sketchRoute', () => {
  it('is a pure function of seed and route index', () => {
    expect(sketchRoute(request('alpha', 3))).toEqual(sketchRoute(request('alpha', 3)));
    expect(signature('alpha', 3)).not.toBe(signature('alpha', 4));
    expect(signature('alpha', 3)).not.toBe(signature('beta', 3));
  });

  it('freezes a known route as a regression seed', () => {
    expect(signature('regression-seed', 0)).toBe(
      '56x32|straight|1,14->54,10|11111111111111111111111111111111111111111111111111111111/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000021/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/10000000000000000000000000000000000000000000000000000001/11111111111111111111111111111111111111111111111111111111',
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

  it('places every opening on the edge its shape declares', () => {
    for (const shape of ROUTE_SHAPES) {
      const edges = shapeEdges(shape);
      for (const seed of ['edge-a', 'edge-b', 'edge-c']) {
        const route = sketchRoute(request(seed, 4, shape));
        expect(onEdge(route.entry, edges.entry), `${shape} ${seed} entry`).toBe(true);
        expect(route.exits.length, `${shape} ${seed} exits`).toBe(edges.exits.length);
        route.exits.forEach((exit, index) => {
          expect(onEdge(exit, edges.exits[index]), `${shape} ${seed} exit ${index}`).toBe(true);
        });
      }
    }
  });

  it('carves a spine from the entry to every exit, never on the border', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['spine-a', 'spine-b']) {
        const route = sketchRoute(request(seed, 5, shape));
        const spine = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
        expect(spine.has(`${route.entry.x},${route.entry.y}`), `${shape} ${seed} entry`).toBe(true);
        for (const exit of route.exits) {
          expect(spine.has(`${exit.x},${exit.y}`), `${shape} ${seed} ${exit.x},${exit.y}`).toBe(true);
        }
        for (const tile of route.spine) {
          expect(tile.x, `${shape} ${seed} ${tile.x},${tile.y} x`).toBeGreaterThan(0);
          expect(tile.x, `${shape} ${seed} ${tile.x},${tile.y} x`).toBeLessThan(route.width - 1);
          expect(tile.y, `${shape} ${seed} ${tile.x},${tile.y} y`).toBeGreaterThan(0);
          expect(tile.y, `${shape} ${seed} ${tile.x},${tile.y} y`).toBeLessThan(route.height - 1);
        }
        expect(spineReaches(route.spine, route.entry, route.exits), `${shape} ${seed} connected`).toBe(true);
      }
    }
  });

  it('carves optional branches and marks each dead end as a pocket', () => {
    let totalPockets = 0;
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['branch-a', 'branch-b', 'branch-c']) {
        const route = sketchRoute(request(seed, 6, shape));
        const carved = new Set([...route.spine, ...route.branches].map((tile) => `${tile.x},${tile.y}`));
        expect(route.branches.length, `${shape} ${seed} branches`).toBeGreaterThan(0);
        const reached = reachableTiles(route.tiles, route.entry);
        for (const pocket of route.pockets) {
          totalPockets += 1;
          const key = `${pocket.x},${pocket.y}`;
          expect(carved.has(key), `${shape} ${seed} ${key} carved`).toBe(true);
          expect(reached.has(key), `${shape} ${seed} ${key} reachable`).toBe(true);
          const neighbours = CARDINAL_DIRS.filter((dir) =>
            carved.has(`${pocket.x + dir.x},${pocket.y + dir.y}`),
          );
          expect(neighbours.length, `${shape} ${seed} ${key} dead end`).toBe(1);
        }
      }
    }
    expect(totalPockets).toBeGreaterThan(0);
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
