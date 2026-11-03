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
 * A rested member: HP and PP back to full. A member already at 0 HP is left as
 * it is — the healing stop never resurrects (D5), so a fallen Pokémon cannot be
 * pulled back by resting. `cureStatus` additionally clears a primary status; the
 * route stop leaves status alone, the Pokevial cures it (`routes-spec` §6).
 */
function healMember(member: RunPokemon, cureStatus: boolean): RunPokemon {
  const fighter = restoreFighter(member.fighter);
  if (fighter.hp > 0) fighter.hp = fighter.maxHp;
  for (const slot of fighter.moves) slot.pp = slot.maxPp;
  if (cureStatus) {
    fighter.status = null;
    fighter.statusCounter = 0;
  }
  return { ...member, fighter: snapshotFighter(fighter) };
}

/** Rests the party and the box, optionally clearing status, never a resurrection. */
function restParty(run: RunState, cureStatus: boolean): RunState {
  const rest = (member: RunPokemon) => healMember(member, cureStatus);
  return { ...run, party: run.party.map(rest), box: run.box.map(rest) };
}

/** The heal stop between routes: restores HP/PP across the party and the box. */
export function healParty(run: RunState): RunState {
  return restParty(run, false);
}

/**
 * The Centre's counter, and the laboratory's: party and box, HP and PP back to full,
 * never a status cure and never a revival (D5). Returns the run untouched when there
 * is nothing to heal.
 */
export function serviceHeal(run: RunState): RunState {
  return needsHealing(run) ? restParty(run, false) : run;
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
 * One member as a reason to drink: **alive** and missing HP, missing PP on any of
 * its moves or carrying a primary status. A member at 0 HP is never a reason, so
 * the vial never resurrects (D5), and a member with no moves is simply not
 * missing PP.
 */
function memberNeedsHealing(member: RunPokemon): boolean {
  const fighter = member.fighter;
  if (fighter.hp <= 0) return false;
  if (fighter.status) return true;
  // A `FighterSnapshot` carries no maximum of its own, so the bar is re-derived
  // the way `healMember` rebuilds it.
  if (fighter.hp < restoreFighter(fighter).maxHp) return true;
  return fighter.moves.some((slot) => slot.pp < slot.maxPp);
}

/** True when any member — party **or** box — is something the vial can cure. */
export function needsHealing(run: RunState): boolean {
  return run.party.some(memberNeedsHealing) || run.box.some(memberNeedsHealing);
}

/** True when the meter is full and there is something to cure. */
export function pokevialReady(run: RunState): boolean {
  return run.pokevialCharges >= POKEVIAL_MAX_CHARGES && needsHealing(run);
}

/**
 * Drinks the vial the instant it is ready: a full meter plus a wounded party or
 * box rests both — HP/PP to full and a primary status cured, never a
 * resurrection (D5) — and empties the meter. Not ready is a no-op that returns
 * the run **by reference**, so a caller never dirties a save on nothing.
 */
export function autoPokevial(run: RunState): RunState {
  if (!pokevialReady(run)) return run;
  return { ...restParty(run, true), pokevialCharges: 0 };
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
