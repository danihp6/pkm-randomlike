import { getSpecies } from '../data/dex';
import type { RunPokemon } from '../engine/run';

/**
 * Permadeath presentation (Phase 5). A fallen Pokémon gets its own "was
 * released" beat and, when the last one falls, the run ends on the score screen
 * (`src/ui/runSummary.ts`). The timings and the text are here, not in the
 * scene, so the beats read as data (`docs/battle-spec.md` §5).
 */

/** How long one release beat holds before the next one shows. */
export const RELEASE_HOLD_MS = 1600;

/** The window after the battle closes during which a stray confirm is ignored. */
export const RELEASE_INPUT_DELAY_MS = 220;

export type ReleaseBeat = Readonly<{
  /** The run member's id, so the beat can be tied back to the run. */
  id: string;
  speciesId: string;
  /** The display name the message uses: the nickname when it has one, else the species name. */
  name: string;
  level: number;
  /** A shiny member keeps its alternate-palette portrait. */
  shiny: boolean;
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
    name:
      member.fighter.nickname ?? getSpecies(member.fighter.speciesId)?.name ?? member.fighter.speciesId,
    level: member.fighter.level,
    shiny: member.fighter.shiny,
  }));
}
