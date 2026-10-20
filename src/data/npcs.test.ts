import { describe, expect, it } from 'vitest';
import { en, es, setLocale, t } from '../i18n';
import { NPC_SPRITE_KEYS } from './overworldSprites';
import { NPC_ROWS, getNpcRow } from './npcs';

/** The one row the table ships today (`docs/maps-spec.md` §7). */
const MERCHANT = NPC_ROWS[0];

describe('the special-NPC table', () => {
  it('ships the merchant, the floor guarantee that carries the Mart', () => {
    expect(NPC_ROWS).toHaveLength(1);
    expect(MERCHANT.id).toBe('merchant');
    expect(MERCHANT.nameKey).toBe('npc.merchant.name');
    expect(MERCHANT.greetingKey).toBe('npc.merchant.greeting');
    expect(MERCHANT.spriteKey).toBe('merchant');
    // A guaranteed row is placed, never rolled, so its chance stays 0.
    expect(MERCHANT.chance).toBe(0);
    expect(MERCHANT.floorStep).toBe(0);
    expect(MERCHANT.guaranteedFromMap).toBe(2);
    expect(MERCHANT.requires).toBeUndefined();
    expect(MERCHANT.choices).toEqual([{ id: 'mart', label: 'npc.merchant.trade' }]);
  });

  it('answers the merchant by id and nothing else', () => {
    expect(getNpcRow('merchant')).toBe(MERCHANT);
    expect(getNpcRow('')).toBeUndefined();
    expect(getNpcRow('medic')).toBeUndefined();
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

  it('keys every row name, greeting and choice in both locales', () => {
    for (const row of NPC_ROWS) {
      for (const locale of [en, es]) {
        expect(Object.prototype.hasOwnProperty.call(locale, row.nameKey), row.id).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(locale, row.greetingKey), row.id).toBe(true);
        for (const choice of row.choices ?? []) {
          expect(
            Object.prototype.hasOwnProperty.call(locale, choice.label),
            `${row.id}/${choice.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it('renders the merchant copy through t() in both locales', () => {
    setLocale('en');
    expect(t('npc.merchant.name')).toBe('MERCHANT');
    expect(t('npc.merchant.greeting')).toBe('A merchant with a full pack. Pick what you carry.');
    expect(t('npc.merchant.trade')).toBe('TRADE');
    setLocale('es');
    expect(t('npc.merchant.name')).toBe('MERCADER');
    expect(t('npc.merchant.greeting')).toBe('Un mercader con la mochila llena. Elige que te llevas.');
    expect(t('npc.merchant.trade')).toBe('COMERCIAR');
    setLocale('en');
  });

  it('keeps every chance a probability and every step a per-floor increment', () => {
    for (const row of NPC_ROWS) {
      expect(row.chance, row.id).toBeGreaterThanOrEqual(0);
      expect(row.chance, row.id).toBeLessThanOrEqual(1);
      expect(row.floorStep, row.id).toBeGreaterThanOrEqual(-1);
      expect(row.floorStep, row.id).toBeLessThanOrEqual(1);
      if (row.guaranteedFromMap !== undefined) expect(row.chance, row.id).toBe(0);
    }
  });

  it('gives every choice row of a row its own id', () => {
    for (const row of NPC_ROWS) {
      const ids = (row.choices ?? []).map((choice) => choice.id);
      expect(new Set(ids).size, row.id).toBe(ids.length);
    }
  });
});
