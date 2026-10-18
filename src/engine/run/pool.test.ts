import { describe, expect, it } from 'vitest';
import { getSpecies, playableSpecies } from '../../data/dex/species';
import { LEVEL_BANDS, bossBstWindow } from '../../data/run';
import { encounterTableFor } from '../routes/encounters';
import { WILD_BANNED_TAGS, speciesPool, wildExclusions } from './pool';
import { createRunPokemon } from './progression';
import { createRun, type RunState } from './state';

const wildIds = (): readonly string[] => LEVEL_BANDS.flatMap((band) => speciesPool(band, 'wild'));
const trainerIds = (): readonly string[] => LEVEL_BANDS.flatMap((band) => speciesPool(band, 'trainer'));

const spawnable = () => playableSpecies().filter((species) => species.battleOnly === undefined);

const starter = createRunPokemon({ id: 'starter', speciesId: 'charmander', level: 3 });

/** A run whose caught record is set directly: `wildExclusions` reads only that field. */
function runWithCaught(caughtSpecies: readonly string[]): RunState {
  return { ...createRun({ seed: 'pool-a', starter }), caughtSpecies };
}

describe('speciesPool', () => {
  it('fills every band with both a wild and a trainer pool', () => {
    for (const band of LEVEL_BANDS) {
      expect(speciesPool(band, 'wild').length, `${band.id} wild`).toBeGreaterThan(0);
      expect(speciesPool(band, 'trainer').length, `${band.id} trainer`).toBeGreaterThan(0);
    }
  });

  it('never spawns a battle-only forme', () => {
    const spawning = new Set([...wildIds(), ...trainerIds()]);
    for (const species of playableSpecies()) {
      if (species.battleOnly !== undefined) {
        expect(spawning.has(species.id), species.id).toBe(false);
      }
    }
  });

  it('bans legendary and mythical species from the wild only', () => {
    const wild = wildIds();
    for (const species of playableSpecies()) {
      if (WILD_BANNED_TAGS.some((tag) => species.tags.includes(tag))) {
        expect(wild, species.id).not.toContain(species.id);
      }
    }
    // A trainer may field them: the top band carries the high-BST legendaries.
    expect(speciesPool(LEVEL_BANDS[5], 'trainer')).toContain('zacian');
    expect(speciesPool(LEVEL_BANDS[5], 'trainer')).toContain('mewtwo');
  });

  it('lets a Paradox Pokémon spawn in the grass (it is neither legendary nor mythical)', () => {
    expect(speciesPool(LEVEL_BANDS[5], 'wild')).toContain('greattusk');
  });

  it('covers the whole dex across the bands: wild all but the banned tags', () => {
    const expected = spawnable()
      .filter((species) => !WILD_BANNED_TAGS.some((tag) => species.tags.includes(tag)))
      .map((species) => species.id);
    const actual = new Set(wildIds());
    expect(actual.size).toBe(expected.length);
    for (const id of expected) expect(actual.has(id), id).toBe(true);
  });

  it('covers the whole dex across the bands: trainers include every spawnable species', () => {
    const expected = spawnable().map((species) => species.id);
    const actual = new Set(trainerIds());
    expect(actual.size).toBe(expected.length);
    for (const id of expected) expect(actual.has(id), id).toBe(true);
  });

  it('tiles the BST space: contiguous, gap-free, ascending windows', () => {
    for (let i = 0; i < LEVEL_BANDS.length; i++) {
      const band = LEVEL_BANDS[i];
      expect(band.bst.min).toBeLessThanOrEqual(band.bst.max);
      if (i > 0) {
        const previous = LEVEL_BANDS[i - 1];
        expect(band.bst.min, `${previous.id}->${band.id}`).toBe(previous.bst.max + 1);
      }
    }
  });

  it('keeps every pool inside its band BST window', () => {
    for (const band of LEVEL_BANDS) {
      for (const id of speciesPool(band, 'trainer')) {
        const bst = getSpecies(id)!.bst;
        expect(bst, `${band.id}/${id}`).toBeGreaterThanOrEqual(band.bst.min);
        expect(bst, `${band.id}/${id}`).toBeLessThanOrEqual(band.bst.max);
      }
    }
  });

  it('raises a boss to the upper half of the band window', () => {
    for (const band of LEVEL_BANDS) {
      const window = bossBstWindow(band);
      const expected = spawnable()
        .filter((species) => species.bst >= window.min && species.bst <= window.max)
        .map((species) => species.id);
      const actual = new Set(speciesPool(band, 'trainer', { boss: true }));
      expect(actual.size, band.id).toBe(expected.length);
      for (const id of expected) expect(actual.has(id), `${band.id}/${id}`).toBe(true);
    }
  });
});

describe('encounterTableFor', () => {
  it('builds a positive, weighted wild table for every band', () => {
    for (const band of LEVEL_BANDS) {
      const table = encounterTableFor(band);
      expect(table.length, band.id).toBeGreaterThan(0);
      for (const entry of table) {
        expect(entry.weight, entry.speciesId).toBeGreaterThan(0);
        expect(getSpecies(entry.speciesId), entry.speciesId).toBeDefined();
      }
    }
  });

  it('matches the band wild pool', () => {
    const band = LEVEL_BANDS[3];
    expect(encounterTableFor(band).map((entry) => entry.speciesId)).toEqual([
      ...speciesPool(band, 'wild'),
    ]);
  });
});

describe('wildExclusions', () => {
  it('is empty for a run that has caught nothing', () => {
    expect(wildExclusions(createRun({ seed: 'pool-a', starter })).size).toBe(0);
  });

  it('expands a caught species to its whole line and its formes', () => {
    const excluded = wildExclusions(runWithCaught(['pikachu']));
    for (const id of ['pichu', 'pikachu', 'raichu', 'raichualola']) {
      expect(excluded.has(id), id).toBe(true);
    }
  });

  it('reaches the hand-authored appliances of a caught rotom', () => {
    const excluded = wildExclusions(runWithCaught(['rotom']));
    for (const id of ['rotomheat', 'rotomwash', 'rotomfrost', 'rotomfan', 'rotommow']) {
      expect(excluded.has(id), id).toBe(true);
    }
  });

  it('contributes nothing for an unknown recorded id', () => {
    expect(wildExclusions(runWithCaught(['not-a-species'])).size).toBe(0);
  });
});
