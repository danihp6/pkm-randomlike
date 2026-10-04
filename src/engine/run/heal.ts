import { restoreFighter, snapshotFighter } from '../battle/fighter';
import type { RunPokemon } from './progression';
import { type RunState } from './state';

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
