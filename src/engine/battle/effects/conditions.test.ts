import { describe, expect, it } from 'vitest';
import { getMove } from '../../../data/dex';
import { Rng } from '../../rng';
import { computeDamage } from '../damage';
import { createFighter } from '../fighter';
import { orderActions } from '../order';
import { createBattle, type BattleState } from '../state';
import { setFieldCondition, setSideCondition, tickConditions } from './conditions';

function battle(): BattleState {
  return createBattle({
    player: [createFighter({ id: 'p', speciesId: 'charmander', level: 20, moves: ['ember'] })],
    enemy: [createFighter({ id: 'e', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] })],
    rng: new Rng(5),
    isWild: true,
  });
}

describe('side conditions', () => {
  it('sets a duration and ticks it down, announcing the expiry', () => {
    const state = battle();
    setSideCondition(state, 'player', 'reflect');
    expect(state.sides.player.sideConditions.reflect).toBe(5);
    for (let i = 0; i < 4; i++) tickConditions(state);
    expect(state.sides.player.sideConditions.reflect).toBe(1);
    tickConditions(state);
    expect(state.sides.player.sideConditions.reflect).toBe(0);
    expect(
      state.log.some((event) => event.kind === 'text' && event.key === 'battle.log.side.end.reflect'),
    ).toBe(true);
  });
});

describe('field conditions', () => {
  it('sets a duration and ticks it down', () => {
    const state = battle();
    setFieldCondition(state, 'trickroom');
    expect(state.field.trickroom).toBe(5);
    for (let i = 0; i < 5; i++) tickConditions(state);
    expect(state.field.trickroom).toBe(0);
  });
});

describe('Trick Room and Tailwind', () => {
  it('reverses the Speed order under Trick Room', () => {
    const state = battle();
    const entries = [
      { side: 'player' as const, priority: 0 },
      { side: 'enemy' as const, priority: 0 },
    ];
    const normal = orderActions(state, entries).map((entry) => entry.side);
    state.field.trickroom = 5;
    const reversed = orderActions(state, entries).map((entry) => entry.side);
    expect(reversed).toEqual([...normal].reverse());
  });

  it('doubles the side Speed under Tailwind', () => {
    const state = battle();
    const entries = [
      { side: 'player' as const, priority: 0 },
      { side: 'enemy' as const, priority: 0 },
    ];
    const before = orderActions(state, entries).map((entry) => entry.side);
    const slower = before[before.length - 1];
    setSideCondition(state, slower, 'tailwind');
    const after = orderActions(state, entries).map((entry) => entry.side);
    expect(after[0]).toBe(slower);
  });
});

describe('screens', () => {
  it('halves physical damage under Reflect and special under Light Screen', () => {
    const state = battle();
    const attacker = state.sides.player.party[0];
    const defender = state.sides.enemy.party[0];
    const physical = getMove('tackle')!;
    const special = getMove('ember')!;

    const plainPhysical = computeDamage(attacker, defender, physical, new Rng(9)).damage;
    const screenedPhysical = computeDamage(attacker, defender, physical, new Rng(9), {
      reflect: true,
    }).damage;
    expect(screenedPhysical).toBeLessThan(plainPhysical);

    const plainSpecial = computeDamage(attacker, defender, special, new Rng(9)).damage;
    const screenedSpecial = computeDamage(attacker, defender, special, new Rng(9), {
      lightScreen: true,
    }).damage;
    expect(screenedSpecial).toBeLessThan(plainSpecial);
  });
});
