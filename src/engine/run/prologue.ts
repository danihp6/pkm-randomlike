import { STARTING_BAG } from '../../data/run';
import { createRunPokemon, xpForLevel } from './progression';
import { addItem, createRun, nextMemberId, type RunState } from './state';

/**
 * The prologue (`docs/region-spec.md` §6): a brand-new run starts **inside the
 * town's laboratory with no Pokémon at all**, the professor hands over one starter
 * and the starting bag, and the town's exit stays shut until that happens.
 *
 * Pure, like the rest of the run (`D11`): the starter is minted off the run seed, so
 * the same `(seed, speciesId, level)` always yields the same member, and neither
 * `emptyRun` nor `takeStarter` reads a clock or an Rng of its own.
 */

/** The level the professor's starter arrives at (`StarterScene`'s own 5). */
export const STARTER_LEVEL = 5;

/** The prologue run: no starter taken yet and no member to field. */
export function isPrologue(run: RunState): boolean {
  return !run.starterTaken && run.party.length === 0;
}

/** The run a brand-new game starts: no party, no badge, standing in the town. */
export function emptyRun(seed: string, startedAt?: string): RunState {
  return createRun({ seed, ...(startedAt === undefined ? {} : { startedAt }) });
}

/**
 * The professor's one gift: one member, the starting bag, the flag. A run that
 * already took its starter comes back **as the same object**, so a second press
 * cannot grant a second member or a second bag. The starter is not a catch: the
 * run's `stats.catches`, `caughtSpecies` and `recordCatch` are untouched.
 */
export function takeStarter(run: RunState, speciesId: string, level: number): RunState {
  if (run.starterTaken) return run;
  const member = createRunPokemon({
    id: nextMemberId(run),
    speciesId,
    level,
    learnsetSeed: run.seed,
  });
  let next: RunState = {
    ...run,
    party: [member],
    xp: xpForLevel(level),
    starterTaken: true,
  };
  for (const row of STARTING_BAG) next = addItem(next, row.itemId, row.count);
  return next;
}

/** True once the town's exit bands may be walked. Mirrors `hasLivingParty`'s rule. */
export function canLeaveTown(run: RunState): boolean {
  return !isPrologue(run);
}
