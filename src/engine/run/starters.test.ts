import { describe, expect, it } from 'vitest';
import { evolutionDepth } from '../../data/dex/evolutions';
import { starterCandidates } from '../../data/run';
import { Rng, rngFromSeed } from '../rng';
import { rollStarterPool, starterOffer } from './starters';

describe('starter roll', () => {
  it('draws distinct base forms with two consecutive evolutions ahead', () => {
    const candidates = starterCandidates();
    const pool = rollStarterPool(new Rng(12345), 3);
    expect(pool).toHaveLength(3);
    expect(new Set(pool).size).toBe(3);
    for (const id of pool) {
      expect(candidates, id).toContain(id);
      expect(evolutionDepth(id)).toBeGreaterThanOrEqual(2);
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

describe('starterOffer', () => {
  it('pins the offer two fixed seeds show, so a reroll path stays reproducible', () => {
    expect(starterOffer('alpha')).toEqual(['happiny', 'nidoranf', 'tinkatink']);
    expect(starterOffer('bravo')).toEqual(['gothita', 'terapagos', 'popplio']);
  });

  it('is a pure function of the seed alone', () => {
    expect(starterOffer('alpha')).toEqual(starterOffer('alpha'));
    expect(starterOffer('alpha')).not.toEqual(starterOffer('bravo'));
  });

  it('takes its stream from the seed it is given', () => {
    expect(starterOffer('alpha')).toEqual(rollStarterPool(rngFromSeed('alpha:starters')));
  });

  it('honours the count it is asked for, like the roll it wraps', () => {
    expect(starterOffer('alpha', 2)).toEqual(starterOffer('alpha').slice(0, 2));
    expect(starterOffer('alpha', 10_000).length).toBe(starterCandidates().length);
  });
});
