import type { Rng } from '../rng';
import { accuracyStageMultiplier, clampBoost, type BattleFighter } from './fighter';

/** Gen 9 hit chance: move accuracy times the net accuracy/evasion stage. */
export function accuracyChance(
  moveAccuracy: number | true,
  attacker: BattleFighter,
  defender: BattleFighter,
  gravity = false,
): number {
  if (moveAccuracy === true) return 1;
  const evasion = attacker.ability === "Mind's Eye" ? 0 : defender.boosts.evasion;
  const stage = clampBoost(attacker.boosts.accuracy - evasion);
  const chance = Math.min(1, (moveAccuracy / 100) * accuracyStageMultiplier(stage));
  // Gravity bends every move's aim by 5/3.
  return gravity ? Math.min(1, chance * (5 / 3)) : chance;
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
