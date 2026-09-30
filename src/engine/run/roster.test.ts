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

  it('draws from the archetype pool for the route band', () => {
    const band = bandForRoute(1);
    const roster = trainerRoster(youngster, band, new Rng(3), 't1');
    expect(youngster.pools[band.id]).toContain(roster[0].speciesId);
    expect(youngster.pools.early).toContain(roster[0].speciesId);
  });

  it('uses a later pool at a later band', () => {
    const end = bandForRoute(40);
    const roster = trainerRoster(youngster, end, new Rng(3), 't1');
    for (const entry of roster) {
      expect(youngster.pools.end).toContain(entry.speciesId);
    }
  });
});
