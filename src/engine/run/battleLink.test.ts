import { afterEach, describe, expect, it, vi } from 'vitest';
import { scriptedBattle } from '../battle/harness';
import type { BattleEvent } from '../battle/state';
import { battleSeed, battleTallies, launchTeamTypes, type BattleLaunch } from './battleLink';

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

const LEAD = [{ id: 'lead' }] as const;
const TWO = [{ id: 'lead' }, { id: 'bench' }] as const;

function hit(side: 'player' | 'enemy', amount: number): BattleEvent {
  return { kind: 'damage', side, amount, hp: 0, maxHp: 40, effectiveness: 1, crit: false };
}

describe('battleTallies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('credits the fielded member with the damage it dealt and the enemy it fainted', () => {
    const log: readonly BattleEvent[] = [
      { kind: 'turn', turn: 1 },
      { kind: 'move', side: 'player', moveId: 'scratch' },
      hit('enemy', 40),
      { kind: 'faint', side: 'enemy', fighterId: 'wild' },
    ];
    expect(battleTallies(log, LEAD)).toEqual([{ memberId: 'lead', kos: 1, damage: 40, damageTaken: 0 }]);
  });

  it('books the player side’s own damage as what the fielded member took', () => {
    const log: readonly BattleEvent[] = [hit('player', 12)];
    expect(battleTallies(log, LEAD)).toEqual([{ memberId: 'lead', kos: 0, damage: 0, damageTaken: 12 }]);
  });

  it('hands the field to the member a player switch sends out', () => {
    const log: readonly BattleEvent[] = [
      hit('enemy', 5),
      { kind: 'switch', side: 'player', fighterId: 'bench' },
      hit('enemy', 7),
      hit('player', 3),
    ];
    expect(battleTallies(log, TWO)).toEqual([
      { memberId: 'lead', kos: 0, damage: 5, damageTaken: 0 },
      { memberId: 'bench', kos: 0, damage: 7, damageTaken: 3 },
    ]);
  });

  it('ignores the enemy side’s own switches, which never move the player’s field', () => {
    const log: readonly BattleEvent[] = [
      hit('enemy', 4),
      { kind: 'switch', side: 'enemy', fighterId: 'other' },
      hit('enemy', 6),
    ];
    expect(battleTallies(log, LEAD)).toEqual([{ memberId: 'lead', kos: 0, damage: 10, damageTaken: 0 }]);
  });

  it('answers one all-zero entry per player fighter for an empty log', () => {
    expect(battleTallies([], TWO)).toEqual([
      { memberId: 'lead', kos: 0, damage: 0, damageTaken: 0 },
      { memberId: 'bench', kos: 0, damage: 0, damageTaken: 0 },
    ]);
    expect(battleTallies([], [])).toEqual([]);
  });

  it('reads no RNG and no clock: the same log answers the same tallies', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('battleTallies read the RNG');
    });
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('battleTallies read the clock');
    });
    const log: readonly BattleEvent[] = [
      hit('enemy', 9),
      { kind: 'faint', side: 'enemy', fighterId: 'w' },
    ];
    expect(battleTallies(log, TWO)).toEqual(battleTallies(log, TWO));
  });

  it('is not conditional on the outcome: a fled or a captured battle still reports', () => {
    const log: readonly BattleEvent[] = [
      hit('enemy', 8),
      { kind: 'run', side: 'player', success: true },
    ];
    expect(battleTallies(log, LEAD)[0].damage).toBe(8);
    const caught: readonly BattleEvent[] = [
      hit('player', 2),
      { kind: 'capture', success: true, fighterId: 'wild', shakes: 3 },
    ];
    expect(battleTallies(caught, LEAD)[0].damageTaken).toBe(2);
  });

  it('carries a fixed-seed battle’s real log back for the party’s own ids', () => {
    const state = scriptedBattle({
      player: [
        {
          id: 'player',
          speciesId: 'charmander',
          level: 20,
          nature: 'serious',
          moves: ['ember', 'growl'],
        },
      ],
      enemy: [
        {
          id: 'enemy',
          speciesId: 'bulbasaur',
          level: 18,
          nature: 'serious',
          moves: ['vinewhip', 'tackle'],
        },
      ],
      seed: 2026,
    });
    expect(state.winner).toBe('player');
    const tallies = battleTallies(
      state.log,
      state.sides.player.party.map((fighter) => ({ id: fighter.id })),
    );
    expect(tallies.map((tally) => tally.memberId)).toEqual(['player']);
    expect(tallies[0].kos).toBeGreaterThan(0);
    expect(tallies[0].damage + tallies[0].damageTaken).toBeGreaterThan(0);
  });
});
