import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAX_HISTORY,
  emptyEndLog,
  emptyHistory,
  endRun,
  makeHistoryRecord,
  pushHistory,
  type RunHistory,
  type RunHistoryRecord,
} from './history';
import { createRunPokemon, type RunPokemon } from './progression';
import { createRun } from './state';
import { releaseFainted } from './perms';

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
    rip: [],
  };
}

/** `member` carrying its own tallies, the way a resolved battle leaves it. */
function withTally(member: RunPokemon, kos: number, damage: number): RunPokemon {
  return { ...member, kos, damage } as RunPokemon;
}

/** `member` at 0 HP, so `releaseFainted` sends it to the rip. */
function fainted(member: RunPokemon, kos: number, damage: number): RunPokemon {
  return { ...withTally(member, kos, damage), fighter: { ...member.fighter, hp: 0 } };
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
      box: [
        tallying(boxed, 0, 45),
        tallying(createRunPokemon({ id: 'p2', speciesId: 'pidgey', level: 3 }), 0, 0),
      ],
    };
    expect(makeHistoryRecord(run, ENDING).species).toEqual([
      { speciesId: 'charmander', kos: 4, damage: 150 },
      { speciesId: 'sentret', kos: 0, damage: 45 },
    ]);
  });

  it('books a lost run’s only member from the rip, with its tallies, and counts it lost', () => {
    const starter = fainted(createRunPokemon({ id: 'p0', speciesId: 'slakoth', level: 5 }), 1, 13);
    const lost = releaseFainted(createRun({ seed: 'seed-loss', starter })).run;
    expect(lost.party).toEqual([]);
    expect(lost.rip).toHaveLength(1);
    const record = makeHistoryRecord(lost, ENDING);
    expect(record.species).toEqual([{ speciesId: 'slakoth', kos: 1, damage: 13 }]);
    expect(record.casualties).toBe(1);
  });

  it('reads the rip beside a live member and a boxed one, ascending by species', () => {
    const run: RunHistory = {
      ...history(),
      party: [withTally(createRunPokemon({ id: 'p0', speciesId: 'sentret', level: 5 }), 1, 20)],
      box: [withTally(createRunPokemon({ id: 'p1', speciesId: 'zigzagoon', level: 5 }), 2, 40)],
      rip: [withTally(createRunPokemon({ id: 'p2', speciesId: 'charmander', level: 5 }), 1, 30)],
    };
    expect(makeHistoryRecord(run, ENDING).species).toEqual([
      { speciesId: 'charmander', kos: 1, damage: 30 },
      { speciesId: 'sentret', kos: 1, damage: 20 },
      { speciesId: 'zigzagoon', kos: 2, damage: 40 },
    ]);
  });

  it('sums the same species into one row when the party and the rip both carry it', () => {
    const run: RunHistory = {
      ...history(),
      party: [withTally(history().party[0], 1, 30)],
      rip: [withTally(history().party[0], 2, 40)],
    };
    expect(makeHistoryRecord(run, ENDING).species).toEqual([
      { speciesId: 'charmander', kos: 3, damage: 70 },
    ]);
  });

  it('builds no row for a rippen member that never earned a KO or damage', () => {
    const run: RunHistory = {
      ...history(),
      party: [],
      box: [],
      rip: [createRunPokemon({ id: 'p9', speciesId: 'slakoth', level: 5 })],
    };
    expect(makeHistoryRecord(run, ENDING)).toEqual({
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
});

describe('emptyEndLog', () => {
  it('opens on the stored history with nothing ended', () => {
    const stored = [record(1), record(2)];
    const log = emptyEndLog(stored);
    expect(log.ended).toBe(false);
    expect(log.history).toBe(stored);
    expect(emptyEndLog([]).history).toEqual([]);
  });
});

describe('endRun', () => {
  it('appends exactly one record, the one its own arguments build', () => {
    const log = endRun(emptyEndLog([]), history(), ENDING);
    expect(log.ended).toBe(true);
    expect(log.history).toHaveLength(1);
    expect(log.history[0]).toEqual(makeHistoryRecord(history(), ENDING));
  });

  it('a second call with the same run appends nothing and answers the same log', () => {
    const first = endRun(emptyEndLog([record(1)]), history(), ENDING);
    const second = endRun(first, history(), ENDING);
    expect(second).toBe(first);
    expect(second.history).toHaveLength(first.history.length);
    expect(second.history.length).toBe(2);
    expect(second.ended).toBe(true);
  });

  it('prepends, so the newest run is first and the older ones keep their order', () => {
    const stored = [record(3), record(1), record(2)];
    const log = endRun(emptyEndLog(stored), history(), ENDING);
    expect(log.history[0].seed).toBe('seed-a');
    expect(log.history.slice(1)).toEqual(stored);
    expect(stored).toEqual([record(3), record(1), record(2)]);
  });

  it('carries the caller’s ending verbatim and reads no clock', () => {
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('endRun read the clock');
    });
    const log = endRun(emptyEndLog([]), history(), { ...ENDING, playtimeMs: 0, won: true });
    expect(log.history[0].playtimeMs).toBe(0);
    expect(log.history[0].won).toBe(true);
    expect(log.history[0].endedAt).toBe(ENDING.endedAt);
  });
});

describe('the end seam stays off the clock', () => {
  const SOURCES = ['./state.ts', './progression.ts', './battleLink.ts', './history.ts'];

  it('reads no clock and no RNG in the four engine files the seam lives in', () => {
    for (const path of SOURCES) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source, path).not.toMatch(/Date\.now|new Date\(|Math\.random/);
    }
  });
});
