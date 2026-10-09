import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { chooseAiCommand } from './ai';
import { legalMoveIndices } from './commands';
import { createFighter } from './fighter';
import { activeFighter, createBattle, type BattleEvent, type BattleState } from './state';
import { autoReplace, needsReplacement, takeTurn } from './turn';

function scriptedBattle(): BattleState {
  const state = createBattle({
    player: [
      createFighter({
        id: 'player',
        speciesId: 'charmander',
        level: 20,
        nature: 'serious',
        moves: ['ember', 'growl'],
      }),
    ],
    enemy: [
      createFighter({
        id: 'enemy',
        speciesId: 'bulbasaur',
        level: 18,
        nature: 'serious',
        moves: ['vinewhip', 'tackle'],
      }),
    ],
    rng: new Rng(2026),
    isWild: true,
  });

  for (let guard = 0; state.winner === null && guard < 50; guard++) {
    if (needsReplacement(state).length > 0) autoReplace(state);
    const legal = legalMoveIndices(activeFighter(state, 'player'));
    takeTurn(state, { type: 'fight', moveIndex: legal[0] ?? 0 }, chooseAiCommand(state, 'enemy'));
  }
  return state;
}

function format(state: BattleState): string {
  return state.log
    .map((event: BattleEvent): string => {
      switch (event.kind) {
        case 'turn':
          return `# turn ${event.turn}`;
        case 'text':
          return event.text;
        case 'move':
          return `  > ${event.side} ${event.moveId}`;
        case 'damage':
          return `  = ${event.side} -${event.amount} (${event.hp}/${event.maxHp}${event.crit ? ' crit' : ''}${event.effectiveness !== 1 ? ` x${event.effectiveness}` : ''})`;
        case 'heal':
          return `  = ${event.side} +${event.amount} (${event.hp}/${event.maxHp})`;
        case 'boost':
          return `  = ${event.side} ${event.stat} ${event.stages > 0 ? '+' : ''}${event.stages}`;
        case 'status':
          return `  = ${event.side} ${event.status}`;
        case 'cure':
          return `  = ${event.side} cured ${event.status}`;
        case 'faint':
          return `  = ${event.side} fainted`;
        case 'switch':
          return `  = ${event.side} sent ${event.fighterId}`;
        case 'mega':
          return `  = ${event.side} mega ${event.fighterId}`;
        case 'item':
          return `  = ${event.side} used ${event.itemId}`;
        case 'capture':
          return `  = capture ${event.success ? 'success' : 'fail'} (${event.shakes})`;
        case 'run':
          return `  = run ${event.success ? 'success' : 'fail'}`;
        case 'end':
          return `# end ${event.winner}`;
      }
    })
    .join('\n');
}

describe('golden battle', () => {
  it('reproduces the scripted battle for seed 2026', () => {
    const state = scriptedBattle();
    expect(state.winner).toBe('player');
    expect(format(state)).toMatchInlineSnapshot(`
      "# turn 1
        > player ember
      Charmander used Ember!
        = enemy -24 (25/49 x2)
      Ember hit Bulbasaur! It's super effective!
        > enemy tackle
      Bulbasaur used Tackle!
        = player -7 (44/51)
      Tackle hit Charmander!
      # turn 2
        > player ember
      Charmander used Ember!
        = enemy -25 (0/49 x2)
      Ember hit Bulbasaur! It's super effective!
        = enemy fainted
      Bulbasaur fainted!
      # end player"
    `);
  });
});
