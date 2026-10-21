import { describe, expect, it } from 'vitest';
import { getTrainerArchetype } from '../data/trainers';
import { BANNED_ROOM } from './bannedRoom';

describe('the banned-species room table', () => {
  it('freezes the leaf’s first floor, chance and archetype', () => {
    expect(BANNED_ROOM).toEqual({ fromMap: 3, chance: 0.2, archetypeId: 'blackbelt' });
  });

  it('names an ordinary archetype that carries no Mega', () => {
    const archetype = getTrainerArchetype(BANNED_ROOM.archetypeId);
    expect(archetype).toBeDefined();
    expect(archetype?.carriesMega).toBeFalsy();
  });
});
