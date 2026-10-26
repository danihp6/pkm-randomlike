import { describe, expect, it } from 'vitest';
import { getMove } from '../../data/dex';
import { Rng } from '../rng';
import { scriptedBattle } from './harness';
import { createFighter, type FighterInput } from './fighter';
import {
  activeFighter,
  createBattle,
  emptyRoomField,
  hasHealthy,
  isTrapped,
  type BattleState,
  type RoomFieldEffects,
} from './state';
import { autoReplace, needsReplacement, takeTurn, teamTypeStatusChance, useMove } from './turn';
import { makeContext, runModifyMultihit } from './effects/registry';
import { multiHitPower } from './modifiers';
import { SEMI_INVULNERABLE_COUNTER_MULTIPLIER } from './volatile';

const build = (
  player: readonly FighterInput[],
  enemy: readonly FighterInput[],
  seed = 42,
  isWild = true,
  roomField?: Partial<RoomFieldEffects>,
): BattleState =>
  createBattle({
    player: player.map((input) => createFighter(input)),
    enemy: enemy.map((input) => createFighter(input)),
    rng: new Rng(seed),
    isWild,
    ...(roomField ? { roomField } : {}),
  });

const fight = (moveIndex = 0) => ({ type: 'fight', moveIndex }) as const;

describe('takeTurn', () => {
  it('resolves both moves, spends PP and deals damage', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 30, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 10, moves: ['tackle'] }],
    );
    const pp = state.sides.player.party[0].moves[0].pp;
    takeTurn(state, fight(), fight());
    expect(state.turn).toBe(1);
    expect(state.sides.player.party[0].moves[0].pp).toBe(pp - 1);
    expect(state.sides.enemy.party[0].hp).toBeLessThan(state.sides.enemy.party[0].maxHp);
    expect(state.log.some((event) => event.kind === 'move')).toBe(true);
  });

  it('applies a status move to the foe', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['growl'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
    );
    takeTurn(state, fight(), fight());
    expect(state.sides.enemy.party[0].boosts.atk).toBe(-1);
  });

  it('throws on an illegal command', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
    );
    expect(() => takeTurn(state, fight(9), fight())).toThrow();
  });
});

describe('faints and replacements', () => {
  it('ends the battle when the enemy is wiped', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 30, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 5, moves: ['tackle'] }],
    );
    state.sides.enemy.party[0].hp = 1;
    takeTurn(state, fight(), fight());
    expect(state.winner).toBe('player');
    expect(hasHealthy(state, 'enemy')).toBe(false);
  });

  it('asks for a replacement when a side still has healthy members', () => {
    const state = build(
      [{ id: 'p1', speciesId: 'charmander', level: 30, moves: ['ember'] }],
      [
        { id: 'e1', speciesId: 'bulbasaur', level: 5, moves: ['tackle'] },
        { id: 'e2', speciesId: 'squirtle', level: 5, moves: ['tackle'] },
      ],
    );
    state.sides.enemy.party[0].hp = 1;
    takeTurn(state, fight(), fight());
    expect(state.winner).toBeNull();
    expect(needsReplacement(state)).toEqual(['enemy']);
    autoReplace(state);
    expect(activeFighter(state, 'enemy').id).toBe('e2');
    expect(needsReplacement(state)).toEqual([]);
  });

  it('loses the battle when the last party member falls', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 5, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 50, moves: ['vinewhip'] }],
    );
    state.sides.player.party[0].hp = 1;
    takeTurn(state, fight(), fight());
    expect(state.winner).toBe('enemy');
    expect(hasHealthy(state, 'player')).toBe(false);
  });
});

describe('escape', () => {
  it('a successful run ends a wild battle without a winner', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 50, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'geodude', level: 2, moves: ['tackle'] }],
      1,
      true,
    );
    takeTurn(state, { type: 'run' }, fight());
    expect(state.winner).toBe('draw');
    expect(state.log.some((event) => event.kind === 'run' && event.success)).toBe(true);
  });
});

describe('secondary effects', () => {
  it('applies a single secondary exactly once', () => {
    const state = build(
      [{ id: 'p', speciesId: 'croconaw', level: 20, moves: ['bulldoze'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 40, moves: ['growl'] }],
    );
    state.sides.enemy.party[0].maxHp = 100000;
    state.sides.enemy.party[0].hp = 100000;
    takeTurn(state, fight(), fight());
    expect(activeFighter(state, 'enemy').boosts.spe).toBe(-1);
  });

  it('applies a self-targeting secondary once', () => {
    const state = build(
      [{ id: 'p', speciesId: 'croconaw', level: 20, moves: ['flamecharge'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 40, moves: ['growl'] }],
    );
    state.sides.enemy.party[0].maxHp = 100000;
    state.sides.enemy.party[0].hp = 100000;
    takeTurn(state, fight(), fight());
    expect(activeFighter(state, 'player').boosts.spe).toBe(1);
  });

  it('applies each entry of a multi-secondary move once', () => {
    const state = build(
      [{ id: 'p', speciesId: 'croconaw', level: 20, moves: ['firefang'] }],
      [{ id: 'e', speciesId: 'blissey', level: 40, moves: ['growl'] }],
      7,
    );
    state.sides.enemy.party[0].maxHp = 100000;
    state.sides.enemy.party[0].hp = 100000;
    for (let i = 0; i < 200 && activeFighter(state, 'enemy').status === null; i++) {
      state.sides.player.party[0].moves[0].pp = 40;
      takeTurn(state, fight(), { type: 'fight', moveIndex: 0 });
    }
    expect(activeFighter(state, 'enemy').status).toBe('brn');
  });
});

describe('ability interactions in the turn loop', () => {
  it('Pressure doubles the PP a foe move costs', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'dusclops', level: 20, ability: 'Pressure', moves: ['tackle'] }],
    );
    const before = state.sides.player.party[0].moves[0].pp;
    takeTurn(state, fight(), fight());
    expect(state.sides.player.party[0].moves[0].pp).toBe(before - 2);
  });

  it('Pressure costs the extra PP from the second ability slot too', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
      [
        {
          id: 'e',
          speciesId: 'dusclops',
          level: 20,
          ability: 'Frisk',
          secondAbility: 'Pressure',
          moves: ['tackle'],
        },
      ],
    );
    const before = state.sides.player.party[0].moves[0].pp;
    takeTurn(state, fight(), fight());
    expect(state.sides.player.party[0].moves[0].pp).toBe(before - 2);
  });

  it('Protean changes the holder type from the second ability slot', () => {
    const state = build(
      [
        {
          id: 'p',
          speciesId: 'pidgey',
          level: 20,
          ability: 'Keen Eye',
          secondAbility: 'Protean',
          moves: ['ember'],
        },
      ],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
    );
    const player = activeFighter(state, 'player');
    expect(player.types).toEqual(['Normal', 'Flying']);
    takeTurn(state, fight(), fight());
    expect(player.types).toEqual(['Fire']);
    expect(player.volatiles.proteanUsed).toBe(true);
  });

  it('Liquid Ooze makes a drain move hurt its user', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['absorb'] }],
      [{ id: 'e', speciesId: 'tentacool', level: 20, ability: 'Liquid Ooze', moves: ['growl'] }],
    );
    const player = state.sides.player.party[0];
    const before = player.hp;
    takeTurn(state, fight(), fight());
    expect(player.hp).toBeLessThan(before);
  });
});

describe('the no-heal room in the turn loop', () => {
  /** A battle launched from the no-heal leaf (`BattleLaunch.noHeal`). */
  const buildRoom = (
    player: readonly FighterInput[],
    enemy: readonly FighterInput[],
    seed = 42,
  ): BattleState =>
    createBattle({
      player: player.map((input) => createFighter(input)),
      enemy: enemy.map((input) => createFighter(input)),
      rng: new Rng(seed),
      isWild: false,
      noHeal: true,
    });

  it('resolves an all-barred moveset as Struggle and restores no HP', () => {
    const state = buildRoom(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['synthesis'] }],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['tackle'] }],
    );
    const player = state.sides.player.party[0];
    player.hp = Math.floor(player.maxHp / 2);
    const before = player.hp;
    const pp = player.moves[0].pp;
    takeTurn(state, fight(), fight());
    // The barred move was never used: no PP spent, no heal, Struggle instead.
    expect(state.log.some((event) => event.kind === 'move' && event.moveId === 'synthesis')).toBe(false);
    expect(state.log.some((event) => event.kind === 'move' && event.moveId === 'struggle')).toBe(true);
    expect(state.log.some((event) => event.kind === 'heal' && event.side === 'player')).toBe(false);
    expect(player.moves[0].pp).toBe(pp);
    expect(player.hp).toBeLessThan(before);
  });

  it('refuses a barred move while another one is legal, before any roll', () => {
    const state = buildRoom(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['synthesis', 'ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
    );
    expect(() => takeTurn(state, fight(0), fight())).toThrow('That move cannot be used in this room.');
    expect(state.turn).toBe(0);
    expect(state.sides.player.party[0].hp).toBe(state.sides.player.party[0].maxHp);
  });

  it('leaves the enemy’s own healing move working', () => {
    const state = buildRoom(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['growl'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['synthesis'] }],
    );
    const enemy = state.sides.enemy.party[0];
    enemy.hp = Math.floor(enemy.maxHp / 3);
    const before = enemy.hp;
    takeTurn(state, fight(), fight());
    expect(state.log.some((event) => event.kind === 'move' && event.moveId === 'synthesis')).toBe(true);
    expect(state.log.some((event) => event.kind === 'heal' && event.side === 'enemy')).toBe(true);
    expect(enemy.hp).toBeGreaterThan(before);
  });
});

class CountingRng extends Rng {
  draws = 0;

  override next(): number {
    this.draws += 1;
    return super.next();
  }
}

describe('the room’s whole-field rules in the turn loop', () => {
  it('defaults roomField to the empty field and merges a partial over it', () => {
    const plain = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
    );
    expect(plain.roomField).toEqual(emptyRoomField());

    const partial = build(
      [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      42,
      true,
      { endure: true },
    );
    expect(partial.roomField).toEqual({ ...emptyRoomField(), endure: true });
  });

  it('passes the all-types override into STAB and the chart', () => {
    const damageEvent = (roomField?: Partial<RoomFieldEffects>) => {
      const state = build(
        [{ id: 'p', speciesId: 'sentret', level: 30, moves: ['ember'] }],
        [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['growl'] }],
        11,
        false,
        roomField,
      );
      const enemy = state.sides.enemy.party[0];
      enemy.maxHp = 100000;
      enemy.hp = 100000;
      takeTurn(state, fight(), fight());
      const event = state.log.find((entry) => entry.kind === 'damage' && entry.side === 'enemy');
      if (event?.kind !== 'damage') throw new Error('the hit never landed');
      return event;
    };

    const plain = damageEvent();
    const overridden = damageEvent({ overrideType: 'Fire' });

    expect(plain.effectiveness).toBe(2);
    expect(overridden.effectiveness).toBe(0.5);
    expect(overridden.amount).toBeGreaterThan(0);
    expect(overridden.amount).toBeLessThan(plain.amount);
  });

  it('leaves the target at exactly 1 HP under the Endure room', () => {
    const run = (roomField?: Partial<RoomFieldEffects>) => {
      const state = build(
        [{ id: 'p', speciesId: 'charmander', level: 40, moves: ['ember'] }],
        [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['growl'] }],
        5,
        false,
        roomField,
      );
      state.sides.enemy.party[0].hp = 5;
      takeTurn(state, fight(), fight());
      return state;
    };

    const endured = run({ endure: true });
    expect(activeFighter(endured, 'enemy').hp).toBe(1);
    expect(endured.winner).toBeNull();
    expect(
      endured.log.some((event) => event.kind === 'text' && event.key === 'battle.log.enduredHit'),
    ).toBe(true);

    const fainted = run();
    expect(activeFighter(fainted, 'enemy').hp).toBe(0);
    expect(fainted.winner).toBe('player');
  });

  it('faints a target that already sits at 1 HP under the Endure room', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 40, moves: ['ember'] }],
      [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['growl'] }],
      5,
      false,
      { endure: true },
    );
    state.sides.enemy.party[0].hp = 1;
    takeTurn(state, fight(), fight());
    expect(activeFighter(state, 'enemy').hp).toBe(0);
    expect(state.winner).toBe('player');
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.enduredHit'),
    ).toBe(false);
  });

  it('crits with a +1 room stage whose roll the control misses', () => {
    // Seed 19's first draw (0.0585) sits between the 1/24 base rate and the 1/8
    // +1-stage rate, and Tackle is the first move, so the crit roll is that draw.
    const run = (roomField?: Partial<RoomFieldEffects>) => {
      const state = build(
        [{ id: 'p', speciesId: 'sentret', level: 40, moves: ['tackle'] }],
        [{ id: 'e', speciesId: 'bulbasaur', level: 5, moves: ['tackle'] }],
        19,
        false,
        roomField,
      );
      const enemy = state.sides.enemy.party[0];
      enemy.maxHp = 100000;
      enemy.hp = 100000;
      takeTurn(state, fight(), fight());
      const event = state.log.find((entry) => entry.kind === 'damage' && entry.side === 'enemy');
      if (event?.kind !== 'damage') throw new Error('the hit never landed');
      return event;
    };

    const plain = run();
    const crit = run({ critStage: 1 });

    expect(plain.crit).toBe(false);
    expect(crit.crit).toBe(true);
    expect(Math.abs(crit.amount * 2 - plain.amount * 3)).toBeLessThanOrEqual(3);
  });

  it('adds no RNG draw for any of the six rules', () => {
    const draws = (roomField?: Partial<RoomFieldEffects>) => {
      const rng = new CountingRng(9);
      const state = createBattle({
        player: [createFighter({ id: 'p', speciesId: 'sentret', level: 30, moves: ['bite'] })],
        enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['growl'] })],
        rng,
        isWild: false,
        ...(roomField ? { roomField } : {}),
      });
      const enemy = state.sides.enemy.party[0];
      enemy.maxHp = 100000;
      enemy.hp = 100000;
      takeTurn(state, fight(), fight());
      return rng.draws;
    };

    const control = draws();
    expect(control).toBeGreaterThan(0);
    expect(
      draws({
        abilitiesOff: true,
        darkAura: true,
        fairyAura: true,
        overrideType: 'Normal',
        endure: true,
        critStage: 1,
      }),
    ).toBe(control);
  });
});

describe('the status half in the turn loop', () => {
  it('Quash pins the quashed side to the back of the turn', () => {
    const order = (quash: boolean): readonly string[] => {
      const state = build(
        [{ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] }],
        [{ id: 'e', speciesId: 'pidgey', level: 40, moves: ['tackle'] }],
      );
      if (quash) activeFighter(state, 'enemy').volatiles.quash = true;
      takeTurn(state, fight(), fight());
      return state.log.flatMap((event) => (event.kind === 'move' ? [event.side] : []));
    };

    expect(order(false)).toEqual(['enemy', 'player']);
    expect(order(true)).toEqual(['player', 'enemy']);
  });

  it('Instruct makes the target repeat the move it last used', () => {
    const state = build(
      [{ id: 'p', speciesId: 'machamp', level: 30, moves: ['instruct', 'splash'] }],
      [{ id: 'e', speciesId: 'snorlax', level: 30, moves: ['tackle'] }],
    );
    const enemy = activeFighter(state, 'enemy');
    enemy.lastMoveId = 'tackle';
    const before = activeFighter(state, 'player').hp;

    useMove(state, 'player', { type: 'fight', moveIndex: 0 });

    const moves = state.log.flatMap((event) =>
      event.kind === 'move' && event.side === 'enemy' ? [event.moveId] : [],
    );
    expect(moves).toEqual(['tackle']);
    expect(activeFighter(state, 'player').hp).toBeLessThan(before);
    expect(enemy.moves[0].pp).toBe(35);
  });

  it('Instruct fails when the target has not moved yet', () => {
    const state = build(
      [{ id: 'p', speciesId: 'gengar', level: 30, moves: ['instruct'] }],
      [{ id: 'e', speciesId: 'snorlax', level: 30, moves: ['tackle'] }],
    );
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.fail')).toBe(
      true,
    );
  });

  it('Electrify makes the target next move Electric and is spent by it', () => {
    const state = build(
      [{ id: 'p', speciesId: 'gengar', level: 30, moves: ['electrify', 'splash'] }],
      [{ id: 'e', speciesId: 'snorlax', level: 30, moves: ['tackle'] }],
    );
    useMove(state, 'player', { type: 'fight', moveIndex: 0 });
    expect(activeFighter(state, 'enemy').volatiles.electrify).toBe(true);

    const player = activeFighter(state, 'player');
    const before = player.hp;
    takeTurn(state, fight(1), fight());
    expect(player.hp).toBeLessThan(before);
    expect(activeFighter(state, 'enemy').volatiles.electrify).toBe(false);
  });

  it('a Normal move is still immune on a Ghost without Electrify', () => {
    const state = build(
      [{ id: 'p', speciesId: 'gengar', level: 30, moves: ['splash'] }],
      [{ id: 'e', speciesId: 'snorlax', level: 30, moves: ['tackle'] }],
    );
    const before = activeFighter(state, 'player').hp;
    takeTurn(state, fight(), fight());
    expect(activeFighter(state, 'player').hp).toBe(before);
  });
});

describe('the status half in a scripted battle on seed 2026', () => {
  it('locks, torments, drains PP and chips a sleeper through the harness', () => {
    const state = scriptedBattle({
      player: [
        {
          id: 'player',
          speciesId: 'gengar',
          level: 30,
          moves: ['sludgebomb', 'nightmare', 'spite', 'torment'],
        },
      ],
      enemy: [{ id: 'enemy', speciesId: 'snorlax', level: 30, moves: ['tackle', 'rest'] }],
      turnCap: 4,
      playerCommand: (_state, turn) => fight([0, 1, 2, 3][turn - 1] ?? 3),
      enemyCommand: (_state, turn) => fight(turn === 1 ? 1 : 0),
    });

    const enemy = activeFighter(state, 'enemy');
    // Nightmare chipped the sleeper once before it woke on turn 3.
    expect(enemy.hp).toBe(enemy.maxHp - Math.max(1, Math.floor(enemy.maxHp / 4)));
    expect(enemy.status).toBeNull();
    expect(enemy.volatiles.nightmare).toBe(false);
    // Spite drained four PP from the Rest the foe last used.
    expect(enemy.moves[1].pp).toBe((getMove('rest')?.pp ?? 0) - 1 - 4);
    expect(enemy.volatiles.torment).toBe(true);
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.nightmare'),
    ).toBe(true);
  });
});

/** The damage events of a turn, in order. */
function damageEvents(state: BattleState): readonly { amount: number }[] {
  return state.log.flatMap((event) => (event.kind === 'damage' ? [{ amount: event.amount }] : []));
}

describe('the relative-damage half in the turn loop', () => {
  it('logs a fixed hit as neutral and uncritical, for its exact amount', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['seismictoss'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    takeTurn(state, fight(), fight());
    const event = state.log.find((entry) => entry.kind === 'damage');
    expect(event).toMatchObject({ amount: 50, hp: 73, maxHp: 123, effectiveness: 1, crit: false });
    expect(activeFighter(state, 'enemy').hp).toBe(73);
  });

  it('leaves a fixed hit’s target at 1 HP under Endure', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['seismictoss'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['endure'] }],
    );
    activeFighter(state, 'enemy').hp = 10;
    takeTurn(state, fight(), fight());
    expect(activeFighter(state, 'enemy').hp).toBe(1);
    expect(
      state.log.some((entry) => entry.kind === 'text' && entry.key === 'battle.log.enduredHit'),
    ).toBe(true);
  });

  it('lets a Substitute absorb a fixed hit', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['seismictoss'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    const enemy = activeFighter(state, 'enemy');
    enemy.volatiles.substitute = 40;
    takeTurn(state, fight(), fight());
    expect(enemy.hp).toBe(123);
    expect(enemy.volatiles.substitute).toBe(0);
    expect(
      state.log.some((entry) => entry.kind === 'text' && entry.key === 'battle.log.substituteFaded'),
    ).toBe(true);
  });

  it('fails Endeavor at equal HP instead of dealing nothing', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['endeavor'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    takeTurn(state, fight(), fight());
    expect(state.log.some((entry) => entry.kind === 'text' && entry.key === 'battle.log.fail')).toBe(
      true,
    );
    expect(damageEvents(state)).toHaveLength(0);
    expect(activeFighter(state, 'enemy').hp).toBe(123);
  });

  it('mirrors twice the physical damage Counter took this turn', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['counter'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['tackle'] }],
    );
    activeFighter(state, 'player').boosts.spe = -6;
    takeTurn(state, fight(), fight());
    const [taken, mirrored] = damageEvents(state);
    expect(taken.amount).toBe(25);
    expect(mirrored.amount).toBe(50);
  });

  it('fails the OHKO rule against a higher level without drawing', () => {
    const rng = new CountingRng(9);
    const state = createBattle({
      player: [createFighter({ id: 'p', speciesId: 'ditto', level: 50, moves: ['fissure'] })],
      enemy: [createFighter({ id: 'e', speciesId: 'ditto', level: 60, moves: ['splash'] })],
      rng,
      isWild: true,
    });
    activeFighter(state, 'player').volatiles.lockOn = true;
    const enemy = activeFighter(state, 'enemy');
    useMove(state, 'player', fight());
    expect(rng.draws).toBe(0);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(state.log.some((entry) => entry.kind === 'text' && entry.key === 'battle.log.fail')).toBe(
      true,
    );
  });

  it('refuses Spit Up at no stockpile and spends the charge on a hit', () => {
    const empty = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['spitup'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    takeTurn(empty, fight(), fight());
    expect(empty.log.some((entry) => entry.kind === 'text' && entry.key === 'battle.log.fail')).toBe(
      true,
    );
    expect(activeFighter(empty, 'enemy').hp).toBe(123);

    const charged = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['spitup'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    const player = activeFighter(charged, 'player');
    player.volatiles.stockpile = 1;
    takeTurn(charged, fight(), fight());
    expect(damageEvents(charged)[0].amount).toBe(67);
    expect(activeFighter(charged, 'enemy').hp).toBe(56);
    expect(player.volatiles.stockpile).toBe(0);
  });

  it('lands one Beat Up hit per healthy party member', () => {
    const state = build(
      [
        { id: 'p1', speciesId: 'ditto', level: 50, moves: ['beatup'] },
        { id: 'p2', speciesId: 'ditto', level: 50, moves: ['splash'] },
        { id: 'p3', speciesId: 'ditto', level: 50, moves: ['splash'] },
      ],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    );
    state.sides.player.party[2].status = 'brn';
    takeTurn(state, fight(), fight());
    expect(damageEvents(state)).toHaveLength(2);
    expect(activeFighter(state, 'enemy').hp).toBe(110);
  });

  it('doubles Payback when the target has already moved this turn', () => {
    const run = (playerSpe: number): number => {
      const state = build(
        [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['payback'] }],
        [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['tackle'] }],
      );
      activeFighter(state, 'player').boosts.spe = playerSpe;
      takeTurn(state, fight(), fight());
      const dealt = state.log.find((entry) => entry.kind === 'damage' && entry.side === 'enemy');
      if (dealt?.kind !== 'damage') throw new Error('Payback never landed');
      return dealt.amount;
    };
    expect(run(6)).toBe(22);
    expect(run(-6)).toBe(43);
  });

  it('doubles Avalanche when the user was damaged this turn', () => {
    const run = (enemyMove: string): number => {
      const state = build(
        [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['avalanche'] }],
        [{ id: 'e', speciesId: 'ditto', level: 50, moves: [enemyMove] }],
      );
      takeTurn(state, fight(), fight());
      const dealt = state.log.find((entry) => entry.kind === 'damage' && entry.side === 'enemy');
      if (dealt?.kind !== 'damage') throw new Error('Avalanche never landed');
      return dealt.amount;
    };
    expect(run('splash')).toBe(25);
    expect(run('tackle')).toBe(51);
  });

  it('heals for a quarter on Present’s heal branch and hits on its damaging one', () => {
    const heal = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['present'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      13,
    );
    activeFighter(heal, 'enemy').hp = 40;
    takeTurn(heal, fight(), fight());
    expect(activeFighter(heal, 'enemy').hp).toBe(70);
    expect(heal.log.some((entry) => entry.kind === 'heal' && entry.side === 'enemy')).toBe(true);
    expect(damageEvents(heal)).toHaveLength(0);

    const hit = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['present'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      1,
    );
    activeFighter(hit, 'enemy').hp = 40;
    takeTurn(hit, fight(), fight());
    expect(damageEvents(hit)[0].amount).toBe(28);
    expect(activeFighter(hit, 'enemy').hp).toBe(12);
  });
});

describe('the four team-type bonuses in the turn loop', () => {
  const launch = (teamTypes?: readonly string[]) =>
    createBattle({
      player: [createFighter({ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] })],
      enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 40, moves: ['growl'] })],
      rng: new Rng(2),
      isWild: false,
      ...(teamTypes ? { teamTypes } : {}),
    });

  it('defaults to no repeated type and carries the launch’s list', () => {
    expect(launch().teamTypes).toEqual([]);
    expect(launch(['Fire']).teamTypes).toEqual(['Fire']);
  });

  it('adds twenty points to its own status and nothing to the rest', () => {
    const fire = launch(['Fire']);
    const plain = launch();
    const pairs: readonly (readonly [string, string])[] = [
      ['Fire', 'brn'],
      ['Ice', 'frz'],
      ['Electric', 'par'],
      ['Poison', 'psn'],
    ];
    for (const [type, status] of pairs) {
      expect(teamTypeStatusChance(launch([type]), type, status, 10), type).toBe(30);
      expect(teamTypeStatusChance(plain, type, status, 10), type).toBe(10);
    }
    expect(teamTypeStatusChance(fire, 'Fire', 'par', 10)).toBe(10);
    expect(teamTypeStatusChance(fire, 'Ice', 'brn', 10)).toBe(10);
    expect(teamTypeStatusChance(fire, 'Fire', undefined, 10)).toBe(10);
    expect(teamTypeStatusChance(fire, 'Fire', 'brn', 90)).toBe(100);
  });

  it('lands a secondary roll with the bonus that misses without it', () => {
    // Seed 2's Ember secondary draws 11-30: over the printed 10 % and under the 30 %.
    const status = (teamTypes?: readonly string[]) => {
      const state = launch(teamTypes);
      takeTurn(state, fight(), fight());
      return activeFighter(state, 'enemy').status;
    };
    expect(status()).toBeNull();
    expect(status(['Fire'])).toBe('brn');
  });

  it('never gives the enemy the damage bonus', () => {
    const dealt = (teamTypes?: readonly string[]) => {
      const state = createBattle({
        player: [createFighter({ id: 'p', speciesId: 'sentret', level: 40, moves: ['growl'] })],
        enemy: [createFighter({ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember'] })],
        rng: new Rng(2),
        isWild: false,
        ...(teamTypes ? { teamTypes } : {}),
      });
      takeTurn(state, fight(), fight());
      const event = state.log.find((entry) => entry.kind === 'damage' && entry.side === 'player');
      if (event?.kind !== 'damage') throw new Error('the hit never landed');
      return event.amount;
    };
    expect(dealt(['Fire'])).toBe(dealt());
  });
});

/** Every log line's key, in log order. */
const textKeys = (state: BattleState): readonly string[] =>
  state.log.flatMap((event) => (event.kind === 'text' ? [event.key] : []));

describe('the partial trap (Task-159)', () => {
  it('pays the trap on the following turn, never on the landing turn', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 30, moves: ['bind', 'splash'] }],
      [{ id: 'e', speciesId: 'snorlax', level: 30, moves: ['splash'] }],
    );
    const enemy = activeFighter(state, 'enemy');
    const full = enemy.hp;

    useMove(state, 'player', fight(0));
    const landed = enemy.hp;
    expect(landed).toBeLessThan(full);
    expect(enemy.volatiles.partiallyTrapped?.moveId).toBe('bind');
    expect(textKeys(state)).not.toContain('battle.log.partiallyTrapped');

    takeTurn(state, fight(1), fight(0));
    expect(enemy.hp).toBe(landed - Math.max(1, Math.floor(enemy.maxHp / 8)));
    expect(textKeys(state)).toContain('battle.log.partiallyTrapped');
  });

  it('still hurts a Ghost with the trap but no longer pins it', () => {
    const state = build(
      [{ id: 'p', speciesId: 'charmander', level: 30, moves: ['firespin', 'splash'] }],
      [{ id: 'e', speciesId: 'shuppet', level: 30, ability: 'Insomnia', moves: ['splash'] }],
    );
    const ghost = activeFighter(state, 'enemy');
    const full = ghost.hp;

    useMove(state, 'player', fight(0));
    const landed = ghost.hp;
    expect(landed).toBeLessThan(full);
    expect(ghost.volatiles.trapped).toBe(true);
    expect(isTrapped(state, 'enemy')).toBe(false);

    takeTurn(state, fight(1), fight(0));
    expect(ghost.hp).toBe(landed - Math.max(1, Math.floor(ghost.maxHp / 8)));
    expect(isTrapped(state, 'enemy')).toBe(false);

    const plain = build(
      [{ id: 'p', speciesId: 'charmander', level: 30, moves: ['firespin', 'splash'] }],
      [{ id: 'e', speciesId: 'charmander', level: 30, ability: 'Insomnia', moves: ['splash'] }],
    );
    useMove(plain, 'player', fight(0));
    expect(activeFighter(plain, 'enemy').volatiles.trapped).toBe(true);
    expect(isTrapped(plain, 'enemy')).toBe(true);
  });
});

/** The two ends of a dex multihit: a fixed count reads as both. */
function hitRange(moveId: string): readonly [number, number] {
  const multihit = getMove(moveId)?.multihit;
  if (multihit === undefined) throw new Error(`${moveId} carries no multihit`);
  return typeof multihit === 'number' ? [multihit, multihit] : [multihit[0], multihit[1]];
}

/** One move against a clean Ditto board on a fixed seed, the foe holding still. */
function charge(moveId: string, seed: number, ability?: string): BattleState {
  const state = build(
    [
      {
        id: 'p',
        speciesId: 'ditto',
        level: 50,
        ...(ability ? { ability } : {}),
        moves: [moveId],
      },
    ],
    [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
    seed,
  );
  useMove(state, 'player', fight());
  return state;
}

describe('the per-hit rule of the multiaccuracy moves (Task-160)', () => {
  it('pins the three dex facts the rule reads', () => {
    expect(getMove('populationbomb')?.multiaccuracy).toBe(true);
    expect(getMove('tripleaxel')?.multiaccuracy).toBe(true);
    expect(getMove('triplekick')?.multiaccuracy).toBe(true);
    expect(hitRange('populationbomb')).toEqual([10, 10]);
    expect(hitRange('tripleaxel')).toEqual([3, 3]);
    expect(hitRange('triplekick')).toEqual([3, 3]);
    expect(getMove('pinmissile')?.multiaccuracy).toBeUndefined();
  });

  it('ramps the Triple pair and leaves a flat multi-hit alone', () => {
    const powers = (moveId: string, hits: number): readonly number[] =>
      Array.from({ length: hits }, (_, hit) => multiHitPower(getMove(moveId)!, hit));

    expect(powers('triplekick', 3)).toEqual([10, 20, 30]);
    expect(powers('tripleaxel', 3)).toEqual([20, 40, 60]);
    expect(powers('populationbomb', 10)).toEqual([20, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
    expect(powers('pinmissile', 5)).toEqual([25, 25, 25, 25, 25]);
  });

  it('rolls before every hit after the first and stops the move on the first miss', () => {
    // Seed 1's second per-hit roll lands over Triple Kick's 90 %, the first hit's aim roll under it.
    const state = charge('triplekick', 1);
    expect(damageEvents(state)).toEqual([{ amount: 16 }]);
    expect(textKeys(state).filter((key) => key === 'battle.log.missed')).toHaveLength(1);
  });

  it('reports a rising per-hit sequence when all three Triple Kick hits land', () => {
    const state = charge('triplekick', 2);
    const amounts = damageEvents(state).map((event) => event.amount);
    expect(amounts).toHaveLength(3);
    expect(amounts[0]).toBeLessThan(amounts[1]!);
    expect(amounts[1]).toBeLessThan(amounts[2]!);
    const enemy = activeFighter(state, 'enemy');
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(enemy.maxHp - enemy.hp);
    expect(textKeys(state)).not.toContain('battle.log.missed');
  });

  it('lands all ten Population Bomb hits on one seed and stops at the fourth on another', () => {
    const landed = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['populationbomb'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      3,
    );
    const wall = activeFighter(landed, 'enemy');
    wall.maxHp = 100000;
    wall.hp = 100000;
    useMove(landed, 'player', fight());
    expect(damageEvents(landed)).toHaveLength(10);
    expect(textKeys(landed)).not.toContain('battle.log.missed');
    expect(damageEvents(landed).reduce((sum, event) => sum + event.amount, 0)).toBe(100000 - wall.hp);

    // Seed 44's fifth per-hit roll lands over the 90 %, so only four hits are paid.
    const stopped = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['populationbomb'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      44,
    );
    const target = activeFighter(stopped, 'enemy');
    target.maxHp = 100000;
    target.hp = 100000;
    useMove(stopped, 'player', fight());
    expect(damageEvents(stopped)).toHaveLength(4);
    expect(textKeys(stopped).filter((key) => key === 'battle.log.missed')).toHaveLength(1);
  });

  it('spends one draw per hit after the first, and none under Lock-On', () => {
    const draws = (moveId: string, seed: number): number => {
      const rng = new CountingRng(seed);
      const state = createBattle({
        player: [createFighter({ id: 'p', speciesId: 'ditto', level: 50, moves: [moveId] })],
        enemy: [createFighter({ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] })],
        rng,
        isWild: true,
      });
      useMove(state, 'player', fight());
      return rng.draws;
    };
    // Seed 2 lands three hits for both moves; Triple Kick only adds its two per-hit rolls.
    expect(draws('triplekick', 2) - draws('tripledive', 2)).toBe(2);

    const locked = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, moves: ['triplekick'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      1,
    );
    activeFighter(locked, 'player').volatiles.lockOn = true;
    useMove(locked, 'player', fight());
    expect(damageEvents(locked)).toHaveLength(3);
    expect(textKeys(locked)).not.toContain('battle.log.missed');
  });

  it('Skill Link keeps the full count and does not buy the rolls', () => {
    const state = build(
      [{ id: 'p', speciesId: 'ditto', level: 50, ability: 'Skill Link', moves: ['populationbomb'] }],
      [{ id: 'e', speciesId: 'ditto', level: 50, moves: ['splash'] }],
      44,
    );
    const target = activeFighter(state, 'enemy');
    target.maxHp = 100000;
    target.hp = 100000;
    useMove(state, 'player', fight());
    expect(damageEvents(state)).toHaveLength(4);
    expect(textKeys(state).filter((key) => key === 'battle.log.missed')).toHaveLength(1);

    const move = getMove('populationbomb')!;
    expect(
      runModifyMultihit(
        makeContext(state, 'player', {
          source: activeFighter(state, 'player'),
          target,
          move,
        }),
        move,
        10,
      ),
    ).toBe(10);
  });
});

/** The damage a side took, in log order. */
const damageTaken = (state: BattleState, side: 'player' | 'enemy'): readonly number[] =>
  state.log.flatMap((event) => (event.kind === 'damage' && event.side === side ? [event.amount] : []));

/** A fast Dugtrio charging Dig against a slow Bulbasaur carrying the two counters. */
function digBoard(seed: number): BattleState {
  return build(
    [{ id: 'p', speciesId: 'dugtrio', level: 20, moves: ['dig', 'tackle', 'splash'] }],
    [{ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle', 'earthquake', 'splash'] }],
    seed,
  );
}

describe('the semi-invulnerable charge turn (Task-168)', () => {
  it('dodges every aimed move behind Dig and fires on the second turn (seed 1)', () => {
    const state = digBoard(1);
    const player = activeFighter(state, 'player');
    const enemy = activeFighter(state, 'enemy');
    const startPlayerHp = player.hp;
    const startEnemyHp = enemy.hp;

    takeTurn(state, fight(0), fight(0));
    expect(player.volatiles.charging).toBe('dig');
    expect(player.volatiles.semiInvulnerable).toBe('dig');
    expect(player.volatiles.semiInvulnerable).toBe(player.volatiles.charging);
    expect(textKeys(state)).toContain('battle.log.missed');
    expect(player.hp).toBe(startPlayerHp);
    expect(enemy.hp).toBe(startEnemyHp);

    takeTurn(state, fight(1), fight(0));
    expect(player.volatiles.charging).toBeNull();
    expect(player.volatiles.semiInvulnerable).toBeNull();
    expect(player.hp).toBe(startPlayerHp - 9);
    expect(enemy.hp).toBe(startEnemyHp - 36);
  });

  it('lets Earthquake reach Dig, does not roll its aim away and doubles it (seed 1)', () => {
    const quake = digBoard(1);
    const quakePlayer = activeFighter(quake, 'player');
    const startPlayerHp = quakePlayer.hp;

    takeTurn(quake, fight(0), fight(1));
    expect(textKeys(quake)).not.toContain('battle.log.missed');
    expect(damageTaken(quake, 'player')).toEqual([34]);
    expect(quakePlayer.hp).toBe(startPlayerHp - 34);

    const control = digBoard(1);
    takeTurn(control, fight(0), fight(0));
    expect(textKeys(control)).toContain('battle.log.missed');
    const controlTaken = damageTaken(control, 'player');
    const quakeTaken = damageTaken(quake, 'player');
    const sum = (amounts: readonly number[]): number =>
      amounts.reduce((total, amount) => total + amount, 0);
    expect(sum(quakeTaken)).toBeGreaterThan(sum(controlTaken));
    expect(controlTaken).toEqual([]);

    // The doubling itself: the same seed with the target visible rolls the same hit
    // and pays exactly the multiplier, so the counter connects for twice as much.
    const visible = digBoard(1);
    takeTurn(visible, fight(2), fight(1));
    expect(damageTaken(visible, 'player')).toHaveLength(1);
    expect(quakeTaken).toEqual([
      damageTaken(visible, 'player')[0]! * SEMI_INVULNERABLE_COUNTER_MULTIPLIER,
    ]);
  });

  it('leaves a charge that does not hide reachable, and no stale flag behind it', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['solarbeam'] }],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['tackle'] }],
      1,
    );
    takeTurn(state, fight(0), fight(0));
    const player = activeFighter(state, 'player');
    expect(player.volatiles.charging).toBe('solarbeam');
    expect(player.volatiles.semiInvulnerable).toBeNull();
    expect(player.hp).toBeLessThan(player.maxHp);
  });
});
