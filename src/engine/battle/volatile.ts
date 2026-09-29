import type { Rng } from '../rng';
import { confusionDamage } from './damage';
import { applyDamage, type BattleFighter } from './fighter';

export function applyConfusion(fighter: BattleFighter, rng: Rng): boolean {
  if (fighter.volatiles.confusion > 0) return false;
  fighter.volatiles.confusion = rng.int(2, 5);
  return true;
}

export function applyFlinch(fighter: BattleFighter): void {
  fighter.volatiles.flinched = true;
}

export function applyLeechSeed(fighter: BattleFighter): boolean {
  if (fighter.volatiles.leechSeed) return false;
  fighter.volatiles.leechSeed = true;
  return true;
}

export function applyTaunt(fighter: BattleFighter): boolean {
  fighter.volatiles.taunt = 3;
  return true;
}

export function applyEncore(fighter: BattleFighter): boolean {
  if (fighter.lastMoveId === null) return false;
  fighter.volatiles.encore = 3;
  fighter.volatiles.encoreMove = fighter.lastMoveId;
  return true;
}

export function applyTrap(fighter: BattleFighter): void {
  fighter.volatiles.trapped = true;
}

export function applyPerish(fighter: BattleFighter): void {
  if (fighter.volatiles.perish <= 0) fighter.volatiles.perish = 3;
}

export function isTaunted(fighter: BattleFighter): boolean {
  return fighter.volatiles.taunt > 0;
}

export type VolatileMoveCheck =
  | Readonly<{ flinched: true }>
  | Readonly<{ confusionDamage: number }>
  | Readonly<{ confusionEnded: true }>
  | null;

export function beforeMoveVolatile(fighter: BattleFighter, rng: Rng): VolatileMoveCheck {
  if (fighter.volatiles.flinched) {
    fighter.volatiles.flinched = false;
    return { flinched: true };
  }
  if (fighter.volatiles.confusion > 0) {
    fighter.volatiles.confusion -= 1;
    if (fighter.volatiles.confusion <= 0) return { confusionEnded: true };
    if (rng.next() < 1 / 3) {
      const damage = applyDamage(fighter, confusionDamage(fighter, rng));
      return { confusionDamage: damage };
    }
  }
  return null;
}

export function leechSeedDamage(fighter: BattleFighter): number {
  if (!fighter.volatiles.leechSeed) return 0;
  return Math.max(1, Math.floor(fighter.maxHp / 8));
}

/** Decrements Taunt/Encore, clears the spent flinch flag and drops protection. */
export function endOfTurnVolatile(fighter: BattleFighter): void {
  fighter.volatiles.flinched = false;
  fighter.volatiles.protect = null;
  if (fighter.volatiles.taunt > 0) fighter.volatiles.taunt -= 1;
  if (fighter.volatiles.encore > 0) {
    fighter.volatiles.encore -= 1;
    if (fighter.volatiles.encore === 0) fighter.volatiles.encoreMove = null;
  }
}

/** True when the perish count reaches zero this tick. */
export function tickPerish(fighter: BattleFighter): boolean {
  if (fighter.volatiles.perish <= 0) return false;
  fighter.volatiles.perish -= 1;
  return fighter.volatiles.perish === 0;
}

export function makeSubstitute(fighter: BattleFighter): number {
  const cost = Math.max(1, Math.floor(fighter.maxHp / 4));
  if (fighter.hp <= cost) return 0;
  fighter.hp -= cost;
  fighter.volatiles.substitute = cost;
  return cost;
}

/**
 * Applies damage to the substitute first. Excess damage past the substitute is
 * discarded, exactly as in the games, so the user is never hit through it.
 */
export function absorbWithSubstitute(fighter: BattleFighter, damage: number): boolean {
  if (fighter.volatiles.substitute <= 0) return false;
  fighter.volatiles.substitute -= damage;
  if (fighter.volatiles.substitute <= 0) fighter.volatiles.substitute = 0;
  return true;
}

export function hasSubstitute(fighter: BattleFighter): boolean {
  return fighter.volatiles.substitute > 0;
}
