import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { ROUTE_LOOT } from '../../data/loot';
import { FINITE_MAPS, levelCapForMap } from '../../data/maps';
import { POPULATION } from '../../data/population';
import { LEVEL_BANDS, type LevelBand } from '../../data/run';
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
 * The floor totals (`T̄(m)`) maps 1-2 shipped before the on-ramp's population pass
 * thinned them, as `docs/balance/route-curve.md` recorded them. The thinned floors
 * must read strictly below these, or the table is not wired in.
 */
const PRE_THINNING_TRAINERS: Readonly<Record<number, number>> = { 1: 12.0, 2: 12.33 };

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
    population: POPULATION[bandForMap(mapIndex).id],
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
      awards += experienceAward(level, 1, true);
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
      expect(fill, `${label} fill`).toBeGreaterThanOrEqual(1);
      expect(fill, `${label} fill`).toBeLessThanOrEqual(1.5);
      // The on-ramp (maps 1-2) lands in the middle of the window on purpose: its
      // population pass cancels the tier bonus and gates every pocket guard, so it
      // places strictly fewer trainers than it shipped before (`O-M5`).
      if (floor.mapIndex <= 2) {
        expect(fill, `${label} on-ramp fill`).toBeGreaterThanOrEqual(1.2);
        expect(fill, `${label} on-ramp fill`).toBeLessThanOrEqual(1.35);
        expect(floor.meanTrainers, `${label} thinned`).toBeLessThan(
          PRE_THINNING_TRAINERS[floor.mapIndex],
        );
      }
    }
  }, 120_000);
});
