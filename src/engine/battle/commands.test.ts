import { describe, expect, it } from 'vitest';
import { getItem } from '../../data/items';
import { Rng } from '../rng';
import { legalMoveIndices, selectedMove, useBagItem, validateCommand, type Command } from './commands';
import { createFighter, type FighterInput } from './fighter';
import { createBattle, type BattleState } from './state';

const make = (input: FighterInput) => createFighter(input);

const build = (
  playerMoves: readonly string[],
  enemyMoves: readonly string[],
  isWild = true,
  bag: readonly { itemId: string; count: number }[] = [],
): BattleState =>
  createBattle({
    player: [make({ id: 'player', speciesId: 'charmander', level: 20, moves: playerMoves })],
    enemy: [make({ id: 'enemy', speciesId: 'bulbasaur', level: 20, moves: enemyMoves })],
    rng: new Rng(1),
    isWild,
    bag: bag.map((slot) => ({ item: getItem(slot.itemId)!, count: slot.count })),
  });

describe('move selection', () => {
  it('lists only moves with PP, honouring Encore', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    const fighter = state.sides.player.party[0];
    expect(legalMoveIndices(fighter)).toEqual([0, 1]);
    fighter.moves[0].pp = 0;
    expect(legalMoveIndices(fighter)).toEqual([1]);
  });

  it('falls back to Struggle when every move is spent', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    const fighter = state.sides.player.party[0];
    fighter.moves.forEach((slot) => (slot.pp = 0));
    expect(selectedMove(fighter, { type: 'fight', moveIndex: 0 })?.move.id).toBe('struggle');
  });
});

describe('validateCommand', () => {
  const fight = (moveIndex = 0): Command => ({ type: 'fight', moveIndex });

  it('rejects an out-of-range or spent move', () => {
    const state = build(['ember', 'growl'], ['tackle']);
    expect(validateCommand(state, 'player', fight(4))).toBe('There is no such move.');
    state.sides.player.party[0].moves[0].pp = 0;
    expect(validateCommand(state, 'player', fight(0))).toBe('That move has no PP left.');
  });

  it('rejects a ball in a trainer battle', () => {
    const state = build(['ember'], ['tackle'], false, [{ itemId: 'pokeball', count: 1 }]);
    expect(validateCommand(state, 'player', { type: 'bag', itemId: 'pokeball' })).toBe(
      'Ball: cannot be used in a trainer battle.',
    );
  });

  it('requires a replacement before anything else', () => {
    const state = build(['ember'], ['tackle']);
    state.sides.player.party[0].hp = 0;
    state.sides.player.awaitingReplacement = true;
    expect(validateCommand(state, 'player', fight(0))).toBe('A replacement must be sent out first.');
  });
});

describe('useBagItem', () => {
  it('heals and consumes the item', () => {
    const state = build(['ember'], ['tackle'], true, [{ itemId: 'potion', count: 2 }]);
    const fighter = state.sides.player.party[0];
    fighter.hp = fighter.maxHp - 5;
    expect(useBagItem(state, 'player', 'potion')).toBe(true);
    expect(fighter.hp).toBe(fighter.maxHp);
    expect(state.bag[0].count).toBe(1);
  });

  it('captures a wild Pokémon with a ball and ends the battle', () => {
    const state = build(['ember'], ['tackle'], true, [{ itemId: 'masterball', count: 1 }]);
    expect(useBagItem(state, 'player', 'masterball')).toBe(true);
    expect(state.winner).toBe('player');
    expect(state.bag.length).toBe(0);
    expect(state.log.some((event) => event.kind === 'capture' && event.success)).toBe(true);
  });
});
