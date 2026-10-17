import { describe, expect, it } from 'vitest';
import { UNMODELLED_ITEMS } from '../engine/battle/effects/items';
import { COMPETITIVE_HELD_IDS, ITEMS, MEMORY_DRIVE_IDS } from './items';
import { ROUTE_LOOT } from './loot';
import { LEVEL_BANDS } from './run';
import { SHOP_ROTATION } from './shop';

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

  it('never repeats an id inside one band', () => {
    for (const band of LEVEL_BANDS) {
      const ids = ROUTE_LOOT[band.id].pool.map((entry) => entry.itemId);
      expect(new Set(ids).size, band.id).toBe(ids.length);
    }
  });

  it('thins the two on-ramp bands, leaving the later four at 0.75', () => {
    expect(ROUTE_LOOT.early.itemChance).toBe(0.5);
    expect(ROUTE_LOOT.low.itemChance).toBe(0.6);
    expect(ROUTE_LOOT.mid.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.high.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.late.itemChance).toBe(0.75);
    expect(ROUTE_LOOT.end.itemChance).toBe(0.75);
  });

  it('keeps the on-ramp rows hidden at 0.35 with the pools they ship', () => {
    expect(ROUTE_LOOT.early.hiddenChance).toBe(0.35);
    expect(ROUTE_LOOT.low.hiddenChance).toBe(0.35);
    expect(ROUTE_LOOT.early.pool.map((entry) => entry.itemId)).toEqual([
      'potion',
      'pokeball',
      'antidote',
      'stardust',
      'tm032',
    ]);
    expect(ROUTE_LOOT.low.pool.map((entry) => entry.itemId)).toEqual([
      'pokeball',
      'potion',
      'superpotion',
      'paralyzeheal',
      'stardust',
      'pearl',
      'tm020',
    ]);
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

  it('makes every competitive held item reachable from the ground or the Mart', () => {
    const reachable = new Set<string>();
    for (const band of LEVEL_BANDS) {
      for (const entry of ROUTE_LOOT[band.id].pool) reachable.add(entry.itemId);
      for (const entry of SHOP_ROTATION[band.id]) reachable.add(entry.itemId);
    }
    for (const id of [...COMPETITIVE_HELD_IDS, ...MEMORY_DRIVE_IDS]) {
      expect(reachable.has(id), id).toBe(true);
    }
  });

  it('drops the Memories and Drives as end-band ground treasure only (D37)', () => {
    const endIds = ROUTE_LOOT.end.pool.map((entry) => entry.itemId);
    for (const id of MEMORY_DRIVE_IDS) {
      expect(endIds, id).toContain(id);
      for (const band of LEVEL_BANDS) {
        expect(
          SHOP_ROTATION[band.id].some((entry) => entry.itemId === id),
          `${band.id} ${id}`,
        ).toBe(false);
      }
    }
  });

  it('hands the unmodelled items out on the ground only, never from the Mart (D16)', () => {
    for (const band of LEVEL_BANDS) {
      for (const entry of SHOP_ROTATION[band.id]) {
        expect(UNMODELLED_ITEMS, `${band.id} ${entry.itemId}`).not.toContain(entry.itemId);
      }
    }
  });

  it('drops the Plates as late-game treasure', () => {
    for (const band of LEVEL_BANDS) {
      const ids = ROUTE_LOOT[band.id].pool.map((entry) => entry.itemId);
      const plateIds = ids.filter((id) => id.endsWith('plate'));
      if (band.id === 'late' || band.id === 'end') expect(plateIds.length, band.id).toBe(17);
      else expect(plateIds.length, band.id).toBe(0);
    }
  });
});
