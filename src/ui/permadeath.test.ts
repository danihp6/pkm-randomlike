import { describe, expect, it } from 'vitest';
import type { RunPokemon, RunState } from '../engine/run';
import { releaseBeats, runOverLines, runOverSummary } from './permadeath';

function member(id: string, level: number, speciesId = 'charmander'): RunPokemon {
  return {
    fighter: {
      id,
      speciesId,
      level,
      nature: 'Hardy',
      ability: 'Blaze',
      gender: 'male',
      heldItem: null,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      moves: [{ moveId: 'ember', pp: 10, maxPp: 10 }],
      hp: 0,
      status: null,
      statusCounter: 0,
    },
    xp: level ** 3,
  };
}

function run(routeIndex: number, seed = 'seed-1'): RunState {
  return {
    seed,
    mode: 'finite',
    routeIndex,
    levelCap: 20,
    party: [],
    box: [],
    bag: [],
    defeatedTrainers: [],
    captureUsed: false,
  };
}

describe('releaseBeats', () => {
  it('resolves the display name and keeps the reported order', () => {
    const beats = releaseBeats([
      member('a', 7, 'charmander'),
      member('b', 5, 'squirtle'),
    ]);
    expect(beats).toEqual([
      { id: 'a', speciesId: 'charmander', name: 'Charmander', level: 7 },
      { id: 'b', speciesId: 'squirtle', name: 'Squirtle', level: 5 },
    ]);
  });

  it('falls back to the species id when the dex has no name', () => {
    expect(releaseBeats([member('a', 3, 'missingno')])[0].name).toBe('missingno');
  });

  it('produces nothing for an empty list', () => {
    expect(releaseBeats([])).toEqual([]);
  });
});

describe('runOverSummary', () => {
  it('counts the routes cleared before a lost route', () => {
    expect(runOverSummary(run(3), false).routesCleared).toBe(2);
  });

  it('counts the final route as cleared on a win', () => {
    expect(runOverSummary(run(9), true).routesCleared).toBe(9);
  });

  it('never reports a negative count when the first route is lost', () => {
    expect(runOverSummary(run(1), false).routesCleared).toBe(0);
  });

  it('carries the run seed', () => {
    expect(runOverSummary(run(2, 'abc-def'), false).seed).toBe('abc-def');
  });
});

describe('runOverLines', () => {
  it('names the loss and shows what the run got through', () => {
    const lines = runOverLines(runOverSummary(run(2, 'abc'), false));
    expect(lines[0]).toBe('You have no more Pokémon!');
    expect(lines).toContain('Routes cleared: 1');
    expect(lines).toContain('Seed: abc');
  });

  it('turns the same screen into the win message', () => {
    const lines = runOverLines(runOverSummary(run(8, 'abc'), true));
    expect(lines[0]).toBe('The final route falls. You win!');
    expect(lines).toContain('Routes cleared: 8');
  });
});
