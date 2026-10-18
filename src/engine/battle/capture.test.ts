import { describe, expect, it } from 'vitest';
import { catchRateOf } from '../../data/dex';
import { Rng } from '../rng';
import { attemptCapture, catchValue, catchValueFor, FIRST_CATCH_VALUE } from './capture';
import { createFighter } from './fighter';
import { createBattle, type BattleState } from './state';

const fighter = (id: string, speciesId: string) =>
  createFighter({ id, speciesId, level: 10, nature: 'serious' });

const battle = (isWild: boolean, firstCatch = false): BattleState =>
  createBattle({
    player: [fighter('player', 'charmander')],
    enemy: [fighter('enemy', 'sentret')],
    rng: new Rng(1),
    isWild,
    firstCatch,
  });

describe('catchValue', () => {
  it('rises as the target loses HP', () => {
    const full = fighter('t', 'sentret');
    const low = fighter('t', 'sentret');
    low.hp = 1;
    expect(catchValue(low, 255, 1)).toBeGreaterThan(catchValue(full, 255, 1));
  });

  it('adds the status bonus', () => {
    const fighterA = fighter('t', 'sentret');
    fighterA.hp = 1;
    const plain = catchValue(fighterA, 255, 1);
    fighterA.status = 'slp';
    expect(catchValue(fighterA, 255, 1)).toBeGreaterThan(plain);
  });
});

describe('attemptCapture', () => {
  it('a Master Ball never fails', () => {
    const result = attemptCapture(battle(true), 'enemy', 255, new Rng(3));
    expect(result.success).toBe(true);
    expect(result.shakes).toBe(4);
  });

  it('refuses outside a wild battle', () => {
    const result = attemptCapture(battle(false), 'enemy', 255, new Rng(3));
    expect(result.success).toBe(false);
  });

  it('is a pure function of the rng stream', () => {
    const target = () => {
      const state = battle(true);
      state.sides.enemy.party[0].hp = 1;
      return state;
    };
    const a = attemptCapture(target(), 'enemy', 1, new Rng(11));
    const b = attemptCapture(target(), 'enemy', 1, new Rng(11));
    expect(a).toEqual(b);
  });
});

describe('catchValueFor', () => {
  it('is a certain 255 while the run has caught nothing', () => {
    const full = fighter('t', 'charmander');
    expect(full.hp).toBe(full.maxHp);
    expect(FIRST_CATCH_VALUE).toBe(255);
    expect(catchValueFor(full, 1, true)).toBe(FIRST_CATCH_VALUE);
  });

  it('ignores a status and a weaker ball while the first catch is live', () => {
    const asleep = fighter('t', 'charmander');
    asleep.status = 'slp';
    expect(catchValueFor(asleep, 1, true)).toBe(FIRST_CATCH_VALUE);
  });

  it('is exactly the shipped formula otherwise', () => {
    const full = fighter('t', 'charmander');
    expect(catchRateOf('charmander')).toBe(45);
    expect(catchValueFor(full, 1, false)).toBe(catchValue(full, catchRateOf('charmander'), 1));
    expect(catchValueFor(full, 1, false)).toBe(15);

    const hurt = fighter('t', 'sentret');
    hurt.hp = 1;
    expect(catchValueFor(hurt, 2, false)).toBe(catchValue(hurt, catchRateOf('sentret'), 2));
  });
});

describe('createBattle firstCatch', () => {
  it('defaults to false when the setup omits it', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'sentret')],
      rng: new Rng(1),
      isWild: true,
    });
    expect(state.firstCatch).toBe(false);
  });

  it('carries the setup flag', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'sentret')],
      rng: new Rng(1),
      isWild: true,
      firstCatch: true,
    });
    expect(state.firstCatch).toBe(true);
  });
});

describe("attemptCapture and the run's first catch (seed 42)", () => {
  const fullHpWild = (firstCatch: boolean): BattleState =>
    createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'charmander')],
      rng: new Rng(42),
      isWild: true,
      firstCatch,
    });

  it('catches a full-HP wild with a plain ball on the first catch', () => {
    const state = fullHpWild(true);
    expect(state.sides.enemy.party[0].hp).toBe(state.sides.enemy.party[0].maxHp);
    expect(attemptCapture(state, 'enemy', 1, new Rng(42))).toEqual({
      success: true,
      shakes: 4,
      value: 255,
    });
  });

  it('falls back to the species rate on the same seed once a catch landed', () => {
    const state = fullHpWild(false);
    const result = attemptCapture(state, 'enemy', 1, new Rng(42));
    expect(result.success).toBe(false);
    expect(result.value).toBe(15);
    expect(result.shakes).toBeLessThan(4);
  });

  it('still refuses a certain first catch outside a wild battle', () => {
    const state = createBattle({
      player: [fighter('player', 'charmander')],
      enemy: [fighter('enemy', 'charmander')],
      rng: new Rng(42),
      isWild: false,
      firstCatch: true,
    });
    expect(attemptCapture(state, 'enemy', 1, new Rng(42))).toEqual({
      success: false,
      shakes: 0,
      value: 255,
    });
  });
});
