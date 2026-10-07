import type { BandId } from './run';

export type LootEntry = Readonly<{ itemId: string; weight: number }>;

export type BandLoot = Readonly<{
  /** Weighted pool the ground items are drawn from. */
  pool: readonly LootEntry[];
  /** Chance a placed item is hidden (a faint sparkle instead of a Poke Ball). */
  hiddenChance: number;
  /** Chance an optional path (a `pocket`) actually holds an item at all. */
  itemChance: number;
}>;

const entry = (itemId: string, weight: number): LootEntry => ({ itemId, weight });

/**
 * The route reward as ground items, like the classic games: an optional path
 * (a `pocket`) holds an item with `itemChance` probability, placed as deep down
 * the path as it can, and pressing the interact key on it adds it to the bag.
 * The count follows the route's size because the map-size tier adds optional
 * paths (`branchBonus`), so a bigger route carves more pockets and therefore
 * holds more items. Everything is drawn from the route `Rng`, so
 * `(seed, routeIndex)` fixes positions, contents and which ones are hidden (D11).
 *
 * The pool widens and deepens with the band: early routes hand out Potions and
 * Poke Balls, the late bands bring Hyper Potions, Ultra Balls and the held items
 * the battle engine already supports. No Revive anywhere (D5).
 */
export const ROUTE_LOOT: Readonly<Record<BandId, BandLoot>> = {
  early: {
    hiddenChance: 0.35,
    itemChance: 0.75,
    pool: [entry('potion', 4), entry('pokeball', 4), entry('antidote', 1)],
  },
  low: {
    hiddenChance: 0.35,
    itemChance: 0.75,
    pool: [
      entry('pokeball', 4),
      entry('potion', 3),
      entry('superpotion', 2),
      entry('paralyzeheal', 1),
    ],
  },
  mid: {
    hiddenChance: 0.4,
    itemChance: 0.75,
    pool: [
      entry('greatball', 3),
      entry('superpotion', 3),
      entry('potion', 2),
      entry('fullheal', 2),
      entry('xattack', 1),
    ],
  },
  high: {
    hiddenChance: 0.4,
    itemChance: 0.75,
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
    hiddenChance: 0.45,
    itemChance: 0.75,
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
    hiddenChance: 0.45,
    itemChance: 0.75,
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
