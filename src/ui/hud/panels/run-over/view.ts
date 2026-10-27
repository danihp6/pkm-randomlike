import type { RunPokemon, RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { partyRow, partyRows } from '../../../partyScreen';
import { RUN_SUMMARY_EM_DASH, recordedCount, runSummary } from '../../../runSummary';

/**
 * The run-over score screen's value model (`D49`, frames `06` / `07` / `07b` and
 * their `m…` twins): the panel, the win/loss title and blurb, the four stat rows,
 * the share line, the two tabs and the POKéMON table, as plain data.
 *
 * Every figure is the run's own: enemies fainted read `RunStats.faints` and each
 * row's three columns read that member's `kos` / `damage` / `damageTaken` through
 * the shared `recordedCount` + `figure()` rule, so a recorded `0` prints `00`. Only
 * a counter the run never recorded prints the em dash. The frames' own numbers
 * live in `design/fixtures/` only, so the board's geometry can be reproduced
 * exactly.
 */

export const RUN_OVER_SLUGS = [
  '06-run-over-defeat',
  '07-run-over-victory',
  '07b-run-over-victory-pokemon',
] as const;
export type RunOverSlug = (typeof RUN_OVER_SLUGS)[number];

/** The two boards' breakpoint; the stylesheet uses the same 600px. */
export const RUN_OVER_NARROW_QUERY = '(max-width: 600px)';

/** The em dash (U+2014) every unrecorded figure is drawn as, one cell, never a 0. */
export const RUN_OVER_EM_DASH = RUN_SUMMARY_EM_DASH;

export const RUN_OVER_STAT_IDS = ['routes', 'catches', 'lost', 'fainted'] as const;
export type RunOverStatId = (typeof RUN_OVER_STAT_IDS)[number];

export const RUN_OVER_TABS = ['totals', 'pokemon'] as const;
export type RunOverTab = (typeof RUN_OVER_TABS)[number];

export const RUN_OVER_ROW_STATES = ['party', 'box', 'rip'] as const;
export type RunOverRowState = (typeof RUN_OVER_ROW_STATES)[number];

export type RunOverStatView = Readonly<{ id: RunOverStatId; label: string; value: string }>;

export type RunOverRowView = Readonly<{
  memberId: string;
  name: string;
  state: RunOverRowState;
  level: number;
  /** `null` means the run never recorded it: the panel draws the em dash. */
  kos: string | null;
  dealt: string | null;
  tanked: string | null;
}>;

export type RunOverPortraitView = Readonly<{ memberId: string; name: string }>;

export type RunOverTabLabels = Readonly<Record<RunOverTab, string>>;
export type RunOverColumnLabels = Readonly<Record<RunOverColumnId, string>>;
export type RunOverStateLabels = Readonly<Record<RunOverRowState, string>>;

export type RunOverView = Readonly<{
  won: boolean;
  title: string;
  blurb: string;
  stats: readonly RunOverStatView[];
  share: string;
  tab: RunOverTab;
  rows: readonly RunOverRowView[];
  button: Readonly<{ label: string }>;
  /** The board's party strip, in party order; empty draws none (`06` / `m06`). */
  portraits?: readonly RunOverPortraitView[];
  /** The board's tab copy; the panel never reads the locale itself. */
  tabLabels: RunOverTabLabels;
  /** The POKéMON table's four headers, in board order. */
  columnLabels: RunOverColumnLabels;
  /** The table's state column: the copy each member state prints. */
  stateLabels: RunOverStateLabels;
  /** The board's second, frame-only action (`07`'s CONTINUE); `null` draws one. */
  secondary?: Readonly<{ label: string }> | null;
}>;

/** The POKéMON table's four columns, in board order; the ids are structure, not copy. */
export const RUN_OVER_COLUMNS = ['pokemon', 'kos', 'dealt', 'tanked'] as const;
export type RunOverColumnId = (typeof RUN_OVER_COLUMNS)[number];

/**
 * Every label the panel paints but a run figure does not carry, read from the
 * table here: the panel itself never touches the locale (`D43`, `D49`).
 */
function tabLabels(): RunOverTabLabels {
  return { totals: t('runOver.tabTotals'), pokemon: t('runOver.tabPokemon') };
}

function columnLabels(): RunOverColumnLabels {
  return {
    pokemon: t('runOver.colPokemon'),
    kos: t('runOver.colKos'),
    dealt: t('runOver.colDealt'),
    tanked: t('runOver.colTanked'),
  };
}

function stateLabels(): RunOverStateLabels {
  return {
    party: t('runOver.stateParty'),
    box: t('runOver.stateBox'),
    rip: t('runOver.stateRip'),
  };
}

export type RunOverRect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type RunOverPitchRect = Readonly<{ x: number; y: number; w: number; h: number; pitch: number }>;

export type RunOverBoard = Readonly<{
  panel: Readonly<{ x: number; y: number; w: number; h: number; radius: number }>;
  title: RunOverRect;
  blurb: RunOverRect;
  tabs: readonly Readonly<{ id: RunOverTab; x: number; y: number; w: number; h: number }>[];
  statLabel: RunOverPitchRect;
  statValue: RunOverPitchRect;
  share: RunOverRect;
  button: RunOverRect;
  row: RunOverPitchRect;
}>;

/** `06` / `07` / `07b`, page coordinates at 1280×800. */
const DESKTOP_BOARD: RunOverBoard = {
  panel: { x: 280, y: 170, w: 720, h: 480, radius: 11 },
  title: { x: 320, y: 196, w: 640, h: 36 },
  blurb: { x: 320, y: 236, w: 640, h: 20 },
  tabs: [
    { id: 'totals', x: 336, y: 312, w: 90, h: 24 },
    { id: 'pokemon', x: 432, y: 312, w: 100, h: 24 },
  ],
  statLabel: { x: 336, y: 360, w: 300, h: 16, pitch: 46 },
  statValue: { x: 764, y: 358, w: 180, h: 20, pitch: 46 },
  share: { x: 336, y: 544, w: 608, h: 12 },
  button: { x: 540, y: 590, w: 200, h: 40 },
  row: { x: 336, y: 404, w: 608, h: 32, pitch: 36 },
};

/** `m07` / `m07b`, page coordinates at 390×844: the taller, tab-bearing phone board. */
const NARROW_BOARD: RunOverBoard = {
  panel: { x: 8, y: 96, w: 374, h: 604, radius: 12 },
  title: { x: 134, y: 130, w: 122, h: 23 },
  blurb: { x: 119, y: 158, w: 151, h: 12 },
  tabs: [
    { id: 'totals', x: 32, y: 236, w: 90, h: 28 },
    { id: 'pokemon', x: 130, y: 236, w: 100, h: 28 },
  ],
  statLabel: { x: 32, y: 280, w: 232, h: 13, pitch: 46 },
  statValue: { x: 300, y: 280, w: 50, h: 13, pitch: 46 },
  share: { x: 32, y: 530, w: 326, h: 12 },
  button: { x: 35, y: 600, w: 320, h: 44 },
  row: { x: 24, y: 302, w: 342, h: 44, pitch: 50 },
};

/** Both boards' measured rects, for the fixture test and the diff. */
export function runOverBoard(viewport: 'desktop' | 'narrow'): RunOverBoard {
  return viewport === 'narrow' ? NARROW_BOARD : DESKTOP_BOARD;
}

/** The label half of a `{count}` line: 'Routes cleared: 5' -> 'Routes cleared'. */
function labelHalf(value: string): string {
  const cut = value.indexOf(':');
  return cut < 0 ? value : value.slice(0, cut).trim();
}

/** The label half of a `runOver.*` counter line, with its figure left blank. */
function statLabel(key: 'runOver.routes' | 'runOver.caught' | 'runOver.lost'): string {
  return labelHalf(t(key, { count: '' }));
}

/** The board's two-figure padding: 5 draws 05. */
function figure(count: number): string {
  return String(Math.max(0, Math.trunc(count))).padStart(2, '0');
}

/** A member column: the recorded figure, or `null` so the panel draws the dash. */
function cell(value: number | undefined): string | null {
  const count = recordedCount(value);
  return count === null ? null : figure(count);
}

/**
 * The live screen. The four figures are `runSummary`'s, enemies fainted included;
 * only a counter the run never recorded prints the em dash.
 */
export function liveRunOverView(
  run: RunState,
  won: boolean,
  tab: RunOverTab,
  confirmKey: string,
): RunOverView {
  const summary = runSummary(run, won);
  const faints = summary.faints;
  return {
    won,
    title: won ? t('runOver.headlineWin') : t('runOver.headlineLoss'),
    blurb: won ? t('runOver.blurbWin') : t('runOver.blurbLoss'),
    stats: [
      { id: 'routes', label: statLabel('runOver.routes'), value: figure(summary.routesCleared) },
      { id: 'catches', label: statLabel('runOver.caught'), value: figure(summary.catches) },
      { id: 'lost', label: statLabel('runOver.lost'), value: figure(summary.casualties) },
      {
        id: 'fainted',
        label: t('runOver.enemiesFainted'),
        value: faints === null ? RUN_OVER_EM_DASH : figure(faints),
      },
    ],
    share: t('runOver.share', { share: summary.share }),
    tab,
    rows: tab === 'pokemon' ? liveRows(run) : [],
    button: { label: t('runOver.return', { key: confirmKey }) },
    portraits: partyRows(run).map((row) => ({ memberId: row.id, name: row.name })),
    tabLabels: tabLabels(),
    columnLabels: columnLabels(),
    stateLabels: stateLabels(),
    secondary: null,
  };
}

/** The killed, the binned and the fallen: party, then box, then rip, as the board reads. */
function liveRows(run: RunState): readonly RunOverRowView[] {
  const rows: RunOverRowView[] = [];
  for (const member of run.party) rows.push(liveRow(member, 'party'));
  for (const member of run.box) rows.push(liveRow(member, 'box'));
  for (const member of run.rip) rows.push(liveRow(member, 'rip'));
  return rows;
}

function liveRow(member: RunPokemon, state: RunOverRowState): RunOverRowView {
  const row = partyRow(member);
  return {
    memberId: row.id,
    name: row.name,
    state,
    level: row.level,
    kos: cell(member.kos),
    dealt: cell(member.damage),
    tanked: cell(member.damageTaken),
  };
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

function isTab(value: unknown): value is RunOverTab {
  return typeof value === 'string' && (RUN_OVER_TABS as readonly string[]).includes(value);
}

function isRowState(value: unknown): value is RunOverRowState {
  return typeof value === 'string' && (RUN_OVER_ROW_STATES as readonly string[]).includes(value);
}

function fixtureStat(value: unknown, id: RunOverStatId): RunOverStatView | null {
  if (!isPlainObject(value)) return null;
  const { id: printed, label, value: figureText } = value;
  if (printed !== id || !isNonEmpty(label) || typeof figureText !== 'string') return null;
  return { id, label, value: figureText };
}

/** Exactly the board's four stats, in order; anything else is not this panel's payload. */
function fixtureStats(value: unknown): readonly RunOverStatView[] | null {
  if (!Array.isArray(value) || value.length !== RUN_OVER_STAT_IDS.length) return null;
  const stats: RunOverStatView[] = [];
  for (const [index, id] of RUN_OVER_STAT_IDS.entries()) {
    const stat = fixtureStat(value[index], id);
    if (stat === null) return null;
    stats.push(stat);
  }
  return stats;
}

function fixtureColumn(value: unknown): string | null | false {
  if (value === null) return null;
  return typeof value === 'string' ? value : false;
}

function fixtureRow(value: unknown): RunOverRowView | null {
  if (!isPlainObject(value)) return null;
  const { memberId, name, state, level, kos, dealt, tanked } = value;
  if (!isNonEmpty(memberId) || !isNonEmpty(name) || !isRowState(state)) return null;
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  const kosText = fixtureColumn(kos);
  const dealtText = fixtureColumn(dealt);
  const tankedText = fixtureColumn(tanked);
  if (kosText === false || dealtText === false || tankedText === false) return null;
  return { memberId, name, state, level, kos: kosText, dealt: dealtText, tanked: tankedText };
}

function fixtureRows(value: unknown): readonly RunOverRowView[] | null {
  if (!Array.isArray(value)) return null;
  const rows: RunOverRowView[] = [];
  for (const entry of value) {
    const row = fixtureRow(entry);
    if (row === null) return null;
    rows.push(row);
  }
  return rows;
}

/** The party strip the board draws over the title: `state.party`, never `rows`. */
function fixturePortraits(state: unknown): readonly RunOverPortraitView[] {
  if (!isPlainObject(state)) return [];
  const party = state.party;
  if (!Array.isArray(party)) return [];
  const portraits: RunOverPortraitView[] = [];
  for (const row of party) {
    if (!isPlainObject(row)) return [];
    const { id, name } = row;
    if (!isNonEmpty(id) || typeof name !== 'string') return [];
    portraits.push({ memberId: id, name });
  }
  return portraits;
}

/** The payload's own tab copy, or the table's when the payload omits it. */
function fixtureTabLabels(value: unknown): RunOverTabLabels {
  const fallback = tabLabels();
  if (!isPlainObject(value)) return fallback;
  const { totals, pokemon } = value;
  return {
    totals: isNonEmpty(totals) ? totals : fallback.totals,
    pokemon: isNonEmpty(pokemon) ? pokemon : fallback.pokemon,
  };
}

/** The payload's own table headers, or the table's when the payload omits them. */
function fixtureColumnLabels(value: unknown): RunOverColumnLabels {
  const fallback = columnLabels();
  if (!isPlainObject(value)) return fallback;
  const pick = (id: RunOverColumnId): string => {
    const printed = value[id];
    return isNonEmpty(printed) ? printed : fallback[id];
  };
  return { pokemon: pick('pokemon'), kos: pick('kos'), dealt: pick('dealt'), tanked: pick('tanked') };
}

/** The payload's own state column, or the table's when the payload omits it. */
function fixtureStateLabels(value: unknown): RunOverStateLabels {
  const fallback = stateLabels();
  if (!isPlainObject(value)) return fallback;
  const pick = (id: RunOverRowState): string => {
    const printed = value[id];
    return isNonEmpty(printed) ? printed : fallback[id];
  };
  return { party: pick('party'), box: pick('box'), rip: pick('rip') };
}

function fixtureSecondary(value: unknown): Readonly<{ label: string }> | null {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value) || !isNonEmpty(value.label)) return null;
  return { label: value.label };
}

/** The frame's own payload, or null when it is not one this panel can draw. */
export function fixtureRunOverView(payload: unknown): RunOverView | null {
  if (!isPlainObject(payload)) return null;
  const block = payload.runOver;
  if (!isPlainObject(block)) return null;

  const { won, tab, title, blurb, share, button } = block;
  if (typeof won !== 'boolean' || !isTab(tab)) return null;
  if (!isNonEmpty(title) || !isNonEmpty(blurb) || !isNonEmpty(share)) return null;
  if (!isPlainObject(button) || !isNonEmpty(button.label)) return null;

  const stats = fixtureStats(block.stats);
  if (stats === null) return null;
  const rows = fixtureRows(block.rows);
  if (rows === null) return null;
  const secondary = fixtureSecondary(block.secondary);
  if (secondary === null && block.secondary !== undefined && block.secondary !== null) return null;

  return {
    won,
    title,
    blurb,
    stats,
    share,
    tab,
    rows,
    button: { label: button.label },
    portraits: fixturePortraits(payload.state),
    tabLabels: fixtureTabLabels(block.tabLabels),
    columnLabels: fixtureColumnLabels(block.columnLabels),
    stateLabels: fixtureStateLabels(block.stateLabels),
    secondary,
  };
}
