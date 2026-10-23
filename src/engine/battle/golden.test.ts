import { describe, expect, it } from 'vitest';
import { formatBattleLog, scriptedBattle, type HarnessFighterSpec } from './harness';

/**
 * The battle every rule change is measured against (`docs/battle-spec.md`): the
 * teams and the seed are frozen here and the battle's keys, as `formatBattleLog`
 * prints them, must stay byte-identical.
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
      battle.log.used(move=ember, name=Charmander)
        = enemy -26 (23/49 x2)
      battle.log.hitSuper(move=ember, name=Bulbasaur)
        > enemy vinewhip
      battle.log.used(move=vinewhip, name=Bulbasaur)
        = player -6 (45/51 x0.5)
      battle.log.hitWeak(move=vinewhip, name=Charmander)
      # turn 2
        > player ember
      battle.log.used(move=ember, name=Charmander)
        = enemy -23 (0/49 x2)
      battle.log.hitSuper(move=ember, name=Bulbasaur)
        = enemy fainted
      battle.log.fainted(name=Bulbasaur)
      # end player"
    `);
  });
});
