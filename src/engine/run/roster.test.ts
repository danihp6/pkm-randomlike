import { describe, expect, it } from 'vitest';
import { megaFormsForBase } from '../../data/dex/megas';
import { getSpecies, normalizeId } from '../../data/dex/species';
import { LEVEL_BANDS } from '../../data/run';
import { Rng } from '../rng';
import { speciesPool } from './pool';
import { assignMegaStone, trainerRoster, type RosterEntry } from './roster';

const early = LEVEL_BANDS[0];
const end = LEVEL_BANDS[5];

describe('trainerRoster', () => {
  it('is deterministic for the same Rng seed', () => {
    const a = trainerRoster(LEVEL_BANDS[2], new Rng(1234), 't1');
    const b = trainerRoster(LEVEL_BANDS[2], new Rng(1234), 't1');
    expect(a).toEqual(b);
  });

  it('fills the band party size with distinct, in-band species', () => {
    const roster = trainerRoster(end, new Rng(7), 't1');
    expect(roster).toHaveLength(end.trainerSize);
    expect(new Set(roster.map((entry) => entry.speciesId)).size).toBe(roster.length);
    for (const entry of roster) {
      expect(getSpecies(entry.speciesId)).toBeDefined();
      expect(entry.level).toBeGreaterThanOrEqual(end.minLevel);
      expect(entry.level).toBeLessThanOrEqual(end.maxLevel);
      expect(entry.id).toMatch(/^t1:/);
    }
  });

  it('draws from the band BST pool, the same one every archetype uses', () => {
    const pool = speciesPool(end, 'trainer');
    const roster = trainerRoster(end, new Rng(3), 't1');
    for (const entry of roster) expect(pool).toContain(entry.speciesId);
  });

  it('climbs the BST window with the band', () => {
    const earlyPool = speciesPool(early, 'trainer');
    const endPool = speciesPool(end, 'trainer');
    for (const entry of trainerRoster(early, new Rng(3), 't1'))
      expect(earlyPool).toContain(entry.speciesId);
    for (const entry of trainerRoster(end, new Rng(3), 't1')) expect(endPool).toContain(entry.speciesId);
    expect(getSpecies(endPool[0])!.bst).toBeGreaterThan(getSpecies(earlyPool[0])!.bst);
  });

  it('raises a boss to the upper half of the band window', () => {
    const pool = speciesPool(end, 'trainer', { boss: true });
    const roster = trainerRoster(end, new Rng(11), 'boss', { boss: true });
    for (const entry of roster) expect(pool).toContain(entry.speciesId);
  });

  it('overrides the band party size with count', () => {
    const roster = trainerRoster(end, new Rng(7), 't1', { count: 6 });
    expect(roster).toHaveLength(6);
    expect(roster.map((entry) => entry.id)).toEqual(['t1:0', 't1:1', 't1:2', 't1:3', 't1:4', 't1:5']);
    expect(roster.length).toBeGreaterThan(end.trainerSize);
  });

  it('clamps count to at least one member', () => {
    expect(trainerRoster(end, new Rng(7), 't1', { count: 0 })).toHaveLength(1);
    expect(trainerRoster(end, new Rng(7), 't1', { count: -3 })).toHaveLength(1);
  });

  it('repeats species once the count passes the pool', () => {
    const pool = speciesPool(end, 'trainer');
    const count = pool.length + 3;
    const roster = trainerRoster(end, new Rng(5), 't1', { count });
    expect(roster).toHaveLength(count);
    for (const entry of roster) expect(getSpecies(entry.speciesId)).toBeDefined();
    expect(new Set(roster.map((entry) => entry.speciesId)).size).toBeLessThanOrEqual(pool.length);
  });

  it('draws a fixed boss party from the boss window, stable for a fixed Rng', () => {
    const pool = speciesPool(end, 'trainer', { boss: true });
    const build = (): readonly RosterEntry[] =>
      trainerRoster(end, new Rng(42), 'boss', { boss: true, count: 6 });
    const roster = build();
    expect(roster).toHaveLength(6);
    expect(roster).toEqual(build());
    for (const entry of roster) {
      expect(pool).toContain(entry.speciesId);
      expect(entry.level).toBeGreaterThanOrEqual(end.minLevel);
      expect(entry.level).toBeLessThanOrEqual(end.maxLevel);
    }
  });

  it('appends when the count grows, so the stream keeps its prefix', () => {
    const short = trainerRoster(end, new Rng(21), 't1', { count: 3 });
    const long = trainerRoster(end, new Rng(21), 't1', { count: 6 });
    expect(long.slice(0, 3)).toEqual(short);
  });

  it('still hands out at most one Mega Stone with a count', () => {
    const roster = trainerRoster(end, new Rng(9), 'boss', {
      allowMega: true,
      boss: true,
      count: 6,
    });
    const held = roster.filter((entry) => entry.heldItem !== undefined);
    expect(held.length).toBeLessThanOrEqual(1);
  });
});

describe('trainerRoster Mega Stones', () => {
  it('gives no stone unless asked', () => {
    const roster = trainerRoster(end, new Rng(9), 't1');
    expect(roster.every((entry) => entry.heldItem === undefined)).toBe(true);
  });

  it('gives at most one stone, only to a Mega-capable member, deterministically', () => {
    const pick = (): readonly string[] =>
      trainerRoster(end, new Rng(9), 't1', { allowMega: true })
        .map((entry) => entry.heldItem)
        .filter((id): id is string => id !== undefined);
    const held = pick();
    expect(held).toEqual(pick());
    expect(held.length).toBeLessThanOrEqual(1);
  });
});

describe('trainerRoster variant roll (fixed seed)', () => {
  const band = LEVEL_BANDS[2];
  const FAMILIES: Readonly<Record<string, readonly string[]>> = {
    eiscue: ['eiscue', 'eiscuenoice'],
    morpeko: ['morpeko', 'morpekohangry'],
    minior: ['minior', 'miniormeteor'],
  };

  it('draws the band exactly as before, its individuals being variant formes', () => {
    const roster = trainerRoster(band, new Rng(6), 't1', { count: 10 });
    expect(roster).toEqual(trainerRoster(band, new Rng(6), 't1', { count: 10 }));

    const pool = speciesPool(band, 'trainer');
    const control = new Rng(6);
    const remaining = [...pool];
    let flipped = 0;
    for (const entry of roster) {
      const picked = remaining.splice(control.int(0, remaining.length - 1), 1)[0];
      expect(entry.level, entry.id).toBe(control.int(band.minLevel, band.maxLevel));
      const family = FAMILIES[picked];
      if (family === undefined) {
        expect(entry.speciesId, entry.id).toBe(picked);
      } else {
        expect(family, entry.id).toContain(entry.speciesId);
        if (entry.speciesId !== picked) flipped += 1;
      }
    }
    expect(flipped).toBeGreaterThan(0);
    expect(roster.map((entry) => entry.speciesId)).toContain('morpekohangry');
  });

  it('leaves every entry a member of the band pool or the forme of one', () => {
    const pool = speciesPool(band, 'trainer');
    const roster = trainerRoster(band, new Rng(6), 't1', { count: 10 });
    for (const entry of roster) {
      const base = getSpecies(entry.speciesId)!.battleOnly;
      const inPool = typeof base === 'string' ? normalizeId(base) : entry.speciesId;
      expect(pool, entry.id).toContain(inPool);
    }
  });

  it('still hands out at most one Mega Stone with the roll in place', () => {
    const roster = trainerRoster(band, new Rng(6), 'boss', { count: 10, allowMega: true });
    const held = roster.filter((entry) => entry.heldItem !== undefined);
    expect(held.length).toBeLessThanOrEqual(1);
    expect(roster).toEqual(trainerRoster(band, new Rng(6), 'boss', { count: 10, allowMega: true }));
  });
});

describe('trainerRoster levelFor', () => {
  it('carries the callback level on every member, once per member', () => {
    const sizes: number[] = [];
    const roster = trainerRoster(end, new Rng(7), 't1', {
      levelFor: (size) => {
        sizes.push(size);
        return 12;
      },
    });
    expect(roster).toHaveLength(4);
    expect(roster.map((entry) => entry.level)).toEqual([12, 12, 12, 12]);
    expect(roster.map((entry) => entry.id)).toEqual(['t1:0', 't1:1', 't1:2', 't1:3']);
    expect(sizes).toEqual([4, 4, 4, 4]);
  });

  it('passes the overridden count as the size', () => {
    const sizes: number[] = [];
    const roster = trainerRoster(end, new Rng(7), 't1', {
      count: 2,
      levelFor: (size) => {
        sizes.push(size);
        return 30;
      },
    });
    expect(roster).toHaveLength(2);
    expect(sizes).toEqual([2, 2]);
  });

  it('builds the identical roster twice from the same seed', () => {
    const build = (): readonly RosterEntry[] =>
      trainerRoster(LEVEL_BANDS[5], new Rng(7), 't1', { levelFor: () => 12 });
    expect(build()).toEqual(build());
  });

  it('pins the fixed-seed roster it builds (LEVEL_BANDS[5], Rng(7), levelFor 12)', () => {
    // Read off this build: without the level draw the species stream runs ahead,
    // so the picks differ from the no-`levelFor` roster from the second member on.
    const roster = trainerRoster(LEVEL_BANDS[5], new Rng(7), 't1', { levelFor: () => 12 });
    expect(roster.map(({ id, speciesId, level }) => ({ id, speciesId, level }))).toEqual([
      { id: 't1:0', speciesId: 'arcanine', level: 12 },
      { id: 't1:1', speciesId: 'moltres', level: 12 },
      { id: 't1:2', speciesId: 'archaludon', level: 12 },
      { id: 't1:3', speciesId: 'celesteela', level: 12 },
    ]);
  });
});

describe('assignMegaStone', () => {
  it('gives a lone Mega species its stone', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'garchomp', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(roster[0].heldItem).toBe('garchompite');
  });

  it('picks a form for a two-Mega species, deterministically', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'charizard', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(['charizarditex', 'charizarditey']).toContain(roster[0].heldItem);
  });

  it('leaves a roster with no Mega-capable species alone', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'sentret', level: 3 }];
    assignMegaStone(roster, new Rng(1));
    expect(roster[0].heldItem).toBeUndefined();
  });

  it('assigns a stone a species with a Mega can actually use', () => {
    const roster: RosterEntry[] = [{ id: 't:0', speciesId: 'garchomp', level: 40 }];
    assignMegaStone(roster, new Rng(4));
    expect(megaFormsForBase('garchomp').map((form) => form.stoneId)).toContain(roster[0].heldItem);
  });
});
