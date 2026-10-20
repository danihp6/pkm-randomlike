import { describe, expect, it } from 'vitest';
import { getSpecies } from '../../data/dex/species';
import { LEVEL_BANDS, bandForLevel } from '../../data/run';
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
  rollWildLevel,
  type EncounterTable,
  type EncounterLevelRoll,
} from './encounters';

const table: EncounterTable = [
  { speciesId: 'a', weight: 1 },
  { speciesId: 'b', weight: 3 },
];

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 3 });

/** A roll that reads `level` without spending a draw, for the cases about the species. */
function fixedLevel(level: number): EncounterLevelRoll {
  return () => level;
}

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

describe('rollWildLevel', () => {
  it('stays inside the shipped share of the squad level', () => {
    const rng = new Rng(2024);
    const levels = Array.from({ length: 200 }, () => rollWildLevel(rng, 20, 30));
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(12);
      expect(level).toBeLessThanOrEqual(14);
      expect(level).toBeLessThan(20);
    }
    expect(new Set(levels).size).toBeGreaterThanOrEqual(2);
    const replay = new Rng(2024);
    expect(Array.from({ length: 200 }, () => rollWildLevel(replay, 20, 30))).toEqual(levels);
  });

  it('clamps to the floor cap instead of passing it', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 100; i++) expect(rollWildLevel(rng, 100, 9)).toBe(9);
  });
});

describe('rollEncounter', () => {
  it('always rolls when the chance is 1 and reads the level the caller rolls', () => {
    const rng = new Rng(7);
    const encounter = rollEncounter(table, rng, (levelRng) => rollWildLevel(levelRng, 20, 30), 1);
    expect(encounter).toBeDefined();
    expect(['a', 'b']).toContain(encounter!.speciesId);
    expect(encounter!.level).toBeGreaterThanOrEqual(12);
    expect(encounter!.level).toBeLessThanOrEqual(14);
  });

  it('never rolls an empty table', () => {
    expect(rollEncounter([], new Rng(1), fixedLevel(1), 1)).toBeUndefined();
  });

  it('calls the level roll once per successful encounter and never on a miss', () => {
    let calls = 0;
    const levelFor: EncounterLevelRoll = (levelRng) => {
      calls++;
      return rollWildLevel(levelRng, 20, 30);
    };
    for (let i = 0; i < 10; i++) rollEncounter(table, new Rng(i), levelFor, 1);
    expect(calls).toBe(10);
    for (let i = 0; i < 10; i++) rollEncounter(table, new Rng(i), levelFor, 0);
    expect(calls).toBe(10);
  });
});

describe('RouteEncounters', () => {
  it('is a pure function of the table, the level roll and the seed', () => {
    const roll = (): RouteEncounters =>
      new RouteEncounters(table, new Rng(99), (rng) => rollWildLevel(rng, 20, 30), 0.5);
    const sequence = (roller: RouteEncounters) => Array.from({ length: 20 }, () => roller.step());
    const first = roll();
    expect(sequence(first)).toEqual(sequence(roll()));
    expect(first.steps).toBe(20);
  });

  it('reads the level roll live, so a squad that levels up inside the room moves it', () => {
    let squad = 5;
    const roller = new RouteEncounters(table, new Rng(31), (rng) => rollWildLevel(rng, squad, 30), 1);
    const weak = Array.from({ length: 20 }, () => roller.step()!.level);
    squad = 20;
    const strong = Array.from({ length: 20 }, () => roller.step()!.level);
    expect(weak.every((level) => level === 3)).toBe(true);
    for (const level of strong) {
      expect(level).toBeGreaterThanOrEqual(12);
      expect(level).toBeLessThanOrEqual(14);
    }
    expect(Math.min(...strong)).toBeGreaterThan(Math.max(...weak));
  });

  it('narrows the table live without touching the step count or the stream', () => {
    const three: EncounterTable = [
      { speciesId: 'a', weight: 1 },
      { speciesId: 'b', weight: 1 },
      { speciesId: 'c', weight: 1 },
    ];
    const roller = new RouteEncounters(three, new Rng(77), fixedLevel(1), 1);
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
    const roller = new RouteEncounters(
      band,
      new Rng(11),
      (rng) => rollWildLevel(rng, 4, LEVEL_BANDS[0].maxLevel),
      1,
      undefined,
      everything,
    );
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

describe('wild species window (fixed seed)', () => {
  it('follows the band of the squad level, not the floor\u2019s', () => {
    expect(bandForLevel(5).id).toBe('early');
    expect(bandForLevel(20).id).toBe('mid');
    const early = encounterTableFor(bandForLevel(5));
    const mid = encounterTableFor(bandForLevel(20));
    expect(early).not.toEqual(mid);
    for (const entry of mid) {
      const species = getSpecies(entry.speciesId);
      expect(species, entry.speciesId).toBeDefined();
      expect(species!.bst).toBeGreaterThanOrEqual(356);
      expect(species!.bst).toBeLessThanOrEqual(440);
    }
  });

  it('adds no draw of its own, so a seed rolls the same sequence with an exclusion', () => {
    const band = encounterTableFor(LEVEL_BANDS[0]);
    const levelFor = (rng: Rng): number => rollWildLevel(rng, 4, LEVEL_BANDS[0].maxLevel);
    const plain = new RouteEncounters(band, new Rng(1234), levelFor, 1, undefined, NO_EXCLUSIONS);
    const filtered = new RouteEncounters(
      band,
      new Rng(1234),
      levelFor,
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
      const roller = new RouteEncounters(
        narrowed,
        new Rng(4242),
        (rng) => rollWildLevel(rng, 12, LEVEL_BANDS[1].maxLevel),
        1,
      );
      return Array.from({ length: 300 }, () => roller.step()!.speciesId);
    };
    const first = walk();
    for (const id of first) expect(excluded.has(id), id).toBe(false);
    expect(new Set(first).size).toBeGreaterThan(1);
    expect(walk()).toEqual(first);
  });
});

describe('wild level draw (fixed seed)', () => {
  it('spends one draw on the level, in the slot the level draw used to occupy', () => {
    const rng = new Rng(2024);
    const levels = Array.from(
      { length: 10 },
      () => rollEncounter(table, rng, (levelRng) => rollWildLevel(levelRng, 20, 30), 1)!.level,
    );
    const control = new Rng(2024);
    const expected = Array.from({ length: 10 }, () => {
      control.next();
      control.next();
      return rollWildLevel(control, 20, 30);
    });
    expect(levels).toEqual(expected);
    expect(new Set(levels).size).toBeGreaterThan(1);
  });
});

/** One table entry, the individual drawn from its variant family (`D38`). */
describe('wild variant roll (fixed seed)', () => {
  const VARIANT_TABLE: EncounterTable = [{ speciesId: 'eiscue', weight: 1 }];

  it('rolls the table entry and generates the individual as one of its formes', () => {
    const walk = (): readonly string[] => {
      const roller = new RouteEncounters(
        VARIANT_TABLE,
        new Rng(24),
        (rng) => rollWildLevel(rng, 20, 30),
        1,
      );
      return Array.from({ length: 40 }, () => roller.step()!.speciesId);
    };
    const first = walk();
    for (const id of first) expect(['eiscue', 'eiscuenoice']).toContain(id);
    expect(new Set(first).size).toBeGreaterThan(1);
    expect(walk()).toEqual(first);
  });

  it('spends its level draw after the species pick, never in the variant stream', () => {
    const roller = new RouteEncounters(
      VARIANT_TABLE,
      new Rng(4321),
      (rng) => rollWildLevel(rng, 20, 30),
      1,
    );
    const levels = Array.from({ length: 10 }, () => roller.step()!.level);
    const control = new Rng(4321);
    const expected = Array.from({ length: 10 }, () => {
      control.next();
      control.next();
      return rollWildLevel(control, 20, 30);
    });
    expect(levels).toEqual(expected);
    expect(new Set(levels).size).toBeGreaterThan(1);
  });

  it('returns the table entry itself without a variant stream', () => {
    const encounter = rollEncounter(VARIANT_TABLE, new Rng(7), (rng) => rollWildLevel(rng, 3, 5), 1);
    expect(encounter!.speciesId).toBe('eiscue');
  });

  it('keeps the whole band table at one entry per variant species', () => {
    const band = LEVEL_BANDS[3];
    const table = encounterTableFor(band);
    const ids = table.map((entry) => entry.speciesId);
    expect(ids).toContain('eiscue');
    expect(ids).not.toContain('eiscuenoice');
    const roller = new RouteEncounters(
      table,
      new Rng(13),
      (rng) => rollWildLevel(rng, 20, band.maxLevel),
      1,
    );
    const walk = Array.from({ length: 2000 }, () => roller.step()!).map((entry) => entry.speciesId);
    expect(walk).toContain('eiscuenoice');
    for (const id of walk) expect(getSpecies(id), id).toBeDefined();
  });
});
