import { describe, expect, it } from 'vitest';
import { getSpecies } from './dex';
import { evolutionDepth } from './dex/evolutions';
import {
  LEVEL_BANDS,
  RUN_CHAIN,
  STARTER_POOL_SIZE,
  STARTING_BAG,
  bandForLevel,
  starterCandidates,
} from './run';

describe('level bands', () => {
  it('picks the band a level floor falls in and clamps at the ends', () => {
    expect(bandForLevel(0).id).toBe('early');
    expect(bandForLevel(2).id).toBe('early');
    expect(bandForLevel(4).id).toBe('early');
    expect(bandForLevel(5).id).toBe('low');
    expect(bandForLevel(11).id).toBe('mid');
    expect(bandForLevel(20).id).toBe('late');
    expect(bandForLevel(32).id).toBe('end');
    expect(bandForLevel(999).id).toBe('end');
  });

  it('keeps band levels monotonically rising', () => {
    for (let i = 1; i < LEVEL_BANDS.length; i++) {
      expect(LEVEL_BANDS[i].minLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].minLevel);
      expect(LEVEL_BANDS[i].maxLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].maxLevel);
    }
  });
});

describe('run chain', () => {
  it('has a finite length divisible into cadences', () => {
    expect(RUN_CHAIN.finiteLength).toBeGreaterThan(RUN_CHAIN.bossBlock);
    expect(RUN_CHAIN.bossBlock % RUN_CHAIN.minibossEvery).toBe(0);
  });
});

describe('starter pool', () => {
  it('names base forms with two consecutive evolutions ahead', () => {
    const candidates = starterCandidates();
    expect(candidates.length).toBeGreaterThanOrEqual(STARTER_POOL_SIZE);
    for (const id of candidates) {
      const species = getSpecies(id);
      expect(species, id).toBeDefined();
      expect(species!.prevo, id).toBe('');
      expect(evolutionDepth(id), id).toBeGreaterThanOrEqual(2);
    }
  });

  it('includes the classic starters and leaves out branching lines', () => {
    const candidates = starterCandidates();
    for (const id of ['bulbasaur', 'charmander', 'squirtle', 'chikorita', 'dratini']) {
      expect(candidates, id).toContain(id);
    }
    // Two-stage lines, split lines and fully evolved Pokémon are never offered.
    expect(candidates).not.toContain('ivysaur');
    expect(candidates).not.toContain('venusaur');
    expect(candidates).not.toContain('rattata');
    expect(candidates).not.toContain('eevee');
    expect(candidates).not.toContain('scyther');
  });

  it('starts the run with ten Poke Balls, everything else earned on the route', () => {
    expect(STARTING_BAG).toEqual([{ itemId: 'pokeball', count: 10 }]);
  });
});
