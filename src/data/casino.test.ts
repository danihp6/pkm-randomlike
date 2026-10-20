import { describe, expect, it } from 'vitest';
import { CASINO, EGG_ITEM_ID, type CasinoPrize } from './casino';
import { getItem } from './items';
import { LEVEL_BANDS, type BandId } from './run';

/** Every band id, in the shipped order, so a missing table row fails loudly. */
const BANDS: readonly BandId[] = LEVEL_BANDS.map((band) => band.id);

/** The `kind: 'item'` rows of a band, with their id narrowed. */
function itemRows(rows: readonly CasinoPrize[]): readonly { itemId: string; weight: number }[] {
  return rows
    .filter((row): row is CasinoPrize & { itemId: string } => row.kind === 'item')
    .map((row) => ({ itemId: row.itemId, weight: row.weight }));
}

/** One row as this file compares it: its kind, its id (or `-`) and its weight. */
function asRow(row: CasinoPrize): string {
  return `${row.kind}:${row.itemId ?? '-'}:${row.weight}`;
}

const item = (itemId: string, weight: number): string => `item:${itemId}:${weight}`;
const held = (weight: number): string => `held:-:${weight}`;
const egg = (weight: number): string => `egg:-:${weight}`;

/**
 * The shipped prize table, row for row (`docs/maps-spec.md` §7). Every band carries
 * exactly one grouped `held` row — no id, because its id is drawn from the band's
 * own Mart shelf — and exactly one Egg row.
 */
const EXPECTED: Readonly<Record<BandId, readonly string[]>> = {
  early: [item('potion', 4), item('pokeball', 4), item('oranberry', 2), held(1), egg(1)],
  low: [
    item('superpotion', 4),
    item('greatball', 4),
    item('oranberry', 2),
    item('nugget', 1),
    held(1),
    egg(1),
  ],
  mid: [item('hyperpotion', 3), item('greatball', 3), held(1), item('nugget', 1), egg(1)],
  high: [item('hyperpotion', 2), item('ultraball', 2), held(1), item('nugget', 1), egg(1)],
  late: [item('fullrestore', 2), item('ultraball', 2), held(1), item('nugget', 2), egg(1)],
  end: [item('fullrestore', 2), item('ultraball', 2), held(1), item('nugget', 2), egg(1)],
};

/** Each band's total weight, in `LEVEL_BANDS` order: the grouped row's own divisor. */
const TOTALS: readonly number[] = [12, 13, 9, 7, 8, 8];

describe('the casino table', () => {
  it('names the Egg the catalogue holds', () => {
    expect(EGG_ITEM_ID).toBe('egg');
    expect(getItem(EGG_ITEM_ID)).toBeDefined();
  });

  it('prices one spin per band, climbing with the bands', () => {
    expect(Object.keys(CASINO.price).sort()).toEqual([...BANDS].sort());
    const prices = BANDS.map((band) => CASINO.price[band]);
    for (const price of prices) {
      expect(Number.isInteger(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
    }
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // The early and low rungs are the shipped Potion's and Super Potion's own prices.
    expect(CASINO.price.early).toBe(getItem('potion')!.price);
    expect(CASINO.price.low).toBe(getItem('superpotion')!.price);
  });

  it('keeps one battle rate for every band', () => {
    expect(CASINO.battleChance).toBeGreaterThan(0);
    expect(CASINO.battleChance).toBeLessThan(1);
  });

  it('writes each band’s rows in the published order and weights', () => {
    expect(Object.keys(CASINO.prizes).sort()).toEqual([...BANDS].sort());
    for (const band of BANDS) {
      expect(CASINO.prizes[band].map(asRow), band).toEqual(EXPECTED[band]);
    }
  });

  it('gives every band one grouped equipable row and one Egg row', () => {
    for (const band of BANDS) {
      const rows = CASINO.prizes[band];
      // The grouped row names no id: its id is the band's own shelf draw.
      const helds = rows.filter((row) => row.kind === 'held');
      expect(helds, band).toHaveLength(1);
      expect(helds[0].itemId, band).toBeUndefined();
      // Exactly one Egg row per band, and it names no item id.
      const eggs = rows.filter((row) => row.kind === 'egg');
      expect(eggs, band).toHaveLength(1);
      expect(eggs[0].itemId, band).toBeUndefined();
      for (const row of rows) expect(row.weight, band).toBeGreaterThan(0);
    }
  });

  it('totals 12 / 13 / 9 / 7 / 8 / 8 in LEVEL_BANDS order', () => {
    const totals = BANDS.map((band) => CASINO.prizes[band].reduce((sum, row) => sum + row.weight, 0));
    expect(totals).toEqual([...TOTALS]);
  });

  it('only pays out catalogue items the run can carry', () => {
    for (const band of BANDS) {
      for (const row of itemRows(CASINO.prizes[band])) {
        expect(getItem(row.itemId), `${band} ${row.itemId}`).toBeDefined();
        // Paid for at the counter, carried for nothing: never a Master Ball.
        expect(row.itemId, `${band}`).not.toBe('masterball');
      }
    }
  });

  it('never names the same item twice in one band', () => {
    for (const band of BANDS) {
      const ids = itemRows(CASINO.prizes[band]).map((row) => row.itemId);
      expect(new Set(ids).size, band).toBe(ids.length);
    }
  });
});
