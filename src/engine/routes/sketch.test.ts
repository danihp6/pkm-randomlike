import { describe, expect, it } from 'vitest';
import { FLOOR, LEDGE, TALL_GRASS, WALL, isWalkable } from '../map';
import type { Tile } from '../grid';
import { ROUTE_LOOT } from '../../data/loot';
import { isTmItemId } from '../../data/tms';
import {
  ROUTE_SHAPES,
  SHAPES,
  chamberFor,
  specForOpenings,
  type Access,
  type AccessEdge,
  type RouteShape,
  type ShapeSpec,
} from './layout';
import {
  ROUTE_HEIGHT,
  ROUTE_WIDTH,
  bossChamberTile,
  carveChamber,
  cornerClearance,
  sketchRoute,
  sketchRouteSteps,
  wallMargin,
  wantsTrainers,
  type RouteRequest,
  type RouteStep,
} from './sketch';
import type { RouteMap } from './routeMap';
import { borderEdge, openingBandCells } from './doors';
import { reachableTiles, validateRoute } from './validate';
import { routeStreams } from './streams';

const CARDINAL_DIRS: readonly Tile[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const request = (seed: string, routeIndex: number, shape?: RouteShape): RouteRequest => ({
  seed,
  routeIndex,
  biomeId: 'forest',
  ...(shape ? { shape } : {}),
});

/** Fixed size of the frozen regression route, kept independent of the live default. */
const FROZEN_WIDTH = 56;
const FROZEN_HEIGHT = 32;

/** Shapes whose template carves optional paths (the corridor is a bare passage). */
const BRANCHY_SHAPES = ROUTE_SHAPES.filter((shape) => SHAPES[shape].branchCount > 0);

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
    exits: spec.openings.filter((opening) => opening.role === 'exit').map((opening) => opening.edge),
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
            expect(free, `${shape} ${seed} #${index} ${point.x},${point.y}`).toBeGreaterThanOrEqual(
              corner,
            );
            expect(free, `${shape} ${seed} #${index} ${point.x},${point.y}`).toBeLessThanOrEqual(
              span - 1 - corner,
            );
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
          const exitCount = SHAPES[shape].openings.filter((opening) => opening.role === 'exit').length;
          expect(route.exits.length, `${shape} ${seed} #${routeIndex} exits`).toBe(exitCount);
          for (const exit of route.exits) {
            expect(isWalkable(route.tiles, exit), `${shape} ${seed} #${routeIndex} exit`).toBe(true);
          }
          expect(borderIsSolidButForOpenings(route), `${shape} ${seed} #${routeIndex} border`).toBe(
            true,
          );
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
        expect(spineReaches(route.spine, route.entry, route.exits), `${shape} ${seed} connected`).toBe(
          true,
        );
      }
    }
  });

  it('carves branches at least two tiles wide and marks each end as a pocket', () => {
    let totalPockets = 0;
    for (const shape of BRANCHY_SHAPES) {
      for (const seed of ['branch-a', 'branch-b', 'branch-c']) {
        const route = sketchRoute({ ...request(seed, 6, shape), width: 30, height: 30 });
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
    for (const shape of BRANCHY_SHAPES) {
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

  it('holds an item only with the itemChance probability', () => {
    const loot = [{ itemId: 'potion', weight: 1 }];
    const base = { ...request('item-chance', 2, 'cross'), width: 30, height: 30, loot };
    expect(sketchRoute({ ...base, itemChance: 0 }).items).toEqual([]);
    expect(sketchRoute({ ...base, itemChance: 1 }).items.length).toBeGreaterThan(0);
  });

  /** The `early` and `mid` pools joined: three TMs, the widest set a band can draw. */
  const TM_POOL = [...ROUTE_LOOT.early.pool, ...ROUTE_LOOT.mid.pool];
  const TM_SEEDS = Array.from({ length: 40 }, (_, i) => `tm-unique-${i}`);
  const tmRoute = (seed: string, extra: Partial<RouteRequest> = {}): RouteMap =>
    sketchRoute({
      seed,
      routeIndex: 2,
      biomeId: 'forest',
      shape: 'cross',
      width: 30,
      height: 30,
      loot: TM_POOL,
      hiddenChance: ROUTE_LOOT.early.hiddenChance,
      itemChance: ROUTE_LOOT.mid.itemChance,
      ...extra,
    });
  const itemIdsOf = (route: RouteMap): string[] => route.items.map((item) => item.itemId);

  it('never places the same TM twice inside one route', () => {
    for (const seed of TM_SEEDS) {
      const tmIds = itemIdsOf(tmRoute(seed)).filter(isTmItemId);
      expect(new Set(tmIds).size, seed).toBe(tmIds.length);
    }
  }, 20_000);

  it('never places a TM the run already owns, while a Potion may still appear', () => {
    let potions = 0;
    for (const seed of TM_SEEDS) {
      const ids = itemIdsOf(tmRoute(seed, { lootExclude: ['tm032'] }));
      expect(ids, seed).not.toContain('tm032');
      potions += ids.filter((id) => id === 'potion').length;
    }
    expect(potions).toBeGreaterThan(0);
  }, 20_000);

  it('filters TMs only: an excluded non-TM id changes nothing', () => {
    const base = {
      ...request('tm-filter', 2, 'cross'),
      width: 30,
      height: 30,
      loot: [
        { itemId: 'potion', weight: 1 },
        { itemId: 'tm032', weight: 1 },
      ],
      itemChance: 1,
    };
    const plain = sketchRoute(base).items;
    expect(plain.length).toBeGreaterThan(0);
    expect(sketchRoute({ ...base, lootExclude: ['potion'] }).items).toEqual(plain);
  });

  it('stops drawing a TM it already placed: a two-TM pool fills one pocket each', () => {
    const route = sketchRoute({
      ...request('tm-dedupe-c', 2, 'cross'),
      width: 40,
      height: 30,
      loot: [
        { itemId: 'tm032', weight: 1 },
        { itemId: 'tm058', weight: 1 },
      ],
      itemChance: 1,
    });
    expect(route.pockets.length).toBeGreaterThan(2);
    expect(itemIdsOf(route).sort()).toEqual(['tm032', 'tm058']);
  });

  it('pins the shipped item list for a fixed seed, with and without the TM exclusion', () => {
    const early = ROUTE_LOOT.early;
    const pinned = (extra: Partial<RouteRequest> = {}): (string | boolean)[][] =>
      sketchRoute({
        seed: 'tm-unique-32',
        routeIndex: 2,
        biomeId: 'forest',
        shape: 'straight',
        width: 30,
        height: 30,
        loot: early.pool,
        hiddenChance: early.hiddenChance,
        itemChance: early.itemChance,
        ...extra,
      }).items.map((item) => [item.id, item.itemId, item.hidden]);

    // This route draws no TM, so the rule leaves the shipped draw alone.
    expect(pinned()).toEqual([
      ['item-2-0', 'stardust', false],
      ['item-2-1', 'pokeball', false],
      ['item-2-2', 'potion', false],
    ]);
    // Filtering tm032 out of the pool moves the draw, so the new list is pinned too.
    expect(pinned({ lootExclude: ['tm032'] })).toEqual([
      ['item-2-0', 'antidote', false],
      ['item-2-1', 'pokeball', false],
      ['item-2-2', 'potion', false],
    ]);
  });

  it('empties a quiet room: no grass, no ledges, no items and no trainers', () => {
    const loot = [{ itemId: 'potion', weight: 1 }];
    const base = {
      ...request('quiet', 2, 'cross'),
      width: 30,
      height: 30,
      grassPatches: 16,
      ledges: 16,
      loot,
      itemChance: 1,
      hiddenChance: 1,
      trainerArchetypes: ['youngster'],
    };
    const loud = sketchRoute(base);
    expect(loud.trainers.length).toBeGreaterThan(0);
    expect(loud.items.length).toBeGreaterThan(0);
    expect(loud.tiles.some((row) => row.includes(TALL_GRASS))).toBe(true);

    const quiet = sketchRoute({ ...base, quiet: true });
    expect(quiet.trainers).toEqual([]);
    expect(quiet.items).toEqual([]);
    expect(quiet.tiles.some((row) => row.includes(TALL_GRASS))).toBe(false);
    expect(quiet.tiles.some((row) => row.includes(LEDGE))).toBe(false);
    // The geometry still carves the lanes, so the route stays valid and walkable.
    expect(validateRoute(quiet).ok).toBe(true);
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
          expect(route.tiles[item.position.y][item.position.x], `${shape} ${seed} item grass`).not.toBe(
            TALL_GRASS,
          );
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
          expect(route.tiles[lane.y][lane.x], `${shape} ${seed} lane ${lane.x},${lane.y}`).not.toBe(
            WALL,
          );
        }
        expect(borderIsSolidButForOpenings(route), `${shape} ${seed} border`).toBe(true);
      }
    }
  });

  it('records every build phase, walls first and the live map last', () => {
    for (const shape of ROUTE_SHAPES) {
      const stepRequest = request('steps-a', 2, shape);
      const steps = sketchRouteSteps(stepRequest);
      const phases: RouteStep['phase'][] = ['walls', 'access', 'spine', 'branches'];
      // A chamber room paints one more frame, on the existing `branches` phase.
      if (SHAPES[shape].chamber === 'diamond') phases.push('branches');
      phases.push('clean', 'terrain', 'trainers', 'items', 'final');
      expect(steps.map((step) => step.phase)).toEqual(phases);
      expect(steps.filter((step) => step.phase === 'branches').map((step) => step.label)).toEqual(
        SHAPES[shape].chamber === 'diamond' ? ['carve chamber', 'carve branches'] : ['carve branches'],
      );
      expect(steps[0].tiles.every((row) => row.every((value) => value === WALL))).toBe(true);
      expect(steps.at(-1)!.tiles).toEqual(sketchRoute(stepRequest).tiles);
    }
  });

  it('takes its opening set from the plan and places each opening on its edge', () => {
    const cases: ReadonlyArray<{ openings: readonly Access[]; shape: RouteShape }> = [
      { openings: [{ edge: 'N', role: 'entry' }], shape: 'dead-end' },
      {
        openings: [
          { edge: 'N', role: 'entry' },
          { edge: 'S', role: 'exit' },
        ],
        shape: 'corridor',
      },
      {
        openings: [
          { edge: 'S', role: 'entry' },
          { edge: 'E', role: 'exit' },
          { edge: 'W', role: 'exit' },
        ],
        shape: 'tee',
      },
      {
        openings: [
          { edge: 'N', role: 'entry' },
          { edge: 'S', role: 'exit' },
          { edge: 'E', role: 'exit' },
          { edge: 'W', role: 'exit' },
        ],
        shape: 'cross',
      },
    ];
    for (const { openings, shape } of cases) {
      const route = sketchRoute({ ...request('opening-a', 4), openings });
      expect(route.shape).toBe(shape);
      expect(onEdge(route.entry, openings[0].edge)).toBe(true);
      const exits = openings.filter((opening) => opening.role === 'exit');
      expect(route.exits).toHaveLength(exits.length);
      route.exits.forEach((exit, index) => {
        expect(onEdge(exit, exits[index].edge), `${shape} exit ${index}`).toBe(true);
      });
      // Every link joins an opening with its opposite edge.
      for (const exit of exits) {
        const opposite = { N: 'S', E: 'W', S: 'N', W: 'E' }[exit.edge];
        expect(openings.some((opening) => opening.edge === opposite)).toBe(true);
      }
      expect(validateRoute(route).ok, `${shape} valid`).toBe(true);
    }
  }, 20_000);

  it('carves a branchless corridor as a bare passage', () => {
    const route = sketchRoute(request('corridor-a', 6, 'corridor'));
    expect(route.branches).toEqual([]);
    expect(route.pockets).toEqual([]);
    expect(route.spine.length).toBeGreaterThan(0);
    expect(validateRoute(route).ok).toBe(true);
  });

  it('gates the lane guard on a non-quiet room that carries an archetype pool', () => {
    expect(wantsTrainers(request('wants', 1, 'cross'))).toBe(false);
    expect(wantsTrainers({ ...request('wants', 1, 'cross'), trainerArchetypes: [] })).toBe(false);
    expect(wantsTrainers({ ...request('wants', 1, 'cross'), trainerArchetypes: ['youngster'] })).toBe(
      true,
    );
    expect(
      wantsTrainers({ ...request('wants', 1, 'cross'), trainerArchetypes: ['youngster'], quiet: true }),
    ).toBe(false);
    expect(
      wantsTrainers({
        ...request('wants', 1, 'cross'),
        trainerArchetypes: ['youngster'],
        role: 'wild',
      }),
    ).toBe(false);
  });

  it('ships no trainers in a wild room, and owes no lane guard there', () => {
    const wild: RouteRequest = {
      ...request('wild-room', 2, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster', 'lass'],
      role: 'wild',
    };
    const route = sketchRoute(wild);
    expect(wantsTrainers(wild)).toBe(false);
    expect(route.trainers).toEqual([]);
    expect(validateRoute(route, { expectTrainers: false }).ok).toBe(true);
    // The guard is conditional: the same room, had it been a `trainers` room, has none.
    expect(validateRoute(route, { expectTrainers: true }).missingLaneGuard).not.toEqual([]);
  });

  it('ships one or two trainers in a trainers room, whatever the shape', () => {
    for (const shape of ROUTE_SHAPES) {
      for (let i = 0; i < 32; i++) {
        const sized: RouteRequest = {
          seed: `role-${i}`,
          routeIndex: 3,
          biomeId: 'forest',
          shape,
          width: 30,
          height: 30,
          trainerArchetypes: ['youngster', 'lass'],
          role: 'trainers',
        };
        const route = sketchRoute(sized);
        expect(route.trainers.length, `${shape} role-${i} trainers`).toBeGreaterThanOrEqual(1);
        expect(route.trainers.length, `${shape} role-${i} trainers`).toBeLessThanOrEqual(2);
        expect(validateRoute(route, { expectTrainers: true }).ok, `${shape} role-${i}`).toBe(true);
      }
    }
  }, 120_000);

  it('keeps the shipped pass for a request that names no role', () => {
    const sized: RouteRequest = {
      ...request('no-role', 3, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster', 'lass'],
    };
    const route = sketchRoute(sized);
    expect(wantsTrainers(sized)).toBe(true);
    expect(route.trainers.length).toBeGreaterThanOrEqual(1);
    expect(route.trainers.length).toBeLessThanOrEqual(2);
    expect(validateRoute(route, { expectTrainers: true }).ok).toBe(true);
  });

  it('always ships a guarding trainer the pass was asked for, across a bounded seed sweep', () => {
    const archetypes = ['youngster', 'lass'];
    for (const shape of ROUTE_SHAPES) {
      for (let i = 0; i < 120; i++) {
        const sized: RouteRequest = {
          seed: `guard-${i}`,
          routeIndex: 2,
          biomeId: 'forest',
          shape,
          width: 30,
          height: 30,
          trainerArchetypes: archetypes,
        };
        const route = sketchRoute(sized);
        expect(route.trainers.length, `${shape} guard-${i} trainers`).toBeGreaterThan(0);
        expect(validateRoute(route, { expectTrainers: true }).ok, `${shape} guard-${i} guarded`).toBe(
          true,
        );
      }
    }
  }, 120_000);

  it('keeps the archetype pool a pure function of the request (D11)', () => {
    const sized: RouteRequest = {
      ...request('pure-trainers', 3, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster', 'lass'],
    };
    expect(sketchRoute(sized)).toEqual(sketchRoute(sized));
    expect(sketchRoute(sized).trainers.length).toBeGreaterThan(0);
  });

  it('ships no trainers for an empty pool or a quiet room, and still validates', () => {
    const empty: RouteRequest = {
      ...request('no-pool', 2, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: [],
    };
    const quiet: RouteRequest = {
      ...request('quiet-room', 2, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster'],
      quiet: true,
    };
    const emptyRoute = sketchRoute(empty);
    const quietRoute = sketchRoute(quiet);
    expect(emptyRoute.trainers).toEqual([]);
    expect(quietRoute.trainers).toEqual([]);
    expect(validateRoute(emptyRoute).ok).toBe(true);
    expect(validateRoute(quietRoute).ok).toBe(true);
  });

  it('replays the attempt sketchRoute ships, with and without an archetype pool', () => {
    const phasesOf = (sized: RouteRequest): RouteStep['phase'][] => {
      const template = SHAPES[sized.shape ?? 'straight'];
      const phases: RouteStep['phase'][] = ['walls', 'access', 'spine', 'branches'];
      if (chamberFor(sized.openings ?? template.openings, sized.chamber) === 'diamond') {
        phases.push('branches');
      }
      phases.push('clean', 'terrain', 'trainers', 'items', 'final');
      return phases;
    };
    const archetypeRequest: RouteRequest = {
      ...request('steps-archetype', 3, 'cross'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster'],
    };
    // sweep-b's dead-end attempt 0 ships no trainer, so the gate re-rolls and the
    // stepper must follow it to the shipped attempt instead of replaying attempt 0.
    const rerolledRequest: RouteRequest = {
      ...request('sweep-b', 5, 'dead-end'),
      width: 30,
      height: 30,
      trainerArchetypes: ['youngster', 'lass'],
    };
    const plainRequest: RouteRequest = { ...request('steps-plain', 3, 'cross'), width: 30, height: 30 };
    for (const sized of [archetypeRequest, rerolledRequest, plainRequest]) {
      const steps = sketchRouteSteps(sized);
      expect(steps.map((step) => step.phase)).toEqual(phasesOf(sized));
      expect(steps.at(-1)!.tiles).toEqual(sketchRoute(sized).tiles);
    }
    expect(sketchRoute(rerolledRequest).trainers.length).toBeGreaterThan(0);
  }, 60_000);

  /**
   * The shipped floors' **geometry**, pinned by a digest of a route's whole shape
   * minus its population: its size, its tiles, the entry, the exits, the spine, the
   * branches, the pockets and the fact that it carries **no** `gate` key. Read off
   * the **pre-change** engine for this sweep, so any moved lane is a defect, never a
   * re-pin: the gate pass runs only when a request asks for one. The population
   * (trainers, then the items their draws shift) is deliberately outside the digest,
   * because a floor's trainer composition is what its plan room decides now
   * (`docs/maps-spec.md` §2).
   */
  const NO_GATE_DIGESTS: Readonly<Record<string, string>> = {
    'alpha:1': '74341a58',
    'alpha:2': 'd00cc239',
    'alpha:3': 'e25318b3',
    'alpha:4': '21c87156',
    'alpha:5': '267d5829',
    'alpha:6': '61c2b082',
    'alpha:7': 'dd13863d',
    'alpha:8': 'e5f24a86',
    'bravo:1': '8bfa49c6',
    'bravo:2': 'c3c14af0',
    'bravo:3': 'adeaf82d',
    'bravo:4': '7e7ae508',
    'bravo:5': '6502c91c',
    'bravo:6': '6005d06b',
    'bravo:7': '19632112',
    'bravo:8': 'c9a939b8',
    'charlie:1': '1319923d',
    'charlie:2': '1c17b5d6',
    'charlie:3': '70895189',
    'charlie:4': 'f072f15e',
    'charlie:5': 'c037e816',
    'charlie:6': 'ce332bc0',
    'charlie:7': 'a4add1f8',
    'charlie:8': 'a132105a',
    'delta:1': '6bbdda61',
    'delta:2': '01c1d023',
    'delta:3': 'de97c558',
    'delta:4': '77253023',
    'delta:5': '4dc6cad7',
    'delta:6': 'faf6d57c',
    'delta:7': 'cc340756',
    'delta:8': '799cb659',
    'echo:1': '094e6ed9',
    'echo:2': '8253cc6a',
    'echo:3': '9eb240d2',
    'echo:4': '6499fb7d',
    'echo:5': '485f31d9',
    'echo:6': '01a429ad',
    'echo:7': '0042853f',
    'echo:8': '476f1c9a',
    'foxtrot:1': '10ade222',
    'foxtrot:2': 'c84c9619',
    'foxtrot:3': '803fe54f',
    'foxtrot:4': '5f396465',
    'foxtrot:5': 'cb553988',
    'foxtrot:6': '83c3c4f2',
    'foxtrot:7': 'a4c0c9a4',
    'foxtrot:8': 'e23b00d5',
    'golf:1': '92e657d7',
    'golf:2': '51169a5c',
    'golf:3': '0bea98f2',
    'golf:4': '78894c02',
    'golf:5': '6ec9b3e5',
    'golf:6': 'c66d1981',
    'golf:7': '578b7e12',
    'golf:8': 'a9cde700',
    'hotel:1': 'b87790d6',
    'hotel:2': '3237d237',
    'hotel:3': 'f32cd614',
    'hotel:4': '233d7031',
    'hotel:5': '9db6aa9e',
    'hotel:6': '972bcec0',
    'hotel:7': '72df4e94',
    'hotel:8': 'bcc0b869',
  };

  /** A census request at room size, the shape every plan room is built at. */
  function census(seed: string, routeIndex: number): RouteRequest {
    return {
      ...request(seed, routeIndex),
      width: 30,
      height: 30,
      grassPatches: 12,
      ledges: 6,
      loot: [{ itemId: 'potion', weight: 1 }],
      hiddenChance: 0.5,
      trainerArchetypes: ['youngster', 'lass'],
    };
  }

  /** A cheap fold over a route's geometry, for the pin above. */
  function digest(route: RouteMap): string {
    const text = JSON.stringify({
      seed: route.seed,
      routeIndex: route.routeIndex,
      biomeId: route.biomeId,
      shape: route.shape,
      width: route.width,
      height: route.height,
      tiles: route.tiles,
      entry: route.entry,
      exits: route.exits,
      spine: route.spine,
      branches: route.branches,
      pockets: route.pockets,
      hasGate: 'gate' in route,
    });
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  it("leaves every shipped floor's geometry where it was, and adds no gate key", () => {
    const actual: Record<string, string> = {};
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']) {
      for (let mapIndex = 1; mapIndex <= 8; mapIndex++) {
        const route = sketchRoute(census(seed, mapIndex));
        actual[`${seed}:${mapIndex}`] = digest(route);
        expect('gate' in route, `${seed}:${mapIndex} gate key`).toBe(false);
      }
    }
    expect(actual).toEqual(NO_GATE_DIGESTS);
  }, 60_000);

  it('moves two cells and nothing else when the room is asked for a gated vault', () => {
    for (const seed of ['alpha', 'delta', 'hotel']) {
      const plain = sketchRoute(census(seed, 5));
      const gated = sketchRoute({ ...census(seed, 5), gate: 'sealed' });
      const gate = gated.gate!;
      expect('gate' in plain, `${seed} plain`).toBe(false);
      expect(gate, `${seed} vault`).toBeDefined();

      const moved: string[] = [];
      for (let y = 0; y < gated.height; y++) {
        for (let x = 0; x < gated.width; x++) {
          if (plain.tiles[y][x] !== gated.tiles[y][x]) moved.push(`${x},${y}`);
        }
      }
      // The seal replaces a wall and the chamber behind it becomes floor: the route's
      // geometry, its lanes, its pockets, its items and its trainers do not move.
      expect(moved.sort(), `${seed} moved cells`).toEqual(
        [`${gate.tile.x},${gate.tile.y}`, `${gate.pocket.x},${gate.pocket.y}`].sort(),
      );
      expect(gated.entry, `${seed} entry`).toEqual(plain.entry);
      expect(gated.exits, `${seed} exits`).toEqual(plain.exits);
      expect(gated.spine, `${seed} spine`).toEqual(plain.spine);
      expect(gated.branches, `${seed} branches`).toEqual(plain.branches);
      expect(gated.pockets, `${seed} pockets`).toEqual(plain.pockets);
      expect(gated.items, `${seed} items`).toEqual(plain.items);
      // The population pass reads the tiles, so a trainer beside the vault may shift
      // with it; only the **no-gate** builds above are pinned, as the pass promises.
    }
  }, 60_000);
});

/** A solid wall grid: the room's interior before any lane is carved into it. */
function wallGrid(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => new Array<number>(width).fill(WALL));
}

/** The rows a tile set covers, top to bottom, as `[y, [x…]]` in column order. */
function rowsOf(keys: Iterable<string>): Array<[number, number[]]> {
  const byRow = new Map<number, number[]>();
  for (const key of keys) {
    const [x, y] = key.split(',').map(Number);
    byRow.set(y, [...(byRow.get(y) ?? []), x]);
  }
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, xs]) => [y, xs.sort((a, b) => a - b)]);
}

/** The tiles a room's chamber opens, taken from its own `chamber` stream. */
function carveOf(seed: string, routeIndex: number, spec: ShapeSpec, size = 30) {
  return carveChamber(
    wallGrid(size, size),
    spec,
    size,
    size,
    routeStreams(seed, routeIndex, 0).chamber,
    wallMargin(undefined),
  )!;
}

const DEAD_END_OPENINGS: readonly Access[] = [{ edge: 'W', role: 'entry' }];

/** The tiles the chamber opened in a built room, read off the debug stepper. */
function openedChamber(stepRequest: RouteRequest): Set<string> {
  const steps = sketchRouteSteps(stepRequest);
  const before = steps.find((step) => step.label === 'carve spine')!;
  const after = steps.find((step) => step.label === 'carve chamber')!;
  const opened = new Set<string>();
  for (let y = 0; y < before.tiles.length; y++) {
    for (let x = 0; x < before.tiles[y].length; x++) {
      if (before.tiles[y][x] === WALL && after.tiles[y][x] !== WALL) opened.add(`${x},${y}`);
    }
  }
  return opened;
}

const keyOf = (tile: Tile): string => `${tile.x},${tile.y}`;

describe('the centre chamber', () => {
  it('pins the exact outline a dead-end room opens at a written seed', () => {
    const spec = specForOpenings(DEAD_END_OPENINGS);
    expect(spec.chamber).toBe('diamond');
    const chamber = carveOf('chamber-a', 3, spec);
    expect(chamber.radius).toBe(5);
    expect(chamber.pockets).toEqual([
      { x: 9, y: 15 },
      { x: 21, y: 15 },
    ]);
    expect(rowsOf(chamber.tiles)).toEqual([
      [10, [15]],
      [11, [14, 15, 16]],
      [12, [12, 13, 14, 15, 16, 17, 18]],
      [13, [12, 13, 14, 15, 16, 17, 18]],
      [14, [11, 12, 13, 14, 15, 16, 17, 18, 19]],
      [15, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]],
      [16, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]],
      [17, [12, 13, 14, 15, 16, 17, 18]],
      [18, [13, 14, 15, 16, 17]],
      [19, [13, 14, 15, 16, 17]],
      [20, [14, 15, 16]],
    ]);

    // The same room built for real opens every one of those tiles and keeps them on
    // its spine, so the pinned outline is the floor the player actually walks.
    const route = sketchRoute({
      ...request('chamber-a', 3),
      openings: DEAD_END_OPENINGS,
      width: 30,
      height: 30,
    });
    expect(validateRoute(route).ok).toBe(true);
    const spine = new Set(route.spine.map(keyOf));
    for (const key of chamber.tiles) {
      const [x, y] = key.split(',').map(Number);
      expect(route.tiles[y][x], key).toBe(FLOOR);
      expect(spine.has(key), `${key} on spine`).toBe(true);
    }
  });

  it('never repeats an outline: four seeds, four different (radius, tiles) pairs', () => {
    const spec = specForOpenings(DEAD_END_OPENINGS);
    const built = ['chamber-a', 'chamber-b', 'chamber-c', 'chamber-d'].map((seed) => {
      const chamber = carveOf(seed, 3, spec);
      return {
        radius: chamber.radius,
        key: [...chamber.tiles].sort().join('|'),
      };
    });
    expect(built.every((pair) => pair.key.length > 0)).toBe(true);
    for (let i = 0; i < built.length; i++) {
      for (let j = i + 1; j < built.length; j++) {
        expect(`${built[i].radius}/${built[i].key}`, `seeds ${i} and ${j}`).not.toBe(
          `${built[j].radius}/${built[j].key}`,
        );
      }
    }
  });

  it('is never a perfect rhombus: the centre row carries one extra tile', () => {
    const spec = specForOpenings(DEAD_END_OPENINGS);
    const cx = 15;
    const cy = 15;
    for (let i = 0; i < 20; i++) {
      const chamber = carveOf(`chamber-sweep-${i}`, 3, spec);
      const centreRow = [...chamber.tiles]
        .map((key) => key.split(',').map(Number))
        .filter(([, y]) => y === cy)
        .map(([x]) => x);
      expect(Math.max(...centreRow) - cx, `seed ${i} centre row`).toBe(chamber.radius + 1);
      expect(cx - Math.min(...centreRow), `seed ${i} centre row`).toBe(chamber.radius + 1);
      const perfect = new Set<string>();
      for (let dy = -chamber.radius; dy <= chamber.radius; dy++) {
        const half = chamber.radius - Math.abs(dy);
        for (let dx = -half; dx <= half; dx++) perfect.add(`${cx + dx},${cy + dy}`);
      }
      expect([...chamber.tiles].sort(), `seed ${i} rhombus`).not.toEqual([...perfect].sort());
    }
  });

  it('stops at the walls: inside the margin, off the ring and out of every opening band', () => {
    const margin = wallMargin(undefined);
    const requests: RouteRequest[] = [];
    for (let i = 0; i < 20; i++) {
      requests.push({
        ...request(`chamber-wall-${i}`, 4),
        openings: DEAD_END_OPENINGS,
        width: 30,
        height: 30,
      });
      requests.push({
        ...request(`chamber-wall-${i}`, 4),
        openings: [],
        width: 30,
        height: 30,
      });
    }
    for (const stepRequest of requests) {
      const route = sketchRoute(stepRequest);
      const opened = openedChamber(stepRequest);
      expect(opened.size, `${stepRequest.seed} carves`).toBeGreaterThan(0);
      const band = new Set<string>();
      for (const anchor of [route.entry, ...route.exits]) {
        const edge = borderEdge(anchor, 30, 30);
        if (!edge) continue;
        for (const cell of openingBandCells(edge, anchor, 30, 30, 2)) band.add(keyOf(cell));
      }
      for (const key of opened) {
        const [x, y] = key.split(',').map(Number);
        expect(route.tiles[y][x], `${stepRequest.seed} ${key} floor`).toBe(FLOOR);
        expect(x, `${stepRequest.seed} ${key} ring x`).not.toBe(0);
        expect(x, `${stepRequest.seed} ${key} ring x`).not.toBe(29);
        expect(y, `${stepRequest.seed} ${key} ring y`).not.toBe(0);
        expect(y, `${stepRequest.seed} ${key} ring y`).not.toBe(29);
        expect(x, `${stepRequest.seed} ${key} margin x`).toBeGreaterThanOrEqual(margin);
        expect(x, `${stepRequest.seed} ${key} margin x`).toBeLessThanOrEqual(29 - margin);
        expect(y, `${stepRequest.seed} ${key} margin y`).toBeGreaterThanOrEqual(margin);
        expect(y, `${stepRequest.seed} ${key} margin y`).toBeLessThanOrEqual(29 - margin);
        expect(band.has(key), `${stepRequest.seed} ${key} opening band`).toBe(false);
      }
    }
  });

  it('clamps into a room too tight for the radius it drew', () => {
    const spec = specForOpenings(DEAD_END_OPENINGS);
    const tile = carveChamber(
      wallGrid(16, 16),
      spec,
      16,
      16,
      routeStreams('tight-room', 3, 0).chamber,
      wallMargin(undefined),
    )!;
    expect(tile.radius).toBeGreaterThanOrEqual(2);
    for (const key of tile.tiles) {
      const [x, y] = key.split(',').map(Number);
      expect(x, key).toBeGreaterThanOrEqual(3);
      expect(y, key).toBeGreaterThanOrEqual(3);
      expect(x, key).toBeLessThanOrEqual(12);
      expect(y, key).toBeLessThanOrEqual(12);
    }
  });

  it('is one floor with the room: on the spine, reachable and validated', () => {
    for (const seed of ['chamber-a', 'chamber-b', 'chamber-c', 'chamber-d']) {
      const stepRequest: RouteRequest = {
        ...request(seed, 3),
        openings: DEAD_END_OPENINGS,
        width: 30,
        height: 30,
      };
      const route = sketchRoute(stepRequest);
      expect(validateRoute(route).ok, `${seed} valid`).toBe(true);
      const opened = openedChamber(stepRequest);
      const spine = new Set(route.spine.map(keyOf));
      const reached = reachableTiles(route.tiles, route.entry);
      for (const key of opened) {
        expect(spine.has(key), `${seed} ${key} on spine`).toBe(true);
        expect(reached.has(key), `${seed} ${key} reachable`).toBe(true);
      }
    }
  });

  it('fields no branch on a dead end and still holds its loot on the chamber', () => {
    const stepRequest: RouteRequest = {
      ...request('chamber-loot', 3),
      openings: DEAD_END_OPENINGS,
      width: 30,
      height: 30,
      loot: [{ itemId: 'potion', weight: 1 }],
      itemChance: 1,
    };
    const route = sketchRoute(stepRequest);
    expect(route.branches).toEqual([]);
    expect(route.pockets).toHaveLength(2);
    const opened = openedChamber(stepRequest);
    for (const pocket of route.pockets) {
      expect(opened.has(keyOf(pocket)), `${pocket.x},${pocket.y} chamber tile`).toBe(true);
    }
    expect(route.items.length).toBeGreaterThan(0);
    for (const item of route.items) {
      expect(route.pockets.some((pocket) => keyOf(pocket) === keyOf(item.position))).toBe(true);
    }
  });

  it('moves nothing else: a straight, a cross and a two-opening corridor keep their tiles', () => {
    const digestOf = (route: RouteMap): string => {
      const text = JSON.stringify({
        shape: route.shape,
        tiles: route.tiles,
        entry: route.entry,
        exits: route.exits,
        spine: route.spine,
        branches: route.branches,
        pockets: route.pockets,
      });
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16).padStart(8, '0');
    };
    // Read off the engine before the chamber existed: `chamberFor` answers `none` for
    // every one of these opening sets, so their `chamber` stream is never drawn.
    const pinned: Readonly<Record<string, string>> = {
      'straight:no-move-a': '3eb52e7a',
      'straight:no-move-b': '9d69139c',
      'cross:no-move-a': 'd7f3eb93',
      'cross:no-move-b': '0df237ce',
      'corridor:no-move-a': '155255f2',
      'corridor:no-move-b': '0171b6ff',
      'corridor-ns:no-move-a': '70950b84',
      'corridor-ns:no-move-b': '5008478f',
    };
    const actual: Record<string, string> = {};
    for (const seed of ['no-move-a', 'no-move-b']) {
      for (const [label, extra] of [
        ['straight', { shape: 'straight' as const }],
        ['cross', { shape: 'cross' as const }],
        ['corridor', { shape: 'corridor' as const }],
        [
          'corridor-ns',
          {
            openings: [
              { edge: 'N', role: 'entry' },
              { edge: 'S', role: 'exit' },
            ] as readonly Access[],
          },
        ],
      ] as const) {
        const route = sketchRoute({
          seed,
          routeIndex: 4,
          biomeId: 'forest',
          width: 30,
          height: 30,
          ...extra,
        });
        actual[`${label}:${seed}`] = digestOf(route);
      }
    }
    expect(actual).toEqual(pinned);
  });
});

describe('the room chamber on the route', () => {
  const chambered = (seed: string, extra: Partial<RouteRequest> = {}): RouteMap =>
    sketchRoute({
      seed,
      routeIndex: 4,
      biomeId: 'forest',
      width: 30,
      height: 30,
      ...extra,
    });

  it('rides the route only when one was carved, row-major', () => {
    const plain = chambered('chamber-carry', { shape: 'straight' });
    expect(plain).not.toHaveProperty('chamber');

    const route = chambered('chamber-carry', { shape: 'straight', chamber: true });
    const chamber = route.chamber;
    expect(chamber).toBeDefined();
    if (!chamber) return;
    expect(chamber.tiles.length).toBeGreaterThan(0);
    expect(chamber.tiles).toEqual([...chamber.tiles].sort((a, b) => a.y - b.y || a.x - b.x));
    expect(chamber.pockets).toHaveLength(2);
    // The pockets are the widest row's lateral extremes, on the room's middle row.
    const centreY = Math.floor(route.height / 2);
    expect(chamber.pockets.every((pocket) => pocket.y === centreY)).toBe(true);
    expect(chamber.radius).toBeGreaterThanOrEqual(4);
    expect(chamber.radius).toBeLessThanOrEqual(6);
    for (const tile of chamber.tiles) {
      expect(route.tiles[tile.y][tile.x]).toBe(FLOOR);
    }
  });

  it('answers no boss tile for a route that carved no chamber', () => {
    expect(bossChamberTile(chambered('boss-tile-none', { shape: 'straight' }))).toBeNull();
  });

  it('puts the boss on the chamber tile farthest from the entry', () => {
    const route = chambered('boss-tile-far', { shape: 'cross', chamber: true });
    const boss = bossChamberTile(route);
    expect(boss).not.toBeNull();
    const distance = (tile: Tile): number =>
      Math.abs(tile.x - route.entry.x) + Math.abs(tile.y - route.entry.y);
    const farthest = Math.max(...route.chamber!.tiles.map(distance));
    expect(distance(boss!)).toBe(farthest);
    expect(route.chamber!.tiles).toContainEqual(boss);
  });

  it('breaks a distance tie on the middle line, then by lower y and lower x', () => {
    const width = 20;
    const height = 20;
    const flat = (): RouteMap => ({
      seed: 'boss-tile-tie',
      routeIndex: 0,
      biomeId: 'forest',
      shape: 'corridor',
      width,
      height,
      tiles: Array.from({ length: height }, () => new Array<number>(width).fill(FLOOR)),
      entry: { x: 0, y: 10 },
      exits: [],
      spine: [],
      branches: [],
      pockets: [],
      items: [],
      trainers: [],
      chamber: {
        // The off-line tile ties the middle row's far end on distance.
        tiles: [
          { x: 14, y: 6 },
          { x: 18, y: 10 },
          { x: 10, y: 4 },
        ],
        pockets: [],
        radius: 4,
      },
    });
    expect(bossChamberTile(flat())).toEqual({ x: 18, y: 10 });

    const tied = flat();
    const both = {
      ...tied,
      chamber: {
        tiles: [
          { x: 10, y: 16 },
          { x: 10, y: 4 },
        ],
        pockets: [],
        radius: 4,
      },
    };
    expect(bossChamberTile(both)).toEqual({ x: 10, y: 4 });

    const crossed = {
      ...tied,
      chamber: {
        tiles: [
          { x: 10, y: 12 },
          { x: 8, y: 10 },
        ],
        pockets: [],
        radius: 4,
      },
    };
    expect(bossChamberTile(crossed)).toEqual({ x: 10, y: 12 });
  });
});

/**
 * The boss room's anti-soft-lock argument, on the engine's own terms: the boss is
 * fought only by interacting with it, so the player must always be able to stand on
 * a tile next to it and press the key. Twenty literal seeds keep that a pin instead
 * of a sweep.
 */
const BOSS_GUARD_SEEDS: readonly string[] = [
  'boss-guard-01',
  'boss-guard-02',
  'boss-guard-03',
  'boss-guard-04',
  'boss-guard-05',
  'boss-guard-06',
  'boss-guard-07',
  'boss-guard-08',
  'boss-guard-09',
  'boss-guard-10',
  'boss-guard-11',
  'boss-guard-12',
  'boss-guard-13',
  'boss-guard-14',
  'boss-guard-15',
  'boss-guard-16',
  'boss-guard-17',
  'boss-guard-18',
  'boss-guard-19',
  'boss-guard-20',
];

describe('the boss room never soft-locks on the boss', () => {
  const shapes: readonly RouteShape[] = ['straight', 'cross', 'corridor'];
  const CARDINAL_NEIGHBOURS: readonly Tile[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  it('keeps a walkable neighbour of the boss tile on the entry BFS tree, on 20 seeds', () => {
    for (const seed of BOSS_GUARD_SEEDS) {
      for (const shape of shapes) {
        const route = sketchRoute({
          seed,
          routeIndex: 4,
          biomeId: 'forest',
          width: 30,
          height: 30,
          shape,
          chamber: true,
        });
        const label = `${seed} ${shape}`;
        expect(route.chamber, `${label} chamber`).toBeDefined();
        const boss = bossChamberTile(route);
        expect(boss, `${label} boss tile`).not.toBeNull();
        const reached = reachableTiles(route.tiles, route.entry);
        expect(reached.has(`${boss!.x},${boss!.y}`), `${label} boss tile reachable`).toBe(true);
        const standable = CARDINAL_NEIGHBOURS.some((vector) => {
          const neighbour = { x: boss!.x + vector.x, y: boss!.y + vector.y };
          return isWalkable(route.tiles, neighbour) && reached.has(`${neighbour.x},${neighbour.y}`);
        });
        expect(standable, `${label} reachable neighbour of ${boss!.x},${boss!.y}`).toBe(true);
      }
    }
  }, 120_000);
});
