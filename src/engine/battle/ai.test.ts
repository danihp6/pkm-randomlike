import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { createFighter, type FighterInput } from './fighter';
import { createBattle, type BattleState } from './state';

const build = (
  player: readonly FighterInput[],
  enemy: readonly FighterInput[],
): BattleState =>
  createBattle({
    player: player.map((input) => createFighter(input)),
    enemy: enemy.map((input) => createFighter(input)),
    rng: new Rng(1),
    isWild: true,
  });

describe('chooseAiCommand', () => {
  it('picks the super effective move', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 5, moves: ['tackle'] }],
      [{ id: 'e', speciesId: 'charmander', level: 50, moves: ['ember', 'growl'] }],
    );
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });

  it('falls back to the first move when everything is spent', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      [{ id: 'e', speciesId: 'charmander', level: 20, moves: ['ember'] }],
    );
    state.sides.enemy.party[0].moves.forEach((slot) => (slot.pp = 0));
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'fight', moveIndex: 0 });
  });

  it('switches when the active Pokémon cannot hurt the foe', () => {
    const state = build(
      [{ id: 'p', speciesId: 'geodude', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'geodude', level: 20, moves: ['thundershock'] },
        { id: 'e2', speciesId: 'charmander', level: 20, moves: ['ember'] },
      ],
    );
    expect(chooseAiCommand(state, 'enemy')).toEqual({ type: 'switch', partyIndex: 1 });
  });

  it('replaces a fainted active with the healthiest reserve', () => {
    const state = build(
      [{ id: 'p', speciesId: 'bulbasaur', level: 20, moves: ['tackle'] }],
      [
        { id: 'e1', speciesId: 'charmander', level: 20, moves: ['ember'] },
        { id: 'e2', speciesId: 'geodude', level: 20, moves: ['tackle'] },
      ],
    );
    state.sides.enemy.party[0].hp = 0;
    state.sides.enemy.awaitingReplacement = true;
    const command = chooseAiCommand(state, 'enemy');
    expect(command.type).toBe('switch');
    if (command.type === 'switch') expect(command.partyIndex).toBe(1);
  });
});
