import { describe, expect, it } from 'vitest';
import { getMove, type StatId, type Stats } from '../../data/dex';
import {
  HIDDEN_POWER_TYPES,
  abilityMoveType,
  baseMoveType,
  effectiveMoveType,
  hiddenPowerType,
} from './moveType';

const tackle = getMove('tackle')!;
const ember = getMove('ember')!;
const hypervoice = getMove('hypervoice')!;
const judgment = getMove('judgment')!;
const hiddenpower = getMove('hiddenpower')!;

const ALL_31: Stats = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const ALL_0: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

describe('abilityMoveType', () => {
  it('retypes a Normal move for the -ate abilities', () => {
    expect(abilityMoveType('Refrigerate', tackle)).toBe('Ice');
    expect(abilityMoveType('Aerilate', tackle)).toBe('Flying');
    expect(abilityMoveType('Galvanize', tackle)).toBe('Electric');
    expect(abilityMoveType('Pixilate', tackle)).toBe('Fairy');
    // A move that is not Normal is left alone.
    expect(abilityMoveType('Refrigerate', ember)).toBe('Fire');
  });

  it('Normalize makes every move Normal, even a typed one', () => {
    expect(abilityMoveType('Normalize', ember)).toBe('Normal');
    expect(abilityMoveType('Normalize', tackle)).toBe('Normal');
  });

  it('Liquid Voice only retypes sound moves', () => {
    expect(abilityMoveType('Liquid Voice', hypervoice)).toBe('Water');
    expect(abilityMoveType('Liquid Voice', tackle)).toBe('Normal');
  });

  it('leaves a move unchanged for any other or missing ability', () => {
    expect(abilityMoveType('Blaze', ember)).toBe('Fire');
    expect(abilityMoveType(null, ember)).toBe('Fire');
    expect(abilityMoveType(undefined, tackle)).toBe('Normal');
  });
});

describe('effectiveMoveType', () => {
  it('a held Plate gives Judgment its type', () => {
    expect(effectiveMoveType('Multitype', 'flameplate', judgment)).toBe('Fire');
    expect(effectiveMoveType('Multitype', 'pixieplate', judgment)).toBe('Fairy');
    expect(effectiveMoveType('Multitype', null, judgment)).toBe('Normal');
    // A non-Plate item does not retype it.
    expect(effectiveMoveType('Multitype', 'charcoal', judgment)).toBe('Normal');
  });

  it('still applies the ability and leaves other moves alone', () => {
    expect(effectiveMoveType('Refrigerate', 'flameplate', tackle)).toBe('Ice');
    expect(effectiveMoveType('Blaze', null, ember)).toBe('Fire');
  });
});

describe('hiddenPowerType', () => {
  it('anchors all-31 and all-0 IVs, and defaults the missing ones to MAX_IV', () => {
    expect(hiddenPowerType(ALL_31)).toBe('Dark');
    expect(hiddenPowerType(ALL_0)).toBe('Fighting');
    expect(hiddenPowerType()).toBe('Dark');
    expect(hiddenPowerType(null)).toBe('Dark');
  });

  it('reproduces @pkmn/dex for a mixed IV set', () => {
    // Dex.getHiddenPower({ hp: 31, atk: 0, def: 31, spa: 0, spd: 31, spe: 0 }).type === 'Fire'
    expect(hiddenPowerType({ hp: 31, atk: 0, def: 31, spa: 0, spd: 31, spe: 0 })).toBe('Fire');
  });

  it('always picks one of the 16 types, never Normal or Fairy', () => {
    const stats: readonly StatId[] = ['hp', 'atk', 'def', 'spe', 'spa', 'spd'];
    for (let mask = 0; mask < 64; mask++) {
      const ivs: Record<StatId, number> = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
      stats.forEach((stat, bit) => {
        ivs[stat] = (mask >> bit) & 1 ? 31 : 0;
      });
      const type = hiddenPowerType(ivs);
      expect(HIDDEN_POWER_TYPES).toContain(type);
      expect(type).not.toBe('Normal');
      expect(type).not.toBe('Fairy');
    }
  });
});

describe('baseMoveType', () => {
  it('reads Hidden Power from the IVs and everything else from the dex', () => {
    expect(baseMoveType(hiddenpower, ALL_31)).toBe('Dark');
    expect(baseMoveType(hiddenpower)).toBe('Dark');
    expect(baseMoveType(tackle)).toBe('Normal');
    expect(baseMoveType(ember)).toBe('Fire');
  });
});

describe('Hidden Power precedence', () => {
  it('Normalize still forces Normal, an -ate ability leaves it alone', () => {
    expect(abilityMoveType('Normalize', hiddenpower, ALL_31)).toBe('Normal');
    expect(abilityMoveType('Aerilate', hiddenpower, ALL_31)).toBe('Dark');
    expect(abilityMoveType('Aerilate', hiddenpower, ALL_0)).toBe('Fighting');
  });

  it('the panel reads the same IV-derived type', () => {
    expect(effectiveMoveType('Blaze', null, hiddenpower, ALL_31)).toBe('Dark');
    expect(effectiveMoveType('Normalize', null, hiddenpower, ALL_31)).toBe('Normal');
  });
});
