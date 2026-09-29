import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { attemptCapture, catchValue } from './capture';
import { createFighter } from './fighter';
import { createBattle, type BattleState } from './state';

const fighter = (id: string, speciesId: string) =>
  createFighter({ id, speciesId, level: 10, nature: 'serious' });

const battle = (isWild: boolean): BattleState =>
  createBattle({
    player: [fighter('player', 'charmander')],
    enemy: [fighter('enemy', 'sentret')],
    rng: new Rng(1),
    isWild,
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
