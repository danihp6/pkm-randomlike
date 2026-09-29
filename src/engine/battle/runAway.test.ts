import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import { canRun, escapeOdds, rollRun } from './runAway';
import { activeFighter, createBattle, type BattleState } from './state';

const fighter = (id: string, speciesId: string, level: number) =>
  createFighter({ id, speciesId, level, nature: 'serious' });

const battle = (isWild: boolean): BattleState =>
  createBattle({
    player: [fighter('player', 'charmander', 50)],
    enemy: [fighter('enemy', 'geodude', 2)],
    rng: new Rng(1),
    isWild,
  });

describe('canRun', () => {
  it('only works in a wild battle', () => {
    expect(canRun(battle(true), 'player')).toBe(true);
    expect(canRun(battle(false), 'player')).toBe(false);
  });

  it('refuses when trapped', () => {
    const state = battle(true);
    activeFighter(state, 'player').volatiles.trapped = true;
    expect(canRun(state, 'player')).toBe(false);
  });
});

describe('escapeOdds', () => {
  it('grows with speed and with failed attempts', () => {
    expect(escapeOdds(100, 50, 0)).toBeGreaterThan(escapeOdds(30, 50, 0));
    expect(escapeOdds(30, 50, 5)).toBeGreaterThan(escapeOdds(30, 50, 0));
  });
});

describe('rollRun', () => {
  it('a much faster runner always escapes', () => {
    const state = battle(true);
    expect(rollRun(state, 'player', new Rng(7))).toBe(true);
  });

  it('never escapes a trainer battle and records no attempt', () => {
    const state = battle(false);
    expect(rollRun(state, 'player', new Rng(7))).toBe(false);
    expect(state.escapeAttempts).toBe(0);
  });
});
