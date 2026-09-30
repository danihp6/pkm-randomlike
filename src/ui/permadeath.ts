import { getSpecies } from '../data/dex';
import type { RunPokemon, RunState } from '../engine/run';

/**
 * Permadeath presentation (Phase 5). A fallen Pokémon gets its own "was
 * released" beat and, when the last one falls, the run ends on a dedicated
 * screen. The timings and the text are here, not in the scenes, so the beats
 * read as data (`docs/battle-spec.md` §5).
 */

/** How long one release beat holds before the next one shows. */
export const RELEASE_HOLD_MS = 1600;

/** The window after the battle closes during which a stray confirm is ignored. */
export const RELEASE_INPUT_DELAY_MS = 220;

/** The same guard for the end-of-run screen, after the last release beat. */
export const RUN_OVER_INPUT_DELAY_MS = 300;

export type ReleaseBeat = Readonly<{
  /** The run member's id, so the beat can be tied back to the run. */
  id: string;
  speciesId: string;
  /** The display name the message uses. */
  name: string;
  level: number;
}>;

/**
 * One beat per fallen Pokémon, in the order the resolution reported them (party
 * first, then the box). Released members are already gone from the run, so the
 * beat carries everything the message needs.
 */
export function releaseBeats(released: readonly RunPokemon[]): ReleaseBeat[] {
  return released.map((member) => ({
    id: member.fighter.id,
    speciesId: member.fighter.speciesId,
    name: getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
    level: member.fighter.level,
  }));
}

export type RunOverSummary = Readonly<{
  won: boolean;
  /** Routes fully cleared: everything before the one that ended a lost run. */
  routesCleared: number;
  seed: string;
}>;

/** What the end-of-run screen reports: a win clears its route, a loss does not. */
export function runOverSummary(run: RunState, won: boolean): RunOverSummary {
  return {
    won,
    routesCleared: won ? run.routeIndex : Math.max(0, run.routeIndex - 1),
    seed: run.seed,
  };
}

/** The message lines the end-of-run screen shows, in order. */
export function runOverLines(summary: RunOverSummary): string[] {
  const headline = summary.won
    ? 'The final route falls. You win!'
    : 'You have no more Pokémon!';
  const detail = summary.won
    ? 'Nothing was lost on the way.'
    : 'The run is over — nothing carries over.';
  return [headline, detail, `Routes cleared: ${summary.routesCleared}`, `Seed: ${summary.seed}`];
}
