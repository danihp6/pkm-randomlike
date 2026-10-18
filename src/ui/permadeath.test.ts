import { describe, expect, it } from 'vitest';
import type { RunPokemon } from '../engine/run';
import { releaseBeats } from './permadeath';

function member(id: string, level: number, speciesId = 'charmander', nickname?: string): RunPokemon {
  return {
    fighter: {
      id,
      speciesId,
      ...(nickname ? { nickname } : {}),
      level,
      nature: 'Hardy',
      ability: 'Blaze',
      gender: 'male',
      shiny: false,
      heldItem: null,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      moves: [{ moveId: 'ember', pp: 10, maxPp: 10 }],
      hp: 0,
      status: null,
      statusCounter: 0,
    },
  };
}

describe('releaseBeats', () => {
  it('resolves the display name and keeps the reported order', () => {
    const beats = releaseBeats([member('a', 7, 'charmander'), member('b', 5, 'squirtle')]);
    expect(beats).toEqual([
      { id: 'a', speciesId: 'charmander', name: 'Charmander', level: 7, shiny: false },
      { id: 'b', speciesId: 'squirtle', name: 'Squirtle', level: 5, shiny: false },
    ]);
  });

  it('falls back to the species id when the dex has no name', () => {
    expect(releaseBeats([member('a', 3, 'missingno')])[0].name).toBe('missingno');
  });

  it('names a member from its nickname when it has one', () => {
    const beats = releaseBeats([member('a', 7, 'charmander', 'Sparky'), member('b', 5, 'squirtle')]);
    expect(beats[0].name).toBe('Sparky');
    expect(beats[1].name).toBe('Squirtle');
  });

  it('produces nothing for an empty list', () => {
    expect(releaseBeats([])).toEqual([]);
  });
});
