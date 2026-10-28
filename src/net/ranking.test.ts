import { describe, expect, it, vi } from 'vitest';
import type { RunHistoryRecord } from '../engine/run/history';
import type { StorageLike } from '../engine/save';
import {
  RANKING_CONFIG_URL,
  RANKING_DEVICE_KEY,
  RANKING_MAX_MAP_REACHED,
  RANKING_MAX_PLAYTIME_MS,
  RANKING_TOP_N,
  buildRankingEntry,
  clampMapReached,
  clampPlaytimeMs,
  fetchRanking,
  loadRankingEndpoint,
  rankingDeviceId,
  submitRanking,
  type RankingEntry,
} from './ranking';

const ENTRY: RankingEntry = {
  seed: 'pkm-qa',
  mode: 'finite',
  mapReached: 3,
  won: true,
  playtimeMs: 123_456,
  species: ['pikachu'],
  deviceId: 'qa-device-0001',
};

function historyRecord(edit: Partial<RunHistoryRecord> = {}): RunHistoryRecord {
  return {
    seed: 'pkm-a',
    mode: 'finite',
    mapReached: 3,
    catches: 2,
    casualties: 1,
    playtimeMs: 123_456,
    won: true,
    endedAt: '2026-10-18T09:30:00.000Z',
    species: [
      { speciesId: 'bulbasaur', kos: 1, damage: 10 },
      { speciesId: 'charmander', kos: 2, damage: 20 },
      { speciesId: 'gastly', kos: 3, damage: 30 },
      { speciesId: 'pikachu', kos: 4, damage: 40 },
      { speciesId: 'raticate', kos: 5, damage: 50 },
      { speciesId: 'squirtle', kos: 6, damage: 60 },
      { speciesId: 'zubat', kos: 7, damage: 70 },
    ],
    ...edit,
  };
}

function respond(body: unknown, ok = true): Response {
  return { ok, json: async (): Promise<unknown> => body } as unknown as Response;
}

function storage(seed: string | null = null): StorageLike & { written: string[] } {
  let value = seed;
  const written: string[] = [];
  return {
    written,
    getItem: (key: string): string | null => (key === RANKING_DEVICE_KEY ? value : null),
    setItem: (key: string, next: string): void => {
      if (key === RANKING_DEVICE_KEY) {
        value = next;
        written.push(next);
      }
    },
    removeItem: (): void => {
      value = null;
    },
  };
}

describe('the clamps', () => {
  it('pins the two magnitudes the Lambda re-applies', () => {
    expect(RANKING_MAX_MAP_REACHED).toBe(99);
    expect(RANKING_MAX_PLAYTIME_MS).toBe(86_400_000);
    expect(RANKING_TOP_N).toBe(10);
  });

  it('truncates a floor into 0 … 99 and a playtime into 0 … 24 h', () => {
    expect(clampMapReached(3.9)).toBe(3);
    expect(clampMapReached(-4)).toBe(0);
    expect(clampMapReached(400)).toBe(99);
    expect(clampMapReached(Number.NaN)).toBe(0);
    expect(clampPlaytimeMs(1_500.7)).toBe(1_500);
    expect(clampPlaytimeMs(-5)).toBe(0);
    expect(clampPlaytimeMs(86_400_001)).toBe(86_400_000);
    expect(clampPlaytimeMs(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('buildRankingEntry', () => {
  it('carries exactly the seven keys the endpoint reads', () => {
    expect(Object.keys(buildRankingEntry(historyRecord(), 'qa-device-0001')).sort()).toEqual([
      'deviceId',
      'mapReached',
      'mode',
      'playtimeMs',
      'seed',
      'species',
      'won',
    ]);
  });

  it('clamps the floor and the playtime and keeps the rest of the record as it is', () => {
    const entry = buildRankingEntry(
      historyRecord({ seed: 'pkm-pinned', mode: 'infinite', won: false }),
      'qa-device-0001',
    );

    expect(entry).toEqual({
      seed: 'pkm-pinned',
      mode: 'infinite',
      mapReached: 3,
      won: false,
      playtimeMs: 123_456,
      species: ['bulbasaur', 'charmander', 'gastly', 'pikachu', 'raticate', 'squirtle'],
      deviceId: 'qa-device-0001',
    });
    expect(buildRankingEntry(historyRecord({ mapReached: 400 }), 'qa-device-0001').mapReached).toBe(99);
    expect(buildRankingEntry(historyRecord({ playtimeMs: -5 }), 'qa-device-0001').playtimeMs).toBe(0);
    expect(
      buildRankingEntry(historyRecord({ playtimeMs: Number.NaN }), 'qa-device-0001').playtimeMs,
    ).toBe(0);
  });

  it('slices the species list to its first six, already sorted by id', () => {
    const entry = buildRankingEntry(historyRecord(), 'qa-device-0001');

    expect(entry.species).toHaveLength(6);
    expect(entry.species).not.toContain('zubat');
  });

  it('reads no clock and no RNG: the same record is the same payload', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('buildRankingEntry read the clock');
    });
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('buildRankingEntry drew a random number');
    });

    const first = buildRankingEntry(historyRecord(), 'qa-device-0001');
    const second = buildRankingEntry(historyRecord(), 'qa-device-0001');

    expect(first).toEqual(second);
    expect(nowSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });
});

describe('rankingDeviceId', () => {
  it('keeps a well-formed stored id and writes nothing', () => {
    const store = storage('qa-device-0001');

    expect(rankingDeviceId(store)).toBe('qa-device-0001');
    expect(store.written).toEqual([]);
  });

  it('mints d- and twelve hex digits from the injected sequence, and stores it', () => {
    const store = storage();

    const id = rankingDeviceId(store, draws([0, 0.5, 0.25, 1]));

    expect(id).toBe('d-000800400fff');
    expect(id).toMatch(/^d-[0-9a-f]{12}$/);
    expect(store.written).toEqual([id]);
  });

  it('mints a fresh id over junk and over an id the pattern refuses', () => {
    for (const junk of ['', 'short', 'has space', 'x'.repeat(41), 'under_score']) {
      const store = storage(junk);

      const id = rankingDeviceId(store, draws([0.1, 0.2, 0.3, 0.4]));

      expect(id).not.toBe(junk);
      expect(id).toMatch(/^d-[0-9a-f]{12}$/);
      expect(store.written).toEqual([id]);
    }
  });

  it('answers an id with no storage at all, without a write', () => {
    expect(rankingDeviceId(null, draws([0.5, 0.5, 0.5, 0.5]))).toBe('d-800800800800');
  });
});

function draws(sequence: readonly number[]): () => number {
  let at = 0;
  return (): number => {
    const draw = sequence[at] ?? 0;
    at += 1;
    return draw;
  };
}

describe('loadRankingEndpoint', () => {
  it('reads ranking.json and returns the endpoint it names', () => {
    const fetcher = vi.fn(async () => respond({ endpoint: 'https://example.test/ranking' }));

    return expect(loadRankingEndpoint(fetcher as unknown as typeof fetch)).resolves.toBe(
      'https://example.test/ranking',
    );
  });

  it('asks for the file the deploy writes', async () => {
    const fetcher = vi.fn(async () => respond({ endpoint: 'https://example.test/ranking' }));

    await loadRankingEndpoint(fetcher as unknown as typeof fetch);

    expect(RANKING_CONFIG_URL).toBe('ranking.json');
    expect(fetcher).toHaveBeenCalledWith('ranking.json');
  });

  it('is null for a missing file, a broken body or a non-http endpoint', async () => {
    const cases: readonly (() => Promise<Response>)[] = [
      async () => respond({ endpoint: 'https://example.test/ranking' }, false),
      async () => respond({}),
      async () => respond({ endpoint: '' }),
      async () => respond({ endpoint: 'ftp://example.test/ranking' }),
      async () => respond(['https://example.test/ranking']),
      async () => {
        throw new Error('offline');
      },
    ];

    for (const fetcher of cases) {
      await expect(loadRankingEndpoint(fetcher as unknown as typeof fetch)).resolves.toBeNull();
    }
  });
});

describe('submitRanking', () => {
  it('is false for a null or empty endpoint without calling the fetcher', async () => {
    const fetcher = vi.fn();

    await expect(submitRanking(ENTRY, null, fetcher as unknown as typeof fetch)).resolves.toBe(false);
    await expect(submitRanking(ENTRY, '', fetcher as unknown as typeof fetch)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('posts the payload as JSON and answers the response’s own ok', async () => {
    const fetcher = vi.fn(async () => respond({ ok: true }));

    const sent = await submitRanking(
      ENTRY,
      'https://example.test/ranking',
      fetcher as unknown as typeof fetch,
    );

    expect(sent).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/ranking');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual(ENTRY);
  });

  it('is false when the endpoint refuses, and when the browser cannot reach it', async () => {
    const refused = vi.fn(async () => respond({ error: 'rate' }, false));
    const offline = vi.fn(async () => {
      throw new Error('offline');
    });

    await expect(
      submitRanking(ENTRY, 'https://example.test/ranking', refused as unknown as typeof fetch),
    ).resolves.toBe(false);
    await expect(
      submitRanking(ENTRY, 'https://example.test/ranking', offline as unknown as typeof fetch),
    ).resolves.toBe(false);
  });
});

describe('fetchRanking', () => {
  it('is null for a null endpoint and for a month outside YYYY-MM, without a call', async () => {
    const fetcher = vi.fn();

    await expect(fetchRanking('2026-10', null, fetcher as unknown as typeof fetch)).resolves.toBeNull();
    for (const month of ['', '2026-13', '2026-00', '2026-1', 'OCT 2026', '2026-10-18']) {
      await expect(
        fetchRanking(month, 'https://example.test/ranking', fetcher as unknown as typeof fetch),
      ).resolves.toBeNull();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reads the month and the rows, in the endpoint’s own order', async () => {
    const fetcher = vi.fn(async () => respond({ month: '2026-10', rows: TWO_ROWS }));

    const board = await fetchRanking(
      '2026-10',
      'https://example.test/ranking',
      fetcher as unknown as typeof fetch,
    );

    expect(fetcher).toHaveBeenCalledWith('https://example.test/ranking?month=2026-10&limit=10');
    expect(board).toEqual({ month: '2026-10', ownDeviceId: '', rows: TWO_ROWS });
  });

  it('is null on a 500, on a rejection and on a malformed body', async () => {
    const cases: readonly (() => Promise<Response>)[] = [
      async () => respond({ error: 'boom' }, false),
      async () => {
        throw new Error('offline');
      },
      async () => respond(null),
      async () => respond({}),
      async () => respond({ month: 202610, rows: [] }),
      async () => respond({ month: '2026-10' }),
      async () => respond({ month: '2026-10', rows: [{ deviceId: 'qa', runs: 1, wins: 0 }] }),
      async () => respond({ month: '2026-10', rows: [{ deviceId: 5, runs: 1, wins: 0, bestFloor: 0 }] }),
      async () =>
        respond({ month: '2026-10', rows: [{ deviceId: 'qa', runs: '1', wins: 0, bestFloor: 0 }] }),
    ];

    for (const fetcher of cases) {
      await expect(
        fetchRanking('2026-10', 'https://example.test/ranking', fetcher as unknown as typeof fetch),
      ).resolves.toBeNull();
    }
  });
});

const TWO_ROWS = [
  { deviceId: 'qa-device-0001', runs: 1, wins: 1, bestFloor: 3 },
  { deviceId: 'qa-device-0002', runs: 4, wins: 0, bestFloor: 2 },
] as const;
