import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { createFighter, type FighterInput } from './fighter';
import { activeFighter, createBattle, hasHealthy, type BattleState } from './state';
import { autoReplace, needsReplacement, takeTurn } from './turn';

const build = (
  player: readonly FighterInput[],
  enemy: readonly FighterInput[],
  seed = 42,
  isWild = true,
): BattleState =>
  createBattle({
    player: player.map((input) => createFighter(input)),
    enemy: enemy.map((input) => createFighter(input)),
    rng: new Rng(seed),
    isWild,
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
