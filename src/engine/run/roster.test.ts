import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../data/dex';
import { bandForRoute } from '../../data/run';
import { getTrainerArchetype } from '../../data/trainers';
import { Rng } from '../rng';
import { trainerRoster } from './roster';

const youngster = getTrainerArchetype('youngster')!;

describe('trainerRoster', () => {
  it('is deterministic for the same Rng seed', () => {
    const band = bandForRoute(9);
    const a = trainerRoster(youngster, band, new Rng(1234), 't1');
    const b = trainerRoster(youngster, band, new Rng(1234), 't1');
    expect(a).toEqual(b);
  });

  it('fills the band party size with distinct, in-band species', () => {
    const band = bandForRoute(40);
    const roster = trainerRoster(youngster, band, new Rng(7), 't1');
    expect(roster).toHaveLength(band.trainerSize);
    expect(new Set(roster.map((entry) => entry.speciesId)).size).toBe(roster.length);
    for (const entry of roster) {
      expect(getSpecies(entry.speciesId)).toBeDefined();
      expect(entry.level).toBeGreaterThanOrEqual(band.minLevel);
      expect(entry.level).toBeLessThanOrEqual(band.maxLevel);
      expect(entry.id).toMatch(/^t1:/);
    }
  });

  it('draws from the archetype pool', () => {
    const band = bandForRoute(1);
    const roster = trainerRoster(youngster, band, new Rng(3), 't1');
    expect(youngster.pool).toContain(roster[0].speciesId);
  });
});
