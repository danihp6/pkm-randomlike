import { describe, expect, it } from 'vitest';
import { MOVE_COVERAGE, unportedMoveIds } from '../../data/moveCoverage';
import type { Command } from './commands';
import { activeFighter, type BattleState } from './state';
import { formatBattleLog, scriptedBattle } from './harness';
import {
  MOVE_AUDIT_ROWS,
  boostsVector,
  fieldConditionsVector,
  probeMove,
  sideConditionsVector,
  type MoveAuditRow,
  type MoveAuditSetup,
  type MoveProbe,
} from './moveAudit';

/**
 * The ledger's two verses. `MOVE_AUDIT_ROWS` covers every move the ledger calls
 * ported through something other than plain damage; the plain-damage verse is
 * swept below and only has to land a hit.
 */
const ROW_MOVES = MOVE_COVERAGE.filter(
  (entry) => entry.status === 'port' && entry.note !== 'data: basePower',
);
const BASE_POWER_MOVES = MOVE_COVERAGE.filter(
  (entry) => entry.status === 'port' && entry.note === 'data: basePower',
);

/**
 * The setup a conditional plain-damage move needs to land on the clean board. A
 * Ghost move is refused outright by Ditto's Normal type, so those are aimed at a
 * pure Psychic-type, which no type is immune to.
 */
const BASE_POWER_SETUPS: Partial<Record<string, Partial<MoveAuditSetup>>> = {
  astralbarrage: { enemySpecies: 'mew' },
  hex: { enemySpecies: 'mew' },
  lastrespects: { enemySpecies: 'mew' },
  moongeistbeam: { enemySpecies: 'mew' },
  poltergeist: { enemySpecies: 'mew' },
  ragefist: { enemySpecies: 'mew' },
  shadowclaw: { enemySpecies: 'mew' },
  shadowpunch: { enemySpecies: 'mew' },
  shadowsneak: { enemySpecies: 'mew' },
  spectralthief: { enemySpecies: 'mew' },
  spiritshackle: { enemySpecies: 'mew' },
};

/** A member of the verse whose reference needs a condition the probe cannot seed. */
const SWEEP_EXEMPT: Readonly<Record<string, string>> = {};

/** The ids the backlog leaves to a later task: each must be a row or a `no-op`. */
const LEDGER_TARGETS: readonly string[] = [
  'attract',
  'disable',
  'torment',
  'spite',
  'trick',
  'switcheroo',
  'skillswap',
  'heartswap',
  'powerswap',
  'guardswap',
  'powersplit',
  'guardsplit',
  'speedswap',
  'soak',
  'reflecttype',
  'mimic',
  'simplebeam',
  'worryseed',
  'gastroacid',
  'entrainment',
  'topsyturvy',
  'nightmare',
  'octolock',
  'spiderweb',
  'telekinesis',
  'lockon',
  'mindreader',
  'foresight',
  'odorsleuth',
  'defog',
  'healpulse',
  'floralhealing',
  'purify',
  'instruct',
  'quash',
  'electrify',
  'embargo',
  'psychoshift',
  'magicpowder',
  'forestscurse',
  'trickortreat',
  'venomdrench',
  'beatup',
  'seismictoss',
  'nightshade',
  'dragonrage',
  'sonicboom',
  'psywave',
  'superfang',
  'endeavor',
  'painsplit',
  'present',
  'spitup',
  'wringout',
  'crushgrip',
  'electroball',
  'flail',
  'reversal',
  'gyroball',
  'hardpress',
  'heatcrash',
  'heavyslam',
  'lowkick',
  'grassknot',
  'fissure',
  'guillotine',
  'horndrill',
  'sheercold',
  'naturesmadness',
  'ruination',
  'strengthsap',
];

describe('the probe', () => {
  it('runs one move against the same clean board every time', () => {
    expect(probeMove('ember')).toEqual(probeMove('ember'));
    expect(probeMove('leechseed')).toEqual(probeMove('leechseed'));
  });

  it('never mutates the setup it is handed', () => {
    const setup: Partial<MoveAuditSetup> = { playerHp: 40, playerStatus: 'brn' };
    const before = { ...setup };
    probeMove('absorb', setup);
    expect(setup).toEqual(before);
  });

  it('builds full vectors from the stages a row names', () => {
    expect(boostsVector({ atk: 2, evasion: -1 })).toEqual([2, 0, 0, 0, 0, 0, -1]);
    expect(boostsVector()).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(sideConditionsVector({ reflect: 5 })).toEqual([5, 0, 0, 0, 0, 0, 0]);
    expect(sideConditionsVector()).toHaveLength(7);
    expect(fieldConditionsVector({ trickroom: 5 })).toEqual([5, 0, 0, 0, 0, 0, 0]);
    expect(fieldConditionsVector()).toHaveLength(7);
  });

  it('resolves every classified move without throwing', () => {
    for (const entry of MOVE_COVERAGE) {
      expect(() => probeMove(entry.id), entry.id).not.toThrow();
    }
  });
});

function probeRow(row: MoveAuditRow): MoveProbe {
  const probe = probeMove(row.moveId, row.setup);
  for (const key of Object.keys(row.expected) as (keyof MoveProbe)[]) {
    expect(probe[key], `${row.moveId}.${key}`).toEqual(row.expected[key]);
  }
  return probe;
}

describe('the audit table', () => {
  it('holds one row per ported move that is not plain damage', () => {
    process.stdout.write(`moveAudit: ${MOVE_AUDIT_ROWS.length} rows\n`);
    expect(MOVE_AUDIT_ROWS.map((row) => row.moveId)).toEqual(ROW_MOVES.map((entry) => entry.id).sort());
  });

  it('is sorted, one id per row, and no row is empty', () => {
    const ids = MOVE_AUDIT_ROWS.map((row) => row.moveId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    for (const row of MOVE_AUDIT_ROWS) {
      expect(Object.keys(row.expected).length, row.moveId).toBeGreaterThan(0);
    }
  });

  it('never names a move the ledger calls excluded or no-op', () => {
    const byId = new Map(MOVE_COVERAGE.map((entry) => [entry.id, entry]));
    for (const row of MOVE_AUDIT_ROWS) {
      const entry = byId.get(row.moveId);
      expect(entry, row.moveId).toBeDefined();
      expect(entry?.status, row.moveId).toBe('port');
      expect(entry?.note, row.moveId).not.toBe('data: basePower');
    }
  });

  it('accounts for every id the backlog leaves to a later task, exactly once', () => {
    const rows = new Set(MOVE_AUDIT_ROWS.map((row) => row.moveId));
    const noOps = new Set(unportedMoveIds());
    const classified = new Set(MOVE_COVERAGE.map((entry) => entry.id));
    for (const moveId of [...LEDGER_TARGETS]) {
      expect(classified.has(moveId), `${moveId}: not in the ledger`).toBe(true);
      expect(rows.has(moveId) !== noOps.has(moveId), `${moveId}: a row or a no-op`).toBe(true);
    }
  });
});

describe('one expectation per row', () => {
  for (const row of MOVE_AUDIT_ROWS) {
    const probe = (): void => {
      probeRow(row);
    };
    if (row.knownGap) it.fails(`${row.moveId} — known gap`, probe);
    else it(row.moveId, probe);
  }
});

describe('the plain-damage verse', () => {
  for (const entry of BASE_POWER_MOVES) {
    if (SWEEP_EXEMPT[entry.id]) continue;
    it(`${entry.id} lands a hit`, () => {
      const probe = probeMove(entry.id, BASE_POWER_SETUPS[entry.id]);
      expect(probe.events).toContain('damage');
    });
  }

  it('exempts only verse members, and always with a reason', () => {
    const verse = new Set(BASE_POWER_MOVES.map((entry) => entry.id));
    for (const [moveId, reason] of Object.entries(SWEEP_EXEMPT)) {
      expect(verse.has(moveId), moveId).toBe(true);
      expect(reason.length, moveId).toBeGreaterThan(0);
    }
    for (const moveId of Object.keys(BASE_POWER_SETUPS)) expect(verse.has(moveId), moveId).toBe(true);
  });
});

/** A single fight command by move index. */
const fight = (moveIndex: number): Command => ({ type: 'fight', moveIndex });

/** The player's command for the turn, from a per-turn plan of move indices. */
const plan =
  (indices: readonly number[]) =>
  (_state: BattleState, turn: number): Command =>
    fight(indices[turn - 1] ?? indices[indices.length - 1]);

function runTurns(
  indices: readonly number[],
  playerMoves: readonly string[],
  enemyMoves: readonly string[],
  turns: number,
): BattleState {
  return scriptedBattle({
    player: [{ id: 'player', speciesId: 'charmander', level: 50, moves: [...playerMoves] }],
    enemy: [{ id: 'enemy', speciesId: 'squirtle', level: 50, moves: [...enemyMoves] }],
    turnCap: turns,
    playerCommand: plan(indices),
  });
}

function texts(state: BattleState): readonly string[] {
  return state.log.flatMap((event) => (event.kind === 'text' ? [event.key] : []));
}

function countText(state: BattleState, key: string): number {
  return texts(state).filter((line) => line === key).length;
}

/** The params of every text event of one key, in log order. */
function namesOf(state: BattleState, key: string): readonly string[] {
  return state.log.flatMap((event) =>
    event.kind === 'text' && event.key === key ? [String(event.params?.name)] : [],
  );
}

/**
 * The multi-turn families, pinned on seed 2026: the residual pass that ticks
 * Leech Seed, Yawn, the perish count, Encore/Taunt and protection is what these
 * five cases hold still.
 */
describe('multi-turn families on seed 2026', () => {
  it('saps the seeded side once per turn', () => {
    const state = runTurns([0, 1, 1], ['leechseed', 'splash'], ['splash'], 3);
    const enemy = activeFighter(state, 'enemy');
    expect(countText(state, 'battle.log.leechSeed')).toBe(3);
    expect(namesOf(state, 'battle.log.leechSeed')).toEqual(['Squirtle', 'Squirtle', 'Squirtle']);
    expect(enemy.maxHp - enemy.hp).toBe(3 * Math.max(1, Math.floor(enemy.maxHp / 8)));
    expect(enemy.volatiles.leechSeed).toBe(true);
  });

  it('puts the drowsy side to sleep on the next residual pass', () => {
    const state = runTurns([0, 1, 1], ['yawn', 'splash'], ['splash'], 3);
    const enemy = activeFighter(state, 'enemy');
    expect(countText(state, 'battle.log.volatile.drowsy')).toBe(1);
    expect(enemy.status).toBe('slp');
    expect(countText(state, 'battle.log.fellAsleep')).toBe(1);
    expect(namesOf(state, 'battle.log.fellAsleep')).toEqual(['Squirtle']);
  });

  it('counts both actives down to a draw', () => {
    const state = runTurns([0, 1, 1], ['perishsong', 'splash'], ['splash'], 3);
    expect(countText(state, 'battle.log.move.perishsong')).toBe(1);
    expect(countText(state, 'battle.log.faintedPerish')).toBe(2);
    expect(state.winner).toBe('draw');
  });

  it('refuses a taunted status move and lifts the taunt after three passes', () => {
    const state = runTurns([0, 1, 1, 1], ['taunt', 'splash'], ['growl', 'growl'], 4);
    expect(countText(state, 'battle.log.taunted')).toBe(3);
    expect(countText(state, 'battle.log.boostFell.atk')).toBe(1);
    expect(namesOf(state, 'battle.log.boostFell.atk')).toEqual(['Charmander']);
    expect(activeFighter(state, 'enemy').volatiles.taunt).toBe(0);
  });

  it('locks the encored move and ticks the lock down', () => {
    const state = runTurns([1, 0, 1], ['encore', 'splash'], ['growl', 'tackle'], 3);
    const enemy = activeFighter(state, 'enemy');
    expect(countText(state, 'battle.log.volatile.default')).toBe(1);
    expect(enemy.volatiles.encoreMove).toBe('growl');
    expect(enemy.volatiles.encore).toBe(1);
    expect(countText(state, 'battle.log.boostFell.atk')).toBe(3);
  });

  it('blocks the foe on a protect turn and lets it through on the next', () => {
    const state = runTurns([0, 1, 0], ['protect', 'splash'], ['tackle', 'tackle'], 3);
    const player = activeFighter(state, 'player');
    expect(countText(state, 'battle.log.protectedItself')).toBe(4);
    expect(namesOf(state, 'battle.log.protectedItself')).toEqual([
      'Charmander',
      'Charmander',
      'Charmander',
      'Charmander',
    ]);
    expect(player.hp).toBeLessThan(player.maxHp);
    expect(formatBattleLog(state)).toContain('# turn 3');
  });
});
