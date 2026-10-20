import { describe, expect, it } from 'vitest';
import { getSpecies } from './dex';
import { evolutionDepth } from './dex/evolutions';
import { FINITE_MAPS } from './maps';
import {
  LEVEL_BANDS,
  RUN_CHAIN,
  STARTER_POOL_SIZE,
  STARTING_BAG,
  TRAINER_XP_PER_MAP,
  bandForLevel,
  starterCandidates,
  trainerXpMultiplierForMap,
} from './run';

describe('level bands', () => {
  it('picks the band a level floor falls in and clamps at the ends', () => {
    expect(bandForLevel(0).id).toBe('early');
    expect(bandForLevel(2).id).toBe('early');
    expect(bandForLevel(8).id).toBe('early');
    expect(bandForLevel(9).id).toBe('low');
    expect(bandForLevel(16).id).toBe('mid');
    expect(bandForLevel(23).id).toBe('high');
    expect(bandForLevel(30).id).toBe('late');
    expect(bandForLevel(37).id).toBe('end');
    expect(bandForLevel(55).id).toBe('end');
    expect(bandForLevel(999).id).toBe('end');
  });

  it('keeps band levels monotonically rising', () => {
    for (let i = 1; i < LEVEL_BANDS.length; i++) {
      expect(LEVEL_BANDS[i].minLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].minLevel);
      expect(LEVEL_BANDS[i].maxLevel).toBeGreaterThan(LEVEL_BANDS[i - 1].maxLevel);
    }
  });

  it('gives every band a finite, positive trainer XP multiplier', () => {
    for (const band of LEVEL_BANDS) {
      expect(Number.isFinite(band.trainerXp), band.id).toBe(true);
      expect(band.trainerXp, band.id).toBeGreaterThan(0);
      expect(band.trainerXp, band.id).toBe(Math.round(band.trainerXp * 100) / 100);
    }
  });
});

describe('trainer XP per floor', () => {
  it('carries one finite two-decimal factor per finite map', () => {
    expect(TRAINER_XP_PER_MAP.length).toBe(FINITE_MAPS);
    for (const [index, factor] of TRAINER_XP_PER_MAP.entries()) {
      expect(Number.isFinite(factor), `map ${index + 1}`).toBe(true);
      expect(factor, `map ${index + 1}`).toBeGreaterThan(0);
      expect(factor, `map ${index + 1}`).toBe(Math.round(factor * 100) / 100);
    }
  });

  it('reads the row of the floor and clamps at both ends', () => {
    for (const mapIndex of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(trainerXpMultiplierForMap(mapIndex), `map ${mapIndex}`).toBe(
        TRAINER_XP_PER_MAP[mapIndex - 1],
      );
    }
    expect(trainerXpMultiplierForMap(0)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(-3)).toBe(TRAINER_XP_PER_MAP[0]);
    expect(trainerXpMultiplierForMap(FINITE_MAPS)).toBe(TRAINER_XP_PER_MAP[FINITE_MAPS - 1]);
    expect(trainerXpMultiplierForMap(FINITE_MAPS + 5)).toBe(TRAINER_XP_PER_MAP[FINITE_MAPS - 1]);
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
