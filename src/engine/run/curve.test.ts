import { describe, expect, it } from 'vitest';
import { getBiome } from '../../data/biomes';
import { bossPartySize } from '../../data/bosses';
import { gymForBadge } from '../../data/gyms';
import { ROUTE_LOOT } from '../../data/loot';
import { levelCapForMap } from '../../data/maps';
import { BADGE_CAPS, LEAGUE_LEVEL, badgeCap } from '../../data/region';
import {
  LEVEL_BANDS,
  TRAINER_XP_PER_MAP,
  bandForLevel,
  trainerXpMultiplierForMap,
  type LevelBand,
} from '../../data/run';
import { SHOP_TM } from '../../data/shop';
import { TILESETS } from '../../data/tilesets';
import {
  TRAINER_ARCHETYPES,
  TRAINER_ARCHETYPE_IDS,
  TRAINER_MONEY_BAND_SCALE,
  getTrainerArchetype,
} from '../../data/trainers';
import { planMap } from '../maps/plan';
import { roomView } from '../maps/progress';
import { leagueIds } from '../region/league';
import { nodeOf, planRegion, type RegionNode } from '../region/plan';
import { planRouteLayout } from '../region/route/layout';
import { towerStep } from '../region/tower';
import { Rng, hashSeed } from '../rng';
import { sketchRoute, type RouteRequest } from '../routes/sketch';
import { gymLeaderFoe, gymReward } from './badge';
import { routeIndexForRoom } from './floors';
import { bandForNode } from './levelCurve';
import { experienceAward, xpForLevel } from './progression';
import { BOSS_MONEY_MULTIPLIER } from './reward';
import { trainerRoster } from './roster';
import { compatForNode, createRun, markTrainerDefeated, type RunState } from './state';

/**
 * The three seeds the region's walk is sampled over. They are fixed, so every
 * figure below is reproducible and the test draws no RNG of its own (`D11`).
 */
const CURVE_SEEDS: readonly string[] = ['curve-a', 'curve-b', 'curve-c'];

/** A fresh run's starter level (`src/scenes/StarterScene.ts`), where the first stretch starts. */
const START_LEVEL = 5;

/** The region's eight badge stretches, in badge order. */
const BADGES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * The fill each stretch measured with the shipped per-stretch factors, two
 * decimals per row. A re-pin records the new column; an unmotivated move fails here.
 *
 * Every stretch is solved to about 1.25 with its own factor, so no stretch needs a
 * shared band's exception: the three `end` stretches do not share a rate.
 *
 * **Re-pinned by Task-92 with the shop room's retirement.** No floor hangs a shop
 * leaf any more, so every floor from the second on tags a different set of trainer
 * rooms and places a trainer more or less; the eight factors were re-solved with
 * `factor = 1.25 / fill` (`docs/balance/route-curve.md`).
 *
 * **Re-pinned again by Task-96** (static-species leaf), **Task-97** (secret shop),
 * **Task-101** (banned room), **Task-102** (puzzle room), **Task-117** (slot
 * machine's room) and **Task-157** (centre chamber): each pass moves a room's
 * content and therefore the walk's trainer count. The factors were left alone by
 * every one of them (a re-solve is a balance task, not a room task).
 *
 * **Re-pinned by Task-297 onto the region's ladder.** The walk is the region's eight
 * **stretches**, not eight floors: every row reads its badge, its cap (`badgeCap`)
 * and its band (`bandForNode(route:<badge>)` — the previous stretch's cap up to this
 * one's) off `planRegion`, and the XP its cap costs off `xpForLevel`. The trainer
 * count is still the one the stretch's route places through the shipped room
 * generator, which is where `RouteScene` posts a regular trainer today;
 * `docs/balance/campaign.md` owns the open rows that will replace it. No figure
 * moved: the ladder's caps are the old floor caps (`levelCapForMap(badge) ===
 * badgeCap(badge)`, asserted below), so this re-pin records the same walk in the
 * region's vocabulary.
 */
const MEASURED_FILL: Readonly<Record<number, number>> = {
  1: 1.25,
  2: 1.14,
  3: 1.34,
  4: 1.25,
  5: 1.17,
  6: 1.06,
  7: 1.26,
  8: 1.25,
};

/** The window a stretch's fill has to land inside: 75 % of its trainers must pay its cap. */
const MIN_FILL = 1.05;
const MAX_FILL = 1.5;

/**
 * The finale's award as a multiple of the XP the stretch's cap costs, two decimals.
 */
const MEASURED_FINALE_MULTIPLE: Readonly<Record<number, number>> = {
  1: 5.42,
  2: 2,
  3: 1.74,
  4: 0.99,
  5: 0.53,
  6: 0.43,
  7: 0.5,
  8: 0.53,
};

/**
 * What a stretch's boss pays **per member** — `experienceAward(cap, 1, true,
 * factor)` at the stretch's own factor — and the party it fields (three on the
 * on-ramp, six on every later stretch, `src/data/bosses.ts`). The finale is injected
 * on top of the route, so it sits outside the 75 % budget — `route-curve.md` records
 * the verdict.
 */
const MEASURED_BOSS: Readonly<Record<number, readonly [award: number, party: number]>> = {
  1: [1092, 3],
  2: [1123, 6],
  3: [2344, 6],
  4: [2443, 6],
  5: [2076, 6],
  6: [2053, 6],
  7: [3188, 6],
  8: [4301, 6],
};

/** The screens each stretch's main route stacks, per walk seed (`planRouteLayout`). */
const MEASURED_SCREENS: Readonly<Record<number, readonly number[]>> = {
  1: [4, 3, 4],
  2: [3, 3, 3],
  3: [3, 2, 4],
  4: [3, 4, 3],
  5: [2, 3, 4],
  6: [2, 4, 2],
  7: [2, 4, 2],
  8: [3, 3, 2],
};

/**
 * What a stretch pays a regular trainer, the mean over the ten archetypes:
 * `round(base × scale) + round(jitter × scale) / 2`, with the scale the band's own
 * (`TRAINER_MONEY_BAND_SCALE`). Read off `src/data/trainers.ts`; the sheet prints
 * exactly these figures.
 */
function meanTrainerMoney(band: LevelBand): number {
  const scale = TRAINER_MONEY_BAND_SCALE[band.id];
  const total = TRAINER_ARCHETYPES.reduce(
    (sum, archetype) =>
      sum + Math.round(archetype.money.base * scale) + Math.round(archetype.money.jitter * scale) / 2,
    0,
  );
  return total / TRAINER_ARCHETYPES.length;
}

/**
 * The expected value of `trainerMoney`'s roll for one archetype: the archetype's
 * base plus half its jitter, both rounded at the band's scale first, times the
 * multiplier — `src/engine/run/reward.ts`'s own arithmetic, never a guess.
 */
function expectedTrainerMoney(archetypeId: string, band: LevelBand, multiplier = 1): number {
  const archetype = getTrainerArchetype(archetypeId);
  if (archetype === undefined) throw new Error(`no archetype: ${archetypeId}`);
  const scale = TRAINER_MONEY_BAND_SCALE[band.id] * Math.max(1, multiplier);
  return Math.round(archetype.money.base * scale) + Math.round(archetype.money.jitter * scale) / 2;
}

/** The money a whole stretch pays at the mean archetype: `T̄(s) × meanTrainerMoney`. */
const MEASURED_MONEY: Readonly<Record<number, number>> = {
  1: 357.75,
  2: 497.83,
  3: 1044.75,
  4: 1491.25,
  5: 2087.5,
  6: 3180,
  7: 3180,
  8: 2981.25,
};

/** The purse a beaten gym leader drops: its borrowed archetype at the band scale, times the row's multiplier. */
const MEASURED_LEADER_PURSE: Readonly<Record<number, number>> = {
  1: 158,
  2: 184,
  3: 239,
  4: 960,
  5: 914,
  6: 1100,
  7: 935,
  8: 2880,
};

/**
 * What a stretch's two hand-placed fights pay at the mean roll: the boss (`ace` at
 * `BOSS_MONEY_MULTIPLIER`) and the mini-boss (`ace` at 1), both read off
 * `trainerMoney`'s own arithmetic — `round(base × scale) + round(jitter × scale) / 2`.
 */
const MEASURED_FINALE: Readonly<Record<number, readonly [number, number]>> = {
  1: [720, 240],
  2: [900, 300],
  3: [1260, 420],
  4: [1800, 600],
  5: [2520, 840],
  6: [3600, 1200],
  7: [3600, 1200],
  8: [3600, 1200],
};

/** The boss's and the mini-boss's archetype (`RouteScene.bossTrainer`, `rooms/miniBoss.ts`). */
const HAND_PLACED_ARCHETYPE = 'ace';

/** The party a gym leader fields: gym 1's fixed three, the band's six on every later gym. */
const MEASURED_LEADER_PARTY: Readonly<Record<number, number>> = {
  1: 3,
  2: 6,
  3: 6,
  4: 6,
  5: 6,
  6: 6,
  7: 6,
  8: 6,
};

/** The region's ladder is seed-independent; the plan is read off the first walk seed. */
const LADDER = planRegion(CURVE_SEEDS[0]);

/** A stretch's main route node: `route:<badge>`, the node the stretch is walked through. */
function stretchNode(badge: number): RegionNode {
  const node = nodeOf(LADDER, `route:${badge}`);
  if (node === undefined) throw new Error(`the region has no route:${badge}`);
  return node;
}

/**
 * One room of one stretch's route, built exactly as `RouteScene` builds it: the
 * plan room's openings and size, the biome's layout, terrain, loot and the whole
 * archetype pool, with the entry / boss / special leaves quiet.
 */
function buildStretchRoom(seed: string, node: RegionNode, roomId: number): RouteRequest {
  const plan = planMap(seed, node.badge);
  const view = roomView(plan, roomId, false);
  const biome = getBiome(view.biomeId);
  const pattern = TILESETS[biome.tilesetId].config.wallPattern;
  const wall = pattern
    ? { cols: pattern.cols, minHeight: Math.max(2, pattern.rows.length - 2) }
    : undefined;
  const loot = ROUTE_LOOT[bandForNode(node).id];
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

type StretchCurve = Readonly<{
  badge: number;
  node: RegionNode;
  band: LevelBand;
  /** The cap the stretch enforces: `badgeCap(badge)`. */
  cap: number;
  /** Trainers each seed's route places, summed over its rooms (quiet rooms count zero). */
  perSeed: readonly SeedCount[];
  /** `T̄(s)`: the mean stretch total over the seed sample. */
  meanTrainers: number;
  /** `A(s)`: the mean XP one trainer of the stretch awards. */
  award: number;
  /** `needed(s)`: the XP the squad still needs to reach the stretch's cap. */
  needed: number;
  /** `0.75 × T̄(s) × A(s)`, the budget the window measures. */
  budget: number;
  /** `budget / needed`. */
  fill: number;
}>;

/** Walks the region's eight stretches the way a run does, and measures each one. */
function measureStretches(): readonly StretchCurve[] {
  return BADGES.map((badge) => {
    const node = stretchNode(badge);
    const band = bandForNode(node);
    const cap = badgeCap(badge);
    const factor = trainerXpMultiplierForMap(badge);
    const perSeed = CURVE_SEEDS.map((seed) => {
      const plan = planMap(seed, badge);
      let trainers = 0;
      for (const room of plan.rooms) {
        trainers += sketchRoute(buildStretchRoom(seed, node, room.id)).trainers.length;
      }
      return { seed, rooms: plan.rooms.length, trainers };
    });
    const trainers = perSeed.reduce((total, count) => total + count.trainers, 0);
    const previousCap = badge <= 1 ? START_LEVEL : badgeCap(badge - 1);
    let levels = 0;
    let awards = 0;
    for (let level = band.minLevel; level <= band.maxLevel; level++) {
      levels += 1;
      awards += experienceAward(level, 1, true, factor);
    }
    const meanTrainers = trainers / CURVE_SEEDS.length;
    const award = band.trainerSize * (awards / levels);
    const needed = xpForLevel(cap) - xpForLevel(previousCap);
    const budget = 0.75 * meanTrainers * award;
    return {
      badge,
      node,
      band,
      cap,
      perSeed,
      meanTrainers,
      award,
      needed,
      budget,
      fill: budget / needed,
    };
  });
}

let walked: readonly StretchCurve[] | null = null;

/** The one walk this file measures, built on first read. */
function stretches(): readonly StretchCurve[] {
  walked ??= measureStretches();
  return walked;
}

/** A run standing on the Champion's far side, where the tower's door is open. */
function afterChampion(seed: string): RunState {
  let run: RunState = {
    ...createRun({ seed }),
    nodeKey: 'tower:1',
    ...compatForNode(seed, 'tower:1'),
  };
  for (const id of leagueIds()) run = markTrainerDefeated(run, id);
  return run;
}

describe('stretch trainer curve', () => {
  it('gives every band a finite, positive trainer XP multiplier', () => {
    for (const band of LEVEL_BANDS) {
      expect(Number.isFinite(band.trainerXp), band.id).toBe(true);
      expect(band.trainerXp, band.id).toBeGreaterThan(0);
      expect(band.trainerXp, band.id).toBe(Math.round(band.trainerXp * 100) / 100);
    }
  });

  it('gives every stretch one two-decimal factor, repeating the last row past the eighth', () => {
    expect(TRAINER_XP_PER_MAP.length).toBe(BADGES.length);
    for (const [index, factor] of TRAINER_XP_PER_MAP.entries()) {
      expect(Number.isFinite(factor), `stretch ${index + 1}`).toBe(true);
      expect(factor, `stretch ${index + 1}`).toBeGreaterThan(0);
      expect(factor, `stretch ${index + 1}`).toBe(Math.round(factor * 100) / 100);
    }
    expect(trainerXpMultiplierForMap(0)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(1)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(BADGES.length)).toBe(TRAINER_XP_PER_MAP[BADGES.length - 1]);
    expect(trainerXpMultiplierForMap(BADGES.length + 5)).toBe(TRAINER_XP_PER_MAP[BADGES.length - 1]);
  });

  it('walks the region ladder: one cap per badge, the previous cap as the window edge', () => {
    expect(BADGE_CAPS.length).toBe(BADGES.length);
    for (const badge of BADGES) {
      const node = stretchNode(badge);
      expect(node.badge, `route:${badge} badge`).toBe(badge);
      expect(node.cap, `route:${badge} cap`).toBe(badgeCap(badge));
      expect(node.gymDistance, `route:${badge} distance to its gym`).toBe(1);
      const band = bandForNode(node);
      expect(band.minLevel, `stretch ${badge} window lower edge`).toBe(
        badge <= 1 ? LEVEL_BANDS[0].minLevel : badgeCap(badge - 1),
      );
      expect(band.maxLevel, `stretch ${badge} window ceiling`).toBe(badgeCap(badge));
      expect(band.id, `stretch ${badge} band`).toBe(bandForLevel(band.minLevel).id);
      expect(band.trainerSize, `stretch ${badge} party size`).toBeGreaterThan(0);
    }
  });

  it('keeps the ladder the same under every walk seed', () => {
    for (const seed of CURVE_SEEDS) {
      const plan = planRegion(seed);
      for (const badge of BADGES) {
        const node = nodeOf(plan, `route:${badge}`);
        expect(node, `${seed} route:${badge}`).toBeDefined();
        expect(node?.cap, `${seed} route:${badge} cap`).toBe(badgeCap(badge));
        expect(node?.gymDistance, `${seed} route:${badge} distance`).toBe(1);
        expect(bandForNode(node!), `${seed} route:${badge} band`).toEqual(
          bandForNode(stretchNode(badge)),
        );
      }
    }
  });

  it("reads the trainer count off the plan row tuned to the stretch's own cap", () => {
    for (const badge of BADGES) {
      expect(levelCapForMap(badge), `stretch ${badge}`).toBe(badgeCap(badge));
    }
  });

  it('stacks every main route two to four screens, one count per walk seed', () => {
    for (const badge of BADGES) {
      const screens = CURVE_SEEDS.map(
        (seed) => planRouteLayout(planRegion(seed), `route:${badge}`).screens.length,
      );
      expect(screens, `stretch ${badge}`).toEqual(MEASURED_SCREENS[badge]);
      for (const count of screens) {
        expect([2, 3, 4], `stretch ${badge} screens`).toContain(count);
      }
    }
  });

  it('splits the whole campaign into its eight steps, with nothing double-counted', () => {
    const walked = stretches();
    const total = walked.reduce((sum, stretch) => sum + stretch.needed, 0);
    expect(xpForLevel(badgeCap(8))).toBe(166_375);
    expect(total).toBe(xpForLevel(badgeCap(8)) - xpForLevel(START_LEVEL));
    expect(total).toBe(166_250);
  });

  it('pays for every stretch level cap with 75 % of its own trainers', () => {
    for (const stretch of stretches()) {
      const label = `stretch ${stretch.badge} (${stretch.band.id})`;
      expect(stretch.cap, `${label} cap`).toBe(badgeCap(stretch.badge));
      expect(Number.isFinite(stretch.budget), `${label} budget`).toBe(true);
      expect(stretch.budget, `${label} budget`).toBeGreaterThan(0);
      expect(stretch.meanTrainers, `${label} places trainers`).toBeGreaterThan(0);
      for (const count of stretch.perSeed) {
        expect(count.rooms, `${label} ${count.seed} rooms`).toBeGreaterThan(0);
        expect(count.trainers, `${label} ${count.seed} trainers`).toBeGreaterThan(0);
      }
      expect(stretch.fill, `${label} fill`).toBeGreaterThanOrEqual(MIN_FILL);
      expect(stretch.fill, `${label} fill`).toBeLessThanOrEqual(MAX_FILL);
      expect(stretch.fill, `${label} fill`).toBeCloseTo(MEASURED_FILL[stretch.badge], 2);
    }
  }, 120_000);

  it('pays its finale beyond the budget, uncapped, at the cap and the stretch factor', () => {
    for (const stretch of stretches()) {
      const [award, party] = MEASURED_BOSS[stretch.badge];
      const factor = trainerXpMultiplierForMap(stretch.badge);
      expect(experienceAward(stretch.cap, 1, true, factor), `stretch ${stretch.badge} boss`).toBe(award);
      expect(bossPartySize('boss', stretch.badge), `stretch ${stretch.badge} boss party`).toBe(party);
      const multiple = (award * party) / stretch.needed;
      expect(multiple, `stretch ${stretch.badge} finale multiple`).toBeCloseTo(
        MEASURED_FINALE_MULTIPLE[stretch.badge],
        2,
      );
      const folded = MEASURED_FILL[stretch.badge] + multiple;
      // Folding the finale into the rule leaves seven of the eight rows over the
      // window's ceiling; the thinnest surplus (stretch 6) lands just inside it.
      if (stretch.badge === 6) expect(folded, 'stretch 6 folded').toBeLessThan(MAX_FILL);
      else expect(folded, `stretch ${stretch.badge} folded`).toBeGreaterThan(MAX_FILL);
    }
  });
});

describe('stretch economy', () => {
  it('pays a regular trainer the band-scale mean of the ten archetypes', () => {
    const means = LEVEL_BANDS.map((band) => ({
      band: band.id,
      mean: meanTrainerMoney(band),
      scale: TRAINER_MONEY_BAND_SCALE[band.id],
    }));
    expect(means.map((row) => row.scale)).toEqual([1, 1.25, 1.75, 2.5, 3.5, 5]);
    expect(means.map((row) => row.mean)).toEqual([119.25, 149.35, 208.95, 298.25, 417.5, 596.25]);
  });

  it('pays a whole stretch T̄(s) × the mean award', () => {
    for (const stretch of stretches()) {
      const money = stretch.meanTrainers * meanTrainerMoney(stretch.band);
      expect(money, `stretch ${stretch.badge} money`).toBeCloseTo(MEASURED_MONEY[stretch.badge], 2);
    }
  });

  it('pays its two hand-placed fights at the mean roll, the boss tripled', () => {
    for (const stretch of stretches()) {
      const [boss, miniBoss] = MEASURED_FINALE[stretch.badge];
      expect(
        expectedTrainerMoney(HAND_PLACED_ARCHETYPE, stretch.band, BOSS_MONEY_MULTIPLIER),
        `stretch ${stretch.badge} boss`,
      ).toBe(boss);
      expect(
        expectedTrainerMoney(HAND_PLACED_ARCHETYPE, stretch.band),
        `stretch ${stretch.badge} mini-boss`,
      ).toBe(miniBoss);
      expect(BOSS_MONEY_MULTIPLIER, 'the boss multiplier').toBe(3);
    }
  });

  it('fields the pinned leader party and pays its pinned purse at every gym', () => {
    const run = createRun({ seed: CURVE_SEEDS[0] });
    const plan = planRegion(CURVE_SEEDS[0]);
    for (const badge of BADGES) {
      const cityKey = `city:${badge}`;
      const foe = gymLeaderFoe(plan, run, cityKey);
      expect(foe.badge, `city:${badge} badge`).toBe(badge);
      expect(foe.roster.length, `city:${badge} leader party`).toBe(MEASURED_LEADER_PARTY[badge]);
      expect(foe.roster.every((entry) => entry.level === badgeCap(badge))).toBe(true);
      const reward = gymReward(foe);
      expect(reward.money, `city:${badge} purse`).toBe(MEASURED_LEADER_PURSE[badge]);
      expect(reward.item?.itemId, `city:${badge} badge TM`).toBe(gymForBadge(badge).tmItemId);
    }
  });

  it('stocks one of eight machines per band, no id on two shelves', () => {
    const seen = new Set<string>();
    for (const band of LEVEL_BANDS) {
      const row = SHOP_TM[band.id];
      expect(row.length, `${band.id} machine row`).toBe(8);
      for (const itemId of row) {
        expect(seen.has(itemId), `${itemId} is on two shelves`).toBe(false);
        seen.add(itemId);
      }
    }
    expect(seen.size).toBe(LEVEL_BANDS.length * 8);
  });
});

describe('the tower ramp', () => {
  const SEED = CURVE_SEEDS[0];
  const PARTY_SIZE = 5;
  /** What a rung pays: five level-60 members, a trainer award each. */
  const MEASURED_RUNG_XP = 17_910;

  it('walks strictly upwards from rung to rung, five foes at LEAGUE_LEVEL', () => {
    const run = afterChampion(SEED);
    let previousRung = 0;
    for (let streak = 0; streak < 5; streak++) {
      const foe = towerStep(run, streak);
      expect(foe, `streak ${streak}`).not.toBeNull();
      expect(foe?.rung, `streak ${streak}`).toBeGreaterThan(previousRung);
      expect(foe?.trainerId).toBe(`tower:${streak + 1}`);
      expect(foe?.level).toBe(LEAGUE_LEVEL);
      expect(LEAGUE_LEVEL).toBe(60);
      expect(foe?.roster).toHaveLength(PARTY_SIZE);
      expect(foe?.roster.every((entry) => entry.level === LEAGUE_LEVEL)).toBe(true);
      previousRung = foe?.rung ?? previousRung;
    }
  });

  it('pays the same pinned XP on every rung, never less as the streak climbs', () => {
    const run = afterChampion(SEED);
    const perMember = experienceAward(LEAGUE_LEVEL, 1, true);
    expect(perMember, 'one level-60 trainer award').toBe(3582);
    expect(MEASURED_RUNG_XP, 'five members').toBe(perMember * 5);
    expect(xpForLevel(LEAGUE_LEVEL), 'the level curve at 60').toBe(216_000);
    let previousXp = 0;
    for (let streak = 0; streak < 5; streak++) {
      const foe = towerStep(run, streak)!;
      const xp = foe.roster.reduce((total, entry) => total + experienceAward(entry.level, 1, true), 0);
      expect(xp, `rung ${foe.rung} XP`).toBe(MEASURED_RUNG_XP);
      expect(xp, `rung ${foe.rung} XP`).toBeGreaterThanOrEqual(previousXp);
      expect(xpForLevel(foe.level), `rung ${foe.rung} level curve`).toBe(xpForLevel(LEAGUE_LEVEL));
      previousXp = xp;
    }
  });

  it('draws every rung off `${seed}:tower:<rung>` and replays it alone', () => {
    const run = afterChampion(SEED);
    for (let streak = 0; streak < 5; streak++) {
      const rung = streak + 1;
      const rebuilt = trainerRoster(
        bandForLevel(LEAGUE_LEVEL),
        new Rng(hashSeed(`${SEED}:tower:${rung}`)),
        `tower:${rung}`,
        { count: PARTY_SIZE, levelFor: () => LEAGUE_LEVEL },
      );
      expect(towerStep(run, streak)?.roster, `rung ${rung}`).toEqual(rebuilt);
    }
  });
});
