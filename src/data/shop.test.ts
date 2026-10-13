import { describe, expect, it } from 'vitest';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { COMPETITIVE_HELD_IDS, buyPrice, getItem, sellPrice } from './items';
import { LEVEL_BANDS } from './run';
import { SHOP_CORE, SHOP_ROTATION, SHOP_ROTATION_COUNT, SHOP_TM } from './shop';
import { TM_MOVE_IDS, isTmItemId } from './tms';

/** Every competitive held item the engine models, so the Mart is the way to buy it. */
const PORT_IDS = COMPETITIVE_HELD_IDS.filter((id) => !UNMODELLED_ITEMS.includes(id));

/** The TM catalogue position of a machine id, read back through the move it teaches. */
const tmIndex = (id: string): number => TM_MOVE_IDS.indexOf(getItem(id)!.teaches!);

describe('shop tables', () => {
  it('stocks only catalogue items that exist', () => {
    for (const band of LEVEL_BANDS) {
      for (const id of SHOP_CORE[band.id]) expect(getItem(id), id).toBeDefined();
      for (const entry of SHOP_ROTATION[band.id]) {
        expect(getItem(entry.itemId), entry.itemId).toBeDefined();
        expect(entry.weight, entry.itemId).toBeGreaterThan(0);
      }
    }
  });

  it('stocks every modelled competitive held item, never twice in one band', () => {
    for (const band of LEVEL_BANDS) {
      const ids = SHOP_ROTATION[band.id].map((entry) => entry.itemId);
      expect(new Set(ids).size, band.id).toBe(ids.length);
    }
    const stocked = new Set<string>();
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) stocked.add(entry.itemId);
    }
    for (const id of PORT_IDS) expect(stocked.has(id), id).toBe(true);
  });

  it('never rotates a valuable, a Mega Stone or the Master Ball', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) {
        const item = getItem(entry.itemId)!;
        expect(item.kind, entry.itemId).not.toBe('valuable');
        expect(item.mega, entry.itemId).toBeUndefined();
        expect(item.id, entry.itemId).not.toBe('masterball');
      }
    }
  });

  it('stocks one or two rotating items', () => {
    expect(SHOP_ROTATION_COUNT).toEqual({ min: 1, max: 2 });
  });
});

describe('shop TM table', () => {
  it('gives every band at least six catalogue machines, in catalogue order', () => {
    const seen = new Set<string>();
    for (const band of LEVEL_BANDS) {
      const ids = SHOP_TM[band.id];
      expect(ids.length, band.id).toBeGreaterThanOrEqual(6);
      expect(new Set(ids).size, band.id).toBe(ids.length);
      const indexes = ids.map((id) => {
        expect(isTmItemId(id), id).toBe(true);
        expect(getItem(id)?.kind, id).toBe('tm');
        return tmIndex(id);
      });
      for (let i = 1; i < indexes.length; i++) {
        expect(indexes[i], ids[i]).toBeGreaterThan(indexes[i - 1]);
      }
      for (const id of ids) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it("lets no band borrow the previous band's range", () => {
    for (let i = 1; i < LEVEL_BANDS.length; i++) {
      const previous = SHOP_TM[LEVEL_BANDS[i - 1].id];
      const previousLast = Math.max(...previous.map(tmIndex));
      const first = Math.min(...SHOP_TM[LEVEL_BANDS[i].id].map(tmIndex));
      expect(first, LEVEL_BANDS[i].id).toBeGreaterThan(previousLast);
    }
  });

  it('prices every machine at the catalogue price, with no buy-and-sell loop', () => {
    for (const band of LEVEL_BANDS) {
      for (const id of SHOP_TM[band.id]) {
        const item = getItem(id)!;
        expect(buyPrice(item), id).toBe(3000);
        expect(sellPrice(item), id).toBeLessThan(buyPrice(item));
      }
    }
  });
});
