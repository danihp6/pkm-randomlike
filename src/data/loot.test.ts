import { describe, expect, it } from 'vitest';
import { getItem } from './items';
import { ROUTE_LOOT } from './loot';
import { LEVEL_BANDS, type BandId } from './run';

const BAND_ORDER: readonly BandId[] = LEVEL_BANDS.map((band) => band.id);

describe('route loot', () => {
  it('covers every level band', () => {
    for (const id of BAND_ORDER) {
      expect(ROUTE_LOOT[id], id).toBeDefined();
    }
  });

  it('places at least one item with a positive-weight pool per band', () => {
    for (const id of BAND_ORDER) {
      expect(ROUTE_LOOT[id].count, id).toBeGreaterThan(0);
      expect(ROUTE_LOOT[id].pool.length, id).toBeGreaterThan(0);
      for (const entry of ROUTE_LOOT[id].pool) {
        expect(entry.weight, `${id}:${entry.itemId}`).toBeGreaterThan(0);
      }
    }
  });

  it('only names items that exist and can be sold', () => {
    for (const id of BAND_ORDER) {
      for (const entry of ROUTE_LOOT[id].pool) {
        const item = getItem(entry.itemId);
        expect(item, `${id}:${entry.itemId}`).toBeDefined();
        expect(item!.price, entry.itemId).toBeGreaterThan(0);
      }
    }
  });

  it('never places a Revive (D5)', () => {
    for (const id of BAND_ORDER) {
      for (const entry of ROUTE_LOOT[id].pool) {
        expect(getItem(entry.itemId)!.shortDesc.toLowerCase()).not.toContain('revive');
      }
    }
  });

  it('does not shrink the item count as the bands rise', () => {
    for (let i = 1; i < BAND_ORDER.length; i++) {
      expect(ROUTE_LOOT[BAND_ORDER[i]].count).toBeGreaterThanOrEqual(ROUTE_LOOT[BAND_ORDER[i - 1]].count);
    }
  });
});
