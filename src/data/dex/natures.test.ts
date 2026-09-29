import { describe, expect, it } from 'vitest';
import { getSpecies } from './species';
import { getNature, natureMultiplier, statAtLevel } from './natures';

describe('nature accessors', () => {
  it('finds a nature by name or id', () => {
    expect(getNature('adamant')?.plus).toBe('atk');
    expect(getNature('Adamant')?.minus).toBe('spa');
    expect(getNature('bashful')).toEqual({ id: 'bashful', name: 'Bashful', plus: null, minus: null });
    expect(getNature('not-a-nature')).toBeUndefined();
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
