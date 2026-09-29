import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter } from './fighter';
import { orderActions } from './order';
import { createBattle, type BattleState } from './state';

const fighter = (id: string, speciesId: string) =>
  createFighter({ id, speciesId, level: 20, nature: 'serious' });

const battle = (playerSpecies: string, enemySpecies: string, seed = 1): BattleState =>
  createBattle({
    player: [fighter('player', playerSpecies)],
    enemy: [fighter('enemy', enemySpecies)],
    rng: new Rng(seed),
    isWild: true,
  });

describe('orderActions', () => {
  it('puts priority before speed', () => {
    const state = battle('charmander', 'geodude');
    const order = orderActions(state, [
      { side: 'player', priority: 0 },
      { side: 'enemy', priority: 1 },
    ]);
    expect(order.map((entry) => entry.side)).toEqual(['enemy', 'player']);
  });

  it('breaks equal priority on effective speed', () => {
    const state = battle('charmander', 'geodude');
    const order = orderActions(state, [
      { side: 'enemy', priority: 0 },
      { side: 'player', priority: 0 },
    ]);
    expect(order.map((entry) => entry.side)).toEqual(['player', 'enemy']);
  });

  it('breaks exact ties deterministically from the rng', () => {
    const build = (seed: number) =>
      createBattle({
        player: [fighter('player', 'charmander')],
        enemy: [fighter('enemy', 'charmander')],
        rng: new Rng(seed),
        isWild: true,
      });
    const entries = [
      { side: 'player' as const, priority: 0 },
      { side: 'enemy' as const, priority: 0 },
    ];
    const first = orderActions(build(42), entries).map((entry) => entry.side);
    const second = orderActions(build(42), entries).map((entry) => entry.side);
    expect(first).toEqual(second);
  });
});
