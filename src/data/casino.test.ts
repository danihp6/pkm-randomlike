import { describe, expect, it } from 'vitest';
import { CASINO, EGG_ITEM_ID, type CasinoPrize } from './casino';
import { getItem } from './items';
import { LEVEL_BANDS } from './run';

/** Every band id, in the shipped order, so a missing table row fails loudly. */
const BANDS = LEVEL_BANDS.map((band) => band.id);

/** The `kind: 'item'` rows of a band, with their id narrowed. */
function itemRows(rows: readonly CasinoPrize[]): readonly { itemId: string; weight: number }[] {
  return rows
    .filter((row): row is CasinoPrize & { itemId: string } => row.kind === 'item')
    .map((row) => ({ itemId: row.itemId, weight: row.weight }));
}

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

  it('gives every band one Egg and three or four items, each row weighable', () => {
    expect(Object.keys(CASINO.prizes).sort()).toEqual([...BANDS].sort());
    for (const band of BANDS) {
      const rows = CASINO.prizes[band];
      // The early band is the run's on-ramp: three items and the Egg, where every
      // later band carries four items and the Egg.
      const items = itemRows(rows);
      expect(items.length, band).toBe(band === 'early' ? 3 : 4);
      expect(rows.length, band).toBe(items.length + 1);
      for (const row of rows) expect(row.weight, band).toBeGreaterThan(0);
      // Exactly one Egg row per band, and it names no item id.
      const eggs = rows.filter((row) => row.kind === 'egg');
      expect(eggs, band).toHaveLength(1);
      expect(eggs[0].itemId, band).toBeUndefined();
    }
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

  it('never offers the same item twice in one band', () => {
    for (const band of BANDS) {
      const ids = itemRows(CASINO.prizes[band]).map((row) => row.itemId);
      expect(new Set(ids).size, band).toBe(ids.length);
    }
  });
});
