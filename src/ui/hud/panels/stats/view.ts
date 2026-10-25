import { getSpecies } from '../../../../data/dex/species';
import type { RunHistoryRecord } from '../../../../engine/run/history';
import { t, type TranslationKey } from '../../../../i18n';

/**
 * The stats and ranking screen's value model (`D49`, frames `08` / `08b` / `08c` /
 * `09` / `09b` and their `m…` twins), as plain data: the totals grid, the run list,
 * the Pokédex-style Pokémon table and the **local** monthly record.
 *
 * The figures come from the run-history store (`src/engine/run/history.ts`), which
 * records no damage taken: the tanked column is the em dash, never a made-up number.
 * The model reads no clock, no storage and no locale beyond `t()`: `now` is the only
 * time source and the same arguments always build the same view (`D11`).
 */

export const STATS_SLUGS = [
  '08-stats-totals',
  '08b-stats-runs',
  '08c-stats-pokemon',
  '09-ranking',
  '09b-ranking-pokemon',
] as const;
export type StatsSlug = (typeof STATS_SLUGS)[number];

export const STATS_MODES = ['totals', 'runs', 'pokemon', 'ranking', 'ranking-pokemon'] as const;
export type StatsMode = (typeof STATS_MODES)[number];

/** The em dash every unrecorded figure is drawn as, one cell, never a 0. */
export const STATS_EM_DASH = '\u2014';

export type StatsFigure = Readonly<{ id: string; label: string; value: string }>;
export type StatsRow = Readonly<{ id: string; cells: readonly string[] }>;
export type StatsTab = Readonly<{ id: StatsMode; label: string }>;
export type StatsActionId = 'back' | 'ranking' | 'ranking-players' | 'ranking-pokemon';
export type StatsAction = Readonly<{ id: StatsActionId; label: string }>;
/** `key` is `YYYY-MM` in UTC; `label` is `OCT 2026` (month key + year). */
export type StatsMonth = Readonly<{ key: string; label: string }>;
export type StatsRect = Readonly<{ x: number; y: number; w: number; h: number }>;

export type StatsBoard = Readonly<{
  panel: Readonly<{ x: number; y: number; w: number; h: number; radius: number }>;
  title: StatsRect;
  blurb: StatsRect;
  tabs: readonly Readonly<{ id: StatsMode; x: number; y: number; w: number; h: number }>[];
  figureLabel: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  figureValue: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  row: Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;
  button: StatsRect;
}>;

export type StatsView = Readonly<{
  mode: StatsMode;
  title: string;
  blurb: string;
  tabs: readonly StatsTab[];
  /** The TOTALS grid, three per row, exactly 12 entries; empty in every other mode. */
  figures: readonly StatsFigure[];
  /** The table's headers; empty for `totals` and for `runs` (its rows carry no header). */
  columns: readonly string[];
  rows: readonly StatsRow[];
  /** The empty-state line when the store holds nothing for this view, else null. */
  empty: string | null;
  /** RANKING's selector; null in every other mode. */
  month: Readonly<{ label: string; canPrev: boolean; canNext: boolean }> | null;
  actions: readonly StatsAction[];
}>;

/** The TOTALS grid's twelve figures, in board order. */
export const STATS_FIGURE_IDS = [
  'runsPlayed',
  'runsWon',
  'winRate',
  'bestFloor',
  'caught',
  'lost',
  'playtime',
  'avgRun',
  'longestRun',
  'kos',
  'dealt',
  'lastRun',
] as const;

/** `08` / `08b` / `08c` / `09` / `09b`, page coordinates at 1280×800. */
const DESKTOP_BOARD: StatsBoard = {
  panel: { x: 80, y: 60, w: 1120, h: 680, radius: 11 },
  title: { x: 160, y: 86, w: 960, h: 36 },
  blurb: { x: 160, y: 126, w: 960, h: 20 },
  tabs: [
    { id: 'totals', x: 120, y: 166, w: 120, h: 24 },
    { id: 'runs', x: 252, y: 166, w: 110, h: 24 },
    { id: 'pokemon', x: 374, y: 166, w: 130, h: 24 },
  ],
  figureLabel: { x: 120, y: 230, w: 320, h: 16, pitch: 88 },
  figureValue: { x: 260, y: 228, w: 180, h: 31, pitch: 88 },
  row: { x: 120, y: 230, w: 1040, h: 54, pitch: 62 },
  button: { x: 540, y: 650, w: 200, h: 40 },
};

/** `m08` / `m08b` / `m08c` / `m09` / `m09b`, page coordinates at 390×844. */
const NARROW_BOARD: StatsBoard = {
  panel: { x: 8, y: 47, w: 374, h: 750, radius: 12 },
  title: { x: 153, y: 80, w: 83, h: 26 },
  blurb: { x: 115, y: 106, w: 160, h: 12 },
  tabs: [
    { id: 'totals', x: 32, y: 118, w: 82, h: 30 },
    { id: 'runs', x: 122, y: 118, w: 82, h: 30 },
    { id: 'pokemon', x: 212, y: 118, w: 82, h: 30 },
  ],
  figureLabel: { x: 32, y: 178, w: 82, h: 12, pitch: 62 },
  figureValue: { x: 32, y: 196, w: 40, h: 20, pitch: 62 },
  row: { x: 32, y: 267, w: 334, h: 56, pitch: 62 },
  button: { x: 95, y: 744, w: 200, h: 40 },
};

/** Both boards' measured rects, for the fixture test and the diff. */
export function statsBoard(viewport: 'desktop' | 'narrow'): StatsBoard {
  return viewport === 'narrow' ? NARROW_BOARD : DESKTOP_BOARD;
}

const MONTH_KEYS: readonly TranslationKey[] = [
  'stats.month.1',
  'stats.month.2',
  'stats.month.3',
  'stats.month.4',
  'stats.month.5',
  'stats.month.6',
  'stats.month.7',
  'stats.month.8',
  'stats.month.9',
  'stats.month.10',
  'stats.month.11',
  'stats.month.12',
];

const ACTION_LABELS: Readonly<Record<StatsActionId, TranslationKey>> = {
  back: 'stats.actionBack',
  ranking: 'stats.actionRanking',
  'ranking-players': 'stats.actionPlayers',
  'ranking-pokemon': 'stats.actionPokemon',
};

type UtcParts = Readonly<{ year: number; month: number; day: number }>;

function utcParts(instant: string | Date): UtcParts | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function pad2(value: number): string {
  return String(Math.trunc(value)).padStart(2, '0');
}

/** The three-letter month, or '' for a month no table carries. */
function monthName(month: number): string {
  const key = MONTH_KEYS[Math.trunc(month) - 1];
  return key === undefined ? '' : t(key);
}

/** `YYYY-MM` in UTC, or null for an instant the store cannot read. */
function utcMonthKey(instant: string | Date): string | null {
  const parts = utcParts(instant);
  if (parts === null) return null;
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}`;
}

/** A duration as the board prints it: `41H 20M`, minutes zero-padded. */
export function statsDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return t('stats.duration', { hours: Math.floor(minutes / 60), minutes: pad2(minutes % 60) });
}

/** A record's ending day as `OCT 18` (UTC). */
export function statsDate(instant: string): string {
  const parts = utcParts(instant);
  if (parts === null) return '';
  return `${monthName(parts.month)} ${pad2(parts.day)}`;
}

/** A record's ending day as `2026-10-18` (UTC). */
export function statsDay(instant: string): string {
  const parts = utcParts(instant);
  if (parts === null) return '';
  return `${String(parts.year).padStart(4, '0')}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** A `YYYY-MM` key as the selector prints it: `OCT 2026`. */
export function statsMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const printed = Number(month);
  if (year === undefined || !Number.isInteger(printed) || printed < 1 || printed > 12) return '';
  return `${monthName(printed)} ${year}`;
}

/**
 * The months the store holds, newest first and deduped; when it holds none, the
 * month of `now` alone. Both arguments are all it reads, so it is deterministic.
 */
export function statsMonths(history: readonly RunHistoryRecord[], now: Date): readonly StatsMonth[] {
  const keys = new Set<string>();
  for (const record of history) {
    const key = utcMonthKey(record.endedAt);
    if (key !== null) keys.add(key);
  }
  if (keys.size === 0) {
    const key = utcMonthKey(now);
    if (key !== null) keys.add(key);
  }
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => ({ key, label: statsMonthLabel(key) }));
}

function action(id: StatsActionId): StatsAction {
  return { id, label: t(ACTION_LABELS[id]) };
}

function allTabs(): readonly StatsTab[] {
  return [
    { id: 'totals', label: t('stats.tabTotals') },
    { id: 'runs', label: t('stats.tabRuns') },
    { id: 'pokemon', label: t('stats.tabPokemon') },
  ];
}

/** The store's records, newest first; ties broken by seed so a hand-edited store still reads. */
function sortedHistory(history: readonly RunHistoryRecord[]): readonly RunHistoryRecord[] {
  return [...history].sort((a, b) => {
    if (a.endedAt !== b.endedAt) return a.endedAt < b.endedAt ? 1 : -1;
    if (a.seed !== b.seed) return a.seed < b.seed ? -1 : 1;
    return 0;
  });
}

function nonNegative(value: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function sum(history: readonly RunHistoryRecord[], read: (record: RunHistoryRecord) => number): number {
  let total = 0;
  for (const record of history) total += nonNegative(read(record));
  return total;
}

type SpeciesTally = { speciesId: string; runs: number; kos: number; dealt: number };

/** Per species over every record: the runs that named it and its summed KOs and damage. */
function speciesTallies(history: readonly RunHistoryRecord[]): readonly SpeciesTally[] {
  const tallies = new Map<string, SpeciesTally>();
  for (const record of history) {
    const named = new Set<string>();
    for (const entry of record.species) {
      const tally = tallies.get(entry.speciesId) ?? {
        speciesId: entry.speciesId,
        runs: 0,
        kos: 0,
        dealt: 0,
      };
      if (!named.has(entry.speciesId)) {
        tally.runs += 1;
        named.add(entry.speciesId);
      }
      tally.kos += nonNegative(entry.kos);
      tally.dealt += nonNegative(entry.damage);
      tallies.set(entry.speciesId, tally);
    }
  }
  return [...tallies.values()];
}

function speciesName(speciesId: string): string {
  return getSpecies(speciesId)?.name ?? speciesId;
}

function bySpeciesId(a: SpeciesTally, b: SpeciesTally): number {
  return a.speciesId < b.speciesId ? -1 : a.speciesId > b.speciesId ? 1 : 0;
}

function totalsView(history: readonly RunHistoryRecord[]): StatsView {
  const runs = history.length;
  const empty = runs === 0;
  const won = history.filter((record) => record.won).length;
  const playtime = sum(history, (record) => record.playtimeMs);
  const longest = history.reduce((best, record) => Math.max(best, nonNegative(record.playtimeMs)), 0);
  const average = runs === 0 ? 0 : Math.round(playtime / runs);
  const bestFloor = empty ? 0 : Math.max(...history.map((record) => nonNegative(record.mapReached)));
  const newest = history[0];
  const lastRun = newest === undefined ? '' : statsDay(newest.endedAt);
  const figures: readonly StatsFigure[] = [
    { id: 'runsPlayed', label: t('stats.runsPlayed'), value: empty ? STATS_EM_DASH : String(runs) },
    { id: 'runsWon', label: t('stats.runsWon'), value: empty ? STATS_EM_DASH : String(won) },
    {
      id: 'winRate',
      label: t('stats.winRate'),
      value: empty ? STATS_EM_DASH : `${Math.round((won / runs) * 100)}%`,
    },
    {
      id: 'bestFloor',
      label: t('stats.bestFloor'),
      value: empty ? STATS_EM_DASH : String(bestFloor),
    },
    {
      id: 'caught',
      label: t('stats.caught'),
      value: empty ? STATS_EM_DASH : String(sum(history, (record) => record.catches)),
    },
    {
      id: 'lost',
      label: t('stats.lost'),
      value: empty ? STATS_EM_DASH : String(sum(history, (record) => record.casualties)),
    },
    {
      id: 'playtime',
      label: t('stats.playtime'),
      value: playtime === 0 ? STATS_EM_DASH : statsDuration(playtime),
    },
    {
      id: 'avgRun',
      label: t('stats.avgRun'),
      value: average === 0 ? STATS_EM_DASH : statsDuration(average),
    },
    {
      id: 'longestRun',
      label: t('stats.longestRun'),
      value: longest === 0 ? STATS_EM_DASH : statsDuration(longest),
    },
    {
      id: 'kos',
      label: t('stats.kos'),
      value: empty ? STATS_EM_DASH : String(sumSpecies(history, 'kos')),
    },
    {
      id: 'dealt',
      label: t('stats.dealt'),
      value: empty ? STATS_EM_DASH : String(sumSpecies(history, 'dealt')),
    },
    {
      id: 'lastRun',
      label: t('stats.lastRun'),
      value: lastRun === '' ? STATS_EM_DASH : lastRun,
    },
  ];

  return {
    mode: 'totals',
    title: t('stats.title'),
    blurb: t('stats.blurbTotals'),
    tabs: allTabs(),
    figures,
    columns: [],
    rows: [],
    empty: empty ? t('stats.emptyTotals') : null,
    month: null,
    actions: [action('ranking'), action('back')],
  };
}

function sumSpecies(history: readonly RunHistoryRecord[], field: 'kos' | 'dealt'): number {
  let total = 0;
  for (const tally of speciesTallies(history)) total += tally[field];
  return total;
}

function runsView(history: readonly RunHistoryRecord[]): StatsView {
  const rows: readonly StatsRow[] = history.map((record, index) => ({
    id: `run-${index}`,
    cells: [
      record.won ? t('stats.win') : t('stats.loss'),
      record.seed,
      statsDate(record.endedAt),
      t('stats.runMeta', {
        maps: nonNegative(record.mapReached),
        caught: nonNegative(record.catches),
        lost: nonNegative(record.casualties),
      }),
    ],
  }));

  return {
    mode: 'runs',
    title: t('stats.title'),
    blurb: t('stats.blurbRuns'),
    tabs: allTabs(),
    figures: [],
    columns: [],
    rows,
    empty: rows.length === 0 ? t('stats.emptyRuns') : null,
    month: null,
    actions: [action('ranking'), action('back')],
  };
}

function pokemonView(history: readonly RunHistoryRecord[]): StatsView {
  const rows: readonly StatsRow[] = [...speciesTallies(history)].sort(bySpeciesId).map((tally) => ({
    id: tally.speciesId,
    cells: [
      speciesName(tally.speciesId),
      String(tally.runs),
      String(tally.kos),
      String(tally.dealt),
      STATS_EM_DASH,
    ],
  }));

  return {
    mode: 'pokemon',
    title: t('stats.title'),
    blurb: t('stats.blurbPokemon'),
    tabs: allTabs(),
    figures: [],
    columns: [
      t('stats.colPokemon'),
      t('stats.colRuns'),
      t('stats.colKos'),
      t('stats.colDealt'),
      t('stats.colTanked'),
    ],
    rows,
    empty: rows.length === 0 ? t('stats.emptyPokemon') : null,
    month: null,
    actions: [action('ranking'), action('back')],
  };
}

function rankingView(
  history: readonly RunHistoryRecord[],
  months: readonly StatsMonth[],
  monthKey: string | null,
): StatsView {
  const at = monthIndex(months, monthKey);
  const month = months[at];
  const inMonth =
    month === undefined ? [] : history.filter((record) => utcMonthKey(record.endedAt) === month.key);
  const runs = inMonth.length;
  const wins = inMonth.filter((record) => record.won).length;
  const bestFloor =
    runs === 0 ? 0 : Math.max(...inMonth.map((record) => nonNegative(record.mapReached)));

  return {
    mode: 'ranking',
    title: t('stats.title'),
    blurb: t('stats.blurbRanking'),
    tabs: [],
    figures: [],
    columns: [t('stats.colPlayer'), t('stats.colRuns'), t('stats.colWins'), t('stats.colBestFloor')],
    rows: [{ id: 'you', cells: [t('stats.you'), String(runs), String(wins), String(bestFloor)] }],
    empty: runs === 0 ? t('stats.emptyMonth') : null,
    month:
      month === undefined
        ? null
        : { label: month.label, canPrev: at < months.length - 1, canNext: at > 0 },
    actions: [action('ranking-pokemon'), action('back')],
  };
}

/** The selected month's index; a stale key falls back to the newest month, never a crash. */
function monthIndex(months: readonly StatsMonth[], monthKey: string | null): number {
  if (monthKey === null) return 0;
  const at = months.findIndex((month) => month.key === monthKey);
  return at < 0 ? 0 : at;
}

function rankingPokemonView(history: readonly RunHistoryRecord[]): StatsView {
  const rows: readonly StatsRow[] = [...speciesTallies(history)]
    .sort(
      (a, b) =>
        b.kos - a.kos ||
        b.runs - a.runs ||
        (a.speciesId < b.speciesId ? -1 : a.speciesId > b.speciesId ? 1 : 0),
    )
    .map((tally) => ({
      id: tally.speciesId,
      cells: [speciesName(tally.speciesId), String(tally.runs), String(tally.kos), String(tally.dealt)],
    }));

  return {
    mode: 'ranking-pokemon',
    title: t('stats.title'),
    blurb: t('stats.blurbRankingPokemon'),
    tabs: [],
    figures: [],
    columns: [t('stats.colPokemon'), t('stats.colRuns'), t('stats.colKos'), t('stats.colDealt')],
    rows,
    empty: rows.length === 0 ? t('stats.emptyPokemon') : null,
    month: { label: t('stats.allRuns'), canPrev: false, canNext: false },
    actions: [action('ranking-players'), action('back')],
  };
}

/** The live screen: the store's records, the mode the scene holds and the month it picked. */
export function liveStatsView(
  history: readonly RunHistoryRecord[],
  mode: StatsMode,
  monthKey: string | null,
  now: Date,
): StatsView {
  const records = sortedHistory(history);
  switch (mode) {
    case 'totals':
      return totalsView(records);
    case 'runs':
      return runsView(records);
    case 'pokemon':
      return pokemonView(records);
    case 'ranking':
      return rankingView(records, statsMonths(records, now), monthKey);
    case 'ranking-pokemon':
      return rankingPokemonView(records);
  }
}

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isMode(value: unknown): value is StatsMode {
  return typeof value === 'string' && (STATS_MODES as readonly string[]).includes(value);
}

function isActionId(value: unknown): value is StatsActionId {
  return (
    value === 'back' || value === 'ranking' || value === 'ranking-players' || value === 'ranking-pokemon'
  );
}

/** The payload's tabs; any malformed entry rejects the whole payload. */
function fixtureTabs(value: unknown): readonly StatsTab[] | null {
  if (!Array.isArray(value)) return null;
  const tabs: StatsTab[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry) || !isMode(entry.id) || !isNonEmpty(entry.label)) return null;
    tabs.push({ id: entry.id, label: entry.label });
  }
  return tabs;
}

/** The payload's figures; ids are free-form so a frame's own board can be replayed. */
function fixtureFigures(value: unknown): readonly StatsFigure[] | null {
  if (!Array.isArray(value)) return null;
  const figures: StatsFigure[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) return null;
    const { id, label, value: printed } = entry;
    if (!isNonEmpty(id) || !isNonEmpty(label) || typeof printed !== 'string') return null;
    figures.push({ id, label, value: printed });
  }
  return figures;
}

function fixtureColumns(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const columns: string[] = [];
  for (const entry of value) {
    if (!isNonEmpty(entry)) return null;
    columns.push(entry);
  }
  return columns;
}

function fixtureRows(value: unknown): readonly StatsRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows: StatsRow[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry) || !isNonEmpty(entry.id) || !Array.isArray(entry.cells)) return null;
    const cells: string[] = [];
    for (const cell of entry.cells) {
      if (typeof cell !== 'string') return null;
      cells.push(cell);
    }
    rows.push({ id: entry.id, cells });
  }
  return rows;
}

/** The selector; `null` is a payload without one, `false` a malformed one. */
function fixtureMonth(
  value: unknown,
): Readonly<{ label: string; canPrev: boolean; canNext: boolean }> | null | false {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) return false;
  const { label, canPrev, canNext } = value;
  if (!isNonEmpty(label) || typeof canPrev !== 'boolean' || typeof canNext !== 'boolean') {
    return false;
  }
  return { label, canPrev, canNext };
}

function fixtureActions(value: unknown): readonly StatsAction[] | null {
  if (!Array.isArray(value)) return null;
  const actions: StatsAction[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry) || !isActionId(entry.id) || !isNonEmpty(entry.label)) return null;
    actions.push({ id: entry.id, label: entry.label });
  }
  return actions;
}

/** The frame's own copy, or null when the payload is not one this panel can draw. */
export function fixtureStatsView(payload: unknown): StatsView | null {
  if (!isPlainObject(payload)) return null;
  const block = payload.stats;
  if (!isPlainObject(block)) return null;

  const { mode, title, blurb, empty } = block;
  if (!isMode(mode) || !isNonEmpty(title) || !isNonEmpty(blurb)) return null;
  if (empty !== null && empty !== undefined && !isNonEmpty(empty)) return null;

  const tabs = fixtureTabs(block.tabs);
  if (tabs === null) return null;
  const figures = fixtureFigures(block.figures);
  if (figures === null) return null;
  const columns = fixtureColumns(block.columns);
  if (columns === null) return null;
  const rows = fixtureRows(block.rows);
  if (rows === null) return null;
  const month = fixtureMonth(block.month);
  if (month === false) return null;
  const actions = fixtureActions(block.actions);
  if (actions === null) return null;

  return {
    mode,
    title,
    blurb,
    tabs,
    figures,
    columns,
    rows,
    empty: empty === undefined ? null : empty,
    month,
    actions,
  };
}
