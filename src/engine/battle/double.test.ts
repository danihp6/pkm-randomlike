import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { type FightCommand } from './commands';
import { createFighter, type BattleFighter } from './fighter';
import { formatBattleLog } from './harness';
import { orderActions } from './order';
import { activeFighter, createBattle, slotActiveIndex, type BattleState } from './state';
import { autoReplace, needsReplacement, takeDoubleTurn } from './turn';

const fighter = (id: string, speciesId: string, moves?: readonly string[]): BattleFighter =>
  createFighter({
    id,
    speciesId,
    level: 20,
    nature: 'serious',
    ...(moves ? { moves } : {}),
  });

interface BoardOptions {
  readonly player: readonly BattleFighter[];
  readonly enemy: readonly BattleFighter[];
  readonly seed?: number;
  readonly double?: boolean;
  readonly isWild?: boolean;
}

const board = (options: BoardOptions): BattleState =>
  createBattle({
    player: options.player,
    enemy: options.enemy,
    rng: new Rng(options.seed ?? 7),
    isWild: options.isWild ?? false,
    double: options.double ?? true,
  });

const emptyTurn = (state: BattleState): void => takeDoubleTurn(state, {}, {});

describe('the double battle', () => {
  it('fields two distinct actives per side and keeps singles at one slot', () => {
    const state = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'geodude')],
    });
    expect(state.double).toBe(true);
    expect(state.sides.player.secondActiveIndex).toBe(1);
    expect(state.sides.enemy.secondActiveIndex).toBe(1);
    expect(slotActiveIndex(state, 'player', 1)).toBe(1);
    expect(activeFighter(state, 'player', 1).id).toBe('p2');
    expect(activeFighter(state, 'enemy', 1).id).toBe('e2');

    const single = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'geodude')],
      double: false,
    });
    expect(single.double).toBe(false);
    expect(single.sides.player.secondActiveIndex).toBe(-1);
    expect(single.sides.enemy.secondActiveIndex).toBe(-1);
    expect(() => activeFighter(single, 'player', 1)).toThrow('There is no second active Pokémon.');

    const lonely = board({
      player: [fighter('p1', 'charmander')],
      enemy: [fighter('e1', 'bulbasaur')],
    });
    expect(lonely.sides.player.secondActiveIndex).toBe(-1);
    expect(lonely.sides.enemy.secondActiveIndex).toBe(-1);
  });

  it('sorts four entries by priority then Speed, deterministically', () => {
    const state = board({
      player: [fighter('p1', 'electrode'), fighter('p2', 'magikarp')],
      enemy: [fighter('e1', 'snorlax'), fighter('e2', 'eevee')],
    });
    const entries = [
      { side: 'player' as const, slot: 0 as const, priority: 0 },
      { side: 'player' as const, slot: 1 as const, priority: 0 },
      { side: 'enemy' as const, slot: 0 as const, priority: 1 },
      { side: 'enemy' as const, slot: 1 as const, priority: 0 },
    ];
    const first = orderActions(state, entries, new Rng(99)).map((entry) => ({
      side: entry.side,
      slot: entry.slot,
    }));
    const second = orderActions(state, entries, new Rng(99)).map((entry) => ({
      side: entry.side,
      slot: entry.slot,
    }));
    // The enemy lead's priority move goes first, then Speed: Electrode, Magikarp, Eevee.
    expect(first).toEqual([
      { side: 'enemy', slot: 0 },
      { side: 'player', slot: 0 },
      { side: 'player', slot: 1 },
      { side: 'enemy', slot: 1 },
    ]);
    expect(second).toEqual(first);
  });

  it('sends a single-target move at the slot the command names', () => {
    const build = (): BattleState =>
      board({
        player: [fighter('p1', 'charmander', ['tackle'])],
        enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'geodude')],
      });

    const aimed = build();
    takeDoubleTurn(aimed, { 0: { type: 'fight', moveIndex: 0, target: { side: 'enemy', slot: 1 } } }, {});
    expect(aimed.sides.enemy.party[0].hp).toBe(aimed.sides.enemy.party[0].maxHp);
    expect(aimed.sides.enemy.party[1].hp).toBeLessThan(aimed.sides.enemy.party[1].maxHp);

    const plain = build();
    takeDoubleTurn(plain, { 0: { type: 'fight', moveIndex: 0 } }, {});
    expect(plain.sides.enemy.party[0].hp).toBeLessThan(plain.sides.enemy.party[0].maxHp);
    expect(plain.sides.enemy.party[1].hp).toBe(plain.sides.enemy.party[1].maxHp);
  });

  it('hits both foe slots with a spread move and spends its PP once', () => {
    const state = board({
      player: [fighter('p1', 'clefable', ['dazzlinggleam'])],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'squirtle')],
    });
    const pp = state.sides.player.party[0].moves[0].pp;
    takeDoubleTurn(state, { 0: { type: 'fight', moveIndex: 0 } }, {});
    expect(state.sides.enemy.party[0].hp).toBeLessThan(state.sides.enemy.party[0].maxHp);
    expect(state.sides.enemy.party[1].hp).toBeLessThan(state.sides.enemy.party[1].maxHp);
    expect(state.sides.player.party[0].moves[0].pp).toBe(pp - 1);
  });

  it('replaces only the emptied slot, and only when a reserve is left', () => {
    const withReserve = board({
      player: [
        fighter('p1', 'charmander'),
        fighter('p2', 'squirtle'),
        fighter('p3', 'geodude'),
      ],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'eevee')],
    });
    withReserve.sides.player.party[0].hp = 0;
    emptyTurn(withReserve);
    expect(withReserve.winner).toBeNull();
    expect(withReserve.sides.player.awaitingReplacement).toBe(true);
    expect(needsReplacement(withReserve)).toContain('player');
    autoReplace(withReserve);
    expect(slotActiveIndex(withReserve, 'player', 0)).toBe(2);
    expect(slotActiveIndex(withReserve, 'player', 1)).toBe(1);
    expect(withReserve.sides.player.awaitingReplacement).toBe(false);

    const noReserve = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'eevee')],
    });
    noReserve.sides.player.party[0].hp = 0;
    emptyTurn(noReserve);
    expect(noReserve.winner).toBeNull();
    expect(noReserve.sides.player.awaitingReplacement).toBe(false);
    expect(needsReplacement(noReserve)).not.toContain('player');
  });

  it('ends the battle only when a side has no healthy Pokémon left', () => {
    const loss = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'eevee')],
    });
    loss.sides.player.party[0].hp = 0;
    loss.sides.player.party[1].hp = 0;
    emptyTurn(loss);
    expect(loss.winner).toBe('enemy');

    const draw = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur'), fighter('e2', 'eevee')],
    });
    for (const side of ['player', 'enemy'] as const) {
      for (const member of draw.sides[side].party) member.hp = 0;
    }
    emptyTurn(draw);
    expect(draw.winner).toBe('draw');
  });

  it('has the partner AI pick a live foe slot and never a dead one', () => {
    const state = board({
      player: [fighter('p1', 'charmander'), fighter('p2', 'squirtle')],
      enemy: [fighter('e1', 'bulbasaur', ['tackle']), fighter('e2', 'geodude', ['tackle'])],
    });
    state.sides.player.party[0].hp = 0;
    const command = chooseAiCommand(state, 'enemy', { slot: 1 }) as FightCommand;
    expect(command.type).toBe('fight');
    expect(command.slot).toBe(1);
    expect(command.target).toBeDefined();
    expect(command.target?.side).toBe('player');
    expect(command.target?.slot).toBe(1);
    const aimed = command.target;
    if (aimed) {
      expect(activeFighter(state, aimed.side, aimed.slot).hp).toBeGreaterThan(0);
    }
  });

  it('reproduces the same double battle from the same seed and commands', () => {
    const run = (): BattleState => {
      const state = board({
        player: [
          fighter('p1', 'charmander', ['ember', 'tackle']),
          fighter('p2', 'squirtle', ['watergun', 'tackle']),
          fighter('p3', 'geodude', ['tackle']),
        ],
        enemy: [
          fighter('e1', 'bulbasaur', ['vinewhip', 'tackle']),
          fighter('e2', 'eevee', ['tackle', 'quickattack']),
          fighter('e3', 'pidgey', ['tackle']),
        ],
        seed: 2026,
      });
      for (let turn = 0; turn < 8 && state.winner === null; turn++) {
        if (needsReplacement(state).length > 0) autoReplace(state);
        takeDoubleTurn(
          state,
          {
            0: { type: 'fight', moveIndex: 0, target: { side: 'enemy', slot: 0 } },
            1: {
              type: 'fight',
              moveIndex: 0,
              slot: 1,
              target: { side: 'enemy', slot: 1 },
            },
          },
          { 0: { type: 'fight', moveIndex: 0 }, 1: { type: 'fight', moveIndex: 0, slot: 1 } },
        );
      }
      return state;
    };
    const first = formatBattleLog(run());
    const second = formatBattleLog(run());
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});
