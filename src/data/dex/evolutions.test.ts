import { describe, expect, it } from 'vitest';
import { evolutionFor, isLevelEvolution } from './evolutions';
import { getSpecies } from './species';

describe('evolution accessors', () => {
  it('distinguishes level evolutions from every other method', () => {
    const bulbasaur = getSpecies('bulbasaur')!;
    const pikachu = getSpecies('pikachu')!;
    expect(isLevelEvolution(bulbasaur.evolutions[0]!)).toBe(true);
    expect(isLevelEvolution(pikachu.evolutions[0]!)).toBe(false);
  });

  it('returns the level evolution that a level triggers', () => {
    expect(evolutionFor('bulbasaur', 15)).toBeUndefined();
    expect(evolutionFor('bulbasaur', 16)?.into).toBe('ivysaur');
    expect(evolutionFor('pikachu', 100)).toBeUndefined();
    expect(evolutionFor('not-a-species', 100)).toBeUndefined();
  });
});
