import type { Rng } from '../rng';
import { confusionDamage } from './damage';
import { applyDamage, takesIndirectDamage, type BattleFighter } from './fighter';

export function applyConfusion(fighter: BattleFighter, rng: Rng): boolean {
  if (fighter.volatiles.confusion > 0) return false;
  fighter.volatiles.confusion = rng.int(2, 5);
  return true;
}

export function applyFlinch(fighter: BattleFighter): void {
  fighter.volatiles.flinched = true;
}

export function applyAttract(fighter: BattleFighter): boolean {
  if (fighter.volatiles.attract) return false;
  fighter.volatiles.attract = true;
  return true;
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

/** A binding move holds for 4-5 residual ticks (the classic duration). */
export const PARTIAL_TRAP_TURNS: Readonly<{ min: number; max: number }> = { min: 4, max: 5 };

/** The share of max HP a trap pays per turn; a held Binding Band switches it to 1/6. */
export const PARTIAL_TRAP_FRACTION = 8;

/**
 * The volatiles that pay damage every turn: the coverage table reads this list, so a
 * move that only writes one of them is never `port` on the strength of the write.
 */
export const RESIDUAL_VOLATILES: readonly string[] = ['partiallytrapped'];

/**
 * Binds `fighter` to `moveId`: draws the duration (`rng.int(4, 5)`) — **one draw, the
 * only one this rule makes** — and replaces any trap already holding it, so a second
 * binding move resets the counter instead of stacking. Always returns `true` (the write
 * happens).
 */
export function applyPartialTrap(fighter: BattleFighter, moveId: string, rng: Rng): boolean {
  fighter.volatiles.partiallyTrapped = {
    turns: rng.int(PARTIAL_TRAP_TURNS.min, PARTIAL_TRAP_TURNS.max),
    moveId,
  };
  fighter.volatiles.trapped = true;
  return true;
}

/**
 * One residual tick of the trap: decrements `turns`; at zero it clears
 * `partiallyTrapped` and releases `trapped` unless `octolock` or `noretreat` still holds
 * it. Returns the turns left (`0` when it just cleared).
 */
export function tickPartialTrap(fighter: BattleFighter): number {
  const trap = fighter.volatiles.partiallyTrapped;
  if (!trap) return 0;
  const left = trap.turns - 1;
  if (left <= 0) {
    fighter.volatiles.partiallyTrapped = null;
    if (!fighter.volatiles.octolock && !fighter.volatiles.noretreat) {
      fighter.volatiles.trapped = false;
    }
    return 0;
  }
  fighter.volatiles.partiallyTrapped = { turns: left, moveId: trap.moveId };
  return left;
}

export function applyTorment(fighter: BattleFighter): boolean {
  if (fighter.volatiles.torment) return false;
  fighter.volatiles.torment = true;
  return true;
}

export function applyNightmare(fighter: BattleFighter): boolean {
  if (fighter.volatiles.nightmare) return false;
  fighter.volatiles.nightmare = true;
  return true;
}

export function applyOctolock(fighter: BattleFighter): boolean {
  if (fighter.volatiles.octolock) return false;
  fighter.volatiles.octolock = true;
  applyTrap(fighter);
  return true;
}

export function applyNoRetreat(fighter: BattleFighter): boolean {
  if (fighter.volatiles.noretreat) return false;
  fighter.volatiles.noretreat = true;
  applyTrap(fighter);
  return true;
}

export function applyLockOn(fighter: BattleFighter): boolean {
  if (fighter.volatiles.lockOn) return false;
  fighter.volatiles.lockOn = true;
  return true;
}

export function applyTelekinesis(fighter: BattleFighter): boolean {
  if (fighter.volatiles.telekinesis > 0) return false;
  fighter.volatiles.telekinesis = 3;
  return true;
}

export function applyElectrify(fighter: BattleFighter): boolean {
  if (fighter.volatiles.electrify) return false;
  fighter.volatiles.electrify = true;
  return true;
}

export function applyEmbargo(fighter: BattleFighter): boolean {
  if (fighter.volatiles.embargo > 0) return false;
  fighter.volatiles.embargo = 5;
  return true;
}

export function applyForesight(fighter: BattleFighter): boolean {
  if (fighter.volatiles.foresight) return false;
  fighter.volatiles.foresight = true;
  return true;
}

export function applyGastroAcid(fighter: BattleFighter): boolean {
  if (fighter.volatiles.gastroAcid) return false;
  fighter.volatiles.gastroAcid = true;
  return true;
}

export function applyQuash(fighter: BattleFighter): boolean {
  if (fighter.volatiles.quash) return false;
  fighter.volatiles.quash = true;
  return true;
}

export function applySmackDown(fighter: BattleFighter): boolean {
  if (fighter.volatiles.grounded) return false;
  fighter.volatiles.grounded = true;
  return true;
}

/** Disable lasts four turns, like the reference. */
const DISABLE_TURNS = 4;

export function applyDisable(fighter: BattleFighter, moveId: string): boolean {
  if (fighter.volatiles.disabledMove !== null) return false;
  fighter.volatiles.disabledMove = moveId;
  fighter.volatiles.disableTurns = DISABLE_TURNS;
  return true;
}

export function applyPerish(fighter: BattleFighter): void {
  if (fighter.volatiles.perish <= 0) fighter.volatiles.perish = 3;
}

export function isTaunted(fighter: BattleFighter): boolean {
  return fighter.volatiles.taunt > 0;
}

/** Nightmare's residual chip: a quarter of max HP, only while the holder sleeps. */
export function nightmareDamage(fighter: BattleFighter): number {
  if (!fighter.volatiles.nightmare || fighter.status !== 'slp' || fighter.hp <= 0) return 0;
  return Math.max(1, Math.floor(fighter.maxHp / 4));
}

export type VolatileMoveCheck =
  | Readonly<{ flinched: true }>
  | Readonly<{ attracted: true }>
  | Readonly<{ confusionDamage: number }>
  | Readonly<{ confusionEnded: true }>
  | null;

export function beforeMoveVolatile(fighter: BattleFighter, rng: Rng): VolatileMoveCheck {
  if (fighter.volatiles.flinched) {
    fighter.volatiles.flinched = false;
    return { flinched: true };
  }
  if (fighter.volatiles.attract && rng.next() < 0.5) {
    return { attracted: true };
  }
  if (fighter.volatiles.confusion > 0) {
    fighter.volatiles.confusion -= 1;
    if (fighter.volatiles.confusion <= 0) return { confusionEnded: true };
    if (rng.next() < 1 / 3) {
      if (!takesIndirectDamage(fighter)) return null;
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

/** Decrements Taunt/Encore and the disable timer, clears the spent flinch flag and drops protection. */
export function endOfTurnVolatile(fighter: BattleFighter): void {
  fighter.volatiles.flinched = false;
  fighter.volatiles.protect = null;
  fighter.volatiles.endure = false;
  fighter.volatiles.destinyBond = false;
  fighter.volatiles.grudge = false;
  fighter.volatiles.magicCoat = false;
  fighter.volatiles.snatch = false;
  fighter.volatiles.quash = false;
  if (fighter.volatiles.magnetRise > 0) fighter.volatiles.magnetRise -= 1;
  if (fighter.volatiles.telekinesis > 0) fighter.volatiles.telekinesis -= 1;
  if (fighter.volatiles.embargo > 0) fighter.volatiles.embargo -= 1;
  if (fighter.volatiles.taunt > 0) fighter.volatiles.taunt -= 1;
  if (fighter.volatiles.disableTurns > 0) {
    fighter.volatiles.disableTurns -= 1;
    if (fighter.volatiles.disableTurns === 0) fighter.volatiles.disabledMove = null;
  }
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
