import type { BandId } from './run';

export type LootEntry = Readonly<{ itemId: string; weight: number }>;

export type BandLoot = Readonly<{
  /** How many ground items a route of this band places. */
  count: number;
  /** Weighted pool the ground items are drawn from. */
  pool: readonly LootEntry[];
}>;

const entry = (itemId: string, weight: number): LootEntry => ({ itemId, weight });

/**
 * The between-route reward as ground items, like the classic games: each route
 * scatters `count` items from its band's pool, and walking over one adds it to
 * the bag. Everything is drawn from the route `Rng`, so `(seed, routeIndex)`
 * fixes both the positions and the contents (D11).
 *
 * The pool widens and deepens with the band: early routes hand out Potions and
 * Poke Balls, the late bands bring Hyper Potions, Ultra Balls and the held
 * items the battle engine already supports. No Revive anywhere (D5).
 */
export const ROUTE_LOOT: Readonly<Record<BandId, BandLoot>> = {
  early: {
    count: 2,
    pool: [entry('potion', 4), entry('pokeball', 4), entry('antidote', 1)],
  },
  low: {
    count: 2,
    pool: [
      entry('pokeball', 4),
      entry('potion', 3),
      entry('superpotion', 2),
      entry('paralyzeheal', 1),
    ],
  },
  mid: {
    count: 3,
    pool: [
      entry('greatball', 3),
      entry('superpotion', 3),
      entry('potion', 2),
      entry('fullheal', 2),
      entry('xattack', 1),
    ],
  },
  high: {
    count: 3,
    pool: [
      entry('greatball', 3),
      entry('superpotion', 2),
      entry('hyperpotion', 2),
      entry('fullheal', 2),
      entry('xdefense', 1),
      entry('sitrusberry', 1),
    ],
  },
  late: {
    count: 4,
    pool: [
      entry('ultraball', 3),
      entry('hyperpotion', 3),
      entry('fullrestore', 2),
      entry('fullheal', 1),
      entry('xspeed', 1),
      entry('sitrusberry', 1),
      entry('leftovers', 1),
    ],
  },
  end: {
    count: 4,
    pool: [
      entry('ultraball', 3),
      entry('hyperpotion', 2),
      entry('fullrestore', 2),
      entry('fullheal', 1),
      entry('leftovers', 1),
      entry('sitrusberry', 1),
      entry('xattack', 1),
    ],
  },
};
