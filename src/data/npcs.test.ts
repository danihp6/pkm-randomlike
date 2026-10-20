import { describe, expect, it } from 'vitest';
import { en } from '../i18n';
import { NPC_SPRITE_KEYS } from './overworldSprites';
import { NPC_ROWS, getNpcRow } from './npcs';

describe('the special-NPC table', () => {
  it('ships empty on purpose: the framework carries no content', () => {
    expect(NPC_ROWS).toEqual([]);
  });

  it('answers no row for any id while the table is empty', () => {
    expect(getNpcRow('merchant')).toBeUndefined();
    expect(getNpcRow('')).toBeUndefined();
  });

  it('hands every row a unique stable id', () => {
    const ids = NPC_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(getNpcRow(id)?.id).toBe(id);
  });

  it('draws every row through a key of the packed NPC sheets', () => {
    for (const row of NPC_ROWS) {
      expect(NPC_SPRITE_KEYS, row.id).toContain(row.spriteKey);
    }
  });

  it('keys every row name and greeting in the source table', () => {
    for (const row of NPC_ROWS) {
      expect(Object.prototype.hasOwnProperty.call(en, row.nameKey), row.id).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(en, row.greetingKey), row.id).toBe(true);
      for (const choice of row.choices ?? []) {
        expect(Object.prototype.hasOwnProperty.call(en, choice.label), `${row.id}/${choice.id}`).toBe(
          true,
        );
      }
    }
  });

  it('keeps every chance a probability and every step a per-floor increment', () => {
    for (const row of NPC_ROWS) {
      expect(row.chance, row.id).toBeGreaterThanOrEqual(0);
      expect(row.chance, row.id).toBeLessThanOrEqual(1);
      expect(row.floorStep, row.id).toBeGreaterThanOrEqual(-1);
      expect(row.floorStep, row.id).toBeLessThanOrEqual(1);
    }
  });

  it('gives every choice row of a row its own id', () => {
    for (const row of NPC_ROWS) {
      const ids = (row.choices ?? []).map((choice) => choice.id);
      expect(new Set(ids).size, row.id).toBe(ids.length);
    }
  });
});
