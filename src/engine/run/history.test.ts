import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_HISTORY,
  emptyHistory,
  makeHistoryRecord,
  pushHistory,
  type RunHistory,
  type RunHistoryRecord,
} from './history';
import { createRunPokemon, type RunPokemon } from './progression';

const ENDING = { endedAt: '2026-10-25T12:00:00.000Z', playtimeMs: 540000, won: false } as const;

function record(index: number): RunHistoryRecord {
  return {
    seed: `seed-${index}`,
    mode: 'finite',
    mapReached: index + 1,
    catches: index,
    casualties: 0,
    playtimeMs: index * 1000,
    won: false,
    endedAt: `2026-10-25T12:00:${String(index % 60).padStart(2, '0')}.000Z`,
    species: [],
  };
}

function history(): RunHistory {
  return {
    seed: 'seed-a',
    mode: 'infinite',
    mapIndex: 3,
    stats: { catches: 5, casualties: 2 },
    party: [createRunPokemon({ id: 'p0', speciesId: 'charmander', level: 9 })],
    box: [createRunPokemon({ id: 'p1', speciesId: 'sentret', level: 4 })],
  };
}

describe('emptyHistory', () => {
  it('is empty and keeps 50 runs at most', () => {
    expect(emptyHistory()).toEqual([]);
    expect(MAX_HISTORY).toBe(50);
  });
});

describe('pushHistory', () => {
  it('prepends the record and leaves its argument untouched', () => {
    const before = [record(1), record(2)];
    const after = pushHistory(before, record(0));
    expect(after.map((entry) => entry.seed)).toEqual(['seed-0', 'seed-1', 'seed-2']);
    expect(before).toEqual([record(1), record(2)]);
  });

  it('keeps 50 rows and drops the oldest when a 51st arrives', () => {
    const before = Array.from({ length: MAX_HISTORY }, (_, index) => record(index + 1));
    const after = pushHistory(before, record(0));
    expect(after).toHaveLength(MAX_HISTORY);
    expect(after[0]).toEqual(record(0));
    expect(after[MAX_HISTORY - 1]).toEqual(record(MAX_HISTORY - 1));
    expect(after.some((entry) => entry.seed === `seed-${MAX_HISTORY}`)).toBe(false);
    expect(before).toEqual(Array.from({ length: MAX_HISTORY }, (_, index) => record(index + 1)));
  });

  it('never reorders what it keeps', () => {
    const before = [record(3), record(1), record(2)];
    expect(pushHistory(before, record(0)).slice(1)).toEqual(before);
  });
});

describe('makeHistoryRecord', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the run counters and the caller-supplied ending', () => {
    expect(makeHistoryRecord(history(), ENDING)).toEqual({
      seed: 'seed-a',
      mode: 'infinite',
      mapReached: 3,
      catches: 5,
      casualties: 2,
      playtimeMs: 540000,
      won: false,
      endedAt: '2026-10-25T12:00:00.000Z',
      species: [],
    });
  });

  it('is pure: the same arguments build the same record, with no clock read', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('makeHistoryRecord read the clock');
    });
    const run = history();
    expect(() => makeHistoryRecord(run, ENDING)).not.toThrow();
    expect(makeHistoryRecord(run, ENDING)).toEqual(makeHistoryRecord(run, ENDING));
  });

  it('builds no species row while the run carries no KO or damage counter', () => {
    expect(makeHistoryRecord(history(), ENDING).species).toEqual([]);
  });

  it('sums a member tally per species, party and box alike, dropping empty rows', () => {
    const tallying = (member: RunPokemon, kos: number, damage: number): RunPokemon =>
      ({ ...member, kos, damage }) as RunPokemon;
    const [lead, boxed] = [history().party[0], history().box[0]];
    const run: RunHistory = {
      ...history(),
      party: [tallying(lead, 3, 120), tallying(lead, 1, 30)],
      box: [tallying(boxed, 0, 45), tallying(createRunPokemon({ id: 'p2', speciesId: 'pidgey', level: 3 }), 0, 0)],
    };
    expect(makeHistoryRecord(run, ENDING).species).toEqual([
      { speciesId: 'charmander', kos: 4, damage: 150 },
      { speciesId: 'sentret', kos: 0, damage: 45 },
    ]);
  });
});
