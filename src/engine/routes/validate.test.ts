import { describe, expect, it } from 'vitest';
import type { Tile } from '../grid';
import { mapFromSketch, type TileMap } from '../map';
import { ROUTE_SHAPES, type RouteShape } from './layout';
import type { RouteItem, RouteMap, RouteTrainer } from './routeMap';
import { sketchRoute, sketchRouteSteps, type RouteRequest } from './sketch';
import { reachableTiles, validateRoute, type RouteValidation } from './validate';

function route(
  tiles: TileMap,
  entry: Tile,
  exits: readonly Tile[],
  overrides: Partial<RouteMap> = {},
): RouteMap {
  return {
    seed: 'test',
    routeIndex: 1,
    biomeId: 'wood',
    shape: 'straight',
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    entry,
    exits,
    spine: [],
    branches: [],
    pockets: [],
    items: [],
    trainers: [],
    ...overrides,
  };
}

function item(id: string, position: Tile): RouteItem {
  return { id, position, itemId: 'potion', hidden: false };
}

function trainer(
  index: number,
  position: Tile,
  facing: RouteTrainer['facing'],
  extra: Partial<RouteTrainer> = {},
): RouteTrainer {
  return {
    id: `trainer-1-${index}`,
    position,
    facing,
    sight: 3,
    archetypeId: 'youngster',
    ...extra,
  };
}

/** A 7x7 open room: solid ring, plain floor, entry (1,1), exit (5,5). */
const ROOM = [
  '#######',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#.....#',
  '#######',
];

/** The lists `ok` gates (`unreachablePockets` is reported, never gated). */
const GATED = [
  'unreachable',
  'blockedByTrainers',
  'strandedItems',
  'itemsOnTerrain',
  'spineBlocked',
  'borderBreaches',
  'borderBandGaps',
  'missingLaneGuard',
  'trainerIssues',
] as const;

type GatedField = (typeof GATED)[number];

/** Asserts the named gated lists reported something and every other one is empty. */
function expectOnly(validation: RouteValidation, red: readonly GatedField[]): void {
  for (const field of GATED) {
    const empty = validation[field].length === 0;
    expect(empty, `${field} ${red.includes(field) ? 'reported' : 'empty'}`)
      .toBe(!red.includes(field));
  }
  expect(validation.ok, `ok ${red.length === 0 ? 'true' : 'false'}`).toBe(red.length === 0);
}

describe('reachableTiles', () => {
  it('floods walkable tiles from the start', () => {
    const tiles = mapFromSketch(['#####', '#...#', '#####']);
    expect([...reachableTiles(tiles, { x: 1, y: 1 })].sort()).toEqual([
      '1,1',
      '2,1',
      '3,1',
    ]);
  });

  it('stops at walls', () => {
    const tiles = mapFromSketch(['#####', '#.#.#', '#####']);
    expect(reachableTiles(tiles, { x: 1, y: 1 }).has('3,1')).toBe(false);
  });
});

describe('validateRoute', () => {
  it('passes when the exit is reachable from the start', () => {
    const tiles = mapFromSketch(['#####', '#...#', '#.#.#', '#...#', '#####']);
    expect(validateRoute(route(tiles, { x: 1, y: 1 }, [{ x: 3, y: 3 }])).ok).toBe(true);
  });

  it('reports an exit sealed off from the start', () => {
    const tiles = mapFromSketch(['#####', '#.#.#', '#####']);
    const validation = validateRoute(route(tiles, { x: 1, y: 1 }, [{ x: 3, y: 1 }]));
    expect(validation.ok).toBe(false);
    expect(validation.unreachable).toContain('3,1');
  });

  it('requires every exit to be reachable, not just the first', () => {
    const tiles = mapFromSketch([
      '#######',
      '#...#.#',
      '#.#.#.#',
      '#...#.#',
      '#######',
    ]);
    const validation = validateRoute(route(tiles, { x: 1, y: 1 }, [
      { x: 3, y: 3 },
      { x: 5, y: 1 },
    ]));
    expect(validation.ok).toBe(false);
    expect(validation.unreachable).toEqual(['5,1']);
  });

  describe('stranded items', () => {
    it('reports the items a wall cuts off from the entry, in declaration order', () => {
      const tiles = mapFromSketch([
        '#######',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '#######',
      ]);
      const validation = validateRoute(
        route(tiles, { x: 1, y: 1 }, [{ x: 2, y: 1 }], {
          items: [
            item('item-1-0', { x: 2, y: 2 }),
            item('item-1-1', { x: 5, y: 1 }),
            item('item-1-2', { x: 5, y: 3 }),
          ],
        }),
      );
      expectOnly(validation, ['strandedItems']);
      expect(validation.strandedItems).toEqual(['item-1-1', 'item-1-2']);
    });
  });

  describe('items on terrain', () => {
    it('reports an item left on tall grass', () => {
      const tiles = mapFromSketch(['######', '#..".#', '######']);
      const validation = validateRoute(
        route(tiles, { x: 1, y: 1 }, [{ x: 2, y: 1 }], {
          items: [item('item-1-0', { x: 3, y: 1 })],
        }),
      );
      expectOnly(validation, ['itemsOnTerrain']);
      expect(validation.itemsOnTerrain).toEqual(['item-1-0']);
    });

    it('reports an item left on a ledge', () => {
      const tiles = mapFromSketch(['######', '#..^.#', '######']);
      const validation = validateRoute(
        route(tiles, { x: 1, y: 1 }, [{ x: 2, y: 1 }], {
          items: [item('item-1-0', { x: 3, y: 1 })],
        }),
      );
      // A ledge is impassable, so an item on one is necessarily stranded too: the
      // two checks overlap here and both gate `ok`.
      expectOnly(validation, ['itemsOnTerrain', 'strandedItems']);
      expect(validation.itemsOnTerrain).toEqual(['item-1-0']);
      expect(validation.strandedItems).toEqual(['item-1-0']);
    });
  });

  describe('the guaranteed lane', () => {
    it('reports a spine tile that is a wall and clears the same spine on floor', () => {
      const spine = [{ x: 2, y: 1 }];
      const blocked = mapFromSketch(['#####', '#.#.#', '#...#', '#####']);
      const open = mapFromSketch(['#####', '#...#', '#...#', '#####']);
      const walled = validateRoute(route(blocked, { x: 1, y: 1 }, [{ x: 3, y: 1 }], { spine }));
      expectOnly(walled, ['spineBlocked']);
      expect(walled.spineBlocked).toEqual(['2,1']);

      const floored = validateRoute(route(open, { x: 1, y: 1 }, [{ x: 3, y: 1 }], { spine }));
      expectOnly(floored, []);
      expect(floored.spineBlocked).toEqual([]);
    });
  });

  describe('the border ring', () => {
    it('reports an open ring cell away from every opening', () => {
      // The entry and exit bands are opened so only the stray ring cell is a finding.
      const tiles = mapFromSketch([
        '###.####',
        '#......#',
        '........',
        '........',
        '########',
      ]);
      const validation = validateRoute(route(tiles, { x: 0, y: 2 }, [{ x: 7, y: 2 }]));
      expectOnly(validation, ['borderBreaches']);
      expect(validation.borderBreaches).toEqual(['3,0']);
    });

    it('passes a border that opens only at the entry and the exit', () => {
      const tiles = mapFromSketch([
        '########',
        '#......#',
        '........',
        '........',
        '########',
      ]);
      const validation = validateRoute(route(tiles, { x: 0, y: 2 }, [{ x: 7, y: 2 }]));
      expectOnly(validation, []);
      expect(validation.borderBreaches).toEqual([]);
    });

    it('passes an open ring cell beside an opening, which only widens it', () => {
      const tiles = mapFromSketch([
        '########',
        '.......#',
        '........',
        '........',
        '########',
      ]);
      const validation = validateRoute(route(tiles, { x: 0, y: 2 }, [{ x: 7, y: 2 }]));
      expectOnly(validation, []);
      expect(validation.borderBreaches).toEqual([]);
    });

    it('reports the band cell a declared opening left a wall, in row-major order', () => {
      const tiles = mapFromSketch([
        '########',
        '#......#',
        '........',
        '#......#',
        '########',
      ]);
      const validation = validateRoute(route(tiles, { x: 0, y: 2 }, [{ x: 7, y: 2 }]));
      expectOnly(validation, ['borderBandGaps']);
      expect(validation.borderBandGaps).toEqual(['0,3', '7,3']);
    });

    it('ignores a spawn in the room’s centre, which declares no ring opening', () => {
      const tiles = mapFromSketch(ROOM);
      const validation = validateRoute(route(tiles, { x: 3, y: 3 }, [{ x: 5, y: 5 }]));
      expectOnly(validation, []);
      expect(validation.borderBandGaps).toEqual([]);
    });
  });

  describe('unreachable pockets', () => {
    it('reports a sealed pocket without failing the route', () => {
      const tiles = mapFromSketch([
        '#######',
        '#.....#',
        '#.###.#',
        '#.#.#.#',
        '#.###.#',
        '#######',
      ]);
      const validation = validateRoute(
        route(tiles, { x: 1, y: 1 }, [{ x: 5, y: 1 }], { pockets: [{ x: 3, y: 3 }] }),
      );
      expectOnly(validation, []);
      expect(validation.unreachablePockets).toEqual(['3,3']);
    });
  });

  describe('trainer poses', () => {
    it('reports nothing for a trainer on floor, backed by a wall, off the spawn', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 1, y: 2 }, 'S')],
        }),
      );
      expectOnly(validation, []);
      expect(validation.trainerIssues).toEqual([]);
    });

    it('reports off-floor for a trainer standing on a wall', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 0, y: 0 }, 'S')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['off-floor'] },
      ]);
    });

    it('reports no-backing-wall for a trainer on open floor', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 3, y: 3 }, 'S')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['no-backing-wall'] },
      ]);
    });

    it('reports on-entry for a trainer standing on the spawn', () => {
      // No exit: a trainer on the spawn blocks the trainer-avoiding fill at its
      // first step, so any exit would read as trainer-blocked too and blur the pose
      // rule this fixture isolates.
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [], {
          trainers: [trainer(0, { x: 1, y: 1 }, 'N')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['on-entry'] },
      ]);
    });

    it('reports on-exit for a trainer standing on an exit', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 5, y: 5 }, 'N')],
        }),
      );
      // The occupied exit is also trainer-blocked: that is the pre-existing gate (a
      // trainer on an exit seals it), not a pose rule.
      expectOnly(validation, ['trainerIssues', 'blockedByTrainers']);
      expect(validation.blockedByTrainers).toEqual(['5,5']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['on-exit'] },
      ]);
    });

    it('reports on-pocket for a trainer standing on a loot pocket', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          pockets: [{ x: 1, y: 2 }],
          trainers: [trainer(0, { x: 1, y: 2 }, 'S')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.unreachablePockets).toEqual([]);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['on-pocket'] },
      ]);
    });

    it('reports crowded for two trainers in neighbouring tiles', () => {
      const tiles = mapFromSketch([
        '#########',
        '#.......#',
        '#.......#',
        '#........',
        '#........',
        '#.......#',
        '#.......#',
        '#.......#',
        '#########',
      ]);
      const validation = validateRoute(
        route(tiles, { x: 6, y: 6 }, [{ x: 8, y: 3 }], {
          trainers: [trainer(0, { x: 1, y: 1 }, 'E'), trainer(1, { x: 1, y: 2 }, 'E')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['crowded'] },
        { trainerId: 'trainer-1-1', reasons: ['crowded'] },
      ]);
    });

    it('reports sees-entry for a trainer one tile from the spawn, facing it', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 1, y: 2 }, 'N')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['sees-entry'] },
      ]);
    });

    it('reports sees-entry for a turn that watches the spawn, not only the held facing', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 3, y: 1 }, 'E', { turns: ['E', 'W'] })],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['sees-entry'] },
      ]);
    });

    it('collects every reason a trainer fails, in the union order', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [], {
          trainers: [trainer(0, { x: 1, y: 1 }, 'N'), trainer(1, { x: 1, y: 2 }, 'S')],
        }),
      );
      expectOnly(validation, ['trainerIssues']);
      expect(validation.trainerIssues).toEqual([
        { trainerId: 'trainer-1-0', reasons: ['on-entry', 'crowded'] },
        { trainerId: 'trainer-1-1', reasons: ['crowded'] },
      ]);
    });
  });

  describe('the lane guard', () => {
    it('passes a trainer-free route when no options ask for trainers', () => {
      const validation = validateRoute(route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }]));
      expectOnly(validation, []);
      expect(validation.missingLaneGuard).toEqual([]);
    });

    it('fails a trainer-free route the pass was asked to guard, naming no-trainers', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }]),
        { expectTrainers: true },
      );
      expectOnly(validation, ['missingLaneGuard']);
      expect(validation.missingLaneGuard).toEqual(['no-trainers']);
    });

    it('keeps the default options a no-op, so no pre-existing caller changes', () => {
      const base = route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }]);
      expect(validateRoute(base, {})).toEqual(validateRoute(base));
      expect(validateRoute(base, { expectTrainers: false })).toEqual(validateRoute(base));
    });

    it('never reports the guard on a route that holds a trainer', () => {
      const validation = validateRoute(
        route(mapFromSketch(ROOM), { x: 1, y: 1 }, [{ x: 5, y: 5 }], {
          trainers: [trainer(0, { x: 1, y: 2 }, 'S')],
        }),
        { expectTrainers: true },
      );
      expectOnly(validation, []);
      expect(validation.missingLaneGuard).toEqual([]);
    });
  });

  describe('the live generator', () => {
    // `sweep-b` is the seed the old comment named: its dead-end route leaves no
    // wall-hugging lane spot, so attempt 0 ships no trainer at all (3 of 720 seeds
    // on `main` already did, plus the ones Task-32's band fix exposed). The lane
    // guard re-rolls past attempt 0 there; the other seeds validate without a
    // re-roll, so the gate stays a no-op where the route already guards its lane.
    const SWEEP_SEEDS = ['sweep-a', 'sweep-b', 'sweep-c', 'sweep-d'] as const;

    function request(seed: string, routeIndex: number, shape?: RouteShape): RouteRequest {
      return { seed, routeIndex, biomeId: 'wood', ...(shape ? { shape } : {}) };
    }

    it('validates every shape at a fixed seed and size, attempt 0 included', () => {
      for (const shape of ROUTE_SHAPES) {
        for (const seed of SWEEP_SEEDS) {
          const where = `${shape} ${seed}`;
          const sized = { ...request(seed, 3, shape), width: 30, height: 30 };
          const route = sketchRoute(sized);
          const validation = validateRoute(route);
          expect(validation.ok, `${where} ok`).toBe(true);
          expectOnly(validation, []);
          expect(validation.unreachablePockets, `${where} unreachablePockets`).toEqual([]);
          // Attempt 0 is the route `sketchRoute` returns whenever it validates, so
          // equal steps are the proof that the stricter gate did not reroll it.
          expect(sketchRouteSteps(sized).at(-1)!.tiles, `${where} attempt 0`).toEqual(route.tiles);
        }
      }
    }, 30_000);

    it('validates a populated route at every shape, attempt 0 included', () => {
      const loot = [{ itemId: 'potion', weight: 1 }];
      for (const shape of ROUTE_SHAPES) {
        for (const seed of SWEEP_SEEDS) {
          const where = `${shape} ${seed}`;
          const sized: RouteRequest = {
            ...request(seed, 5, shape),
            width: 30,
            height: 30,
            grassPatches: 12,
            ledges: 6,
            loot,
            hiddenChance: 0.5,
            trainerArchetypes: ['youngster', 'lass'],
          };
          const route = sketchRoute(sized);
          const validation = validateRoute(route);
          expect(route.trainers.length, `${where} trainers`).toBeGreaterThan(0);
          if (route.pockets.length > 0) {
            expect(route.items.length, `${where} items`).toBeGreaterThan(0);
          }
          expect(validation.ok, `${where} ok`).toBe(true);
          expectOnly(validation, []);
          expect(validation.unreachablePockets, `${where} unreachablePockets`).toEqual([]);
          // The lane guard the pass was asked for is satisfied: the gate is why a
          // trainer-free attempt 0 (sweep-b) shipped a later attempt instead.
          const guarded = validateRoute(route, { expectTrainers: true });
          expect(guarded.missingLaneGuard, `${where} lane guard`).toEqual([]);
          expect(guarded.ok, `${where} guarded ok`).toBe(true);
          expect(sketchRouteSteps(sized).at(-1)!.tiles, `${where} attempt 0`).toEqual(route.tiles);
        }
      }
    }, 30_000);
  });
});
