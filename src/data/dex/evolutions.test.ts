import { describe, expect, it } from 'vitest';
import { evolutionDepth, evolutionFamily, evolutionFor, isLevelEvolution } from './evolutions';
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

describe('evolution family', () => {
  it('collects a whole three-stage line from any of its members', () => {
    const expected = ['bulbasaur', 'ivysaur', 'venusaur'];
    for (const id of expected) {
      expect([...evolutionFamily(id)].sort(), id).toEqual(expected);
    }
  });

  it('walks up to the base form before branching back down', () => {
    const family = evolutionFamily('pikachu');
    expect(family).toContain('pichu');
    expect(family).toContain('pikachu');
    expect(family).toContain('raichu');
  });

  it('counts every branch of a split line', () => {
    expect(evolutionFamily('eevee').length).toBeGreaterThanOrEqual(9);
    expect(evolutionFamily('vaporeon')).toContain('eevee');
  });

  it('is a single member for a species that cannot evolve', () => {
    expect(evolutionFamily('tauros')).toEqual(['tauros']);
    expect(evolutionFamily('not-a-species')).toEqual([]);
  });
});

describe('evolution depth', () => {
  it('counts the longest chain, not the width of a branch', () => {
    expect(evolutionDepth('bulbasaur')).toBe(2);
    expect(evolutionDepth('ivysaur')).toBe(1);
    expect(evolutionDepth('venusaur')).toBe(0);
  });

  it('scores a split line whose children are all final as one step', () => {
    expect(evolutionDepth('scyther')).toBe(1);
    expect(evolutionDepth('eevee')).toBe(1);
  });

  it('is zero for a species that cannot evolve or an unknown id', () => {
    expect(evolutionDepth('tauros')).toBe(0);
    expect(evolutionDepth('not-a-species')).toBe(0);
  });
});
