import { describe, expect, it } from 'vitest';
import { battleSeed, launchTeamTypes, type BattleLaunch } from './battleLink';

/** A launch as the route builds it, so the optional field can be read back. */
function launch(extra: Partial<BattleLaunch> = {}): BattleLaunch {
  return {
    trigger: { kind: 'wild', speciesId: 'pidgey', level: 5, key: 'grass:4,7' },
    player: [],
    bag: [],
    xp: 0,
    seed: battleSeed('run-a', 3, 'grass:4,7:0'),
    runSeed: 'run-a',
    routeIndex: 3,
    canCapture: true,
    firstCatch: false,
    aiLevel: 'normal',
    ...extra,
  };
}

describe('battleSeed', () => {
  it('replays the same seed for the same run inputs', () => {
    expect(battleSeed('run-a', 3, 'grass:4,7:0')).toBe(battleSeed('run-a', 3, 'grass:4,7:0'));
  });

  it('separates the seed across run seed, route and key', () => {
    const base = battleSeed('run-a', 3, 'grass:4,7:0');
    expect(battleSeed('run-b', 3, 'grass:4,7:0')).not.toBe(base);
    expect(battleSeed('run-a', 4, 'grass:4,7:0')).not.toBe(base);
    expect(battleSeed('run-a', 3, 'grass:4,7:1')).not.toBe(base);
  });
});

describe('BattleLaunch.double', () => {
  it('is absent on every launch that does not ask for a double battle', () => {
    const plain = launch();
    expect('double' in plain).toBe(false);
    expect(plain.double).toBeUndefined();
  });

  it('reads the flag the route set and nothing else moves', () => {
    const plain = launch();
    const doubles = launch({ double: true });
    expect(doubles.double).toBe(true);
    expect(doubles.seed).toBe(plain.seed);
    expect(battleSeed('run-a', 3, 'grass:4,7:0')).toBe(plain.seed);
  });
});

describe('launchTeamTypes', () => {
  it('answers none for a launch that carries no list', () => {
    expect(launchTeamTypes({})).toEqual([]);
    expect(launchTeamTypes(launch())).toEqual([]);
  });

  it('hands back the list the route set, untouched', () => {
    expect(launchTeamTypes({ teamTypes: ['Fire'] })).toEqual(['Fire']);
    expect(launchTeamTypes({ teamTypes: ['Fire', 'Water'] })).toEqual(['Fire', 'Water']);
    const teamTypes = ['Fire'] as const;
    expect(launchTeamTypes({ teamTypes })).toBe(teamTypes);
  });
});
