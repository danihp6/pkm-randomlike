import { accuracyChance } from './accuracy';
import { effectiveSpeed } from './fighter';
import { activeFighter, opponent, type BattleState, type SideId } from './state';
import { makeContext, runModifyAccuracy, runModifySpe } from './effects/registry';

/** Effective Speed with ability modifiers (Chlorophyll, Swift Swim, Quick Feet). */
export function modifiedSpeed(state: BattleState, side: SideId): number {
  const fighter = activeFighter(state, side);
  const ctx = makeContext(state, side, { source: fighter, target: opponent(state, side) });
  return runModifySpe(ctx, effectiveSpeed(fighter));
}

/** Final hit chance with ability modifiers (Compound Eyes, Sand Veil, Hustle). */
export function hitChance(state: BattleState, side: SideId, moveAccuracy: number | true): number {
  const attacker = activeFighter(state, side);
  const defender = opponent(state, side);
  const ctx = makeContext(state, side, { source: attacker, target: defender });
  return Math.min(1, runModifyAccuracy(ctx, accuracyChance(moveAccuracy, attacker, defender)));
}

export function rollHitWith(state: BattleState, side: SideId, moveAccuracy: number | true): boolean {
  const chance = hitChance(state, side, moveAccuracy);
  return chance >= 1 || state.rng.next() < chance;
}
