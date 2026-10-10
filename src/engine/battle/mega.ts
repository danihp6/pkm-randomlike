import { getSpecies, statAtLevel } from '../../data/dex';
import { megaFormForItem, megaMatchesSpecies } from '../../data/dex/megas';
import { makeContext, runStart } from './effects/registry';
import { activeFighter, opponent, pushEvent, pushText, type BattleState, type SideId } from './state';

/**
 * A Pokémon that holds the stone matching its species may Mega Evolve once per
 * battle (`D34`). The command is spent at the top of the turn, before any move,
 * so ordering reads the Mega's Speed and the new ability (see `turn.ts`).
 */
export function canMegaEvolve(state: BattleState, side: SideId): boolean {
  const fighter = activeFighter(state, side);
  if (fighter.hp <= 0 || fighter.mega || !fighter.heldItem) return false;
  return megaMatchesSpecies(fighter.heldItem, fighter.speciesId);
}

/**
 * Applies the Mega forme: stats, types and ability are swapped for the rest of
 * the battle while the held item, moves and HP fraction are untouched. Returns
 * false (and changes nothing) when the fighter cannot Mega Evolve.
 */
export function megaEvolve(state: BattleState, side: SideId): boolean {
  if (!canMegaEvolve(state, side)) return false;
  const fighter = activeFighter(state, side);
  const mega = fighter.heldItem ? megaFormForItem(fighter.heldItem) : undefined;
  if (!mega) return false;
  const form = getSpecies(mega.id);
  if (!form) return false;

  const baseName = fighter.name;
  fighter.megaBackup = {
    speciesId: fighter.speciesId,
    name: fighter.name,
    types: fighter.types,
    stats: fighter.stats,
    ability: fighter.ability,
  };
  fighter.speciesId = form.id;
  fighter.name = form.name;
  fighter.types = form.types;
  // Every Mega keeps its base HP, but a Mega Stone never changes the HP in play.
  fighter.stats = {
    ...statAtLevel(form, fighter.level, fighter.nature, fighter.ivs, fighter.evs),
    hp: fighter.stats.hp,
  };
  fighter.ability = Object.values(form.abilities)[0] ?? fighter.ability;
  fighter.mega = true;

  pushEvent(state, { kind: 'mega', side, fighterId: fighter.id });
  pushText(state, `${baseName} Mega Evolved!`);
  // A Mega ability with an on-switch-in effect (Drought, Intimidate...) fires now.
  runStart(makeContext(state, side, { source: fighter, target: opponent(state, side) }));
  return true;
}
