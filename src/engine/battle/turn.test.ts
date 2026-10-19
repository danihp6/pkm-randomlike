import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter, type FighterInput } from './fighter';
import {
  activeFighter,
  createBattle,
  emptyRoomField,
  hasHealthy,
  type BattleState,
  type RoomFieldEffects,
} from './state';
import { autoReplace, needsReplacement, takeTurn } from './turn';

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
      endured.log.some((event) => event.kind === 'text' && event.text.includes('endured the hit!')),
    ).toBe(true);

    const fainted = run();
    expect(activeFighter(fainted, 'enemy').hp).toBe(0);
    expect(fainted.winner).toBe('player');
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
