import { describe, expect, it } from 'vitest';
import { megaFormsForBase } from '../../data/dex/megas';
import { getSpecies } from '../../data/dex/species';
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
    for (const entry of trainerRoster(early, new Rng(3), 't1')) expect(earlyPool).toContain(entry.speciesId);
    for (const entry of trainerRoster(end, new Rng(3), 't1')) expect(endPool).toContain(entry.speciesId);
    expect(getSpecies(endPool[0])!.bst).toBeGreaterThan(getSpecies(earlyPool[0])!.bst);
  });

  it('raises a boss to the upper half of the band window', () => {
    const pool = speciesPool(end, 'trainer', { boss: true });
    const roster = trainerRoster(end, new Rng(11), 'boss', { boss: true });
    for (const entry of roster) expect(pool).toContain(entry.speciesId);
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
