import type { Rng } from '../rng';
import { accuracyStageMultiplier, clampBoost, hasAbility, type BattleFighter } from './fighter';

/** Dense fog costs every move this much of its own accuracy (`docs/battle-spec.md` §4). */
export const FOG_ACCURACY_PENALTY = 20;

/** The field conditions that bend a move's aim. */
export type AccuracyConditions = Readonly<{
  /** Gravity (`state.field.gravity > 0`): every move's aim is bent by 5/3. */
  gravity?: boolean;
  /** Dense fog (`state.fog`): the move's own accuracy drops by 20, before the stage multiplier. */
  fog?: boolean;
}>;

/** Gen 9 hit chance: move accuracy times the net accuracy/evasion stage. */
export function accuracyChance(
  moveAccuracy: number | true,
  attacker: BattleFighter,
  defender: BattleFighter,
  conditions: AccuracyConditions = {},
): number {
  if (moveAccuracy === true) return 1;
  const evasion = hasAbility(attacker, "Mind's Eye") ? 0 : defender.boosts.evasion;
  const stage = clampBoost(attacker.boosts.accuracy - evasion);
  // Fog takes 20 off the move's own accuracy, so the stage multiplier scales the
  // reduced number and a move printed at 20 or less cannot hit at all.
  const base = conditions.fog ? Math.max(0, moveAccuracy - FOG_ACCURACY_PENALTY) : moveAccuracy;
  const chance = Math.min(1, (base / 100) * accuracyStageMultiplier(stage));
  // Gravity bends every move's aim by 5/3.
  return conditions.gravity ? Math.min(1, chance * (5 / 3)) : chance;
}

export function rollHit(
  rng: Rng,
  moveAccuracy: number | true,
  attacker: BattleFighter,
  defender: BattleFighter,
): boolean {
  const chance = accuracyChance(moveAccuracy, attacker, defender);
  return chance >= 1 || rng.next() < chance;
}
