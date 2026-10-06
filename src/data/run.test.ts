import { describe, expect, it } from 'vitest';
import { getSpecies } from './dex';
import { evolutionFamily } from './dex/evolutions';
import {
  LEVEL_BANDS,
  ROUTES_PER_BAND,
  RUN_CHAIN,
  STARTER_POOL_SIZE,
  STARTING_BAG,
  bandForRoute,
  levelCapForRoute,
  starterCandidates,
} from './run';

describe('level bands', () => {
  it('walks the bands every ROUTES_PER_BAND routes and clamps at the ends', () => {
    expect(bandForRoute(1).id).toBe('early');
    expect(bandForRoute(ROUTES_PER_BAND).id).toBe('early');
    expect(bandForRoute(ROUTES_PER_BAND + 1).id).toBe('low');
    expect(bandForRoute(999).id).toBe('end');
    expect(bandForRoute(0).id).toBe('early');
  });

  it('derives the route level cap from its band', () => {
    expect(levelCapForRoute(1)).toBe(LEVEL_BANDS[0].maxLevel);
    expect(levelCapForRoute(999)).toBe(LEVEL_BANDS[LEVEL_BANDS.length - 1].maxLevel);
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
  it('names base forms whose line has at least three members', () => {
    const candidates = starterCandidates();
    expect(candidates.length).toBeGreaterThanOrEqual(STARTER_POOL_SIZE);
    for (const id of candidates) {
      const species = getSpecies(id);
      expect(species, id).toBeDefined();
      expect(species!.prevo, id).toBe('');
      expect(evolutionFamily(id).length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('includes the classic starters and leaves out two-stage lines', () => {
    const candidates = starterCandidates();
    for (const id of ['bulbasaur', 'charmander', 'squirtle', 'chikorita', 'eevee', 'dratini']) {
      expect(candidates, id).toContain(id);
    }
    // Two-stage lines and fully evolved Pokémon are never offered.
    expect(candidates).not.toContain('ivysaur');
    expect(candidates).not.toContain('venusaur');
    expect(candidates).not.toContain('rattata');
  });

  it('opens the bag empty: items come from the route economy, not a starting kit', () => {
    expect(STARTING_BAG).toEqual([]);
  });
});
