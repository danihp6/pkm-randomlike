import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunHistoryRecord } from '../../../../engine/run/history';
import { t } from '../../../../i18n';
import type { RankingBoard } from '../../../../net/ranking';
import {
  STATS_EM_DASH,
  STATS_FIGURE_IDS,
  STATS_MODES,
  STATS_NARROW_QUERY,
  figureRuleBox,
  figureRuleLocal,
  liveStatsView,
  statsBoard,
  statsDate,
  statsDay,
  statsDuration,
  statsMonthLabel,
  statsMonths,
} from './view';

const NOW = new Date('2026-10-25T12:00:00.000Z');

/** The month's global board, the device's line second: the view's fifth argument. */
const BOARD: RankingBoard = {
  month: '2026-10',
  ownDeviceId: 'd-00000000beef',
  rows: [
    { deviceId: 'qa-device-0001', runs: 9, wins: 3, bestFloor: 12 },
    { deviceId: 'd-00000000beef', runs: 2, wins: 1, bestFloor: 4 },
  ],
};

/** A finished run; the store's records are the model's only input. */
function record(edit: Partial<RunHistoryRecord> & Pick<RunHistoryRecord, 'seed'>): RunHistoryRecord {
  return {
    mode: 'finite',
    mapReached: 1,
    catches: 0,
    casualties: 0,
    playtimeMs: 0,
    won: false,
    endedAt: '2026-10-01T00:00:00.000Z',
    species: [],
    ...edit,
  };
}

/**
 * Three finished runs in two UTC months, out of store order on purpose: 41H 20M of
 * playtime, one win, a species in two records and a pair of KOs ties for the
 * ranking's second and third sort keys.
 */
function history(): readonly RunHistoryRecord[] {
  return [
    record({
      seed: 'pkm-b',
      mapReached: 2,
      catches: 3,
      casualties: 2,
      playtimeMs: 3_600_000,
      endedAt: '2026-09-30T23:15:00.000Z',
      species: [{ speciesId: 'charmander', kos: 2, damage: 800 }],
    }),
    record({
      seed: 'pkm-a',
      won: true,
      mapReached: 4,
      catches: 5,
      casualties: 1,
      playtimeMs: 7_200_000,
      endedAt: '2026-10-18T09:30:00.000Z',
      species: [
        { speciesId: 'charmander', kos: 8, damage: 4120 },
        { speciesId: 'pikachu', kos: 3, damage: 900 },
        { speciesId: 'gastly', kos: 1, damage: 200 },
      ],
    }),
    record({
      seed: 'pkm-c',
      mapReached: 3,
      catches: 2,
      casualties: 1,
      playtimeMs: 138_000_000,
      endedAt: '2026-10-02T00:05:00.000Z',
      species: [
        { speciesId: 'gastly', kos: 2, damage: 400 },
        { speciesId: 'bulbasaur', kos: 3, damage: 2980 },
      ],
    }),
  ];
}

function figureValues(history: readonly RunHistoryRecord[]): readonly string[] {
  return liveStatsView(history, 'totals', null, NOW).figures.map((figure) => figure.value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formats', () => {
  it('prints a duration as hours and a zero-padded minute count', () => {
    expect(statsDuration(148_800_000)).toBe('41H 20M');
    expect(statsDuration(6_180_000)).toBe('1H 43M');
    expect(statsDuration(0)).toBe('0H 00M');
    expect(statsDuration(-5)).toBe('0H 00M');
  });

  it('prints a day as a month key and a zero-padded day, in UTC', () => {
    expect(statsDate('2026-10-18T09:30:00.000Z')).toBe('OCT 18');
    expect(statsDate('2026-10-02T23:59:59.000Z')).toBe('OCT 02');
    expect(statsDate('2026-01-01T00:00:00.000Z')).toBe('JAN 01');
    expect(statsDate('not a date')).toBe('');
    expect(statsDay('2026-10-18T09:30:00.000Z')).toBe('2026-10-18');
    expect(statsDay('not a date')).toBe('');
  });

  it('prints a month key with its four-digit year', () => {
    expect(statsMonthLabel('2026-10')).toBe('OCT 2026');
    expect(statsMonthLabel('2026-01')).toBe('JAN 2026');
    expect(statsMonthLabel('2026-13')).toBe('');
    expect(statsMonthLabel('nope')).toBe('');
  });
});

describe('statsMonths', () => {
  it('reads the months in the store, in UTC, newest first and deduped', () => {
    expect(statsMonths(history(), NOW)).toEqual([
      { key: '2026-10', label: 'OCT 2026' },
      { key: '2026-09', label: 'SEP 2026' },
    ]);
  });

  it('holds the month of now alone when the store is empty', () => {
    expect(statsMonths([], NOW)).toEqual([{ key: '2026-10', label: 'OCT 2026' }]);
    expect(statsMonths([], new Date('2024-02-29T23:59:59.000Z'))).toEqual([
      { key: '2024-02', label: 'FEB 2024' },
    ]);
  });

  it('keeps an instant read in UTC, not in the machine’s zone', () => {
    const late = [record({ seed: 'pkm-late', endedAt: '2026-10-31T23:30:00.000Z' })];

    expect(statsMonths(late, NOW).map((month) => month.key)).toEqual(['2026-10']);
  });
});

describe('liveStatsView — totals', () => {
  it('draws exactly twelve figures, in board order', () => {
    const view = liveStatsView(history(), 'totals', null, NOW);

    expect(view.mode).toBe('totals');
    expect(view.figures).toHaveLength(12);
    expect(view.figures.map((figure) => figure.id)).toEqual([...STATS_FIGURE_IDS]);
    expect(view.title).toBe(t('stats.title'));
    expect(view.blurb).toBe(t('stats.blurbTotals'));
    expect(view.tabs.map((tab) => tab.id)).toEqual(['totals', 'runs', 'pokemon']);
    expect(view.columns).toEqual([]);
    expect(view.rows).toEqual([]);
    expect(view.month).toBeNull();
    expect(view.empty).toBeNull();
    expect(view.actions.map((action) => action.id)).toEqual(['ranking', 'back']);
    expect(view.actions.map((action) => action.label)).toEqual([
      t('stats.actionRanking'),
      t('stats.actionBack'),
    ]);
  });

  it('counts the runs, the win rate and the furthest floor', () => {
    const values = figureValues(history());

    expect(values[0]).toBe('3');
    expect(values[1]).toBe('1');
    expect(values[2]).toBe('33%');
    expect(values[3]).toBe('4');
  });

  it('sums catches, losses, KOs and damage over the whole store', () => {
    const values = figureValues(history());

    expect(values[4]).toBe('10');
    expect(values[5]).toBe('4');
    expect(values[9]).toBe('19');
    expect(values[10]).toBe('9400');
  });

  it('prints playtime, the mean and the longest run as durations', () => {
    const values = figureValues(history());

    expect(values[6]).toBe('41H 20M');
    expect(values[7]).toBe('13H 46M');
    expect(values[8]).toBe('38H 20M');
  });

  it('prints the newest record’s day, not the store’s first record', () => {
    expect(figureValues(history())[11]).toBe('2026-10-18');
  });

  it('draws the em dash everywhere on an empty store, and its empty line', () => {
    const view = liveStatsView([], 'totals', null, NOW);

    expect(view.figures).toHaveLength(12);
    expect(view.figures.every((figure) => figure.value === STATS_EM_DASH)).toBe(true);
    expect(view.empty).toBe(t('stats.emptyTotals'));
  });

  it('dashes a zero playtime, a zero mean and a zero longest run', () => {
    const values = figureValues([record({ seed: 'pkm-zero', catches: 2 })]);

    expect(values[6]).toBe(STATS_EM_DASH);
    expect(values[7]).toBe(STATS_EM_DASH);
    expect(values[8]).toBe(STATS_EM_DASH);
    expect(values[4]).toBe('2');
  });
});

describe('liveStatsView — runs', () => {
  it('re-sorts an out-of-order store newest first, one row per record', () => {
    const view = liveStatsView(history(), 'runs', null, NOW);

    expect(view.mode).toBe('runs');
    expect(view.rows.map((row) => row.id)).toEqual(['run-0', 'run-1', 'run-2']);
    expect(view.rows.map((row) => row.cells[1])).toEqual(['pkm-a', 'pkm-c', 'pkm-b']);
    expect(view.blurb).toBe(t('stats.blurbRuns'));
    expect(view.columns).toEqual([]);
    expect(view.figures).toEqual([]);
    expect(view.month).toBeNull();
    expect(view.empty).toBeNull();
    expect(view.actions.map((action) => action.id)).toEqual(['ranking', 'back']);
  });

  it('prints the four cells of a row: badge, seed, day, meta', () => {
    const view = liveStatsView(history(), 'runs', null, NOW);

    expect(view.rows[0]!.cells).toEqual([
      t('stats.win'),
      'pkm-a',
      'OCT 18',
      t('stats.runMeta', { maps: 4, caught: 5, lost: 1 }),
    ]);
    expect(view.rows[1]!.cells[0]).toBe(t('stats.loss'));
    expect(view.rows[1]!.cells[2]).toBe('OCT 02');
    expect(view.rows[2]!.cells[2]).toBe('SEP 30');
  });

  it('breaks a same-instant tie by seed, ascending', () => {
    const tied = [
      record({ seed: 'pkm-z', endedAt: '2026-10-05T00:00:00.000Z' }),
      record({ seed: 'pkm-a', endedAt: '2026-10-05T00:00:00.000Z' }),
    ];

    expect(liveStatsView(tied, 'runs', null, NOW).rows.map((row) => row.cells[1])).toEqual([
      'pkm-a',
      'pkm-z',
    ]);
  });

  it('draws its empty line when the store is empty', () => {
    const view = liveStatsView([], 'runs', null, NOW);

    expect(view.rows).toEqual([]);
    expect(view.empty).toBe(t('stats.emptyRuns'));
  });
});

describe('liveStatsView — the Pokémon tables', () => {
  it('aggregates a species across the records that named it', () => {
    const rows = liveStatsView(history(), 'pokemon', null, NOW).rows;
    const charmander = rows.find((row) => row.id === 'charmander');
    const gastly = rows.find((row) => row.id === 'gastly');

    expect(charmander!.cells).toEqual(['Charmander', '2', '10', '4920', STATS_EM_DASH]);
    expect(gastly!.cells).toEqual(['Gastly', '2', '3', '600', STATS_EM_DASH]);
  });

  it('throws nothing away: every species of every record is a row', () => {
    const rows = liveStatsView(history(), 'pokemon', null, NOW).rows;

    expect(rows.map((row) => row.id)).toEqual(['bulbasaur', 'charmander', 'gastly', 'pikachu']);
  });

  it('prints the tanked column as the em dash and carries five headers', () => {
    const view = liveStatsView(history(), 'pokemon', null, NOW);

    expect(view.columns).toEqual([
      t('stats.colPokemon'),
      t('stats.colRuns'),
      t('stats.colKos'),
      t('stats.colDealt'),
      t('stats.colTanked'),
    ]);
    expect(view.rows.every((row) => row.cells.length === 5)).toBe(true);
    expect(view.rows.every((row) => row.cells[4] === STATS_EM_DASH)).toBe(true);
    expect(view.empty).toBeNull();
    expect(view.blurb).toBe(t('stats.blurbPokemon'));
  });

  it('sorts ranking-pokemon by KOs, then runs, then species id', () => {
    const view = liveStatsView(history(), 'ranking-pokemon', null, NOW);

    expect(view.rows.map((row) => row.id)).toEqual(['charmander', 'gastly', 'bulbasaur', 'pikachu']);
    expect(view.columns).toEqual([
      t('stats.colPokemon'),
      t('stats.colRuns'),
      t('stats.colKos'),
      t('stats.colDealt'),
    ]);
    expect(view.rows.every((row) => row.cells.length === 4)).toBe(true);
    expect(view.rows[0]!.cells).toEqual(['Charmander', '2', '10', '4920']);
  });

  it('says ALL RUNS with both arrows off, and no tab strip', () => {
    const view = liveStatsView(history(), 'ranking-pokemon', null, NOW);

    expect(view.month).toEqual({ label: t('stats.allRuns'), canPrev: false, canNext: false });
    expect(view.tabs).toEqual([]);
    expect(view.actions.map((action) => action.id)).toEqual(['ranking-players', 'back']);
    expect(view.blurb).toBe(t('stats.blurbRankingPokemon'));
  });

  it('draws the empty Pokémon line in both Pokémon modes', () => {
    for (const mode of ['pokemon', 'ranking-pokemon'] as const) {
      const view = liveStatsView([], mode, null, NOW);

      expect(view.rows).toEqual([]);
      expect(view.empty).toBe(t('stats.emptyPokemon'));
    }
  });
});

describe('liveStatsView — ranking', () => {
  it('shows the local record of the selected month as one YOU row', () => {
    const view = liveStatsView(history(), 'ranking', '2026-10', NOW);

    expect(view.mode).toBe('ranking');
    expect(view.tabs).toEqual([]);
    expect(view.figures).toEqual([]);
    expect(view.columns).toEqual([
      t('stats.colPlayer'),
      t('stats.colRuns'),
      t('stats.colWins'),
      t('stats.colBestFloor'),
    ]);
    expect(view.rows).toEqual([{ id: 'you', cells: [t('stats.you'), '2', '1', '4'] }]);
    expect(view.empty).toBeNull();
    expect(view.actions.map((action) => action.id)).toEqual(['ranking-pokemon', 'back']);
    expect(view.blurb).toBe(t('stats.blurbRanking'));
  });

  it('clamps the selector at both ends of the month list', () => {
    const newest = liveStatsView(history(), 'ranking', '2026-10', NOW).month;
    const older = liveStatsView(history(), 'ranking', '2026-09', NOW).month;

    expect(newest).toEqual({ label: 'OCT 2026', canPrev: true, canNext: false });
    expect(older).toEqual({ label: 'SEP 2026', canPrev: false, canNext: true });
    expect(liveStatsView(history(), 'ranking', '2026-09', NOW).rows[0]!.cells).toEqual([
      t('stats.you'),
      '1',
      '0',
      '2',
    ]);
  });

  it('falls back to the newest month on a stale key', () => {
    const stale = liveStatsView(history(), 'ranking', '2020-01', NOW);

    expect(stale.month).toEqual({ label: 'OCT 2026', canPrev: true, canNext: false });
    expect(stale.rows[0]!.cells[1]).toBe('2');
  });

  it('draws its empty line for a month with no runs, and on an empty store', () => {
    const empty = liveStatsView([], 'ranking', null, NOW);

    expect(empty.month).toEqual({ label: 'OCT 2026', canPrev: false, canNext: false });
    expect(empty.empty).toBe(t('stats.emptyMonth'));
    expect(empty.rows).toEqual([{ id: 'you', cells: [t('stats.you'), '0', '0', '0'] }]);
  });
});

describe('liveStatsView — the global board', () => {
  it('is the shipped local view when the fifth argument is omitted or null', () => {
    for (const mode of STATS_MODES) {
      const four = liveStatsView(history(), mode, '2026-10', NOW);
      const five = liveStatsView(history(), mode, '2026-10', NOW, null);

      expect(five).toEqual(four);
    }
  });

  it('reads the board’s order and marks the own line', () => {
    const view = liveStatsView(history(), 'ranking', '2026-10', NOW, BOARD);

    expect(view.rows).toEqual([
      { id: 'global-0', cells: ['#0001', '9', '3', '12'] },
      { id: 'global-1', cells: [t('stats.you'), '2', '1', '4'] },
    ]);
    expect(view.blurb).toBe(t('stats.blurbRankingGlobal'));
    expect(view.columns).toEqual([
      t('stats.colPlayer'),
      t('stats.colRuns'),
      t('stats.colWins'),
      t('stats.colBestFloor'),
    ]);
    expect(view.empty).toBeNull();
  });

  it('appends the device’s own line last when the board does not hold it', () => {
    const board: RankingBoard = { ...BOARD, rows: [BOARD.rows[0]!] };

    const view = liveStatsView(history(), 'ranking', '2026-10', NOW, board);

    expect(view.rows.map((row) => row.id)).toEqual(['global-0', 'you']);
    expect(view.rows[1]!.cells).toEqual([t('stats.you'), '2', '1', '4']);
  });

  it('keeps the shipped month selector and its arrows', () => {
    const view = liveStatsView(history(), 'ranking', '2026-09', NOW, BOARD);

    expect(view.month).toEqual({ label: 'SEP 2026', canPrev: false, canNext: true });
  });

  it('draws its empty line only when neither the board nor the month has a run', () => {
    const emptyBoard: RankingBoard = { month: '2026-10', ownDeviceId: '', rows: [] };

    const empty = liveStatsView([], 'ranking', null, NOW, emptyBoard);
    const localRuns = liveStatsView(history(), 'ranking', '2026-10', NOW, {
      ...emptyBoard,
      ownDeviceId: BOARD.ownDeviceId,
    });

    expect(empty.empty).toBe(t('stats.emptyMonth'));
    expect(empty.rows).toEqual([{ id: 'you', cells: [t('stats.you'), '0', '0', '0'] }]);
    expect(localRuns.empty).toBeNull();
    expect(localRuns.rows).toEqual([{ id: 'you', cells: [t('stats.you'), '2', '1', '4'] }]);
  });

  it('reads the board only in the ranking mode', () => {
    for (const mode of ['totals', 'runs', 'pokemon', 'ranking-pokemon'] as const) {
      expect(liveStatsView(history(), mode, '2026-10', NOW, BOARD)).toEqual(
        liveStatsView(history(), mode, '2026-10', NOW),
      );
    }
  });

  it('is still pure: two board reads are deep-equal', () => {
    expect(liveStatsView(history(), 'ranking', '2026-10', NOW, BOARD)).toEqual(
      liveStatsView(history(), 'ranking', '2026-10', NOW, BOARD),
    );
  });
});

describe('liveStatsView — purity', () => {
  it('is pure: the same input is deep-equal and JSON round-trips unchanged', () => {
    for (const mode of STATS_MODES) {
      const first = liveStatsView(history(), mode, '2026-10', NOW);
      const second = liveStatsView(history(), mode, '2026-10', NOW);

      expect(first).toEqual(second);
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    }
  });

  it('reads no clock: the now argument is the only time source', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('liveStatsView read the clock');
    });

    expect(() => liveStatsView(history(), 'totals', null, NOW)).not.toThrow();
    expect(() => liveStatsView(history(), 'ranking', null, NOW)).not.toThrow();
    expect(() => liveStatsView([], 'ranking', null, NOW)).not.toThrow();
    expect(nowSpy).not.toHaveBeenCalled();
  });

  it('leaves the store it was handed untouched', () => {
    const store = history();
    const before = store.map((entry) => entry.seed);

    liveStatsView(store, 'runs', null, NOW);

    expect(store.map((entry) => entry.seed)).toEqual(before);
  });
});

describe('statsBoard', () => {
  it('carries the desktop panel and the three tabs of frame 08', () => {
    const board = statsBoard('desktop');

    expect(board.panel).toEqual({ x: 80, y: 60, w: 1120, h: 680, radius: 11 });
    expect(board.title).toEqual({ x: 160, y: 86, w: 960, h: 36 });
    expect(board.blurb).toEqual({ x: 160, y: 126, w: 960, h: 20 });
    expect(board.tabs.map((tab) => tab.id)).toEqual(['totals', 'runs', 'pokemon']);
    expect(board.button).toEqual({ x: 540, y: 650, w: 200, h: 40 });
  });

  it('carries the phone panel of frame m08', () => {
    const board = statsBoard('narrow');

    expect(board.panel).toEqual({ x: 8, y: 47, w: 374, h: 750, radius: 12 });
    expect(board.title).toEqual({ x: 153, y: 80, w: 83, h: 26 });
    expect(board.button).toEqual({ x: 95, y: 744, w: 200, h: 40 });
  });
});

describe('the figures’ rule', () => {
  it('carries the measured rule of frame 08 on the desk and m08 on the phone', () => {
    expect(statsBoard('desktop').figureRule).toEqual({
      x: 120,
      y: 274,
      w: 320,
      h: 1,
      colPitch: 360,
      rowPitch: 88,
      columns: 3,
    });
    expect(statsBoard('narrow').figureRule).toEqual({
      x: 32,
      y: 228,
      w: 165,
      h: 1,
      colPitch: 169,
      rowPitch: 62,
      columns: 2,
    });
  });

  it('steps the twelve boxes three per row on the desk', () => {
    const board = statsBoard('desktop');

    expect(Array.from({ length: 12 }, (_, index) => figureRuleBox(board, index))).toEqual([
      { x: 120, y: 274, w: 320, h: 1 },
      { x: 480, y: 274, w: 320, h: 1 },
      { x: 840, y: 274, w: 320, h: 1 },
      { x: 120, y: 362, w: 320, h: 1 },
      { x: 480, y: 362, w: 320, h: 1 },
      { x: 840, y: 362, w: 320, h: 1 },
      { x: 120, y: 450, w: 320, h: 1 },
      { x: 480, y: 450, w: 320, h: 1 },
      { x: 840, y: 450, w: 320, h: 1 },
      { x: 120, y: 538, w: 320, h: 1 },
      { x: 480, y: 538, w: 320, h: 1 },
      { x: 840, y: 538, w: 320, h: 1 },
    ]);
  });

  it('steps the twelve boxes two per row on the phone', () => {
    const board = statsBoard('narrow');

    expect(Array.from({ length: 12 }, (_, index) => figureRuleBox(board, index))).toEqual([
      { x: 32, y: 228, w: 165, h: 1 },
      { x: 201, y: 228, w: 165, h: 1 },
      { x: 32, y: 290, w: 165, h: 1 },
      { x: 201, y: 290, w: 165, h: 1 },
      { x: 32, y: 352, w: 165, h: 1 },
      { x: 201, y: 352, w: 165, h: 1 },
      { x: 32, y: 414, w: 165, h: 1 },
      { x: 201, y: 414, w: 165, h: 1 },
      { x: 32, y: 476, w: 165, h: 1 },
      { x: 201, y: 476, w: 165, h: 1 },
      { x: 32, y: 538, w: 165, h: 1 },
      { x: 201, y: 538, w: 165, h: 1 },
    ]);
  });

  it('clamps an index outside the twelve figures to the first box', () => {
    const board = statsBoard('desktop');
    const first = figureRuleBox(board, 0);

    expect(figureRuleBox(board, -1)).toEqual(first);
    expect(figureRuleBox(board, 12)).toEqual(first);
    expect(figureRuleBox(board, 2.5)).toEqual(first);
    expect(figureRuleBox(board, Number.NaN)).toEqual(first);
  });

  it('draws one rule per figure, under its value and never meeting the next row', () => {
    for (const viewport of ['desktop', 'narrow'] as const) {
      const board = statsBoard(viewport);
      const columns = board.figureRule.columns;
      const rows = STATS_FIGURE_IDS.length / columns;

      for (let index = 0; index < STATS_FIGURE_IDS.length; index += 1) {
        const row = Math.floor(index / columns);
        const box = figureRuleBox(board, index);
        const label = `${viewport} figure ${index}`;

        expect(box.w, label).toBe(board.figureRule.w);
        expect(box.h, label).toBe(1);
        expect(box.y, label).toBeGreaterThanOrEqual(
          board.figureValue.y + row * board.figureValue.pitch + board.figureValue.h,
        );
        if (row < rows - 1) {
          expect(box.y + box.h, label).toBeLessThanOrEqual(
            board.figureLabel.y + (row + 1) * board.figureLabel.pitch,
          );
        }
      }
    }
  });

  it('carries the rule in the figure block’s own coordinates, one box for every figure', () => {
    expect(figureRuleLocal(statsBoard('desktop'))).toEqual({ x: 0, y: 44, w: 320, h: 1 });
    expect(figureRuleLocal(statsBoard('narrow'))).toEqual({ x: 0, y: 50, w: 165, h: 1 });
  });

  it('reads the breakpoint the stylesheet switches its phone column at', () => {
    expect(STATS_NARROW_QUERY).toBe('(max-width: 600px)');
  });
});
