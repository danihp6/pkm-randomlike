import type { Rng } from '../rng';
import { effectiveSpeed } from './fighter';
import { activeFighter, type BattleState, type SideId } from './state';

export type ActionEntry = Readonly<{ side: SideId; priority: number }>;

/**
 * Priority first, then effective Speed; a tie is broken by the seeded battle
 * RNG so the same inputs always resolve in the same order (D11).
 */
export function orderActions(
  state: BattleState,
  entries: readonly ActionEntry[],
  rng: Rng = state.rng,
): ActionEntry[] {
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const speedA = effectiveSpeed(activeFighter(state, a.side));
    const speedB = effectiveSpeed(activeFighter(state, b.side));
    if (speedA !== speedB) return speedB - speedA;
    return rng.next() < 0.5 ? -1 : 1;
  });
}
