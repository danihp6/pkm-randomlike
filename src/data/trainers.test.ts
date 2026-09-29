import { describe, expect, it } from 'vitest';
import { TRAINER_ARCHETYPES, TRAINER_ARCHETYPE_IDS, getTrainerArchetype } from './trainers';
import { getSpecies } from './dex/species';

describe('trainer archetypes', () => {
  it('has unique ids and no empty pools', () => {
    expect(new Set(TRAINER_ARCHETYPE_IDS).size).toBe(TRAINER_ARCHETYPES.length);
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.pool.length, archetype.id).toBeGreaterThan(0);
    }
  });

  it('only lists species that exist in the generated dex', () => {
    for (const archetype of TRAINER_ARCHETYPES) {
      for (const speciesId of archetype.pool) {
        expect(getSpecies(speciesId), `${archetype.id}/${speciesId}`).toBeDefined();
      }
    }
  });

  it('looks up by id', () => {
    expect(getTrainerArchetype('bugcatcher')?.name).toBe('Bug Catcher');
    expect(getTrainerArchetype('not-a-class')).toBeUndefined();
  });
});
