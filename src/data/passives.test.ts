import { describe, expect, it } from 'vitest';
import { getAbility } from './dex/abilities';
import { ITEMS } from './items';
import { MAP_PASSIVES, mapPassivesFor, type MapPassive } from './passives';

const KNOWN = new Set(ITEMS.map((item) => item.id));

describe('MAP_PASSIVES', () => {
  it('holds the two out-of-battle item abilities, in the rule walk order', () => {
    expect(MAP_PASSIVES.map((row) => row.ability)).toEqual(['pickup', 'honeygather']);
    expect(MAP_PASSIVES).toHaveLength(2);
  });

  it('pays Pickup on a room entry and Honey Gather on a win', () => {
    expect(MAP_PASSIVES[0].trigger).toBe('room');
    expect(MAP_PASSIVES[1].trigger).toBe('win');
    expect(new Set(MAP_PASSIVES.map((row) => row.trigger))).toEqual(new Set(['room', 'win']));
  });

  it('never repeats an (ability, trigger) pair', () => {
    const pairs = MAP_PASSIVES.map((row) => `${row.ability}:${row.trigger}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it('names each row by the dex id, never the display name', () => {
    for (const row of MAP_PASSIVES) {
      expect(getAbility(row.ability)?.id, row.ability).toBe(row.ability);
    }
  });

  it('pays only catalogue ids, deduped and non-empty', () => {
    for (const row of MAP_PASSIVES) {
      expect(row.effect.itemIds.length, row.ability).toBeGreaterThan(0);
      expect(new Set(row.effect.itemIds).size, row.ability).toBe(row.effect.itemIds.length);
      for (const itemId of row.effect.itemIds) {
        expect(KNOWN.has(itemId), `${row.ability} ${itemId}`).toBe(true);
      }
    }
  });

  it('rolls a chance inside (0, 1]', () => {
    for (const row of MAP_PASSIVES) {
      expect(row.effect.chance, row.ability).toBeGreaterThan(0);
      expect(row.effect.chance, row.ability).toBeLessThanOrEqual(1);
    }
  });
});

describe('mapPassivesFor', () => {
  it('walks one trigger at a time, in table order', () => {
    for (const trigger of ['room', 'win'] as const) {
      const rows = mapPassivesFor(trigger);
      expect(rows).toEqual(MAP_PASSIVES.filter((row) => row.trigger === trigger));
      expect(rows.every((row: MapPassive) => row.trigger === trigger)).toBe(true);
    }
    expect(mapPassivesFor('room').map((row) => row.ability)).toEqual(['pickup']);
    expect(mapPassivesFor('win').map((row) => row.ability)).toEqual(['honeygather']);
  });
});
