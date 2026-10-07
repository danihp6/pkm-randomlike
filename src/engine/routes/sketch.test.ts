import { describe, expect, it } from 'vitest';
import { TALL_GRASS, WALL, isWalkable } from '../map';
import type { Tile } from '../grid';
import { ROUTE_SHAPES, SHAPES, type AccessEdge, type RouteShape } from './layout';
import {
  ROUTE_HEIGHT,
  ROUTE_WIDTH,
  cornerClearance,
  sketchRoute,
  sketchRouteSteps,
  type RouteRequest,
} from './sketch';
import type { RouteMap } from './routeMap';
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

/** Fixed size of the frozen regression route, kept independent of the live default. */
const FROZEN_WIDTH = 56;
const FROZEN_HEIGHT = 32;

function signature(seed: string, routeIndex: number): string {
  const route = sketchRoute({
    ...request(seed, routeIndex),
    width: FROZEN_WIDTH,
    height: FROZEN_HEIGHT,
  });
  const rows = route.tiles.map((row) => row.join('')).join('/');
  const exits = route.exits.map((exit) => `${exit.x},${exit.y}`).join('+');
  return [
    `${route.width}x${route.height}`,
    `${route.shape}`,
    `${route.entry.x},${route.entry.y}->${exits}`,
    rows,
  ].join('|');
}

/** Share of the interior (border excluded) that is a solid obstacle (walls). */
function blockedShare(tiles: readonly (readonly number[])[]): number {
  let blocked = 0;
  let total = 0;
  for (let y = 1; y < tiles.length - 1; y++) {
    for (let x = 1; x < tiles[y].length - 1; x++) {
      total += 1;
      if (tiles[y][x] === WALL) blocked += 1;
    }
  }
  return total === 0 ? 0 : blocked / total;
}

/** True when `tile` sits on the map's `edge` (the solid one-tile border). */
function onEdge(tile: Tile, edge: AccessEdge): boolean {
  switch (edge) {
    case 'W':
      return tile.x === 0;
    case 'E':
      return tile.x === ROUTE_WIDTH - 1;
    case 'N':
      return tile.y === 0;
    case 'S':
      return tile.y === ROUTE_HEIGHT - 1;
  }
}

/**
 * The border ring is solid tree except for the openings: a floor stretch of the
 * ring counts as an opening when it connects to the entry/exit along the ring.
 */
function borderIsSolidButForOpenings(route: RouteMap): boolean {
  const { width, height, tiles } = route;
  const onRing = (x: number, y: number): boolean =>
    x === 0 || x === width - 1 || y === 0 || y === height - 1;
  const open = new Set<string>();
  const stack: Tile[] = [route.entry, ...route.exits];
  for (const tile of stack) open.add(`${tile.x},${tile.y}`);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const dir of CARDINAL_DIRS) {
      const next = { x: current.x + dir.x, y: current.y + dir.y };
      const key = `${next.x},${next.y}`;
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y >= height) continue;
      if (!onRing(next.x, next.y) || open.has(key) || tiles[next.y][next.x] === WALL) continue;
      open.add(key);
      stack.push(next);
    }
  }
  const solidUnlessOpening = (x: number, y: number): boolean =>
    tiles[y][x] === WALL || open.has(`${x},${y}`);
  for (let x = 0; x < width; x++) {
    if (!solidUnlessOpening(x, 0) || !solidUnlessOpening(x, height - 1)) return false;
  }
  for (let y = 0; y < height; y++) {
    if (!solidUnlessOpening(0, y) || !solidUnlessOpening(width - 1, y)) return false;
  }
  return true;
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
      '56x32|straight|0,13->55,10|11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11100011111111111111111111111111111100011111111111111111/11100011111111111111111111111111111100011111111111111111/11100011111111111111111111111111111100011111111111111111/11100011111111111111111111111111111100011111111111111111/11100011111111111111111111111111111100000000000011111111/11100011111111111111111111111111111100000000000011111111/11100011111100000000000000000000000000000000000000000000/11100011111100000000000000000000000000000000000000000000/00000011100000000000000000000000000000011111100011111111/00000011100000000000000000000000000000011111100011111111/00000000000000011111111111111111111111111111100011111111/00000000000000011111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111100011111111/11100000011111111111111111111111111111111111111111111111/11100000011111111111111111111111111111111111111111111111/11100000011111111111111111111111111111111111111111111111/11100000011111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111/11111111111111111111111111111111111111111111111111111111',
    );
  });

  it('keeps every opening clear of the map corners', () => {
    const corner = cornerClearance(undefined);
    for (const shape of ROUTE_SHAPES) {
      for (let index = 0; index < 6; index++) {
        for (const seed of ['corner-a', 'corner-b']) {
          const route = sketchRoute({ ...request(seed, index, shape), width: 30, height: 30 });
          for (const point of [route.entry, ...route.exits]) {
            const onVertical = point.x === 0 || point.x === route.width - 1;
            const free = onVertical ? point.y : point.x;
            const span = onVertical ? route.height : route.width;
            expect(free, `${shape} ${seed} #${index} ${point.x},${point.y}`).toBeGreaterThanOrEqual(corner);
            expect(free, `${shape} ${seed} #${index} ${point.x},${point.y}`).toBeLessThanOrEqual(span - 1 - corner);
          }
        }
      }
    }
  }, 30_000);

  it('always produces a valid, bordered route with its exits', () => {
    for (const shape of ROUTE_SHAPES) {
      for (let routeIndex = 0; routeIndex < 12; routeIndex++) {
        for (const seed of ['one', 'two', 'three']) {
          const route = sketchRoute(request(seed, routeIndex, shape));
          expect(validateRoute(route).ok, `${shape} ${seed} #${routeIndex}`).toBe(true);
          expect(route.shape, `${shape} ${seed} #${routeIndex}`).toBe(shape);
          expect(isWalkable(route.tiles, route.entry)).toBe(true);
          expect(route.exits.length).toBeGreaterThanOrEqual(1);
          for (const exit of route.exits) {
            expect(isWalkable(route.tiles, exit), `${shape} ${seed} #${routeIndex} exit`).toBe(true);
          }
          expect(borderIsSolidButForOpenings(route), `${shape} ${seed} #${routeIndex} border`).toBe(true);
        }
      }
    }
  }, 30_000);

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

  it('carves a spine from the entry to every exit, interior but for the openings', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['spine-a', 'spine-b']) {
        const route = sketchRoute(request(seed, 5, shape));
        const spine = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
        const openings = new Set([route.entry, ...route.exits].map((tile) => `${tile.x},${tile.y}`));
        expect(spine.has(`${route.entry.x},${route.entry.y}`), `${shape} ${seed} entry`).toBe(true);
        for (const exit of route.exits) {
          expect(spine.has(`${exit.x},${exit.y}`), `${shape} ${seed} ${exit.x},${exit.y}`).toBe(true);
        }
        for (const tile of route.spine) {
          if (openings.has(`${tile.x},${tile.y}`)) continue;
          expect(tile.x, `${shape} ${seed} ${tile.x},${tile.y} x`).toBeGreaterThan(0);
          expect(tile.x, `${shape} ${seed} ${tile.x},${tile.y} x`).toBeLessThan(route.width - 1);
          expect(tile.y, `${shape} ${seed} ${tile.x},${tile.y} y`).toBeGreaterThan(0);
          expect(tile.y, `${shape} ${seed} ${tile.x},${tile.y} y`).toBeLessThan(route.height - 1);
        }
        expect(spineReaches(route.spine, route.entry, route.exits), `${shape} ${seed} connected`).toBe(true);
      }
    }
  });

  it('carves branches at least two tiles wide and marks each end as a pocket', () => {
    let totalPockets = 0;
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['branch-a', 'branch-b', 'branch-c']) {
        const route = sketchRoute(request(seed, 6, shape));
        const branchSet = new Set(route.branches.map((tile) => `${tile.x},${tile.y}`));
        const spineSet = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
        expect(route.branches.length, `${shape} ${seed} branches`).toBeGreaterThan(0);
        const wide = route.branches.some((tile) =>
          CARDINAL_DIRS.some((dir) => branchSet.has(`${tile.x + dir.x},${tile.y + dir.y}`)),
        );
        expect(wide, `${shape} ${seed} width`).toBe(true);
        const reached = reachableTiles(route.tiles, route.entry);
        for (const pocket of route.pockets) {
          totalPockets += 1;
          const key = `${pocket.x},${pocket.y}`;
          expect(branchSet.has(key), `${shape} ${seed} ${key} branch end`).toBe(true);
          expect(spineSet.has(key), `${shape} ${seed} ${key} off spine`).toBe(false);
          expect(reached.has(key), `${shape} ${seed} ${key} reachable`).toBe(true);
        }
      }
    }
    expect(totalPockets).toBeGreaterThan(0);
  }, 15_000);

  it('places one item at each reachable pocket, with stable ids and a hidden flag', () => {
    const loot = [
      { itemId: 'potion', weight: 1 },
      { itemId: 'pokeball', weight: 1 },
    ];
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['item-a', 'item-b', 'item-c']) {
        const build = () =>
          sketchRoute({ ...request(seed, 2, shape), width: 30, height: 30, loot, hiddenChance: 0.5 });
        const route = build();
        expect(route.items.length, `${shape} ${seed} items`).toBeGreaterThan(0);
        const reached = reachableTiles(route.tiles, route.entry);
        const pocketKeys = new Set(route.pockets.map((tile) => `${tile.x},${tile.y}`));
        const seen = new Set<string>();
        route.items.forEach((item, i) => {
          const key = `${item.position.x},${item.position.y}`;
          expect(item.id, `${shape} ${seed} id`).toBe(`item-2-${i}`);
          expect(pocketKeys.has(key), `${shape} ${seed} item ${key} on a pocket`).toBe(true);
          expect(reached.has(key), `${shape} ${seed} item ${key} reachable`).toBe(true);
          expect(['potion', 'pokeball']).toContain(item.itemId);
          expect(typeof item.hidden).toBe('boolean');
          expect(seen.has(key), `${shape} ${seed} item ${key} unique`).toBe(false);
          seen.add(key);
        });
        // Same seed and inputs: byte-identical items (D11).
        expect(build().items).toEqual(route.items);
      }
    }
  }, 20_000);

  it('places no items without a loot pool', () => {
    expect(sketchRoute(request('no-loot', 2, 'cross')).items).toEqual([]);
  });

  it('never places an item on tall grass: the pockets stay clear', () => {
    const loot = [{ itemId: 'potion', weight: 1 }];
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['item-grass-a', 'item-grass-b']) {
        const route = sketchRoute({
          ...request(seed, 1, shape),
          width: 30,
          height: 30,
          grassPatches: 12,
          loot,
        });
        for (const pocket of route.pockets) {
          expect(route.tiles[pocket.y][pocket.x], `${shape} ${seed} pocket grass`).not.toBe(TALL_GRASS);
        }
        for (const item of route.items) {
          expect(
            route.tiles[item.position.y][item.position.x],
            `${shape} ${seed} item grass`,
          ).not.toBe(TALL_GRASS);
        }
      }
    }
  }, 20_000);

  it('keeps every branch inside the border', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['branch-edge-a', 'branch-edge-b']) {
        const route = sketchRoute(request(seed, 6, shape));
        for (const cell of route.branches) {
          expect(cell.x, `${shape} ${seed} ${cell.x},${cell.y} x`).toBeGreaterThan(0);
          expect(cell.x, `${shape} ${seed} ${cell.x},${cell.y} x`).toBeLessThan(route.width - 1);
          expect(cell.y, `${shape} ${seed} ${cell.x},${cell.y} y`).toBeGreaterThan(0);
          expect(cell.y, `${shape} ${seed} ${cell.x},${cell.y} y`).toBeLessThan(route.height - 1);
        }
      }
    }
  });

  it('keeps tall grass off the guaranteed spine', () => {
    for (const shape of ROUTE_SHAPES) {
      const route = sketchRoute({ ...request('grass-a', 2, shape), grassPatches: 16 });
      const spine = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
      let grass = 0;
      for (let y = 0; y < route.height; y++) {
        for (let x = 0; x < route.width; x++) {
          if (route.tiles[y][x] !== TALL_GRASS) continue;
          grass += 1;
          expect(spine.has(`${x},${y}`), `${shape} ${x},${y} grass on spine`).toBe(false);
        }
      }
      expect(grass, `${shape} grass placed`).toBeGreaterThan(0);
    }
  });

  it('scales branch reach with the map size', () => {
    const farthest = (route: RouteMap): number => {
      const spine = route.spine.map((tile) => `${tile.x},${tile.y}`);
      let max = 0;
      for (const cell of route.branches) {
        let nearest = Number.POSITIVE_INFINITY;
        for (const key of spine) {
          const [x, y] = key.split(',').map(Number);
          nearest = Math.min(nearest, Math.abs(x - cell.x) + Math.abs(y - cell.y));
        }
        max = Math.max(max, nearest);
      }
      return max;
    };
    const small = sketchRoute({ ...request('scale-a', 3, 'cross'), width: 20, height: 20 });
    const big = sketchRoute({ ...request('scale-a', 3, 'cross'), width: 64, height: 64 });
    expect(farthest(big)).toBeGreaterThan(farthest(small));
    expect(farthest(big)).toBeGreaterThan(SHAPES.cross.branchMax);
  }, 30_000);

  it('can grow a branch off another branch, not only off the spine', () => {
    const route = sketchRoute({ ...request('nest-a', 3, 'cross'), width: 64, height: 64 });
    const branch = new Set(route.branches.map((tile) => `${tile.x},${tile.y}`));
    // Label each 4-connected component of the branch tiles, then count the pockets
    // per component. Independent lanes rooted on the spine are their own component
    // with a single pocket; a component holding two pockets means a later lane
    // joined an earlier branch instead of the spine, so branches grew off branches.
    const component = new Map<string, number>();
    let next = 0;
    for (const tile of route.branches) {
      const start = `${tile.x},${tile.y}`;
      if (component.has(start)) continue;
      const id = next++;
      const stack = [start];
      component.set(start, id);
      while (stack.length > 0) {
        const [x, y] = stack.pop()!.split(',').map(Number);
        for (const dir of CARDINAL_DIRS) {
          const key = `${x + dir.x},${y + dir.y}`;
          if (branch.has(key) && !component.has(key)) {
            component.set(key, id);
            stack.push(key);
          }
        }
      }
    }
    const pocketsPerComponent = new Map<number, number>();
    for (const pocket of route.pockets) {
      const id = component.get(`${pocket.x},${pocket.y}`);
      if (id === undefined) continue;
      pocketsPerComponent.set(id, (pocketsPerComponent.get(id) ?? 0) + 1);
    }
    expect([...pocketsPerComponent.values()].some((count) => count >= 2)).toBe(true);
  }, 30_000);

  it('joins a multi-link shape through one central hub, so every exit connects', () => {
    for (const seed of ['hub-a', 'hub-b', 'hub-c']) {
      const route = sketchRoute(request(seed, 3, 'cross'));
      const hub = `${Math.floor(route.width / 2)},${Math.floor(route.height / 2)}`;
      const spine = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
      expect(spine.has(hub), `${seed} hub`).toBe(true);
      expect(validateRoute(route).ok, `${seed} valid`).toBe(true);
    }
  });

  it('carves the shape out of a solid forest: the interior is wall but for the lanes', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['carve-a', 'carve-b', 'carve-c']) {
        const route = sketchRoute(request(seed, 2, shape));
        // Most of the interior stays solid, so the carved lane reads as a path
        // through the trees instead of a clear room. The lanes are carved at least
        // two tiles wide, so the cross (two lanes meeting) is the most open shape.
        expect(blockedShare(route.tiles), `${shape} ${seed}`).toBeGreaterThan(0.35);
        for (const lane of [...route.spine, ...route.branches]) {
          expect(route.tiles[lane.y][lane.x], `${shape} ${seed} lane ${lane.x},${lane.y}`).not.toBe(WALL);
        }
        expect(borderIsSolidButForOpenings(route), `${shape} ${seed} border`).toBe(true);
      }
    }
  });

  it('records every build phase, walls first and the live map last', () => {
    for (const shape of ROUTE_SHAPES) {
      const stepRequest = request('steps-a', 2, shape);
      const steps = sketchRouteSteps(stepRequest);
      expect(steps.map((step) => step.phase)).toEqual([
        'walls',
        'access',
        'spine',
        'branches',
        'clean',
        'terrain',
        'trainers',
        'items',
        'final',
      ]);
      expect(steps[0].tiles.every((row) => row.every((value) => value === WALL))).toBe(true);
      expect(steps.at(-1)!.tiles).toEqual(sketchRoute(stepRequest).tiles);
    }
  });
});
