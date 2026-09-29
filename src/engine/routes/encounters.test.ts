import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { RouteEncounters, pickWeighted, rollEncounter } from './encounters';
import type { EncounterTable } from '../../data/encounters';

const table: EncounterTable = [
  { speciesId: 'a', weight: 1 },
  { speciesId: 'b', weight: 3 },
];

describe('pickWeighted', () => {
  it('stays inside the table and respects weights over many rolls', () => {
    const rng = new Rng(42);
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) counts[pickWeighted(table, rng).speciesId]++;
    expect(counts.b).toBeGreaterThan(counts.a);
    expect(counts.a + counts.b).toBe(1000);
  });
});

describe('rollEncounter', () => {
  it('always rolls when the chance is 1 and clamps the level to the band', () => {
    const rng = new Rng(7);
    const encounter = rollEncounter(table, 3, 5, rng, 1);
    expect(encounter).toBeDefined();
    expect(['a', 'b']).toContain(encounter!.speciesId);
    expect(encounter!.level).toBeGreaterThanOrEqual(3);
    expect(encounter!.level).toBeLessThanOrEqual(5);
  });

  it('never rolls an empty table', () => {
    expect(rollEncounter([], 1, 5, new Rng(1), 1)).toBeUndefined();
  });
});

describe('RouteEncounters', () => {
  it('is a pure function of table, levels and seed', () => {
    const first = new RouteEncounters(table, 2, 4, new Rng(99), 0.5);
    const second = new RouteEncounters(table, 2, 4, new Rng(99), 0.5);
    const sequence = (roller: RouteEncounters) =>
      Array.from({ length: 20 }, () => roller.step());
    expect(sequence(first)).toEqual(sequence(second));
    expect(first.steps).toBe(20);
  });
});
