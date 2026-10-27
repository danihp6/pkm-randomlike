import type { RunHistoryRecord } from '../../../../engine/run/history';

/**
 * The run-history arithmetic the stats screen and the main menu share, as plain
 * numbers: no clock, no storage and no locale, so the same list always answers the
 * same figures (`D11`).
 */

/** The finished runs that were won. */
export function historyWins(history: readonly RunHistoryRecord[]): number {
  let wins = 0;
  for (const record of history) if (record.won) wins += 1;
  return wins;
}

/** The deepest floor (1-based `mapReached`) in `history`; 0 for an empty list. */
export function historyBestFloor(history: readonly RunHistoryRecord[]): number {
  let best = 0;
  for (const record of history) best = Math.max(best, floorOf(record));
  return best;
}

/** `YYYY-MM` in UTC for `now`, or null for an instant the store cannot read. */
export function recordMonthKey(now: Date): string | null {
  const time = now.getTime();
  if (!Number.isFinite(time)) return null;
  const year = String(now.getUTCFullYear()).padStart(4, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** A record's floor as a whole number of at least zero; anything unreadable counts as none. */
function floorOf(record: RunHistoryRecord): number {
  const floor = record.mapReached;
  return typeof floor === 'number' && Number.isFinite(floor) && floor > 0 ? Math.floor(floor) : 0;
}
