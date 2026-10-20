import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import './effects/items';
import './effects/abilities';
import { canRun, escapeOdds, rollRun } from './runAway';
import { activeFighter, createBattle, type BattleState } from './state';

const fighter = (id: string, speciesId: string, level: number) =>
  createFighter({ id, speciesId, level, nature: 'serious' });

const battle = (isWild: boolean, extra: Readonly<{ noFlee?: boolean }> = {}): BattleState =>
  createBattle({
    player: [fighter('player', 'charmander', 50)],
    enemy: [fighter('enemy', 'geodude', 2)],
    rng: new Rng(1),
    isWild,
    ...extra,
  });

/** A wild battle that forbids fleeing, with a player built from `input`. */
const guardianBattle = (input: Readonly<{ heldItem?: string; ability?: string }>): BattleState =>
  createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 50,
        nature: 'serious',
        ...input,
      }),
    ],
    enemy: [fighter('enemy', 'geodude', 2)],
    rng: new Rng(1),
    isWild: true,
    noFlee: true,
  });

const trainerBattle = (input: Readonly<{ heldItem?: string; ability?: string }>): BattleState =>
  createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 50,
        nature: 'serious',
        ...input,
      }),
    ],
    enemy: [fighter('enemy', 'geodude', 2)],
    rng: new Rng(1),
    isWild: false,
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

describe('the no-flee rule', () => {
  it('refuses a wild launch that carries noFlee', () => {
    expect(canRun(battle(true, { noFlee: true }), 'player')).toBe(false);
    expect(canRun(battle(true), 'player')).toBe(true);
  });

  it('grants the escape to a Smoke Ball holder', () => {
    const state = guardianBattle({ heldItem: 'smokeball' });
    expect(canRun(state, 'player')).toBe(true);
    expect(rollRun(state, 'player', new Rng(7))).toBe(true);
    expect(state.escapeAttempts).toBe(0);
  });

  it('grants the escape to a Run Away holder', () => {
    const state = guardianBattle({ ability: 'Run Away' });
    expect(canRun(state, 'player')).toBe(true);
    expect(rollRun(state, 'player', new Rng(7))).toBe(true);
    expect(state.escapeAttempts).toBe(0);
  });

  it('refuses without a grant and draws no odds, recording no attempt', () => {
    const state = guardianBattle({});
    expect(rollRun(state, 'player', new Rng(7))).toBe(false);
    expect(canRun(state, 'player')).toBe(false);
    expect(state.escapeAttempts).toBe(0);
  });

  it('stays refused in a trainer battle even with a Smoke Ball or Run Away', () => {
    expect(canRun(trainerBattle({ heldItem: 'smokeball' }), 'player')).toBe(false);
    expect(canRun(trainerBattle({ ability: 'Run Away' }), 'player')).toBe(false);
    expect(rollRun(trainerBattle({ heldItem: 'smokeball' }), 'player', new Rng(7))).toBe(false);
    expect(rollRun(trainerBattle({ ability: 'Run Away' }), 'player', new Rng(7))).toBe(false);
  });

  it('still refuses a trapped Smoke Ball holder', () => {
    const state = guardianBattle({ heldItem: 'smokeball' });
    activeFighter(state, 'player').volatiles.trapped = true;
    expect(canRun(state, 'player')).toBe(false);
  });
});
