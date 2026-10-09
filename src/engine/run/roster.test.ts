import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../data/dex';
import { LEVEL_BANDS } from '../../data/run';
import { getTrainerArchetype } from '../../data/trainers';
import { Rng } from '../rng';
import { trainerRoster } from './roster';

const youngster = getTrainerArchetype('youngster')!;

describe('trainerRoster', () => {
  it('is deterministic for the same Rng seed', () => {
    const band = LEVEL_BANDS[2];
    const a = trainerRoster(youngster, band, new Rng(1234), 't1');
    const b = trainerRoster(youngster, band, new Rng(1234), 't1');
    expect(a).toEqual(b);
  });

  it('fills the band party size with distinct, in-band species', () => {
    const band = LEVEL_BANDS[5];
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
    const band = LEVEL_BANDS[0];
    const roster = trainerRoster(youngster, band, new Rng(3), 't1');
    expect(youngster.pools[band.id]).toContain(roster[0].speciesId);
    expect(youngster.pools.early).toContain(roster[0].speciesId);
  });

  it('uses a later pool at a later band', () => {
    const end = LEVEL_BANDS[5];
    const roster = trainerRoster(youngster, end, new Rng(3), 't1');
    for (const entry of roster) {
      expect(youngster.pools.end).toContain(entry.speciesId);
    }
  });
});

describe('trainerRoster Mega Stones', () => {
  const ace = getTrainerArchetype('ace')!;
  const allBands = (species: string): typeof ace => ({
    ...ace,
    pools: {
      early: [species],
      low: [species],
      mid: [species],
      high: [species],
      late: [species],
      end: [species],
    },
  });

  it('gives an eligible member its stone only when asked', () => {
    const band = LEVEL_BANDS[5];
    const plain = trainerRoster(allBands('garchomp'), band, new Rng(9), 't1');
    expect(plain.every((entry) => entry.heldItem === undefined)).toBe(true);

    const mega = trainerRoster(allBands('garchomp'), band, new Rng(9), 't1', { allowMega: true });
    const held = mega.filter((entry) => entry.heldItem !== undefined);
    expect(held).toHaveLength(1);
    expect(held[0].heldItem).toBe('garchompite');
  });

  it('is deterministic and picks a form for a two-Mega species', () => {
    const band = LEVEL_BANDS[5];
    const pick = (): readonly string[] =>
      trainerRoster(allBands('charizard'), band, new Rng(4), 't1', { allowMega: true })
        .map((entry) => entry.heldItem)
        .filter((id): id is string => id !== undefined);
    const first = pick();
    expect(first).toEqual(pick());
    expect(first).toHaveLength(1);
    expect(['charizarditex', 'charizarditey']).toContain(first[0]);
  });

  it('leaves a roster with no Mega-capable species alone', () => {
    const band = LEVEL_BANDS[0];
    const roster = trainerRoster(youngster, band, new Rng(1), 't1', { allowMega: true });
    expect(roster.every((entry) => entry.heldItem === undefined)).toBe(true);
  });
});
