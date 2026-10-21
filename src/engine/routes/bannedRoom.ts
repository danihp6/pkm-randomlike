import type { RunPokemon } from '../run/progression';
import type { RunState } from '../run/state';

/**
 * The species the banned room bars: the species of the **party** member with the
 * highest `battlesUsed`, ties broken by party order (lowest index wins). The box
 * is never read — only a party member can be sent out, so a boxed veteran must
 * not name the ban. Null only when the party is empty, which `RunState` never
 * allows.
 */
export function bannedSpeciesOf(run: RunState): string | null {
  let best: RunPokemon | null = null;
  let bestUsed = -1;
  for (const member of run.party) {
    const used = member.battlesUsed ?? 0;
    if (used > bestUsed) {
      bestUsed = used;
      best = member;
    }
  }
  return best ? best.fighter.speciesId : null;
}
