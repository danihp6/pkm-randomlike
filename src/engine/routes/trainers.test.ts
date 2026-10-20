import { describe, expect, it } from 'vitest';
import { getTrainerArchetype } from '../../data/trainers';
import { TILESETS } from '../../data/tilesets';
import { createFighter, randomAbility } from '../battle';
import { FLOOR, WALL, isWalkable, mapFromSketch } from '../map';
import type { Tile } from '../grid';
import type { TrainerRosterEntry } from '../run/battleLink';
import type { RouteMap, RouteTrainer } from './routeMap';
import { FACING_VECTORS } from './routeMap';
import { treeTipKeys } from '../tileFrames';
import { ROUTE_SHAPES } from './layout';
import { sketchRoute, type RouteRequest } from './sketch';
import { reachableAvoiding, reachableTiles, validateRoute } from './validate';
import {
  INVISIBLE_REVEAL_DISTANCE,
  sightLine,
  seesPlayer,
  specialTrainerFor,
  trainerAt,
  trainerBlockers,
  trainerHidden,
  withForcedAbility,
  type SpecialTrainerOptions,
} from './trainers';

const ARCHETYPES = ['youngster', 'lass', 'bugcatcher', 'hiker'];

function request(seed: string, routeIndex: number, shape?: RouteRequest['shape']): RouteRequest {
  return {
    seed,
    routeIndex,
    biomeId: 'forest',
    trainerArchetypes: ARCHETYPES,
    ...(shape ? { shape } : {}),
  };
}

/** A route fixture: a 7x7 room with a wall stub, an entry and a trainer. */
function fixture(facing: RouteTrainer['facing'], trainer: Tile): RouteMap {
  const tiles = mapFromSketch([
    '#######',
    '#.....#',
    '#.....#',
    '#..##.#',
    '#.....#',
    '#.....#',
    '#######',
  ]);
  const t: RouteTrainer = {
    id: 'trainer-1-0',
    position: trainer,
    facing,
    sight: 3,
    archetypeId: 'youngster',
  };
  return {
    seed: 'fixture',
    routeIndex: 1,
    biomeId: 'forest',
    shape: 'straight',
    width: 7,
    height: 7,
    tiles,
    entry: { x: 1, y: 1 },
    exits: [{ x: 5, y: 5 }],
    spine: [],
    branches: [],
    pockets: [],
    items: [],
    trainers: [t],
  };
}

function noTrainers(route: RouteMap): RouteMap {
  return { ...route, trainers: [] };
}

describe('trainer line of sight', () => {
  it('watches a straight cardinal line up to its range', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const line = sightLine(route, route.trainers[0]);
    expect(line).toEqual([{ x: 3, y: 2 }]);
  });

  it('stops the line at a wall', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const map = mapFromSketch([
      '#######',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#######',
    ]);
    const open: RouteMap = { ...route, tiles: map };
    expect(sightLine(open, open.trainers[0])).toEqual([
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
  });

  it('stops the line at a ledge, water or any impassable tile', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const ledged: RouteMap = {
      ...route,
      tiles: mapFromSketch([
        '#######',
        '#.....#',
        '#.....#',
        '#..^..#',
        '#.....#',
        '#.....#',
        '#######',
      ]),
    };
    expect(sightLine(ledged, ledged.trainers[0])).toEqual([{ x: 3, y: 2 }]);
    expect(seesPlayer(ledged, ledged.trainers[0], { x: 3, y: 3 })).toBe(false);
  });

  it('sees a player walking along a row of walkable tree tips', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const raw = mapFromSketch([
      '#######',
      '#.....#',
      '#.....#',
      '#..#..#',
      '#.....#',
      '#.....#',
      '#######',
    ]);
    const move = mapFromSketch([
      '#######',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#.....#',
      '#######',
    ]);
    const tipped: RouteMap = { ...route, tiles: raw };
    expect(seesPlayer(tipped, tipped.trainers[0], { x: 3, y: 3 })).toBe(false);
    expect(seesPlayer(tipped, tipped.trainers[0], { x: 3, y: 3 }, move)).toBe(true);
  });

  it('sees the player in the cone but not behind, off-axis or out of range', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const t = route.trainers[0];
    expect(seesPlayer(route, t, { x: 3, y: 2 })).toBe(true);
    expect(seesPlayer(route, t, { x: 3, y: 4 })).toBe(false);
    expect(seesPlayer(route, t, { x: 3, y: 5 })).toBe(false);
    expect(seesPlayer(route, t, { x: 2, y: 2 })).toBe(false);
    expect(seesPlayer(noTrainers(route), t, { x: 3, y: 2 })).toBe(true);
  });

  it('does not see through a wall or around a corner', () => {
    const route = fixture('S', { x: 3, y: 1 });
    const map = mapFromSketch([
      '#######',
      '#.....#',
      '#..##.#',
      '#..##.#',
      '#.....#',
      '#.....#',
      '#######',
    ]);
    const walled: RouteMap = { ...route, tiles: map };
    expect(seesPlayer(walled, walled.trainers[0], { x: 3, y: 3 })).toBe(false);
    expect(seesPlayer(route, route.trainers[0], { x: 2, y: 2 })).toBe(false);
  });

  it('finds a trainer by tile and keys its blockers', () => {
    const route = fixture('S', { x: 3, y: 1 });
    expect(trainerAt(route, { x: 3, y: 1 })?.id).toBe('trainer-1-0');
    expect(trainerAt(route, { x: 1, y: 1 })).toBeUndefined();
    expect([...trainerBlockers(route)]).toEqual(['3,1']);
    expect([...trainerBlockers(route, route.trainers[0])]).toEqual([]);
  });
});

describe('route trainer placement', () => {
  it('places no trainers without an archetype pool', () => {
    expect(sketchRoute({ seed: 'none', routeIndex: 2, biomeId: 'forest' }).trainers).toEqual([]);
  });

  it('is a pure function of the seed and route index', () => {
    const a = sketchRoute(request('tt-seed', 3, 'cross'));
    const b = sketchRoute(request('tt-seed', 3, 'cross'));
    expect(a.trainers).toEqual(b.trainers);
    expect(a.trainers.length).toBeGreaterThan(0);
  });

  it('always places at least one trainer, wall-backed and on floor', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-a', 'tt-b', 'tt-c']) {
        const route = sketchRoute({ ...request(seed, 2, shape), width: 30, height: 30 });
        expect(route.trainers.length, `${shape} ${seed} count`).toBeGreaterThanOrEqual(1);
        for (const trainer of route.trainers) {
          const { x, y } = trainer.position;
          expect(route.tiles[y][x], `${shape} ${seed} ${x},${y} floor`).toBe(FLOOR);
          const walls = [
            route.tiles[y - 1]?.[x],
            route.tiles[y + 1]?.[x],
            route.tiles[y]?.[x - 1],
            route.tiles[y]?.[x + 1],
          ].filter((value) => value === WALL).length;
          expect(walls, `${shape} ${seed} ${x},${y} wall-backed`).toBeGreaterThanOrEqual(1);
          expect(ARCHETYPES).toContain(trainer.archetypeId);
        }
      }
    }
  }, 30_000);

  it('never lets a trainer stand on the entry, an exit or a pocket', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-end-a', 'tt-end-b']) {
        const route = sketchRoute({ ...request(seed, 4, shape), width: 30, height: 30 });
        const ends = new Set(
          [route.entry, ...route.exits, ...route.pockets].map((t) => `${t.x},${t.y}`),
        );
        for (const trainer of route.trainers) {
          expect(ends.has(`${trainer.position.x},${trainer.position.y}`), `${shape} ${seed}`).toBe(
            false,
          );
        }
      }
    }
  }, 30_000);

  it('keeps a trainer-free path from the entry to every exit', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-free-a', 'tt-free-b']) {
        const route = sketchRoute({ ...request(seed, 5, shape), width: 30, height: 30 });
        const avoided = reachableAvoiding(route.tiles, route.entry, trainerBlockers(route));
        for (const exit of route.exits) {
          expect(avoided.has(`${exit.x},${exit.y}`), `${shape} ${seed} exit`).toBe(true);
        }
        expect(validateRoute(route).ok, `${shape} ${seed} valid`).toBe(true);
      }
    }
  }, 30_000);

  it('follows the room role, not the map size', () => {
    for (const size of [20, 64]) {
      const trainers = sketchRoute({
        ...request('tt-role', 3, 'cross'),
        width: size,
        height: size,
        role: 'trainers',
      });
      expect(trainers.trainers.length, `${size}x${size} trainers`).toBeGreaterThanOrEqual(1);
      expect(trainers.trainers.length, `${size}x${size} trainers`).toBeLessThanOrEqual(2);
      expect(validateRoute(trainers, { expectTrainers: true }).ok, `${size}x${size} guarded`).toBe(true);

      const wild = sketchRoute({
        ...request('tt-role', 3, 'cross'),
        width: size,
        height: size,
        role: 'wild',
      });
      expect(wild.trainers, `${size}x${size} wild`).toEqual([]);
      expect(validateRoute(wild, { expectTrainers: false }).ok, `${size}x${size} wild`).toBe(true);
    }
  }, 30_000);

  it('gives some trainers a facing cycle (spinners) and keeps fixed ones still', () => {
    let spinners = 0;
    for (const seed of ['tt-spin-a', 'tt-spin-b', 'tt-spin-c', 'tt-spin-d']) {
      const route = sketchRoute({ ...request(seed, 6, 'cross'), width: 30, height: 30 });
      for (const trainer of route.trainers) {
        if (!trainer.turns) continue;
        spinners += 1;
        expect(trainer.turns.length).toBeGreaterThanOrEqual(2);
        for (const facing of trainer.turns) expect(['N', 'E', 'S', 'W']).toContain(facing);
      }
    }
    expect(spinners).toBeGreaterThan(0);
  }, 30_000);

  it('never faces a tile the player cannot cross', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-face-a', 'tt-face-b', 'tt-face-c']) {
        const route = sketchRoute({ ...request(seed, 3, shape), width: 30, height: 30 });
        for (const trainer of route.trainers) {
          const vector = FACING_VECTORS[trainer.facing];
          const ahead = { x: trainer.position.x + vector.x, y: trainer.position.y + vector.y };
          expect(
            isWalkable(route.tiles, ahead),
            `${shape} ${seed} ${trainer.id} faces ${trainer.facing}`,
          ).toBe(true);
        }
      }
    }
  }, 30_000);

  it('leans on a solid wall, never a walkable tree tip', () => {
    const pattern = TILESETS.forest.config.wallPattern!;
    const wall = { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) };
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-solid-a', 'tt-solid-b', 'tt-solid-c']) {
        const route = sketchRoute({ ...request(seed, 2, shape), width: 30, height: 30, wall });
        const tips = treeTipKeys(route.tiles, TILESETS.forest.config);
        for (const trainer of route.trainers) {
          const { x, y } = trainer.position;
          const neighbours = [
            { x, y: y - 1 },
            { x, y: y + 1 },
            { x: x - 1, y },
            { x: x + 1, y },
          ];
          const solid = neighbours.some(
            (n) => route.tiles[n.y]?.[n.x] === WALL && !tips.has(`${n.x},${n.y}`),
          );
          expect(solid, `${shape} ${seed} ${trainer.id} @${x},${y}`).toBe(true);
        }
      }
    }
  }, 30_000);

  it('watches an optional path across it, wall to wall', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-cross-a', 'tt-cross-b', 'tt-cross-c']) {
        const route = sketchRoute({ ...request(seed, 3, shape), width: 30, height: 30 });
        const spine = new Set(route.spine.map((tile) => `${tile.x},${tile.y}`));
        const branch = new Set(route.branches.map((tile) => `${tile.x},${tile.y}`));
        for (const trainer of route.trainers) {
          const key = `${trainer.position.x},${trainer.position.y}`;
          if (spine.has(key) || !branch.has(key)) continue;
          const pocket = route.pockets
            .map((p) => ({
              p,
              d: Math.abs(p.x - trainer.position.x) + Math.abs(p.y - trainer.position.y),
            }))
            .sort((a, b) => a.d - b.d)[0].p;
          const vertical =
            Math.abs(pocket.y - trainer.position.y) >= Math.abs(pocket.x - trainer.position.x);
          const expected = vertical ? ['E', 'W'] : ['N', 'S'];
          expect(expected, `${shape} ${seed} ${trainer.id} faces ${trainer.facing}`).toContain(
            trainer.facing,
          );
        }
      }
    }
  }, 30_000);

  it('never spawns watching the entry, even as a spinner turns', () => {
    for (const shape of ROUTE_SHAPES) {
      for (const seed of ['tt-spawn-a', 'tt-spawn-b', 'tt-spawn-c']) {
        const route = sketchRoute({ ...request(seed, 2, shape), width: 30, height: 30 });
        for (const trainer of route.trainers) {
          for (const facing of trainer.turns ?? [trainer.facing]) {
            expect(
              seesPlayer(route, { ...trainer, facing }, route.entry),
              `${shape} ${seed} ${trainer.id} ${facing}`,
            ).toBe(false);
          }
        }
      }
    }
  }, 30_000);

  it('hands every trainer a unique stable id', () => {
    const route = sketchRoute({ ...request('tt-id', 7, 'cross'), width: 30, height: 30 });
    const ids = route.trainers.map((trainer) => trainer.id);
    expect(new Set(ids).size).toBe(ids.length);
    route.trainers.forEach((trainer, i) => expect(trainer.id).toBe(`trainer-7-${i}`));
  });

  it('marks a route with trainers still solvable and stranded-free', () => {
    const route = sketchRoute({ ...request('tt-final', 2, 'bend'), width: 30, height: 30 });
    const reached = reachableTiles(route.tiles, route.entry);
    for (const item of route.items) {
      expect(reached.has(`${item.position.x},${item.position.y}`)).toBe(true);
    }
  });
});

/** The fixture route with a second trainer, the shape a special trainer overrides. */
function twoTrainers(): RouteMap {
  const route = fixture('S', { x: 3, y: 1 });
  const second: RouteTrainer = {
    id: 'trainer-1-1',
    position: { x: 1, y: 3 },
    facing: 'E',
    sight: 3,
    archetypeId: 'lass',
  };
  return { ...route, trainers: [route.trainers[0], second] };
}

/** The options a `trainers` room hands `specialTrainerFor`, over the fixture route. */
function specialOptions(overrides: Partial<SpecialTrainerOptions> = {}): SpecialTrainerOptions {
  const base = {
    route: twoTrainers(),
    seed: 'tt-special',
    roomIndex: 1,
    role: 'trainers',
    quiet: false,
    missionsCompleted: 0,
  } as const;
  return { ...base, ...overrides };
}

describe('trainer sprite visibility', () => {
  const ninja = getTrainerArchetype('ninja');
  const visible = getTrainerArchetype('psychic');
  const at = (x: number, y: number): Tile => ({ x, y });

  it('hides an invisible archetype only past the reveal distance', () => {
    expect(INVISIBLE_REVEAL_DISTANCE).toBe(1);
    const trainer = at(3, 3);
    expect(trainerHidden(ninja, trainer, at(3, 3))).toBe(false);
    expect(trainerHidden(ninja, trainer, at(3, 2))).toBe(false);
    expect(trainerHidden(ninja, trainer, at(1, 3))).toBe(true);
    expect(trainerHidden(ninja, trainer, at(3, 1))).toBe(true);
  });

  it('never hides a visible or an unknown archetype', () => {
    for (const archetype of [visible, undefined]) {
      for (const player of [at(3, 3), at(3, 2), at(1, 3), at(8, 9)]) {
        expect(trainerHidden(archetype, at(3, 3), player)).toBe(false);
      }
    }
  });
});

describe('the special trainer', () => {
  it('is deterministic and leaves the route it reads untouched', () => {
    const options = specialOptions();
    const before = options.route.trainers[0].archetypeId;
    const a = specialTrainerFor(options);
    const b = specialTrainerFor(options);
    expect(a).toEqual(b);
    expect(options.route.trainers[0].archetypeId).toBe(before);
  });

  it('fixed-seed pin: the presence draw at `tt-special`/room 1 misses, so the room keeps its own first trainer', () => {
    expect(specialTrainerFor(specialOptions())).toBeNull();
  });

  it('fixed-seed pin: `tt-special-14`/room 1 draws the ninja and swaps only the archetype', () => {
    const route = twoTrainers();
    const first = route.trainers[0];
    const drawn = specialTrainerFor({ ...specialOptions({ route }), seed: 'tt-special-14' });
    expect(drawn).toEqual({ ...first, archetypeId: 'ninja' });
    expect(drawn!.id).toBe(first.id);
    expect(drawn!.position).toEqual(first.position);
    expect(drawn!.facing).toBe(first.facing);
    expect(drawn!.sight).toBe(first.sight);
    expect(drawn!.turns).toBe(first.turns);
    expect(drawn!.archetypeId).toBe('ninja');
    // The body is an override, never a second body.
    expect(route.trainers).toHaveLength(2);
  });

  it('refuses a quiet room, a non-trainers role and a trainer-free route', () => {
    expect(specialTrainerFor(specialOptions({ quiet: true }))).toBeNull();
    expect(specialTrainerFor(specialOptions({ role: 'wild' }))).toBeNull();
    expect(specialTrainerFor(specialOptions({ route: { ...twoTrainers(), trainers: [] } }))).toBeNull();
  });

  it('keeps a gated row out of the draw until the run has met its mission', () => {
    const rows = [{ archetypeId: 'secret', chance: 1, minMissionsCompleted: 1 }];
    expect(specialTrainerFor(specialOptions({ rows, missionsCompleted: 0 }))).toBeNull();
    const met = specialTrainerFor(specialOptions({ rows, missionsCompleted: 1 }));
    expect(met?.archetypeId).toBe('secret');
  });

  it('never rolls a zero-chance row or one naming an unknown archetype', () => {
    expect(
      specialTrainerFor(specialOptions({ rows: [{ archetypeId: 'ninja', chance: 0 }] })),
    ).toBeNull();
    expect(
      specialTrainerFor(specialOptions({ rows: [{ archetypeId: 'not-a-class', chance: 1 }] })),
    ).toBeNull();
  });

  it('leaves a room whose roll misses to its own trainer', () => {
    const route = twoTrainers();
    const drawn = specialTrainerFor({ ...specialOptions({ route }), seed: 'tt-special-2' });
    expect(drawn).toBeNull();
    expect(route.trainers[0].archetypeId).toBe('youngster');
  });
});

describe('the forced ability', () => {
  const roster: readonly TrainerRosterEntry[] = [
    { id: 'trainer-1-0:0', speciesId: 'sentret', level: 5 },
    { id: 'trainer-1-0:1', speciesId: 'pidgey', level: 6 },
  ];

  it('stamps the archetype’s ability on every entry without touching the input', () => {
    const impostor = getTrainerArchetype('impostor');
    const stamped = withForcedAbility(roster, impostor);
    expect(stamped).not.toBe(roster);
    expect(stamped.map((entry) => entry.ability)).toEqual(['Imposter', 'Imposter']);
    expect(stamped.map((entry) => entry.id)).toEqual(roster.map((entry) => entry.id));
    expect(roster.every((entry) => entry.ability === undefined)).toBe(true);
  });

  it('hands an archetype without one back by the same reference', () => {
    expect(withForcedAbility(roster, getTrainerArchetype('ninja'))).toBe(roster);
    expect(withForcedAbility(roster, undefined)).toBe(roster);
  });

  it('skips the run’s ability roll for a stamped roster and keeps it otherwise', () => {
    const stamped = withForcedAbility(roster, getTrainerArchetype('impostor'));
    for (let index = 0; index < stamped.length; index++) {
      const entry = stamped[index];
      const fighter = createFighter({ ...entry, learnsetSeed: 'run-1' });
      expect(fighter.ability, entry.id).toBe('Imposter');
      const plain = createFighter({ ...roster[index], learnsetSeed: 'run-1' });
      expect(plain.ability, roster[index].id).toBe(
        randomAbility(roster[index].speciesId, 'run-1')?.name,
      );
    }
  });
});
