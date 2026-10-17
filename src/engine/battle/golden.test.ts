import { describe, expect, it } from 'vitest';
import { formatBattleLog, scriptedBattle, type HarnessFighterSpec } from './harness';

/**
 * The battle every rule change is measured against (`docs/battle-spec.md`): the
 * teams and the seed are frozen here and the log below must stay byte-identical.
 * The loop itself lives in `./harness` (`scriptedBattle`), so an AI regression
 * (`[Task-35]`) runs the very same script with its own policies.
 *
 * The battle is a wild one, so its enemy now picks a random legal move and spends
 * one `Rng` draw before each turn (`D46`): the log below is the same battle after
 * that rule, re-pinned with the draw included.
 */
const PLAYER: readonly HarnessFighterSpec[] = [
  { id: 'player', speciesId: 'charmander', level: 20, nature: 'serious', moves: ['ember', 'growl'] },
];

const ENEMY: readonly HarnessFighterSpec[] = [
  { id: 'enemy', speciesId: 'bulbasaur', level: 18, nature: 'serious', moves: ['vinewhip', 'tackle'] },
];

describe('golden battle', () => {
  it('reproduces the scripted battle for seed 2026', () => {
    const state = scriptedBattle({ player: PLAYER, enemy: ENEMY });
    expect(state.winner).toBe('player');
    expect(formatBattleLog(state)).toMatchInlineSnapshot(`
      "# turn 1
        > player ember
      Charmander used Ember!
        = enemy -26 (23/49 x2)
      Ember hit Bulbasaur! It's super effective!
        > enemy vinewhip
      Bulbasaur used Vine Whip!
        = player -6 (45/51 x0.5)
      Vine Whip hit Charmander! It's not very effective...
      # turn 2
        > player ember
      Charmander used Ember!
        = enemy -23 (0/49 x2)
      Ember hit Bulbasaur! It's super effective!
        = enemy fainted
      Bulbasaur fainted!
      # end player"
    `);
  });
});
