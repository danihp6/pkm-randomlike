import type { Rng } from '../rng';
import { activeFighter, opponentOf, type BattleState, type SideId } from './state';
import { modifiedSpeed } from './modifiers';

export function canRun(state: BattleState, side: SideId): boolean {
  return state.isWild && !activeFighter(state, side).volatiles.trapped;
}

/** Classic Gen V+ escape odds: speed ratio plus 30 per failed attempt. */
export function escapeOdds(playerSpeed: number, wildSpeed: number, attempts: number): number {
  const denominator = Math.max(1, Math.floor(wildSpeed / 4) % 256);
  return Math.min(256, Math.floor((playerSpeed * 32) / denominator) + 30 * attempts);
}

export function rollRun(state: BattleState, side: SideId, rng: Rng = state.rng): boolean {
  if (!canRun(state, side)) return false;
  const odds = escapeOdds(
    modifiedSpeed(state, side),
    modifiedSpeed(state, opponentOf(side)),
    state.escapeAttempts,
  );
  const success = rng.int(0, 255) < odds;
  if (!success) state.escapeAttempts += 1;
  return success;
}
