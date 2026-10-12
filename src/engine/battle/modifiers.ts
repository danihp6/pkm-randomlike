import type { Move } from '../../data/dex';
import { accuracyChance } from './accuracy';
import { effectiveSpeed } from './fighter';
import { activeFighter, opponent, type BattleState, type SideId } from './state';
import { makeContext, runModifyAccuracy, runModifySpe } from './effects/registry';

/** Effective Speed with ability modifiers (Chlorophyll, Swift Swim, Quick Feet). */
export function modifiedSpeed(state: BattleState, side: SideId): number {
  const fighter = activeFighter(state, side);
  const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side) });
  const speed = runModifySpe(ctx, effectiveSpeed(fighter));
  // Tailwind doubles the side's Speed while it lasts.
  return state.sides[side].sideConditions.tailwind > 0 ? Math.max(1, Math.floor(speed * 2)) : speed;
}

/** Final hit chance with ability modifiers (Compound Eyes, Sand Veil, Wonder Skin). */
export function hitChance(state: BattleState, side: SideId, move: Move): number {
  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  const ctx = makeContext(state, side, { source: attacker, target: defender, move });
  const base = accuracyChance(move.accuracy, attacker, defender, state.field.gravity > 0);
  return Math.min(1, runModifyAccuracy(ctx, base));
}

export function rollHitWith(state: BattleState, side: SideId, move: Move): boolean {
  const chance = hitChance(state, side, move);
  return chance >= 1 || state.rng.next() < chance;
}
