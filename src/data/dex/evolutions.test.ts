import { describe, expect, it } from 'vitest';
import {
  availableEvolutions,
  evolutionBranches,
  evolutionDepth,
  evolutionFamily,
  evolutionFor,
  evolutionLevel,
  evolutionStage,
  isLevelEvolution,
} from './evolutions';
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

describe('evolution levels', () => {
  it('keeps a canon level evolution at its level', () => {
    expect(evolutionLevel('charmander', getSpecies('charmander')!.evolutions[0]!)).toBe(16);
  });

  it('levels every other method by stage, all branches sharing one level', () => {
    const eevee = evolutionBranches('eevee');
    expect(eevee).toHaveLength(8);
    expect(new Set(eevee.map((branch) => branch.level))).toEqual(new Set([20]));
    // A middle form evolves later: Pikachu's Raichu waits for 30.
    expect(evolutionBranches('pikachu').every((branch) => branch.level === 30)).toBe(true);
  });

  it('reuses the species own level evolution for its other branches', () => {
    expect(evolutionBranches('kirlia').map((branch) => branch.level)).toEqual([30, 30]);
    expect(evolutionBranches('slowpoke').map((branch) => branch.level)).toEqual([37, 37]);
  });

  it('never evolves before the level the species was obtained at', () => {
    // Horsea evolves into Seadra at 32, so Kingdra waits past it.
    expect(evolutionBranches('seadra')[0]!.level).toBe(33);
  });

  it('reports the stage from the prevo chain', () => {
    expect(evolutionStage('charmander')).toBe(0);
    expect(evolutionStage('charmeleon')).toBe(1);
    expect(evolutionStage('charizard')).toBe(2);
    expect(evolutionStage('not-a-species')).toBe(0);
  });

  it('filters to the branches a level allows', () => {
    expect(availableEvolutions('charmander', 15)).toEqual([]);
    expect(availableEvolutions('charmander', 16).map((branch) => branch.into)).toEqual(['charmeleon']);
    expect(availableEvolutions('eevee', 20)).toHaveLength(8);
    expect(availableEvolutions('not-a-species', 100)).toEqual([]);
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
