import { describe, expect, it } from 'vitest';
import { evolutionFamily } from '../../data/dex/evolutions';
import { starterCandidates } from '../../data/run';
import { Rng } from '../rng';
import { rollStarterPool } from './starters';

describe('starter roll', () => {
  it('draws distinct base forms of three-stage lines', () => {
    const candidates = starterCandidates();
    const pool = rollStarterPool(new Rng(12345), 3);
    expect(pool).toHaveLength(3);
    expect(new Set(pool).size).toBe(3);
    for (const id of pool) {
      expect(candidates, id).toContain(id);
      expect(evolutionFamily(id).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('is reproducible for a given seed', () => {
    expect(rollStarterPool(new Rng(7), 3)).toEqual(rollStarterPool(new Rng(7), 3));
  });

  it('varies across seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      seen.add(rollStarterPool(new Rng(seed), 3).join(','));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never asks for more starters than the candidate pool holds', () => {
    expect(rollStarterPool(new Rng(3), 10_000).length).toBe(starterCandidates().length);
  });
});
