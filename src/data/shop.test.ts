import { describe, expect, it } from 'vitest';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { COMPETITIVE_HELD_IDS, getItem } from './items';
import { LEVEL_BANDS } from './run';
import { SHOP_CORE, SHOP_ROTATION, SHOP_ROTATION_COUNT } from './shop';

/** Every competitive held item the engine models, so the Mart is the way to buy it. */
const PORT_IDS = COMPETITIVE_HELD_IDS.filter((id) => !UNMODELLED_ITEMS.includes(id));

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
