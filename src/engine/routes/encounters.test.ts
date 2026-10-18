import { describe, expect, it } from 'vitest';
import { LEVEL_BANDS } from '../../data/run';
import { Rng } from '../rng';
import { speciesPool, wildExclusions } from '../run/pool';
import { createRunPokemon } from '../run/progression';
import { createRun, type RunState } from '../run/state';
import {
  NO_EXCLUSIONS,
  RouteEncounters,
  encounterTableFor,
  pickWeighted,
  rollEncounter,
  type EncounterTable,
} from './encounters';

const table: EncounterTable = [
  { speciesId: 'a', weight: 1 },
  { speciesId: 'b', weight: 3 },
];

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 3 });

/** A run whose caught record is set directly: `wildExclusions` reads only that field. */
function runWithCaught(caughtSpecies: readonly string[]): RunState {
  return { ...createRun({ seed: 'enc-a', starter }), caughtSpecies };
}

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
    const sequence = (roller: RouteEncounters) => Array.from({ length: 20 }, () => roller.step());
    expect(sequence(first)).toEqual(sequence(second));
    expect(first.steps).toBe(20);
  });

  it('narrows the table live without touching the step count or the stream', () => {
    const three: EncounterTable = [
      { speciesId: 'a', weight: 1 },
      { speciesId: 'b', weight: 1 },
      { speciesId: 'c', weight: 1 },
    ];
    const roller = new RouteEncounters(three, 1, 1, new Rng(77), 1);
    expect(roller.currentTable().map((entry) => entry.speciesId)).toHaveLength(3);
    roller.setExclusions(new Set(['b', 'c']));
    expect(roller.currentTable().map((entry) => entry.speciesId)).toEqual(['a']);
    const rolled = Array.from({ length: 20 }, () => roller.step()!.speciesId);
    expect(rolled.every((id) => id === 'a')).toBe(true);
    expect(roller.steps).toBe(20);
    roller.setExclusions(NO_EXCLUSIONS);
    expect(roller.currentTable().map((entry) => entry.speciesId)).toEqual(['a', 'b', 'c']);
  });

  it('keeps rolling when the exclusions cover the whole table', () => {
    const band = encounterTableFor(LEVEL_BANDS[0]);
    const everything = new Set(band.map((entry) => entry.speciesId));
    const roller = new RouteEncounters(band, 4, 4, new Rng(11), 1, undefined, everything);
    for (let i = 0; i < 20; i++) expect(roller.step()).toBeDefined();
  });
});

describe('encounterTableFor', () => {
  it('matches the band wild pool in order', () => {
    const ids = encounterTableFor(LEVEL_BANDS[0]).map((entry) => entry.speciesId);
    expect(ids).toContain('pichu');
    expect(ids).toEqual([...speciesPool(LEVEL_BANDS[0], 'wild')]);
  });

  it('drops a caught line and its formes from every band it would appear in', () => {
    const excluded = wildExclusions(runWithCaught(['pikachu']));
    const early = encounterTableFor(LEVEL_BANDS[0], excluded).map((entry) => entry.speciesId);
    expect(early).not.toContain('pichu');
    expect(early.length).toBeGreaterThan(0);
    const low = encounterTableFor(LEVEL_BANDS[1], excluded).map((entry) => entry.speciesId);
    expect(low).not.toContain('pikachu');
    expect(low.length).toBeGreaterThan(0);
    const high = encounterTableFor(LEVEL_BANDS[3], excluded).map((entry) => entry.speciesId);
    expect(high).not.toContain('raichu');
    expect(high).not.toContain('raichualola');
    expect(high.length).toBeGreaterThan(0);
  });

  it('falls back to the unfiltered band when the exclusions would empty it', () => {
    for (const band of LEVEL_BANDS) {
      const everything = new Set(speciesPool(band, 'wild'));
      expect(encounterTableFor(band, everything), band.id).toEqual(encounterTableFor(band));
    }
  });
});

describe('wild encounter filtering (fixed seed)', () => {
  it('adds no draw, so a seed rolls the same sequence with and without an exclusion', () => {
    const band = encounterTableFor(LEVEL_BANDS[0]);
    const plain = new RouteEncounters(band, 4, 4, new Rng(1234), 1, undefined, NO_EXCLUSIONS);
    const filtered = new RouteEncounters(
      band,
      4,
      4,
      new Rng(1234),
      1,
      undefined,
      new Set(['not-a-species']),
    );
    const walk = (roller: RouteEncounters): (string | undefined)[] =>
      Array.from({ length: 40 }, () => roller.step()?.speciesId);
    expect(walk(filtered)).toEqual(walk(plain));
    expect(plain.steps).toBe(40);
    expect(filtered.steps).toBe(40);
  });

  it('never rolls a line the run already caught, over a long walk', () => {
    const excluded = wildExclusions(runWithCaught(['pikachu']));
    const narrowed = encounterTableFor(LEVEL_BANDS[1], excluded);
    const walk = (): readonly string[] => {
      const roller = new RouteEncounters(narrowed, 9, 9, new Rng(4242), 1);
      return Array.from({ length: 300 }, () => roller.step()!.speciesId);
    };
    const first = walk();
    for (const id of first) expect(excluded.has(id), id).toBe(false);
    expect(new Set(first).size).toBeGreaterThan(1);
    expect(walk()).toEqual(first);
  });
});
