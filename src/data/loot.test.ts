import { describe, expect, it } from 'vitest';
import { ITEMS } from './items';
import { ROUTE_LOOT } from './loot';
import { LEVEL_BANDS } from './run';

const KNOWN = new Set(ITEMS.map((item) => item.id));

describe('ROUTE_LOOT', () => {
  it('covers every level band', () => {
    for (const band of LEVEL_BANDS) expect(ROUTE_LOOT[band.id]).toBeDefined();
  });

  it('draws from known items with positive weights', () => {
    for (const band of LEVEL_BANDS) {
      const loot = ROUTE_LOOT[band.id];
      expect(loot.pool.length).toBeGreaterThan(0);
      for (const entry of loot.pool) {
        expect(KNOWN.has(entry.itemId), `${band.id} ${entry.itemId}`).toBe(true);
        expect(entry.weight, `${band.id} ${entry.itemId}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the hidden chance a probability', () => {
    for (const band of LEVEL_BANDS) {
      const chance = ROUTE_LOOT[band.id].hiddenChance;
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });

  it('never offers a Revive (D5)', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of ROUTE_LOOT[band.id].pool) {
        expect(entry.itemId).not.toMatch(/revive/i);
      }
    }
  });
});
