import { restoreFighter, snapshotFighter } from '../battle/fighter';
import type { RunPokemon } from './progression';
import { type RunState } from './state';

/**
 * How many times the Pokevial can rest the party between floors. One charge: a
 * mid-floor emergency heal, refilled by the heal stop when a floor is cleared
 * (`advanceMap`).
 */
export const POKEVIAL_MAX_CHARGES = 1;

/**
 * A rested member: HP and PP back to full, status untouched (routes-spec §6).
 * A member already at 0 HP is left as it is — the healing stop never resurrects
 * (D5), so a fallen Pokémon cannot be pulled back by resting.
 */
function healMember(member: RunPokemon): RunPokemon {
  const fighter = restoreFighter(member.fighter);
  if (fighter.hp > 0) fighter.hp = fighter.maxHp;
  for (const slot of fighter.moves) slot.pp = slot.maxPp;
  return { ...member, fighter: snapshotFighter(fighter) };
}

/** The heal stop between routes: restores HP/PP across the party and the box. */
export function healParty(run: RunState): RunState {
  return {
    ...run,
    party: run.party.map(healMember),
    box: run.box.map(healMember),
  };
}

/**
 * Drinks the Pokevial: the same heal stop as `healParty` (HP/PP across the party
 * and the box, never a resurrection and no status cure, D5) applied on demand,
 * spending one charge. With no charges left it is a no-op, so a click never
 * wastes anything.
 */
export function usePokevial(run: RunState): RunState {
  if (run.pokevialCharges <= 0) return run;
  const healed = healParty(run);
  return { ...healed, pokevialCharges: healed.pokevialCharges - 1 };
}

/**
 * Debug only: a member fully restored — HP and PP to full, status cleared and a
 * 0-HP member revived. The route heal stop (`healParty`) deliberately does
 * neither the status cure nor the revival (D5).
 */
export function fullHealMember(member: RunPokemon): RunPokemon {
  const fighter = restoreFighter(member.fighter);
  fighter.hp = fighter.maxHp;
  fighter.status = null;
  fighter.statusCounter = 0;
  for (const slot of fighter.moves) slot.pp = slot.maxPp;
  return { ...member, fighter: snapshotFighter(fighter) };
}
