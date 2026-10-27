import { describe, expect, it } from 'vitest';
import type { RunHistoryRecord } from '../../../../engine/run/history';
import { historyBestFloor, historyWins, recordMonthKey } from './records';

function record(edit: Partial<RunHistoryRecord> & Pick<RunHistoryRecord, 'seed'>): RunHistoryRecord {
  return {
    mode: 'finite',
    mapReached: 1,
    catches: 0,
    casualties: 0,
    playtimeMs: 0,
    won: false,
    endedAt: '2026-10-18T12:00:00.000Z',
    species: [],
    ...edit,
  };
}

/** Three finished runs: one won finite, one lost finite, one infinite deeper than both. */
function history(): readonly RunHistoryRecord[] {
  return [
    record({ seed: 'pkm-won', won: true, mapReached: 5, endedAt: '2026-10-02T00:00:00.000Z' }),
    record({ seed: 'pkm-lost', mapReached: 2, endedAt: '2026-09-30T23:59:59.000Z' }),
    record({ seed: 'pkm-infinite', mode: 'infinite', mapReached: 9 }),
  ];
}

describe('historyWins', () => {
  it('counts only the won records', () => {
    expect(historyWins(history())).toBe(1);
  });

  it('reads nothing as no win', () => {
    expect(historyWins([])).toBe(0);
    expect(historyWins([record({ seed: 'pkm-a' })])).toBe(0);
  });
});

describe('historyBestFloor', () => {
  it('reads the deepest floor in the list it is handed, every record included', () => {
    expect(historyBestFloor(history())).toBe(9);
  });

  it('lets the caller filter first, so the finite records of the same list answer 5', () => {
    expect(historyBestFloor(history().filter((entry) => entry.mode === 'finite'))).toBe(5);
  });

  it('reads nothing as floor zero', () => {
    expect(historyBestFloor([])).toBe(0);
  });

  it('ignores a floor the store cannot read', () => {
    const odd = [
      record({ seed: 'pkm-a', mapReached: Number.NaN }),
      record({ seed: 'pkm-b', mapReached: -3 }),
      record({ seed: 'pkm-c', mapReached: 2.7 }),
    ];

    expect(historyBestFloor(odd)).toBe(2);
  });
});

describe('recordMonthKey', () => {
  it('prints a UTC month key', () => {
    expect(recordMonthKey(new Date('2026-10-18T12:00:00.000Z'))).toBe('2026-10');
    expect(recordMonthKey(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
  });

  it('reads the instant in UTC, not in the machine’s zone', () => {
    expect(recordMonthKey(new Date('2026-09-30T23:59:59.000Z'))).toBe('2026-09');
    expect(recordMonthKey(new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10');
  });

  it('answers null for an instant the store cannot read', () => {
    expect(recordMonthKey(new Date('not-a-date'))).toBeNull();
  });
});
