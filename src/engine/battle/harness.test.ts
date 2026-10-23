import { describe, expect, it } from 'vitest';
import { formatBattleLog, scriptedBattle, type HarnessFighterSpec } from './harness';
import type { BattleEvent } from './state';

/** The golden battle's own teams (`golden.test.ts`). */
const PLAYER: readonly HarnessFighterSpec[] = [
  { id: 'player', speciesId: 'charmander', level: 20, nature: 'serious', moves: ['ember', 'growl'] },
];

const ENEMY: readonly HarnessFighterSpec[] = [
  { id: 'enemy', speciesId: 'bulbasaur', level: 18, nature: 'serious', moves: ['vinewhip', 'tackle'] },
];

/** The golden log's keys, line for line: `golden.test.ts`'s inline snapshot. */
const GOLDEN_LOG = [
  '# turn 1',
  '  > player ember',
  'battle.log.used(move=ember, name=Charmander)',
  '  = enemy -26 (23/49 x2)',
  'battle.log.hitSuper(move=ember, name=Bulbasaur)',
  '  > enemy vinewhip',
  'battle.log.used(move=vinewhip, name=Bulbasaur)',
  '  = player -6 (45/51 x0.5)',
  'battle.log.hitWeak(move=vinewhip, name=Charmander)',
  '# turn 2',
  '  > player ember',
  'battle.log.used(move=ember, name=Charmander)',
  '  = enemy -23 (0/49 x2)',
  'battle.log.hitSuper(move=ember, name=Bulbasaur)',
  '  = enemy fainted',
  'battle.log.fainted(name=Bulbasaur)',
  '# end player',
].join('\n');

/** One event of every kind `BattleEvent` carries. */
const ALL_KINDS: readonly BattleEvent[] = [
  { kind: 'turn', turn: 1 },
  { kind: 'text', key: 'battle.log.fail' },
  { kind: 'move', side: 'player', moveId: 'ember' },
  { kind: 'damage', side: 'enemy', amount: 24, hp: 25, maxHp: 49, effectiveness: 2, crit: false },
  { kind: 'heal', side: 'player', amount: 5, hp: 30, maxHp: 51 },
  { kind: 'boost', side: 'player', stat: 'atk', stages: 2 },
  { kind: 'status', side: 'enemy', status: 'brn' },
  { kind: 'cure', side: 'enemy', status: 'brn' },
  { kind: 'faint', side: 'enemy', fighterId: 'enemy' },
  { kind: 'switch', side: 'player', fighterId: 'bench' },
  { kind: 'mega', side: 'player', fighterId: 'player' },
  { kind: 'gmax', side: 'player', fighterId: 'player' },
  { kind: 'forme', side: 'player', fighterId: 'player' },
  { kind: 'item', side: 'player', itemId: 'potion' },
  { kind: 'capture', success: true, fighterId: 'wild', shakes: 3 },
  { kind: 'run', side: 'player', success: false },
  { kind: 'end', winner: 'player' },
];

describe('scriptedBattle', () => {
  it('reproduces the golden log for the golden teams at the default seed', () => {
    const state = scriptedBattle({ player: PLAYER, enemy: ENEMY });
    expect(state.winner).toBe('player');
    expect(formatBattleLog(state)).toBe(GOLDEN_LOG);
  });

  it('draws a different log from a different seed', () => {
    const golden = scriptedBattle({ player: PLAYER, enemy: ENEMY });
    const other = scriptedBattle({ player: PLAYER, enemy: ENEMY, seed: 7 });
    expect(formatBattleLog(other)).not.toBe(formatBattleLog(golden));
  });

  it('stops at turnCap, one-based turn, leaving the battle unfinished', () => {
    const state = scriptedBattle({ player: PLAYER, enemy: ENEMY, turnCap: 1 });
    expect(state.log.filter((event) => event.kind === 'turn')).toEqual([{ kind: 'turn', turn: 1 }]);
    expect(state.winner).toBeNull();
    const log = formatBattleLog(state);
    expect(log).toContain('# turn 1');
    expect(log).not.toContain('# turn 2');
  });

  it('replaces a fainted active between turns and logs the switch', () => {
    const state = scriptedBattle({
      player: [
        { id: 'lead', speciesId: 'caterpie', level: 2, moves: ['tackle'] },
        { id: 'bench', speciesId: 'charmander', level: 40, moves: ['ember'] },
      ],
      enemy: [{ id: 'foe', speciesId: 'mewtwo', level: 60, moves: ['psychic'] }],
    });
    const switches = state.log.filter((event) => event.kind === 'switch');
    expect(switches.map((event) => event.fighterId)).toContain('bench');
    expect(state.sides.player.activeIndex).toBe(1);
    expect(formatBattleLog(state)).toContain('  = player sent bench');
  });

  it('calls a custom player policy once per turn and logs the command it returned', () => {
    const turns: number[] = [];
    const state = scriptedBattle({
      player: PLAYER,
      enemy: ENEMY,
      turnCap: 3,
      playerCommand: (_state, turn) => {
        turns.push(turn);
        return { type: 'fight', moveIndex: 1 };
      },
    });
    expect(turns).toEqual([1, 2, 3]);
    expect(state.log.filter((event) => event.kind === 'move' && event.side === 'player')).toEqual([
      { kind: 'move', side: 'player', moveId: 'growl' },
      { kind: 'move', side: 'player', moveId: 'growl' },
      { kind: 'move', side: 'player', moveId: 'growl' },
    ]);
  });

  it('takes a custom enemy policy too', () => {
    const state = scriptedBattle({
      player: PLAYER,
      enemy: ENEMY,
      turnCap: 1,
      enemyCommand: () => ({ type: 'fight', moveIndex: 0 }),
    });
    expect(state.log.filter((event) => event.kind === 'move' && event.side === 'enemy')).toEqual([
      { kind: 'move', side: 'enemy', moveId: 'vinewhip' },
    ]);
  });

  it('carries a spec held item onto the built fighter, and nothing when it is omitted', () => {
    const state = scriptedBattle({
      player: [{ ...PLAYER[0]!, heldItem: 'leftovers' }],
      enemy: ENEMY,
      turnCap: 1,
    });
    expect(state.sides.player.party[0]!.heldItem).toBe('leftovers');
    expect(state.sides.enemy.party[0]!.heldItem).toBeNull();
  });
});

describe('formatBattleLog', () => {
  it('renders every event kind, one line each and never an undefined', () => {
    const state = scriptedBattle({ player: PLAYER, enemy: ENEMY, turnCap: 1 });
    state.log.length = 0;
    state.log.push(...ALL_KINDS);
    const lines = formatBattleLog(state).split('\n');
    expect(lines).toHaveLength(ALL_KINDS.length);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(0);
      expect(line).not.toContain('undefined');
    }
    expect(lines).toEqual([
      '# turn 1',
      'battle.log.fail',
      '  > player ember',
      '  = enemy -24 (25/49 x2)',
      '  = player +5 (30/51)',
      '  = player atk +2',
      '  = enemy brn',
      '  = enemy cured brn',
      '  = enemy fainted',
      '  = player sent bench',
      '  = player mega player',
      '  = player gmax player',
      '  = player forme player',
      '  = player used potion',
      '  = capture success (3)',
      '  = run fail',
      '# end player',
    ]);
  });

  it('renders the golden log without an undefined', () => {
    const log = formatBattleLog(scriptedBattle({ player: PLAYER, enemy: ENEMY }));
    expect(log).not.toContain('undefined');
    expect(log.split('\n')).toHaveLength(17);
  });
});
