import type { RunState } from '../../../../engine/run';
import { t } from '../../../../i18n';
import { partyRows } from '../../../partyScreen';
import { runPositionLabel } from '../../../runSummary';
import { portraitCrop, type PortraitCrop } from '../../portrait';

/** Every row the board can draw, in board order. */
export const MAIN_MENU_ROW_IDS = ['continue', 'new', 'options', 'stats'] as const;
export type MainMenuRowId = (typeof MAIN_MENU_ROW_IDS)[number];

/** The rows the scene can navigate. `stats` opens the stats panel on the DOM path. */
export const MAIN_MENU_ACTIONS = ['continue', 'new', 'options', 'stats'] as const;
export type MainMenuAction = (typeof MAIN_MENU_ACTIONS)[number];

export type MainMenuRowView = Readonly<{
  id: MainMenuRowId;
  /** The label exactly as printed; the stylesheet uppercases it. */
  label: string;
  /** The right-aligned value; '' draws no value node at all. */
  value: string;
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
  /** The record holder under the value (the frame's 'NOVA'), or null. */
  name: string | null;
}>;

export type MainMenuView = Readonly<{
  title: string;
  /** The bottom-right version line; null draws none (the phone frames have none). */
  version: string | null;
  /** In board order, always a prefix-order subset of `MAIN_MENU_ROW_IDS`. */
  rows: readonly MainMenuRowView[];
  /** The CONTINUE row's party portraits, in party order; [] without a run. */
  portraits: readonly MainMenuPortraitView[];
  /** The footer's figures, left to right; [] draws no footer. */
  stats: readonly MainMenuStatView[];
  /** The id drawn selected (accent bar, `>`, accent fill + border), or null. */
  selected: MainMenuRowId | null;
  /** The decorative route preview’s seed: `randomSeed()` once per boot, or the slug’s own. */
  previewSeed: string;
}>;

/** The board's two layouts: the desk frame (`01`) and the phone frame (`m01`). */
export type MainMenuLayout = 'wide' | 'compact';

/**
 * The view as one layout draws it. `'compact'` drops the CONTINUE row's secondary
 * datum — the map/biome label — because the row's 326 px at 390×844 hold the
 * portraits and nothing else; every other field, every other row and the portrait
 * list itself are returned **unchanged**. `'wide'` returns the very same object.
 */
export function forLayout(view: MainMenuView, layout: MainMenuLayout): MainMenuView {
  if (layout !== 'compact') return view;
  const at = view.rows.findIndex((row) => row.id === 'continue');
  if (at < 0) return view;
  if (view.rows[at]!.value === '') return view;
  const rows = view.rows.map((row, index) => (index === at ? { ...row, value: '' } : row));
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

/** The live menu, from the save's run and the scene's cursor. */
export function liveMainMenuView(
  run: RunState | null,
  index: number,
  previewSeed: string = MAIN_MENU_SLUG,
): MainMenuView {
  const rows: MainMenuRowView[] = [];
  if (run !== null) {
    rows.push({
      id: 'continue',
      label: t('menu.continue'),
      value: runPositionLabel(run),
      enabled: true,
    });
  }
  rows.push({ id: 'new', label: t('menu.new'), value: '', enabled: true });
  rows.push({ id: 'options', label: t('menu.options'), value: '', enabled: true });
  rows.push({ id: 'stats', label: t('menu.stats'), value: '', enabled: true });

  const last = rows.length - 1;
  const at = Math.min(Math.max(0, Math.trunc(index)), last);
  const selected = rows[at]?.id ?? null;

  return {
    title: t('menu.title'),
    version: null,
    rows,
    portraits:
      run === null
        ? []
        : partyRows(run).map((row) => ({
            memberId: row.id,
            name: row.name,
            portrait: portraitCrop(row.speciesId, row.shiny),
          })),
    stats: [],
    selected,
    previewSeed,
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

function fixtureRow(value: unknown): MainMenuRowView | null {
  if (!isPlainObject(value)) return null;
  const { id, label, value: printed, enabled } = value;
  if (!isRowId(id) || !isNonEmpty(label) || typeof printed !== 'string') return null;
  if (enabled !== undefined && typeof enabled !== 'boolean') return null;
  return { id, label, value: printed, enabled: enabled !== false };
}

/** The rows, in `MAIN_MENU_ROW_IDS` order, one id each; anything else is null. */
function fixtureRows(value: unknown): readonly MainMenuRowView[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAIN_MENU_ROW_IDS.length) {
    return null;
  }
  const rows: MainMenuRowView[] = [];
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

  return {
    title,
    version,
    rows,
    portraits: fixturePortraits(payload.state),
    stats,
    selected: selection,
    previewSeed: isNonEmpty(previewSeed) ? previewSeed : MAIN_MENU_SLUG,
  };
}
