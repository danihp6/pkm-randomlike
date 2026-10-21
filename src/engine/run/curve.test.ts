import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { ROUTE_LOOT } from '../../data/loot';
import { FINITE_MAPS, levelCapForMap } from '../../data/maps';
import {
  LEVEL_BANDS,
  TRAINER_XP_PER_MAP,
  trainerXpMultiplierForMap,
  type LevelBand,
} from '../../data/run';
import { TILESETS } from '../../data/tilesets';
import { TRAINER_ARCHETYPE_IDS } from '../../data/trainers';
import { planMap } from '../maps/plan';
import { roomView } from '../maps/progress';
import { sketchRoute, type RouteRequest } from '../routes/sketch';
import { bandForMap, routeIndexForRoom } from './floors';
import { experienceAward, xpForLevel } from './progression';

/**
 * The three seeds the floor's trainer count is sampled over. They are fixed, so the
 * budget below is reproducible and the test draws no RNG of its own (`D11`).
 */
const SEEDS = ['curve-a', 'curve-b', 'curve-c'];

/** A fresh run's starter level (`src/scenes/StarterScene.ts`), where map 1 starts. */
const START_LEVEL = 5;

/**
 * The fill each floor measured with the shipped per-floor factors, two decimals
 * per floor. A re-pin records the new column; an unmotivated move fails here.
 *
 * Every floor is solved to 1.25 with its own factor, so no map needs the shared
 * band's exception: maps 6-8 read the `end` band but no longer share a rate.
 *
 * **Re-pinned by Task-92 with the shop room's retirement.** No floor hangs a shop
 * leaf any more, so every floor from map 2 on tags a different set of trainer rooms
 * and places a trainer more or less; the eight factors were re-solved with
 * `factor = 1.25 / fill` (`docs/balance/route-curve.md`) and maps 6 and 7 land as
 * close to 1.25 as a two-decimal factor allows.
 *
 * **Re-pinned again by Task-96 with the static-species leaf.** A floor that hangs
 * the leaf holds one room more, and `routeIndexForRoom` sums the previous floors'
 * room counts, so every later floor's rooms build from a shifted route index and
 * place a trainer more or less. The factors are untouched (a re-solve is a balance
 * task, not a room task) and the column records the walk as it now stands.
 *
 * **Re-pinned by Task-97 with the secret-shop leaf.** The leaf rolls a 20 % chance
 * from map 3 on and is one more room on a floor that hangs it, so the same shifted
 * route index moves trainers again: the column now reads 1.25 on maps 1-5, 1.13 on
 * map 6, 1.24 on map 7 and 1.32 on map 8. One floor left the window: map 5 measured
 * 1.67 against the shipped 1.25 factor, so that single row was re-solved with
 * `factor' = round2(factor × 1.25 / fill)` — 1.25 → 0.94 — and map 5 is back to
 * 1.25. The other seven factors are untouched.
 *
 * **Re-walked by Task-101 with the banned room.** The leaf is one more room on a
 * floor that hangs it, so the route index shifts again from the first floor that
 * does: the column now reads 1.25 on maps 1, 2, 4 and 5, 1.16 on map 3, 1.19 on map
 * 6, and 1.18 on maps 7 and 8. One floor left the window: map 5 measured 1.02
 * against its shipped 0.94 factor, so that single row was re-solved with
 * `factor' = round2(factor x 1.25 / fill)` (0.94 to 1.15) and map 5 is back to
 * 1.25. The other seven factors are untouched.
 */
const MEASURED_FILL: Readonly<Record<number, number>> = {
  1: 1.25,
  2: 1.25,
  3: 1.16,
  4: 1.25,
  5: 1.25,
  6: 1.19,
  7: 1.18,
  8: 1.18,
};

/** The lowest share a floor may pay: the window's floor. */
const MIN_FILL = 1.05;

/**
 * One room of one floor, built exactly as `RouteScene.buildRoute` builds it: the
 * plan room's openings and size, the biome's layout, terrain, loot and the whole
 * archetype pool, with the entry / boss / special leaves quiet.
 */
function buildFloorRoom(seed: string, mapIndex: number, roomId: number): RouteRequest {
  const plan = planMap(seed, mapIndex);
  const view = roomView(plan, roomId, false);
  const biome = getBiome(view.biomeId);
  const pattern = TILESETS[biome.tilesetId].config.wallPattern;
  const wall = pattern
    ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
    : undefined;
  const loot = ROUTE_LOOT[bandForMap(mapIndex).id];
  return {
    seed,
    routeIndex: routeIndexForRoom(plan, view.roomId),
    biomeId: view.biomeId,
    layout: biome.layout,
    openings: view.openings,
    width: view.width,
    height: view.height,
    grassPatches: biome.terrain.grassPatches,
    ledges: biome.terrain.ledges,
    loot: loot.pool,
    hiddenChance: loot.hiddenChance,
    itemChance: loot.itemChance,
    role: view.role,
    trainerArchetypes: TRAINER_ARCHETYPE_IDS,
    quiet: view.entry || view.boss || view.special !== null,
    ...(wall ? { wall } : {}),
  };
}

type SeedCount = Readonly<{ seed: string; rooms: number; trainers: number }>;

type FloorCurve = Readonly<{
  mapIndex: number;
  band: LevelBand;
  /** Trainers each seed's floor places, summed over its rooms (quiet rooms count zero). */
  perSeed: readonly SeedCount[];
  /** `T̄(m)`: the mean floor total over the seed sample. */
  meanTrainers: number;
  /** `A(m)`: the mean XP one trainer of the floor awards. */
  award: number;
  /** `needed(m)`: the XP the squad still needs to reach the floor's cap. */
  needed: number;
}>;

/** Walks every map of a finite run the way the game does, and measures its floors. */
function measureFloors(): readonly FloorCurve[] {
  return Array.from({ length: FINITE_MAPS }, (_, index) => {
    const mapIndex = index + 1;
    const band = bandForMap(mapIndex);
    const factor = trainerXpMultiplierForMap(mapIndex);
    const perSeed = SEEDS.map((seed) => {
      const plan = planMap(seed, mapIndex);
      let trainers = 0;
      for (const room of plan.rooms) {
        trainers += sketchRoute(buildFloorRoom(seed, mapIndex, room.id)).trainers.length;
      }
      return { seed, rooms: plan.rooms.length, trainers };
    });
    const trainers = perSeed.reduce((total, count) => total + count.trainers, 0);
    const previousCap = mapIndex <= 1 ? START_LEVEL : levelCapForMap(mapIndex - 1);
    let levels = 0;
    let awards = 0;
    for (let level = band.minLevel; level <= band.maxLevel; level++) {
      levels += 1;
      awards += experienceAward(level, 1, true, factor);
    }
    return {
      mapIndex,
      band,
      perSeed,
      meanTrainers: trainers / SEEDS.length,
      award: band.trainerSize * (awards / levels),
      needed: xpForLevel(levelCapForMap(mapIndex)) - xpForLevel(previousCap),
    };
  });
}

let walked: readonly FloorCurve[] | null = null;

function floors(): readonly FloorCurve[] {
  walked ??= measureFloors();
  return walked;
}

describe('floor trainer curve', () => {
  it('gives every band a finite, positive trainer XP multiplier', () => {
    for (const band of LEVEL_BANDS) {
      expect(Number.isFinite(band.trainerXp), band.id).toBe(true);
      expect(band.trainerXp, band.id).toBeGreaterThan(0);
      expect(band.trainerXp, band.id).toBe(Math.round(band.trainerXp * 100) / 100);
    }
  });

  it('gives every finite floor one two-decimal factor, repeating the last row past the end', () => {
    expect(TRAINER_XP_PER_MAP.length).toBe(FINITE_MAPS);
    for (const [index, factor] of TRAINER_XP_PER_MAP.entries()) {
      expect(Number.isFinite(factor), `map ${index + 1}`).toBe(true);
      expect(factor, `map ${index + 1}`).toBeGreaterThan(0);
      expect(factor, `map ${index + 1}`).toBe(Math.round(factor * 100) / 100);
    }
    expect(trainerXpMultiplierForMap(0)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(1)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(FINITE_MAPS)).toBe(TRAINER_XP_PER_MAP[FINITE_MAPS - 1]);
    expect(trainerXpMultiplierForMap(FINITE_MAPS + 5)).toBe(TRAINER_XP_PER_MAP[FINITE_MAPS - 1]);
  });

  it("pays for each floor's level cap with 75 % of that floor's trainers", () => {
    for (const floor of floors()) {
      const label = `map ${floor.mapIndex} (${floor.band.id})`;
      expect(floor.meanTrainers, `${label} places trainers`).toBeGreaterThan(0);
      for (const count of floor.perSeed) {
        expect(count.rooms, `${label} ${count.seed} rooms`).toBeGreaterThan(0);
        expect(count.trainers, `${label} ${count.seed} trainers`).toBeGreaterThan(0);
      }
      const budget = 0.75 * floor.meanTrainers * floor.award;
      const fill = budget / floor.needed;
      expect(fill, `${label} fill`).toBeGreaterThanOrEqual(MIN_FILL);
      expect(fill, `${label} fill`).toBeLessThanOrEqual(1.5);
      expect(fill, `${label} fill`).toBeCloseTo(MEASURED_FILL[floor.mapIndex], 2);
    }
  }, 120_000);
});
