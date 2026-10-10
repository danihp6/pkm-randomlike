import { describe, expect, it } from 'vitest';
import { getItem } from './items';
import { LEVEL_BANDS } from './run';
import { SHOP_CORE, SHOP_ROTATION, SHOP_ROTATION_COUNT } from './shop';

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
