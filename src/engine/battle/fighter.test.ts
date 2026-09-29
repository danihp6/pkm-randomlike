import { describe, expect, it } from 'vitest';
import { getSpecies, statAtLevel } from '../../data/dex';
import {
  accuracyStageMultiplier,
  applyBoosts,
  clampBoost,
  createFighter,
  defaultMoveset,
  effectiveSpeed,
  effectiveStat,
  stageMultiplier,
} from './fighter';

const level = 20;

describe('createFighter', () => {
  it('computes stats exactly at the level', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level, nature: 'serious' });
    const expected = statAtLevel(getSpecies('charmander')!, level, 'serious');
    expect(fighter.stats).toEqual(expected);
    expect(fighter.hp).toBe(expected.hp);
    expect(fighter.maxHp).toBe(expected.hp);
    expect(fighter.types).toEqual(['Fire']);
  });

  it('defaults to the species ability and a full-PP moveset', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(fighter.ability).not.toBe('');
    expect(fighter.moves.length).toBeGreaterThan(0);
    for (const slot of fighter.moves) {
      expect(slot.pp).toBe(slot.maxPp);
      expect(slot.pp).toBeGreaterThan(0);
    }
  });

  it('keeps only moves that exist in the dex', () => {
    const fighter = createFighter({
      id: 'c',
      speciesId: 'charmander',
      level,
      moves: ['ember', 'not-a-move', 'growl'],
    });
    expect(fighter.moves.map((slot) => slot.moveId)).toEqual(['ember', 'growl']);
  });

  it('rejects an unknown species', () => {
    expect(() => createFighter({ id: 'x', speciesId: 'missingno', level: 5 })).toThrow();
  });
});

describe('defaultMoveset', () => {
  it('takes the newest four level-up moves', () => {
    const moves = defaultMoveset('charmander', 30);
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.length).toBeGreaterThan(0);
  });
});

describe('stat stages', () => {
  it('clamps to -6..+6 and only reports real changes', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    expect(clampBoost(9)).toBe(6);
    expect(clampBoost(-9)).toBe(-6);
    expect(applyBoosts(fighter, { atk: 2 })).toEqual([{ stat: 'atk', stages: 2 }]);
    expect(applyBoosts(fighter, { atk: 10 })).toEqual([{ stat: 'atk', stages: 4 }]);
    expect(fighter.boosts.atk).toBe(6);
    expect(applyBoosts(fighter, { atk: 1 })).toEqual([]);
  });

  it('uses the classic stage multipliers', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(accuracyStageMultiplier(0)).toBe(1);
    expect(accuracyStageMultiplier(3)).toBe(2);
    expect(accuracyStageMultiplier(-3)).toBe(0.5);
  });

  it('applies stages to effective stats', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    const base = effectiveStat(fighter, 'atk');
    applyBoosts(fighter, { atk: 1 });
    expect(effectiveStat(fighter, 'atk')).toBe(Math.floor(base * 1.5));
  });

  it('halves effective speed when paralyzed', () => {
    const fighter = createFighter({ id: 'c', speciesId: 'charmander', level });
    const base = effectiveSpeed(fighter);
    fighter.status = 'par';
    expect(effectiveSpeed(fighter)).toBe(Math.max(1, Math.floor(base / 2)));
  });
});
