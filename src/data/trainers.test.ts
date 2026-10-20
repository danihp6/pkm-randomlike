import { describe, expect, it } from 'vitest';
import { getAbility } from './dex/abilities';
import { getItem } from './items';
import {
  SPECIAL_ARCHETYPES,
  SPECIAL_TRAINER_ROWS,
  TRAINER_ARCHETYPES,
  TRAINER_ARCHETYPE_IDS,
  getTrainerArchetype,
  type AiFlag,
} from './trainers';
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

describe('the set-piece archetypes', () => {
  it('keeps the set-piece rows out of the route’s own pool, reachable by id', () => {
    expect(SPECIAL_ARCHETYPES.map((archetype) => archetype.id)).toEqual([
      'rocket',
      'ninja',
      'impostor',
      'secret',
    ]);
    for (const archetype of SPECIAL_ARCHETYPES) {
      expect(TRAINER_ARCHETYPE_IDS, archetype.id).not.toContain(archetype.id);
    }
    const rocket = getTrainerArchetype('rocket');
    expect(rocket).toBe(SPECIAL_ARCHETYPES[0]);
    expect(rocket!.name).toBe('Team Rocket');
    expect(rocket!.id).toBe('rocket');
  });

  it('reuses the psychic tier’s money and AI flags, so no new balance tier appears', () => {
    const rocket = SPECIAL_ARCHETYPES[0];
    const psychic = getTrainerArchetype('psychic')!;
    expect(rocket.money).toEqual(psychic.money);
    expect(rocket.money).toEqual({ base: 120, jitter: 50 });
    expect(rocket.aiFlags).toEqual(psychic.aiFlags);
    expect(rocket.aiFlags).toEqual(['checkBadMove', 'checkViability', 'tryToFaint']);
    for (const flag of rocket.aiFlags!) expect(KNOWN_FLAGS).toContain(flag);
  });

  it('declares the two art keys it will draw once the FRLG atlas carries the row', () => {
    const rocket = SPECIAL_ARCHETYPES[0];
    expect(rocket.spriteKey).toBe('rocket');
    expect(rocket.battleSprite).toBe('rocket');
    expect(rocket.colour).toBe(0xc0392b);
    // No catalogue tier carries it: the row is a set-piece, never a route roll.
    expect(rocket.carriesMega).toBeUndefined();
  });
});

describe('the set-piece trainers', () => {
  it('ships the ninja, the impostor and the secret trainer as data rows', () => {
    for (const id of ['ninja', 'impostor', 'secret']) {
      const archetype = getTrainerArchetype(id);
      expect(archetype, id).toBe(SPECIAL_ARCHETYPES.find((entry) => entry.id === id));
      expect(TRAINER_ARCHETYPE_IDS, id).not.toContain(id);
    }
  });

  it('keeps the ten regular classes as the only route pool', () => {
    expect(TRAINER_ARCHETYPE_IDS).toEqual([
      'youngster',
      'lass',
      'bugcatcher',
      'hiker',
      'camper',
      'picnicker',
      'fisher',
      'psychic',
      'blackbelt',
      'ace',
    ]);
    for (const id of ['rocket', 'ninja', 'impostor', 'secret']) {
      expect(TRAINER_ARCHETYPE_IDS, id).not.toContain(id);
    }
  });

  it('hides the ninja’s route sprite without touching its sight', () => {
    const ninja = getTrainerArchetype('ninja')!;
    expect(ninja.sightMode).toBe('invisible');
    expect(ninja.spriteKey).toBe('ninja');
    expect(ninja.battleSprite).toBe('ninja');
    expect(ninja.forcedAbility).toBeUndefined();
    expect(ninja.reward).toBeUndefined();
    expect(ninja.aiFlags).toEqual(['checkBadMove', 'tryToFaint', 'risky']);
  });

  it('gives the impostor a forced Imposter roster and one Ability Shield', () => {
    const impostor = getTrainerArchetype('impostor')!;
    expect(impostor.forcedAbility).toBe('Imposter');
    expect(impostor.reward).toEqual({ itemId: 'abilityshield', count: 1 });
    expect(getItem('abilityshield')).toBeDefined();
    expect(impostor.forcedAbility).toBe(getAbility('imposter')?.name);
    expect(impostor.sightMode).toBeUndefined();
  });

  it('fields the secret trainer as the purest set piece', () => {
    const secret = getTrainerArchetype('secret')!;
    expect(secret.name).toBe('Secret Trainer');
    expect(secret.className).toBe('Secret Trainer');
    expect(secret.money).toEqual({ base: 300, jitter: 120 });
    expect(secret.sightMode).toBeUndefined();
    expect(secret.forcedAbility).toBeUndefined();
    expect(secret.reward).toBeUndefined();
    expect(secret.aiFlags).toHaveLength(6);
  });

  it('lets no set-piece trainer carry a Mega Stone', () => {
    for (const id of ['ninja', 'impostor', 'secret']) {
      expect(getTrainerArchetype(id)!.carriesMega, id).toBeUndefined();
    }
  });
});

describe('the special trainer spawn table', () => {
  it('reads three rows in pick order, the secret one gated on a mission', () => {
    expect(SPECIAL_TRAINER_ROWS).toEqual([
      { archetypeId: 'ninja', chance: 0.1 },
      { archetypeId: 'impostor', chance: 0.08 },
      { archetypeId: 'secret', chance: 0.2, minMissionsCompleted: 1 },
    ]);
  });

  it('names a set-piece archetype the route pool never rolls', () => {
    for (const row of SPECIAL_TRAINER_ROWS) {
      expect(getTrainerArchetype(row.archetypeId), row.archetypeId).toBeDefined();
      expect(TRAINER_ARCHETYPE_IDS, row.archetypeId).not.toContain(row.archetypeId);
      expect(row.chance, row.archetypeId).toBeGreaterThanOrEqual(0);
      expect(row.chance, row.archetypeId).toBeLessThanOrEqual(1);
    }
  });
});
