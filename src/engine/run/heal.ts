import { restoreFighter, snapshotFighter } from '../battle/fighter';
import type { RunPokemon } from './progression';
import { type RunState } from './state';

/**
 * How many charges the Pokevial holds, drawn as a single three-step bar in the
 * party header. It no longer refills at the heal stop: a charge is earned by
 * beating a trainer (one each) and the floor's boss fills it to the cap, and a
 * run keeps its meter across floors (`docs/routes-spec.md` §6).
 */
export const POKEVIAL_MAX_CHARGES = 3;

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
 * Adds Pokevial charges up to the cap, one per beaten trainer. A full meter (or
 * a non-positive amount) is a no-op, so a replay never overfills it.
 */
export function chargePokevial(run: RunState, amount = 1): RunState {
  const charges = Math.min(POKEVIAL_MAX_CHARGES, run.pokevialCharges + Math.max(0, Math.floor(amount)));
  return charges === run.pokevialCharges ? run : { ...run, pokevialCharges: charges };
}

/** Fills the Pokevial to the cap, the boss clear's reward; a no-op when full. */
export function fillPokevial(run: RunState): RunState {
  return chargePokevial(run, POKEVIAL_MAX_CHARGES - run.pokevialCharges);
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
