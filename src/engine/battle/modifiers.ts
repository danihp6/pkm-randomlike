import type { Move } from '../../data/dex';
import { accuracyChance } from './accuracy';
import { effectiveSpeed, type BattleFighter } from './fighter';
import { activeFighter, opponent, type BattleState, type SideId, type Slot } from './state';
import { makeContext, runModifyAccuracy, runModifySpe } from './effects/registry';

/** Effective Speed with ability modifiers (Chlorophyll, Swift Swim, Quick Feet). */
export function modifiedSpeed(state: BattleState, side: SideId, slot: Slot = 0): number {
  const fighter = activeFighter(state, side, slot);
  const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side) });
  const speed = runModifySpe(ctx, effectiveSpeed(fighter));
  // Tailwind doubles the side's Speed while it lasts.
  return state.sides[side].sideConditions.tailwind > 0 ? Math.max(1, Math.floor(speed * 2)) : speed;
}

/** Final hit chance with ability modifiers (Compound Eyes, Sand Veil, Wonder Skin). */
export function hitChance(
  state: BattleState,
  side: SideId,
  move: Move,
  attackerOverride?: BattleFighter,
  defenderOverride?: BattleFighter,
): number {
  const attacker = attackerOverride ?? activeFighter(state, side);
  const defender = defenderOverride ?? opponent(state, side);
  const ctx = makeContext(state, side, { source: attacker, target: defender, move });
  const base = accuracyChance(move.accuracy, attacker, defender, {
    gravity: state.field.gravity > 0,
    fog: state.fog,
  });
  return Math.min(1, runModifyAccuracy(ctx, base));
}

export function rollHitWith(
  state: BattleState,
  side: SideId,
  move: Move,
  attackerOverride?: BattleFighter,
  defenderOverride?: BattleFighter,
): boolean {
  const chance = hitChance(state, side, move, attackerOverride, defenderOverride);
  return chance >= 1 || state.rng.next() < chance;
}
