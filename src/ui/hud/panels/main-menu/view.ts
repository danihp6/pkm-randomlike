import type { RunState } from '../../../../engine/run';
import type { RunHistoryRecord } from '../../../../engine/run/history';
import { t } from '../../../../i18n';
import { partyRows } from '../../../partyScreen';
import { runPositionLabel } from '../../../runSummary';
import { portraitCrop, type PortraitCrop } from '../../portrait';
import { drawnTextWidth } from '../battle-moves/view';
import { historyBestFloor, historyWins, recordMonthKey } from '../stats/records';
import { statsMonthLabel } from '../stats/view';

/** Every row the board can draw, in board order. */
export const MAIN_MENU_ROW_IDS = ['continue', 'new', 'options', 'stats', 'ranking'] as const;
export type MainMenuRowId = (typeof MAIN_MENU_ROW_IDS)[number];

/** The rows the scene can navigate. `stats` shows the panel, `ranking` its ranking mode. */
export const MAIN_MENU_ACTIONS = ['continue', 'new', 'options', 'stats', 'ranking'] as const;
export type MainMenuAction = (typeof MAIN_MENU_ACTIONS)[number];

/** The card's own height per drawn row count, the desk frame's numbers plus the fifth row. */
export const MAIN_MENU_CARD_H: Readonly<Record<number, number>> = { 4: 362, 5: 372 };
/** The same, for the phone card (`@media (max-width: 600px)`). */
export const MAIN_MENU_CARD_H_NARROW: Readonly<Record<number, number>> = { 4: 264, 5: 275 };

export type MainMenuRowView = Readonly<{
  id: MainMenuRowId;
  /** The label exactly as printed; the stylesheet uppercases it. */
  label: string;
  /** The value as painted: already elided to `valueBox.w` when it did not fit. '' = no node. */
  value: string;
  /** The box the value is painted in; null exactly when `value` is ''. */
  valueBox: Rect | null;
  /** False draws the row inert (`disabled` + `aria-disabled="true"`); the boards never do. */
  enabled: boolean;
}>;

export type MainMenuPortraitView = Readonly<{
  /** The run member's id, so the strip is stable across repaints. */
  memberId: string;
  /** The member's name, read out by a screen reader. */
  name: string;
  /** The member's portrait cell, or null when the atlas names none (the box stays a box). */
  portrait: PortraitCrop | null;
}>;

export type MainMenuStatId = 'wins' | 'elite' | 'monthly';

export type MainMenuStatView = Readonly<{
  id: MainMenuStatId;
  /** 'WINS' | 'MAX ELITE STRIKE' | 'MONTHLY MAX STRIKE' as the frame prints them. */
  label: string;
  /** '23' | '2' | '7' as the frame prints them. */
  value: string;
  /**
   * The record's own label under the value: the board prints the record holder
   * ('NOVA'), the live menu the month the monthly figure belongs to. Null draws none.
   */
  name: string | null;
}>;

/** The footer's three live figures, read from the run-history store and the clock. */
export type MainMenuRecords = Readonly<{
  wins: number;
  /** The deepest floor a **finite** run reached; 0 when none has. */
  elite: number;
  /** The deepest floor a finite run reached in the current UTC month; 0 when none has. */
  monthly: number;
  /** The month the monthly figure belongs to, as `statsMonthLabel` prints it (`OCT 2026`). */
  monthlyLabel: string;
}>;

export const EMPTY_MAIN_MENU_RECORDS: MainMenuRecords = {
  wins: 0,
  elite: 0,
  monthly: 0,
  monthlyLabel: '',
};

export type MainMenuView = Readonly<{
  title: string;
  /** The bottom-right version line; null draws none (the phone frames have none). */
  version: string | null;
  /** In board order, always a prefix-order subset of `MAIN_MENU_ROW_IDS`. */
  rows: readonly MainMenuRowView[];
  /** The CONTINUE row's party portraits, in party order; [] without a run. */
  portraits: readonly MainMenuPortraitView[];
  /** The CONTINUE row's portraits' block, in the view's own px space; null with no portraits. */
  portraitsBox: Rect | null;
  /** The footer's figures, left to right; [] draws no footer. */
  stats: readonly MainMenuStatView[];
  /** The id drawn selected (accent bar, `>`, accent fill + border), or null. */
  selected: MainMenuRowId | null;
  /** The decorative route preview’s seed: `randomSeed()` once per boot, or the slug’s own. */
  previewSeed: string;
  /** The backdrop's oval; always present, so the panel never invents geometry. */
  glow: MainMenuGlow;
}>;

/** The board's two layouts: the desk frame (`01`) and the phone frame (`m01`). */
export type MainMenuLayout = 'wide' | 'compact';

/**
 * The view as one layout draws it. `'compact'` drops the CONTINUE row's secondary
 * datum — the map/biome label — because the row's 326 px at 390×844 hold the
 * portraits and nothing else, so that row also loses its `valueBox`; every other
 * field, every other row and the portrait list itself are returned **unchanged**.
 * `'wide'` returns the very same object.
 */
export function forLayout(view: MainMenuView, layout: MainMenuLayout): MainMenuView {
  if (layout !== 'compact') return view;
  const at = view.rows.findIndex((row) => row.id === 'continue');
  if (at < 0) return view;
  if (view.rows[at]!.value === '') return view;
  const rows = view.rows.map((row, index) =>
    index === at ? { ...row, value: '', valueBox: null } : row,
  );
  return { ...view, rows };
}

/** The board's desktop rects (`01`, `01b`), page coordinates at 1280×800. */
export const MAIN_MENU_BOARD: Readonly<{
  title: { x: number; y: number; w: number; h: number };
  rule: { x: number; y: number; w: number; h: number };
  card: { x: number; y: number; w: number };
  row: { x: number; w: number; h: number; pitch: number; top: number };
  window: { x: number; y: number; w: number; h: number };
  footerRule: { x: number; y: number; w: number; h: number };
  footer: { labelY: number; valueY: number; nameY: number; columns: readonly number[] };
  version: { x: number; y: number; w: number; h: number };
  portrait: { size: number; x: number; y: number; pitch: number };
}> = {
  title: { x: 724, y: 146, w: 447, h: 49 },
  rule: { x: 724, y: 204, w: 88, h: 3 },
  card: { x: 724, y: 236, w: 460 },
  row: { x: 744, w: 420, h: 54, pitch: 62, top: 300 },
  window: { x: 96, y: 150, w: 560, h: 380 },
  footerRule: { x: 96, y: 592, w: 520, h: 1 },
  footer: { labelY: 616, valueY: 636, nameY: 650, columns: [96, 240, 724] },
  version: { x: 1065, y: 750, w: 122, h: 15 },
  portrait: { size: 26, x: 922, y: 314, pitch: 30 },
};

/** The board's phone rects (`m01`, `m01b`), page coordinates at 390×844. */
export const MAIN_MENU_BOARD_NARROW: Readonly<{
  title: { x: number; y: number; w: number; h: number };
  rule: { x: number; y: number; w: number; h: number };
  card: { x: number; y: number; w: number };
  row: { x: number; w: number; h: number; pitch: number; top: number };
  window: { x: number; y: number; w: number; h: number };
  footer: { labelY: number; valueY: number; columns: readonly number[] };
  portrait: { size: number; y: number; pitch: number };
}> = {
  title: { x: 16, y: 68, w: 235, h: 26 },
  rule: { x: 16, y: 108, w: 64, h: 3 },
  card: { x: 8, y: 390, w: 374 },
  row: { x: 32, w: 326, h: 48, pitch: 54, top: 402 },
  window: { x: 16, y: 126, w: 358, h: 240 },
  footer: { labelY: 676, valueY: 692, columns: [16, 140, 264] },
  portrait: { size: 22, y: 415, pitch: 25 },
};

/** The breakpoint the board's two frames switch at; the stylesheet uses the same 600px. */
export const MAIN_MENU_NARROW_QUERY = '(max-width: 600px)';

/** A page coordinate box, as the board's frames measure it. */
export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The row's own right inset: `.main-menu__portraits`' `right: 6px` and the value's right edge. */
export const MAIN_MENU_VALUE_INSET = 6;
/** `.main-menu__value`'s `top: 22px` and the 15 px line it draws. */
const VALUE_TOP = 22;
const VALUE_H = 15;
/** `--main-menu-row-value-size`, which the stylesheet paints and the elision measures. */
export const MAIN_MENU_VALUE_SIZE = 12;
/** `.main-menu__label`'s `left: 38px` and `--main-menu-row-label-size`. */
const LABEL_LEFT = 38;
const LABEL_SIZE = 20;
/** The gutter a row keeps between its label and its value: the kit's one 8 px gap. */
export const MAIN_MENU_ROW_GAP = 8;
/** The glyph an elided value ends in, so a cut map label always reads as cut. */
const ELLIPSIS = '\u2026';

/**
 * The CONTINUE row's reserved block: the party's portrait cells hugging the row's
 * right inset, one box per member. The row keeps this strip for itself, so the map
 * label can only ever be painted to its left. Null with no portraits.
 */
export function mainMenuPortraitsBox(count: number): Rect | null {
  if (!(count > 0)) return null;
  const { size, y, pitch } = MAIN_MENU_BOARD.portrait;
  const width = count * size + (count - 1) * (pitch - size);
  const right = MAIN_MENU_BOARD.row.x + MAIN_MENU_BOARD.row.w - MAIN_MENU_VALUE_INSET;
  return { x: right - width, y, w: width, h: size };
}

/** The px a row's label paints at its 20 px, measured against the Silkscreen advance. */
function labelWidth(label: string): number {
  return drawnTextWidth(label.toUpperCase(), LABEL_SIZE);
}

/**
 * `text` reduced to the widest prefix that fits `width` at the value's 12 px, ending
 * in `'\u2026'` when a glyph had to go; `text` itself when it already fits, `''` when
 * nothing fits. Callers pass the painted (uppercase) form, since the stylesheet
 * uppercases it; a cut never leaves the space it stopped on before the ellipsis.
 */
export function elideValue(text: string, width: number): string {
  if (!(width > 0)) return '';
  const measure = (part: string): number => drawnTextWidth(part, MAIN_MENU_VALUE_SIZE);
  if (measure(text) <= width) return text;
  const budget = width - measure(ELLIPSIS);
  if (budget < 0) return '';
  let used = 0;
  let head = '';
  for (const char of text) {
    const advance = measure(char);
    if (used + advance > budget) break;
    used += advance;
    head += char;
  }
  const kept = head.trimEnd();
  return kept.length === 0 ? '' : `${kept}${ELLIPSIS}`;
}

/**
 * The box a row's value is painted in: it starts one gutter past the row's own label
 * and ends one gutter before the row's reserved portraits' block — or on the row's
 * right inset when the row reserves none. The desk's 20 px CONTINUE label fills its
 * column, so the strip between it and the block is the only width the map label can
 * own; a longer name is elided there instead of sliding under the party's cells. Null
 * when the row prints no value.
 */
function valueBoxOf(
  label: string,
  index: number,
  printed: string,
  portraits: Rect | null,
): Rect | null {
  if (printed === '') return null;
  const right = MAIN_MENU_BOARD.row.x + MAIN_MENU_BOARD.row.w - MAIN_MENU_VALUE_INSET;
  const x = MAIN_MENU_BOARD.row.x + LABEL_LEFT + labelWidth(label) + MAIN_MENU_ROW_GAP;
  const end = portraits === null ? right : portraits.x - MAIN_MENU_ROW_GAP;
  const width = Math.max(0, Math.min(right, end) - x);
  const y = MAIN_MENU_BOARD.row.top + index * MAIN_MENU_BOARD.row.pitch + VALUE_TOP;
  return { x, y, w: width, h: VALUE_H };
}

/** A parsed row, before its value's box and elision are worked out. */
type MainMenuRowDraft = Readonly<{
  id: MainMenuRowId;
  label: string;
  value: string;
  enabled: boolean;
}>;

/** One row with the value cut to the box it is painted in; '' and a null box with no value. */
function rowView(draft: MainMenuRowDraft, index: number, portraitsBox: Rect | null): MainMenuRowView {
  const box = valueBoxOf(
    draft.label,
    index,
    draft.value,
    draft.id === 'continue' ? portraitsBox : null,
  );
  const value = box === null ? '' : elideValue(draft.value.toUpperCase(), box.w);
  return {
    id: draft.id,
    label: draft.label,
    value,
    valueBox: value === '' ? null : box,
    enabled: draft.enabled,
  };
}

/** One stop of the oval's radial gradient; `at` is 0…1 of the gradient's radius. */
export type MainMenuGlowStop = Readonly<{ at: number; color: string }>;

/** The board's oval: its box in stage coordinates and the stops that fade it out. */
export type MainMenuGlow = Readonly<{
  box: Rect;
  stops: readonly MainMenuGlowStop[];
}>;

/**
 * The board's `01` oval: 1000 × 720 at (−180, −140), accent 10 % at the mean. The
 * centre stops brighter than the flat fill it replaces, so the falloff to nothing
 * at the rim keeps the backdrop's measured brightness.
 */
export const MAIN_MENU_GLOW: MainMenuGlow = {
  box: { x: -180, y: -140, w: 1000, h: 720 },
  stops: [
    { at: 0, color: 'rgb(125 211 252 / 22%)' },
    { at: 0.45, color: 'rgb(125 211 252 / 10%)' },
    { at: 1, color: 'rgb(125 211 252 / 0%)' },
  ],
};

/** A stop's position as a percentage, rounded to two decimals at most. */
function stopPercent(at: number): string {
  return String(Math.round(at * 10000) / 100);
}

/** The CSS value the panel paints: one `radial-gradient`, never a flat fill. */
export function glowBackground(glow: MainMenuGlow): string {
  const stops = glow.stops.map((stop) => `${stop.color} ${stopPercent(stop.at)}%`).join(', ');
  return `radial-gradient(closest-side, ${stops})`;
}

/** The compact blocks share one box; the kit's 8 px gutter separates both axes. */
const COMPACT_BLOCK: Readonly<{ w: number; h: number }> = { w: 172, h: 48 };
const COMPACT_GUTTER = 8;
const COMPACT_X = 16;
const COMPACT_TOP = MAIN_MENU_BOARD_NARROW.footer.labelY;

/**
 * The compact footer's blocks at 390×844, in page coordinates, one per stat id:
 * two on the first row, the monthly figure on the second, so the labels stop
 * running into each other on the phone. `main-menu.css` draws these numbers.
 */
export const MAIN_MENU_FOOTER_NARROW: Readonly<Record<MainMenuStatId, Rect>> = {
  wins: { x: COMPACT_X, y: COMPACT_TOP, ...COMPACT_BLOCK },
  elite: { x: COMPACT_X + COMPACT_BLOCK.w + COMPACT_GUTTER, y: COMPACT_TOP, ...COMPACT_BLOCK },
  monthly: {
    x: COMPACT_X,
    y: COMPACT_TOP + COMPACT_BLOCK.h + COMPACT_GUTTER,
    ...COMPACT_BLOCK,
  },
};

/** The frame this panel answers to with a save, and the one without. */
export const MAIN_MENU_SLUG = '01-main-menu';
export const MAIN_MENU_SLUG_NO_SAVE = '01b-main-menu-no-save';
export const MAIN_MENU_SLUGS = [MAIN_MENU_SLUG, MAIN_MENU_SLUG_NO_SAVE] as const;
export type MainMenuSlug = (typeof MAIN_MENU_SLUGS)[number];

/** The footer's three figures, always three, in `['wins','elite','monthly']` order. */
export function mainMenuStats(records: MainMenuRecords): readonly MainMenuStatView[] {
  return [
    { id: 'wins', label: t('menu.stat.wins'), value: String(records.wins), name: null },
    { id: 'elite', label: t('menu.stat.elite'), value: String(records.elite), name: null },
    {
      id: 'monthly',
      label: t('menu.stat.monthly'),
      value: String(records.monthly),
      name: records.monthlyLabel === '' ? null : records.monthlyLabel,
    },
  ];
}

/** The live records from the store and the clock the caller supplies. */
export function mainMenuRecords(
  history: readonly RunHistoryRecord[],
  now: Date,
): MainMenuRecords {
  const monthKey = recordMonthKey(now);
  const finite = history.filter((record) => record.mode === 'finite');
  const inMonth =
    monthKey === null
      ? []
      : finite.filter((record) => recordMonthKey(new Date(record.endedAt)) === monthKey);
  return {
    wins: historyWins(history),
    elite: historyBestFloor(finite),
    monthly: historyBestFloor(inMonth),
    monthlyLabel: statsMonthLabel(monthKey ?? ''),
  };
}

/** The live menu, from the save's run and the scene's cursor. */
export function liveMainMenuView(
  run: RunState | null,
  index: number,
  previewSeed: string = MAIN_MENU_SLUG,
  records: MainMenuRecords = EMPTY_MAIN_MENU_RECORDS,
  version: string | null = null,
): MainMenuView {
  const portraits =
    run === null
      ? []
      : partyRows(run).map((row) => ({
          memberId: row.id,
          name: row.name,
          portrait: portraitCrop(row.speciesId, row.shiny),
        }));
  const portraitsBox = mainMenuPortraitsBox(portraits.length);

  const drafts: MainMenuRowDraft[] = [];
  if (run !== null) {
    drafts.push({
      id: 'continue',
      label: t('menu.continue'),
      value: runPositionLabel(run),
      enabled: true,
    });
  }
  drafts.push({ id: 'new', label: t('menu.new'), value: '', enabled: true });
  drafts.push({ id: 'options', label: t('menu.options'), value: '', enabled: true });
  drafts.push({ id: 'stats', label: t('menu.stats'), value: '', enabled: true });
  drafts.push({ id: 'ranking', label: t('stats.actionRanking'), value: '', enabled: true });
  const rows = drafts.map((draft, at) => rowView(draft, at, portraitsBox));

  const last = rows.length - 1;
  const at = Math.min(Math.max(0, Math.trunc(index)), last);
  const selected = rows[at]?.id ?? null;

  return {
    title: t('menu.title'),
    version,
    rows,
    portraits,
    portraitsBox,
    stats: mainMenuStats(records),
    selected,
    previewSeed,
    glow: MAIN_MENU_GLOW,
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

function isRowId(value: unknown): value is MainMenuRowId {
  return typeof value === 'string' && (MAIN_MENU_ROW_IDS as readonly string[]).includes(value);
}

function fixtureRow(value: unknown): MainMenuRowDraft | null {
  if (!isPlainObject(value)) return null;
  const { id, label, value: printed, enabled } = value;
  if (!isRowId(id) || !isNonEmpty(label) || typeof printed !== 'string') return null;
  if (enabled !== undefined && typeof enabled !== 'boolean') return null;
  return { id, label, value: printed, enabled: enabled !== false };
}

/** The rows, in `MAIN_MENU_ROW_IDS` order, one id each; anything else is null. */
function fixtureRows(value: unknown): readonly MainMenuRowDraft[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAIN_MENU_ROW_IDS.length) {
    return null;
  }
  const rows: MainMenuRowDraft[] = [];
  let previous = -1;
  for (const entry of value) {
    const row = fixtureRow(entry);
    if (row === null) return null;
    const order = MAIN_MENU_ROW_IDS.indexOf(row.id);
    if (order <= previous) return null;
    previous = order;
    rows.push(row);
  }
  return rows;
}

function fixtureStat(value: unknown, id: MainMenuStatId): MainMenuStatView | null {
  if (!isPlainObject(value)) return null;
  const { id: printed, label, value: figure, name } = value;
  if (printed !== id || !isNonEmpty(label) || !isNonEmpty(figure)) return null;
  if (name !== null && typeof name !== 'string') return null;
  return { id, label, value: figure, name };
}

/** Zero figures or the board's three, in order; anything else is null. */
function fixtureStats(value: unknown): readonly MainMenuStatView[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  if (value.length !== 3) return null;
  const stats: MainMenuStatView[] = [];
  for (const [index, id] of (['wins', 'elite', 'monthly'] as const).entries()) {
    const stat = fixtureStat(value[index], id);
    if (stat === null) return null;
    stats.push(stat);
  }
  return stats;
}

function fixturePortraits(state: unknown): readonly MainMenuPortraitView[] {
  if (!isPlainObject(state)) return [];
  const party = state.party;
  if (!Array.isArray(party)) return [];
  const portraits: MainMenuPortraitView[] = [];
  for (const row of party) {
    if (!isPlainObject(row)) return [];
    const { id, name, speciesId, shiny } = row;
    if (!isNonEmpty(id) || typeof name !== 'string') return [];
    portraits.push({
      memberId: id,
      name,
      portrait: isNonEmpty(speciesId) ? portraitCrop(speciesId, shiny === true) : null,
    });
  }
  return portraits;
}

/** The frame's own copy, or null when the payload is not one this panel can draw. */
export function fixtureMainMenuView(payload: unknown): MainMenuView | null {
  if (!isPlainObject(payload)) return null;
  const menu = payload.menu;
  if (!isPlainObject(menu)) return null;

  const { title, version, selected, rows: rawRows, stats: rawStats, previewSeed } = menu;
  if (!isNonEmpty(title)) return null;
  if (version !== null && typeof version !== 'string') return null;

  const rows = fixtureRows(rawRows);
  if (rows === null) return null;

  const stats = fixtureStats(rawStats);
  if (stats === null) return null;

  let selection: MainMenuRowId | null = null;
  if (selected !== null) {
    if (!isRowId(selected) || !rows.some((row) => row.id === selected)) return null;
    selection = selected;
  }

  const portraits = fixturePortraits(payload.state);
  const portraitsBox = mainMenuPortraitsBox(portraits.length);

  return {
    title,
    version,
    rows: rows.map((row, at) => rowView(row, at, portraitsBox)),
    portraits,
    portraitsBox,
    stats,
    selected: selection,
    previewSeed: isNonEmpty(previewSeed) ? previewSeed : MAIN_MENU_SLUG,
    glow: MAIN_MENU_GLOW,
  };
}
