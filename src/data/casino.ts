import type { BandId } from './run';

/**
 * The **casino** room's slot machine (`docs/maps-spec.md` §7, D33/D47): what one
 * spin costs, how often a spin turns into a fight and what a paying spin hands
 * over. Pure data — no RNG, no run state and no Phaser — so the machine's whole
 * balance surface is one table a later pass re-tunes here, never in code.
 */

/** One paying outcome of a spin: a catalogue item, or the Egg. */
export type CasinoPrize = Readonly<{
  kind: 'item' | 'egg';
  /** The catalogue id; required for `kind: 'item'`, absent for `kind: 'egg'`. */
  itemId?: string;
  /** The row's weight in the band's weighted pick; `> 0`. */
  weight: number;
}>;

export type CasinoTable = Readonly<{
  /** Poké Dollars one spin costs, by the floor's band. */
  price: Readonly<Record<BandId, number>>;
  /** P(a spin turns into the grunt battle instead of a prize), every band. */
  battleChance: number;
  /** The paying rows, by the floor's band; one weighted pick decides between them. */
  prizes: Readonly<Record<BandId, readonly CasinoPrize[]>>;
}>;

/** The Egg the machine pays out (`src/data/items.ts`). */
export const EGG_ITEM_ID = 'egg';

const prize = (itemId: string, weight: number): CasinoPrize => ({ kind: 'item', itemId, weight });
const egg = (weight: number): CasinoPrize => ({ kind: 'egg', weight });

/**
 * The early price is the shipped **Potion**'s own 300 and the low price the
 * shipped **Super Potion**'s own 700; the rest climb with the band. The Egg's
 * share is one weight of each band's total (≈ 9 % of paying spins early, ≈ 12 %
 * late) and `battleChance` is one rate for every band, so a spin is a fight about
 * one time in seven.
 */
export const CASINO: CasinoTable = {
  battleChance: 0.15,
  price: { early: 300, low: 700, mid: 1000, high: 1500, late: 2000, end: 2500 },
  prizes: {
    early: [prize('potion', 4), prize('pokeball', 4), prize('oranberry', 2), egg(1)],
    low: [
      prize('superpotion', 3),
      prize('greatball', 3),
      prize('oranberry', 1),
      prize('nugget', 1),
      egg(1),
    ],
    mid: [
      prize('hyperpotion', 2),
      prize('greatball', 2),
      prize('charcoal', 1),
      prize('nugget', 1),
      egg(1),
    ],
    high: [
      prize('hyperpotion', 2),
      prize('ultraball', 2),
      prize('expertbelt', 1),
      prize('nugget', 1),
      egg(1),
    ],
    late: [
      prize('fullrestore', 2),
      prize('ultraball', 2),
      prize('lifeorb', 1),
      prize('nugget', 2),
      egg(1),
    ],
    end: [
      prize('fullrestore', 2),
      prize('ultraball', 2),
      prize('leftovers', 1),
      prize('nugget', 2),
      egg(1),
    ],
  },
};
