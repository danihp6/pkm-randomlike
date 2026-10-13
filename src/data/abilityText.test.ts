import { describe, expect, it } from 'vitest';
import { getAbility } from './dex/abilities';
import { OVERRIDES, abilityText } from './abilityText';

const normalise = (id: string): string => id.toLowerCase().replace(/[^a-z0-9]/g, '');

const RUN_AWAY_TEXT = 'Always escapes from a wild Pokémon. A trapping effect still stops it.';

describe('abilityText', () => {
  it('resolves Run Away however the id is written', () => {
    expect(abilityText('runaway')).toBe(RUN_AWAY_TEXT);
    expect(abilityText('Run Away')).toBe(RUN_AWAY_TEXT);
    expect(abilityText('run away')).toBe(RUN_AWAY_TEXT);
  });

  it('is null for an ability without an override and for an id that is no ability', () => {
    expect(abilityText('blaze')).toBeNull();
    expect(abilityText('not-an-ability')).toBeNull();
  });

  it('keys every override on a real dex ability, in its normalised form', () => {
    const keys = Object.keys(OVERRIDES);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const ability = getAbility(key);
      expect(ability, `"${key}" is not a dex ability`).toBeDefined();
      expect(normalise(ability!.id)).toBe(key);
    }
  });

  it('keeps the keys in ascending order', () => {
    const keys = Object.keys(OVERRIDES);
    expect(keys).toEqual([...keys].sort());
  });

  it('gives every override a non-empty single-line text', () => {
    for (const [key, text] of Object.entries(OVERRIDES)) {
      expect(text.trim().length, `"${key}" has no text`).toBeGreaterThan(0);
      expect(text.includes('\n'), `"${key}" is not single-line`).toBe(false);
    }
  });
});
