import { gmaxFormForItem, gmaxMatchesSpecies } from '../../data/dex/gmaxes';
import { changeBattleForm, restoreBattleForm, type BattleFighter } from './fighter';
import { activeFighter, pushEvent, pushText, type BattleState, type SideId } from './state';

/**
 * The HP multiplier Gigantamax applies (`D44`): the pool doubles, every other
 * stat stays as the species has it.
 */
export const GMAX_HP_MULTIPLIER = 2;

/**
 * True while `side`'s active Pokémon may Gigantamax: alive, not Mega Evolved and
 * not already Gigantamaxed this battle, and **holding the G-Max Stone of its own
 * species** (`D44`) — the stone-gated shape a Mega already has (`D34`).
 */
export function canGigantamax(state: BattleState, side: SideId): boolean {
  const fighter = activeFighter(state, side);
  if (fighter.hp <= 0 || fighter.mega || fighter.gmax || !fighter.heldItem) return false;
  return gmaxMatchesSpecies(fighter.heldItem, fighter.speciesId);
}

/**
 * Applies the G-Max forme: the fighter's name and species become the forme's, its
 * types, stats, ability, moves and held item are untouched, and its HP pool
 * (current and maximum) is multiplied by `GMAX_HP_MULTIPLIER`. Returns false and
 * changes nothing when the fighter cannot Gigantamax.
 *
 * The ability never changes, so unlike a Mega this fires no `runStart` /
 * `runSwitchIn`: the holder's own on-switch-in effect already ran when it entered.
 */
export function gigantamax(state: BattleState, side: SideId): boolean {
  if (!canGigantamax(state, side)) return false;
  const fighter = activeFighter(state, side);
  const form = fighter.heldItem ? gmaxFormForItem(fighter.heldItem) : undefined;
  if (!form) return false;

  const baseName = fighter.name;
  // `changeBattleForm` writes the shared pre-forme backup (so a snapshot after the
  // battle still names the base species) and keeps the holder's ability.
  if (!changeBattleForm(fighter, form.id, true)) return false;

  // Both operands are integers, so the pair halves exactly on the way out and the
  // HP fraction is preserved.
  fighter.maxHp = fighter.maxHp * GMAX_HP_MULTIPLIER;
  fighter.hp = fighter.hp * GMAX_HP_MULTIPLIER;
  fighter.stats = { ...fighter.stats, hp: fighter.maxHp };
  fighter.gmax = true;

  pushEvent(state, { kind: 'gmax', side, fighterId: fighter.id });
  pushText(state, 'battle.log.gigantamaxed', { name: baseName });
  return true;
}

/**
 * Undoes a Gigantamax (`D44`): the pre-G-Max shape returns (name, species, types,
 * stats, ability) and the HP pool halves again. Returns false when the fighter is
 * not Gigantamaxed. The flooring costs at most 1 HP of rounding if the fighter
 * was healed or damaged while Gigantamaxed; that is the frozen rule.
 */
export function revertGigantamax(fighter: BattleFighter): boolean {
  if (!fighter.gmax) return false;
  // A form-change ability may have reverted the forme already: the backup is then
  // gone and only the pool is left to halve.
  restoreBattleForm(fighter);
  fighter.hp = Math.floor(fighter.hp / GMAX_HP_MULTIPLIER);
  fighter.maxHp = Math.floor(fighter.maxHp / GMAX_HP_MULTIPLIER);
  fighter.stats = { ...fighter.stats, hp: fighter.maxHp };
  fighter.gmax = false;
  return true;
}
