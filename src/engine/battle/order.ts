import type { Rng } from '../rng';
import type { BattleState, SideId, Slot } from './state';
import { modifiedSpeed } from './modifiers';

export type ActionEntry = Readonly<{
  side: SideId;
  slot?: Slot;
  priority: number;
  fractional?: number;
}>;

/**
 * Priority first, then the per-bracket fractional tie-break (Quick Draw, Stall),
 * then effective Speed; a tie is broken by the seeded battle RNG so the same
 * inputs always resolve in the same order (D11). Trick Room inverts the Speed
 * order for the whole field.
 */
export function orderActions(
  state: BattleState,
  entries: readonly ActionEntry[],
  rng: Rng = state.rng,
): ActionEntry[] {
  const trickRoom = state.field.trickroom > 0;
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const fracA = a.fractional ?? 0;
    const fracB = b.fractional ?? 0;
    if (fracA !== fracB) return fracB - fracA;
    const speedA = modifiedSpeed(state, a.side, a.slot ?? 0);
    const speedB = modifiedSpeed(state, b.side, b.slot ?? 0);
    if (speedA !== speedB) {
      const aFirst = trickRoom ? speedA < speedB : speedA > speedB;
      return aFirst ? -1 : 1;
    }
    return rng.next() < 0.5 ? -1 : 1;
  });
}
