import { describe, expect, it } from 'vitest';
import { TRAINER_ARCHETYPES, TRAINER_ARCHETYPE_IDS, getTrainerArchetype } from './trainers';
import trainerSpriteManifest from './frlg/trainers.json';

describe('trainer archetypes', () => {
  it('has unique ids', () => {
    expect(new Set(TRAINER_ARCHETYPE_IDS).size).toBe(TRAINER_ARCHETYPES.length);
  });

  it('looks up by id', () => {
    expect(getTrainerArchetype('bugcatcher')?.name).toBe('Bug Catcher');
    expect(getTrainerArchetype('not-a-class')).toBeUndefined();
  });

  it('names a battle sprite for every archetype', () => {
    const names = new Set<string>();
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.battleSprite, archetype.id).toBeTruthy();
      names.add(archetype.battleSprite!);
    }
    expect(names.size).toBe(TRAINER_ARCHETYPES.length);
  });

  it('maps every battle sprite onto the packed FRLG trainer atlas', () => {
    const frames: Record<string, number> = trainerSpriteManifest.sprites;
    expect(trainerSpriteManifest.frames.length).toBe(TRAINER_ARCHETYPES.length);
    for (const archetype of TRAINER_ARCHETYPES) {
      const name = archetype.battleSprite!;
      const frame = frames[name];
      expect(frame, `${archetype.id} (${name})`).toBeTypeOf('number');
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(trainerSpriteManifest.frames.length);
    }
  });
});
