import { describe, expect, it } from 'vitest';
import { TRAINER_ARCHETYPES, TRAINER_ARCHETYPE_IDS, getTrainerArchetype, type AiFlag } from './trainers';
import trainerSpriteManifest from './frlg/trainers.json';

/** Every flag the union carries, so a typo in the table cannot ship. */
const KNOWN_FLAGS: readonly AiFlag[] = [
  'checkBadMove',
  'tryToFaint',
  'checkViability',
  'setupFirstTurn',
  'risky',
  'preferBatonPass',
];

/** The AI script flags each archetype thinks with (`docs/battle-spec.md` §11, D46). */
const AI_FLAGS: Readonly<Record<string, readonly AiFlag[]>> = {
  youngster: ['checkBadMove'],
  lass: ['checkBadMove'],
  bugcatcher: ['checkBadMove'],
  hiker: ['checkBadMove', 'checkViability'],
  camper: ['checkBadMove', 'checkViability'],
  picnicker: ['checkBadMove', 'checkViability'],
  fisher: ['checkBadMove', 'checkViability'],
  psychic: ['checkBadMove', 'checkViability', 'tryToFaint'],
  blackbelt: ['checkBadMove', 'checkViability', 'tryToFaint', 'risky'],
  ace: ['checkBadMove', 'tryToFaint', 'checkViability', 'setupFirstTurn', 'risky', 'preferBatonPass'],
};

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

  it('gives every archetype a list of known AI flags', () => {
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.aiFlags, archetype.id).toBeDefined();
      for (const flag of archetype.aiFlags!) {
        expect(KNOWN_FLAGS, `${archetype.id} -> ${flag}`).toContain(flag);
      }
    }
  });

  it('ships the flag ladder the battle spec documents', () => {
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.aiFlags, archetype.id).toEqual(AI_FLAGS[archetype.id]);
    }
    expect(Object.keys(AI_FLAGS).sort()).toEqual([...TRAINER_ARCHETYPE_IDS].sort());
  });

  it('hands the ace — the boss and mini-boss archetype — all six flags', () => {
    expect(getTrainerArchetype('ace')?.aiFlags).toEqual(KNOWN_FLAGS);
    expect(getTrainerArchetype('ace')?.aiFlags).toHaveLength(6);
  });
});
