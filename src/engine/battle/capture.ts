import { catchRateOf } from '../../data/dex';
import type { Rng } from '../rng';
import type { BattleFighter, StatusId } from './fighter';
import { activeFighter, type BattleState, type SideId } from './state';

export function statusCatchBonus(status: StatusId | null): number {
  if (status === 'slp' || status === 'frz') return 2.5;
  if (status === 'par' || status === 'psn' || status === 'tox' || status === 'brn') return 1.5;
  return 1;
}

/** Gen 9 catch value `a`: stronger balls, lower HP and status all raise it. */
export function catchValue(
  fighter: BattleFighter,
  catchRate: number,
  ballBonus: number,
): number {
  const raw = ((3 * fighter.maxHp - 2 * fighter.hp) * catchRate * ballBonus) / (3 * fighter.maxHp);
  return Math.floor(Math.floor(raw) * statusCatchBonus(fighter.status));
}

export function shakeThreshold(value: number): number {
  return Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / value)));
}

export type CaptureResult = Readonly<{ success: boolean; shakes: number; value: number }>;

export function attemptCapture(
  state: BattleState,
  targetSide: SideId,
  ballBonus: number,
  rng: Rng = state.rng,
): CaptureResult {
  const target = activeFighter(state, targetSide);
  const value = catchValue(target, catchRateOf(target.speciesId), ballBonus);

  if (!state.isWild || value <= 0) return { success: false, shakes: 0, value };
  if (value >= 255) return { success: true, shakes: 4, value };

  const threshold = shakeThreshold(value);
  let shakes = 0;
  while (shakes < 4 && rng.int(0, 65535) < threshold) shakes += 1;
  return { success: shakes === 4, shakes, value };
}
