import type { BandId } from './run';

/**
 * How a band thins the population pass of its floors (`docs/route-generator.md`
 * §3.4, O-M5): a `trainerBonus` added to the map-size tier's own bonus, and the
 * chance a pocket's guard exists at all. A neutral row is `{ trainerBonus: 0,
 * guardChance: 1 }` and is *exactly* the behaviour of a request that passes no
 * population at all — it spends no extra draw.
 */
export type BandPopulation = Readonly<{ trainerBonus: number; guardChance: number }>;

/**
 * The per-band population table (balance data, `O-M5`). The two on-ramp bands
 * thin: they cancel the map-size tier's `+1` and hang each pocket's guard only a
 * chance of the time, so maps 1-2 read as a walkable start instead of a wall of
 * trainers. The spine guard, the lane-guard promise and the four later bands are
 * untouched.
 */
export const POPULATION: Readonly<Record<BandId, BandPopulation>> = {
  // Map 1, the run's on-ramp: the tier's +1 is cancelled and a pocket's guard
  // exists half the time.
  early: { trainerBonus: -1, guardChance: 0.5 },
  // Map 2: the same cancelled tier bonus with a gentler guard gate.
  low: { trainerBonus: -1, guardChance: 0.75 },
  mid: { trainerBonus: 0, guardChance: 1 },
  high: { trainerBonus: 0, guardChance: 1 },
  late: { trainerBonus: 0, guardChance: 1 },
  end: { trainerBonus: 0, guardChance: 1 },
};
