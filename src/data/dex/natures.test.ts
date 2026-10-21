import { describe, expect, it } from 'vitest';
import { getSpecies } from './species';
import { allNatures, getNature, natureMultiplier, statAtLevel } from './natures';

describe('nature accessors', () => {
  it('finds a nature by name or id', () => {
    expect(getNature('adamant')?.plus).toBe('atk');
    expect(getNature('Adamant')?.minus).toBe('spa');
    expect(getNature('bashful')).toEqual({ id: 'bashful', name: 'Bashful', plus: null, minus: null });
    expect(getNature('not-a-nature')).toBeUndefined();
  });

  it('exposes every generated nature', () => {
    expect(allNatures().length).toBe(25);
    expect(allNatures().some((nature) => nature.id === 'adamant')).toBe(true);
  });

  it('multiplies the boosted and hindered stats only', () => {
    expect(natureMultiplier('adamant', 'atk')).toBeCloseTo(1.1);
    expect(natureMultiplier('adamant', 'spa')).toBeCloseTo(0.9);
    expect(natureMultiplier('adamant', 'hp')).toBe(1);
    expect(natureMultiplier('bashful', 'atk')).toBe(1);
    expect(natureMultiplier('bashful', 'spe')).toBe(1);
  });

  it('computes the full stat line at a level', () => {
    const pikachu = getSpecies('pikachu')!;
    expect(statAtLevel(pikachu, 50, 'bashful')).toEqual({
      hp: 110,
      atk: 75,
      def: 60,
      spa: 70,
      spd: 70,
      spe: 110,
    });
    expect(statAtLevel(pikachu, 50, 'adamant')).toEqual({
      hp: 110,
      atk: 82,
      def: 60,
      spa: 63,
      spd: 70,
      spe: 110,
    });
  });

  it('honours explicit IVs and EVs', () => {
    const pikachu = getSpecies('pikachu')!;
    const perfect = statAtLevel(pikachu, 50, 'bashful', { atk: 31 }, { atk: 252 });
    expect(perfect.atk).toBeGreaterThan(75);
  });
});

describe('the permanent treats (Task-103)', () => {
  const pikachu = getSpecies('pikachu')!;
  const shipped = statAtLevel(pikachu, 50, 'bashful');

  it('is exactly the shipped formula for an absent or empty record', () => {
    expect(statAtLevel(pikachu, 50, 'bashful', {}, {}, undefined)).toEqual(shipped);
    expect(statAtLevel(pikachu, 50, 'bashful', {}, {}, {})).toEqual(shipped);
  });

  it('raises exactly the treated stat by one', () => {
    const raised = statAtLevel(pikachu, 50, 'bashful', {}, {}, { atk: 1 });
    expect(raised.atk).toBe(shipped.atk + 1);
    expect(raised).toEqual({ ...shipped, atk: shipped.atk + 1 });
  });

  it('lowers exactly the treated stat by one, and never below 1', () => {
    const lowered = statAtLevel(pikachu, 50, 'bashful', {}, {}, { spe: -1 });
    expect(lowered.spe).toBe(shipped.spe - 1);
    expect(lowered).toEqual({ ...shipped, spe: shipped.spe - 1 });
    const floored = statAtLevel(pikachu, 50, 'bashful', {}, {}, { atk: -9999, hp: -9999 });
    expect(floored.atk).toBe(1);
    expect(floored.hp).toBe(1);
  });

  it('raises max HP by the treated amount', () => {
    expect(statAtLevel(pikachu, 50, 'bashful', {}, {}, { hp: 2 }).hp).toBe(shipped.hp + 2);
  });

  it('reads the treats on top of natures, IVs and EVs', () => {
    const perfect = statAtLevel(pikachu, 50, 'adamant', { atk: 31 }, { atk: 252 }, { atk: 1 });
    expect(perfect.atk).toBe(statAtLevel(pikachu, 50, 'adamant', { atk: 31 }, { atk: 252 }).atk + 1);
  });
});
