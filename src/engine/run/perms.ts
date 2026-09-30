import type { RunPokemon } from './progression';
import type { RunState } from './state';

export type ReleaseResult = Readonly<{
  run: RunState;
  /** The fallen members, in party-then-box order, so the scene can name them. */
  released: readonly RunPokemon[];
}>;

/**
 * Permadeath enforcement point (D5, battle-spec §5): a Pokémon at 0 HP leaves
 * the run for good — party and box alike — and takes its XP, moves and any
 * pending evolution with it. Healthy members are untouched. Returns the run
 * unchanged (same reference) when nothing fainted. The lost count feeds the run
 * summary, so it is bumped here, at the one place a Pokémon is actually lost.
 */
export function releaseFainted(run: RunState): ReleaseResult {
  const released = [...run.party, ...run.box].filter((member) => member.fighter.hp <= 0);
  if (released.length === 0) return { run, released: [] };
  return {
    run: {
      ...run,
      stats: { ...run.stats, casualties: run.stats.casualties + released.length },
      party: run.party.filter((member) => member.fighter.hp > 0),
      box: run.box.filter((member) => member.fighter.hp > 0),
    },
    released,
  };
}
