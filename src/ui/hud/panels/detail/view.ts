import type { StatId } from '../../../../data/dex';
import { t } from '../../../../i18n';
import { moveGridCellRects, type MoveGridEmptyCell, type MoveGridSlot } from '../../../moveGrid';
import { natureEffect, statLabel, type MemberDetail } from '../../../partyDetail';
import { MOVE_ICON_BOX } from '../../kit/moveIcons';
import { evolutionView } from './evolution';

/**
 * The member detail panel's layout model (`D49`): the shipped Phaser window — name,
 * level and types over the STATS / MOVES tabs, the six stats with their nature tint,
 * the evolution graph, the 2x2 move grid, the learnset search field and pool, and
 * the rename field — rebuilt from `MemberDetail` and the panel's own cursor state.
 * Every constant below is named after the Phaser constant it mirrors, so a drift
 * between the canvas and the DOM is a failing test rather than a diff nobody reads.
 *
 * `search.value` is empty here on purpose: the query is the scene's (`hudLearnQuery`),
 * and the scene stamps it on the view the way it stamps `open`, so the pure model
 * never carries a second copy of the panel's state.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The MOVES tab's pool row, as the scene hands it over (no engine import here). */
export type DetailPoolRow = Readonly<{
  moveId: string;
  name: string;
  type: string;
  /** `Lv 12`, `TM31` or `Tutor` — from the i18n keys `detail.learnLevel` / `detail.learnTm` / `detail.learnTutor`. */
  source: string;
  enabled: boolean;
}>;

/** The panel's own cursor state. The scene module owns it; the panel paints it. */
export type DetailPanelUi = Readonly<{
  tab: 'stats' | 'moves';
  /** The move slot under the cursor (0…3), or -1. */
  cursor: number;
  /** The learnset pool's scroll offset in rows (0…). */
  page: number;
  /** The pool row under the cursor inside its window, or -1. */
  poolCursor: number;
  /** The move slot whose ⓘ is pinned, or null. */
  info: number | null;
  /** True while the ABILITY ⓘ is pinned. */
  abilityInfo: boolean;
  /** The slot held by a drag, or null. */
  grab: number | null;
  /** The nickname buffer while the field is being edited, or null. */
  nickname: string | null;
}>;

export type DetailStatView = Readonly<{
  stat: StatId;
  label: string;
  value: string;
  effect: 'up' | 'down' | 'neutral';
  box: Rect;
  labelBox: Rect;
  valueBox: Rect;
}>;

export type DetailMoveSlotView = Readonly<{
  index: number;
  moveId: string | null;
  name: string;
  type: string;
  category: string;
  pp: string;
  power: string;
  accuracy: string;
  desc: string;
  selected: boolean;
  /** False for an empty slot and for a slot the run cannot equip (a locked TM). */
  enabled: boolean;
  box: Rect;
  /** The ⓘ hit box, cell-relative (the canvas's own `moveGridInfoAt` box). */
  info: Rect;
  /** The badge's box: the cell's left column, the board's own insets. */
  typeBox: Rect;
  /** The category glyph's box, 2 px under the badge. */
  categoryBox: Rect;
  /** The move's own name line: right of the icon column and clear of the ⓘ. */
  nameBox: Rect;
  /** `PP 12/15` on its own line, the board's three-line column. */
  ppBox: Rect;
  /** The power / accuracy pair's line: power left-aligned, accuracy right-aligned inside it. */
  statsBox: Rect;
}>;

export type DetailPoolRowView = Readonly<{
  index: number;
  moveId: string;
  name: string;
  type: string;
  source: string;
  enabled: boolean;
  selected: boolean;
  box: Rect;
}>;

export type DetailEvolutionRowView = Readonly<{
  id: string;
  name: string;
  row: number;
  depth: number;
  /** The row of the node this edge comes from, or null for the family's root. */
  parent: number | null;
  level: string | null;
  current: boolean;
  ready: boolean;
  kind: 'species' | 'mega' | 'gmax';
  /** Row-relative text origin; the portrait cell is `{x, y, w: 26, h: 26}`. */
  x: number;
  y: number;
}>;

export type DetailEvolutionView = Readonly<{
  title: string;
  empty: string;
  /** The SVG's own box, panel-relative. */
  box: Rect;
  rows: readonly DetailEvolutionRowView[];
  edges: readonly Readonly<{ fromRow: number; toRow: number; d: string }>[];
}>;

export type DetailPanelView = Readonly<{
  open: boolean;
  /** Viewport coordinates. */
  box: Rect;
  /** Panel-relative: every other rect in this view is measured from `box.x`/`box.y`. */
  highlight: Rect;
  name: string;
  level: string;
  statusLabel: string | null;
  types: readonly Readonly<{ type: string; box: Rect }>[];
  tabs: readonly Readonly<{ tab: 'stats' | 'moves'; label: string; active: boolean; box: Rect }>[];
  stats: readonly DetailStatView[];
  nature: string;
  ability: string;
  /** The second ability's name alone, or null when the member carries one. */
  ability2: string | null;
  abilityDesc: string | null;
  abilityInfo: Readonly<{ pinned: boolean; box: Rect }> | null;
  held: string;
  caught: string;
  /** Null off the STATS tab or with no family. */
  evolution: DetailEvolutionView | null;
  moves: readonly DetailMoveSlotView[];
  /** `t('detail.noMoves')` while the MOVES tab is empty. */
  emptyMoves: string | null;
  search: Readonly<{ value: string; placeholder: string; box: Rect }>;
  pool: readonly DetailPoolRowView[];
  /** `t('detail.noMovesToLearn')`. */
  emptyPool: string | null;
  nickname: Readonly<{ value: string; placeholder: string; editing: boolean; box: Rect }>;
  /** `t('detail.clickToName')` / `t('detail.clickToEvolve')`, drawn as the panel's hints. */
  hints: Readonly<{ name: string; evolve: string }>;
}>;

export const DETAIL_PANEL_W = 460; // HUD_DETAIL_W
export const DETAIL_PANEL_H = 560; // HUD_DETAIL_H
export const DETAIL_TABS_TOP = 72; // HUD_DETAIL_TABS_TOP
export const DETAIL_TAB_H = 26; // HUD_DETAIL_TAB_H
export const DETAIL_CONTENT_TOP = 108; // HUD_DETAIL_CONTENT_TOP
export const DETAIL_STAT_ROW = 26; // HUD_DETAIL_STAT_ROW
export const DETAIL_INFO_ROW = 22; // HUD_DETAIL_INFO_ROW
export const DETAIL_MOVE_GRID_H = 188; // HUD_DETAIL_MOVE_GRID_H
export const DETAIL_POOL_ROWS = 2; // HUD_DETAIL_LEARN_ROWS
export const DETAIL_POOL_COLS = 2; // HUD_DETAIL_LEARN_COLS

/** The right-hand column the shipped HUD docks at, and the card's own offsets. */
const HUD_PANEL_W = 344;
const HUD_PANEL_MARGIN = 8;
const HUD_MIN_WIDTH = 160;
const HUD_TOP = 8;
const DETAIL_BOX_Y = HUD_TOP + 64;
const HUD_PAD_TOP = 16; // FRLG_WINDOW_PADDING.top
const HUD_TAB_GAP = 4;
const HUD_SEARCH_H = 24;
const DETAIL_LEARN_GAP = 8; // HUD_DETAIL_LEARN_GAP
const DETAIL_TYPE_W = 74; // HUD_DETAIL_TYPE_W
const DETAIL_TYPE_H = 20;
const DETAIL_TYPE_GAP = 6;
const DETAIL_TYPE_CHIPS = 2;
const DETAIL_STAT_COLS = 2; // HUD_DETAIL_STAT_COLS
const DETAIL_STAT_ROWS = 3; // HUD_DETAIL_STAT_ROWS
const DETAIL_STAT_VALUE_INSET = 12;
const DETAIL_INFO_GAP = 8;
const DETAIL_HIGHLIGHT_INSET = 12;
const DETAIL_HIGHLIGHT_H = 1;
const DETAIL_NICKNAME_H = 22; // HUD_NICKNAME_FIELD_H
const DETAIL_MOVE_SLOTS = 4; // MAX_MOVES
const DETAIL_INFO_BUTTON = 22;
/** The width the learnset band keeps clear for its `<` / `>` scroll arrows. */
const DETAIL_SEARCH_NAV_W = 78;
/** The move cell's left icon column, its text column and the ⓘ the name line leaves clear. */
const DETAIL_MOVE_ICON_INSET = 10;
const DETAIL_MOVE_TEXT_LEFT = 44;
const DETAIL_MOVE_PAD_X = 14;
const DETAIL_MOVE_INFO_W = 28;
const DETAIL_MOVE_LINE_H = 13;
const DETAIL_STAT_COLUMNS: readonly (readonly StatId[])[] = [
  ['hp', 'atk', 'def'],
  ['spa', 'spd', 'spe'],
];
const EMPTY_CELL: MoveGridEmptyCell = { empty: true };

/** Where a panel's header/content starts, leaving room for its collapse icon. */
export const DETAIL_CONTENT_LEFT = 30; // HUD_CONTENT_LEFT
/** The card's lateral padding, and the 12 the narrow card drops to (`hudMetrics`). */
export const DETAIL_PAD_X = 20; // FRLG_WINDOW_PADDING.x / HUD_PAD_X
export const DETAIL_PAD_X_NARROW = 12;
/** The header's name row: the window's baked top padding. */
export const DETAIL_HEADER_TOP = HUD_PAD_TOP;
/** The type chips, under the name row. */
export const DETAIL_TYPE_TOP = HUD_PAD_TOP + 22;
/** The move grid's top: the content top inside the window's baked border. */
export const DETAIL_GRID_TOP = DETAIL_CONTENT_TOP - HUD_PAD_TOP;
/** The NATURE / HELD / ABILITY / CAUGHT band, two rows under the six stats. */
export const DETAIL_INFO_TOP = DETAIL_CONTENT_TOP + DETAIL_STAT_ROWS * DETAIL_STAT_ROW + DETAIL_INFO_GAP;
/** The learnset search field, under the move grid. */
export const DETAIL_SEARCH_TOP = DETAIL_GRID_TOP + DETAIL_MOVE_GRID_H + DETAIL_LEARN_GAP;
/** The learnset pool, under the search field, filling the rest of the card. */
export const DETAIL_POOL_TOP = DETAIL_SEARCH_TOP + HUD_SEARCH_H + DETAIL_LEARN_GAP;
/** The evolution band's title row, and the SVG under it. */
export const DETAIL_EVO_TITLE_TOP = 250; // HUD_DETAIL_EVO_TITLE_TOP
export const DETAIL_EVO_TOP = DETAIL_EVO_TITLE_TOP + 22; // HUD_DETAIL_EVO_TOP

function clampInt(value: number, min: number, max: number): number {
  if (max < min) return min;
  const from = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(Math.max(min, from), max);
}

/** One `moveGridCellRects` layout, in the coordinates the grid's own layout uses. */
function cellRects(
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
): readonly Readonly<{ x: number; y: number; w: number; h: number }>[] {
  const slots: MoveGridSlot[] = Array.from({ length: Math.max(0, count) }, () => EMPTY_CELL);
  return moveGridCellRects({ x, y, w, h, cells: slots, selected: -1, info: null });
}

/** A box moved into the panel's own coordinates. */
function inner(rect: Rect, box: Rect): Rect {
  return { x: rect.x - box.x, y: rect.y - box.y, w: rect.w, h: rect.h };
}

/** A box with no width: the mark a box the panel prints nothing in collapses to. */
function mark(rect: Rect): Rect {
  return { ...rect, w: 0 };
}

/**
 * A move cell's five boxes, in the panel's own coordinates: the two atlas squares in
 * the cell's icon column, and the name, PP and power / accuracy lines in the text
 * column beside it. The name line is the only one that also leaves the ⓘ clear.
 */
function moveBoxes(cell: Rect): Readonly<{
  typeBox: Rect;
  categoryBox: Rect;
  nameBox: Rect;
  ppBox: Rect;
  statsBox: Rect;
}> {
  const iconX = cell.x + DETAIL_MOVE_ICON_INSET;
  const iconY = cell.y + DETAIL_MOVE_ICON_INSET;
  const textX = cell.x + DETAIL_MOVE_TEXT_LEFT;
  const textW = Math.max(0, cell.w - DETAIL_MOVE_TEXT_LEFT - DETAIL_MOVE_PAD_X);
  return {
    typeBox: { x: iconX, y: iconY, w: MOVE_ICON_BOX, h: MOVE_ICON_BOX },
    categoryBox: { x: iconX, y: iconY + MOVE_ICON_BOX + 2, w: MOVE_ICON_BOX, h: MOVE_ICON_BOX },
    nameBox: {
      x: textX,
      y: cell.y + 8,
      w: Math.max(0, textW - DETAIL_MOVE_INFO_W),
      h: DETAIL_MOVE_LINE_H,
    },
    ppBox: { x: textX, y: cell.y + 24, w: textW, h: DETAIL_MOVE_LINE_H },
    statsBox: { x: textX, y: cell.y + 38, w: textW, h: DETAIL_MOVE_LINE_H },
  };
}

/** `hudMetrics().detailPadX`: a card narrower than the design width drops its padding. */
export function detailPadX(viewportWidth: number): number {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 1280;
  const max = Math.max(HUD_MIN_WIDTH, width - HUD_PANEL_MARGIN * 2);
  return Math.min(DETAIL_PANEL_W, max) < DETAIL_PANEL_W ? DETAIL_PAD_X_NARROW : DETAIL_PAD_X;
}

/**
 * The shipped rect, from the viewport alone: `hudMetrics` clamps the two panel widths,
 * the PC box gives the column, and the card docks one gap to its left. On a narrow
 * screen there is no room there, so it clamps onto the screen and overlaps.
 */
export function detailPanelBox(viewport: Viewport): Rect {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : 1280;
  const max = Math.max(HUD_MIN_WIDTH, width - HUD_PANEL_MARGIN * 2);
  const panelW = Math.min(HUD_PANEL_W, max);
  const column = width - panelW - HUD_PANEL_MARGIN;
  const boxX = Math.max(HUD_PANEL_MARGIN, column - panelW - HUD_PANEL_MARGIN);
  const detailW = Math.min(DETAIL_PANEL_W, max);
  const x = Math.max(HUD_PANEL_MARGIN, boxX - detailW - HUD_PANEL_MARGIN);
  return { x, y: DETAIL_BOX_Y, w: detailW, h: DETAIL_PANEL_H };
}

export function initialDetailPanelUi(): DetailPanelUi {
  return {
    tab: 'stats',
    cursor: -1,
    page: 0,
    poolCursor: -1,
    info: null,
    abilityInfo: false,
    grab: null,
    nickname: null,
  };
}

function emptyView(box: Rect): DetailPanelView {
  return {
    open: false,
    box,
    highlight: {
      x: DETAIL_HIGHLIGHT_INSET,
      y: DETAIL_HIGHLIGHT_INSET,
      w: box.w - DETAIL_HIGHLIGHT_INSET * 2,
      h: DETAIL_HIGHLIGHT_H,
    },
    name: '',
    level: '',
    statusLabel: null,
    types: [],
    tabs: [],
    stats: [],
    nature: '',
    ability: '',
    ability2: null,
    abilityDesc: null,
    abilityInfo: null,
    held: '',
    caught: '',
    evolution: null,
    moves: [],
    emptyMoves: null,
    search: { value: '', placeholder: '', box: { x: 0, y: 0, w: 0, h: 0 } },
    pool: [],
    emptyPool: null,
    nickname: { value: '', placeholder: '', editing: false, box: { x: 0, y: 0, w: 0, h: 0 } },
    hints: { name: t('detail.clickToName'), evolve: t('detail.clickToEvolve') },
  };
}

/** The six stat rows: two columns of three, HP printing its current / max pair. */
function statViews(padX: number, width: number, detail: MemberDetail): DetailStatView[] {
  const colW = (width - padX * 2) / DETAIL_STAT_COLS;
  const rows: DetailStatView[] = [];
  DETAIL_STAT_COLUMNS.forEach((column, ci) => {
    const colLeft = padX + ci * colW;
    column.forEach((stat, ri) => {
      const y = DETAIL_CONTENT_TOP + ri * DETAIL_STAT_ROW;
      rows.push({
        stat,
        label: statLabel(stat),
        value: stat === 'hp' ? `${detail.hp}/${detail.maxHp}` : String(detail.stats[stat]),
        effect: natureEffect(detail.nature, stat),
        box: { x: colLeft, y, w: colW, h: DETAIL_STAT_ROW },
        labelBox: { x: colLeft, y, w: colW - DETAIL_STAT_VALUE_INSET, h: DETAIL_STAT_ROW },
        valueBox: { x: colLeft, y, w: colW - DETAIL_STAT_VALUE_INSET, h: DETAIL_STAT_ROW },
      });
    });
  });
  return rows;
}

/** One drawn move slot, or the empty container the 2x2 grid keeps for a short set. */
function moveSlots(box: Rect, detail: MemberDetail, cursor: number): readonly DetailMoveSlotView[] {
  if (detail.moves.length === 0) return [];
  const rects = cellRects(box.x, box.y + DETAIL_GRID_TOP, box.w, DETAIL_MOVE_GRID_H, DETAIL_MOVE_SLOTS);
  const infoBox: Rect = { x: 0, y: 8, w: DETAIL_INFO_BUTTON, h: DETAIL_INFO_BUTTON };
  return rects.map((absolute, index) => {
    const cell = inner(absolute, box);
    const move = detail.moves[index];
    const info: Rect = { ...infoBox, x: cell.w - DETAIL_INFO_BUTTON - 14 };
    const boxes = moveBoxes(cell);
    if (move === undefined) {
      return {
        index,
        moveId: null,
        name: '',
        type: '',
        category: '',
        pp: '',
        power: '',
        accuracy: '',
        desc: '',
        selected: false,
        enabled: false,
        box: cell,
        info,
        typeBox: mark(boxes.typeBox),
        categoryBox: mark(boxes.categoryBox),
        nameBox: mark(boxes.nameBox),
        ppBox: mark(boxes.ppBox),
        statsBox: mark(boxes.statsBox),
      };
    }
    return {
      index,
      moveId: move.moveId,
      name: move.name,
      type: move.type,
      category: move.category,
      pp: t('move.pp', { pp: move.pp, max: move.maxPp }),
      power: move.basePower > 0 ? t('move.pwr', { value: move.power }) : t('move.pwrNone'),
      accuracy:
        move.baseAccuracy === null || move.accuracy === null
          ? t('move.accNone')
          : t('move.acc', { value: move.accuracy }),
      desc: move.desc,
      selected: index === cursor,
      enabled: true,
      box: cell,
      info,
      typeBox: boxes.typeBox,
      categoryBox: boxes.categoryBox,
      nameBox: boxes.nameBox,
      ppBox: boxes.ppBox,
      statsBox: boxes.statsBox,
    };
  });
}

/** The window of the learnset pool the MOVES tab shows: two columns of two rows. */
function poolWindow(pool: readonly DetailPoolRow[], page: number): readonly DetailPoolRow[] {
  const size = DETAIL_POOL_ROWS * DETAIL_POOL_COLS;
  const start = clampInt(page, 0, Math.max(0, pool.length - size));
  return pool.slice(start, start + size);
}

function poolRows(
  box: Rect,
  visible: readonly DetailPoolRow[],
  poolCursor: number,
): readonly DetailPoolRowView[] {
  if (visible.length === 0) return [];
  const rects = cellRects(
    box.x,
    box.y + DETAIL_POOL_TOP,
    box.w,
    DETAIL_PANEL_H - DETAIL_POOL_TOP,
    visible.length,
  );
  return visible.map((row, index) => ({
    index,
    moveId: row.moveId,
    name: row.name,
    type: row.type,
    source: row.source,
    enabled: row.enabled,
    selected: index === poolCursor,
    box:
      rects[index] === undefined ? { x: 0, y: DETAIL_POOL_TOP, w: 0, h: 0 } : inner(rects[index], box),
  }));
}

function evolutionSection(padX: number, width: number, detail: MemberDetail): DetailEvolutionView {
  const innerW = width - padX * 2;
  const band = evolutionView(detail.evolutions, innerW);
  return {
    title: t('detail.evolution'),
    empty: t('detail.noEvolution'),
    box: { x: padX, y: DETAIL_EVO_TOP, w: innerW, h: band.height },
    rows: band.rows,
    edges: band.edges,
  };
}

/**
 * The panel as data. Pure and total: the same arguments give a deep-equal view, a
 * null member gives a closed one, and any cursor state is clamped rather than thrown
 * on. `open` and the search query are the scene's to stamp after this projection.
 */
export function detailPanelView(
  detail: MemberDetail | null,
  pool: readonly DetailPoolRow[],
  ui: DetailPanelUi,
  viewport: Viewport,
): DetailPanelView {
  const box = detailPanelBox(viewport);
  if (detail === null) return emptyView(box);

  const padX = detailPadX(viewport.width);
  const innerW = box.w - padX * 2;
  const right = box.w - padX;
  const tab: 'stats' | 'moves' = ui.tab === 'moves' ? 'moves' : 'stats';
  const statsTab = tab === 'stats';
  const movesTab = tab === 'moves';
  const tabW = (innerW - HUD_TAB_GAP) / 2;
  const cursor = detail.moves.length === 0 ? -1 : clampInt(ui.cursor, 0, detail.moves.length - 1);
  const visible = movesTab ? poolWindow(pool, ui.page) : [];
  const poolCursor = visible.length === 0 ? -1 : clampInt(ui.poolCursor, 0, visible.length - 1);
  const nicknameX = DETAIL_CONTENT_LEFT + DETAIL_TYPE_W * 2 + DETAIL_TYPE_GAP + DETAIL_INFO_GAP;
  const second = detail.ability2 ?? null;

  return {
    open: true,
    box,
    highlight: {
      x: DETAIL_HIGHLIGHT_INSET,
      y: DETAIL_HIGHLIGHT_INSET,
      w: box.w - DETAIL_HIGHLIGHT_INSET * 2,
      h: DETAIL_HIGHLIGHT_H,
    },
    name: detail.name,
    level: t('common.level', { level: detail.level }),
    statusLabel: detail.statusLabel,
    types: detail.types.slice(0, DETAIL_TYPE_CHIPS).map((type, i) => ({
      type,
      box: {
        x: padX + i * (DETAIL_TYPE_W + DETAIL_TYPE_GAP),
        y: DETAIL_TYPE_TOP,
        w: DETAIL_TYPE_W,
        h: DETAIL_TYPE_H,
      },
    })),
    tabs: (['stats', 'moves'] as const).map((id, i) => ({
      tab: id,
      label: t(id === 'stats' ? 'detail.tabStats' : 'detail.tabMoves'),
      active: id === tab,
      box: { x: padX + i * (tabW + HUD_TAB_GAP), y: DETAIL_TABS_TOP, w: tabW, h: DETAIL_TAB_H },
    })),
    stats: statViews(padX, box.w, detail),
    nature: t('detail.nature', { nature: capitalize(detail.nature) }),
    ability: t('detail.ability', {
      ability: second === null ? detail.ability : `${detail.ability} / ${second}`,
    }),
    ability2: second,
    abilityDesc: detail.abilityDesc,
    abilityInfo:
      detail.abilityDesc === null
        ? null
        : {
            pinned: ui.abilityInfo,
            box: {
              x: padX + innerW / 2 - DETAIL_STAT_VALUE_INSET - DETAIL_INFO_BUTTON,
              y: DETAIL_INFO_TOP + DETAIL_INFO_ROW - 2,
              w: DETAIL_INFO_BUTTON,
              h: DETAIL_INFO_BUTTON,
            },
          },
    held: t('detail.held', { held: detail.heldItemName ?? t('detail.none') }),
    caught: t('detail.caughtLabel', { caught: detail.caughtLabel ?? t('detail.starter') }),
    evolution: statsTab && detail.evolutions.length > 0 ? evolutionSection(padX, box.w, detail) : null,
    moves: movesTab ? moveSlots(box, detail, cursor) : [],
    emptyMoves: movesTab && detail.moves.length === 0 ? t('detail.noMoves') : null,
    search: {
      value: '',
      placeholder: t('detail.searchMoves'),
      box: {
        x: DETAIL_PAD_X,
        y: DETAIL_SEARCH_TOP,
        w: box.w - DETAIL_PAD_X * 2 - DETAIL_SEARCH_NAV_W,
        h: HUD_SEARCH_H,
      },
    },
    pool: poolRows(box, visible, poolCursor),
    emptyPool: movesTab && pool.length === 0 ? t('detail.noMovesToLearn') : null,
    nickname: {
      value: ui.nickname ?? detail.nickname ?? '',
      placeholder: t('detail.clickToName'),
      editing: ui.nickname !== null,
      box: {
        x: nicknameX,
        y: DETAIL_TYPE_TOP - 2,
        w: Math.max(0, right - nicknameX),
        h: DETAIL_NICKNAME_H,
      },
    },
    hints: { name: t('detail.clickToName'), evolve: t('detail.clickToEvolve') },
  };
}

/** "adamant" -> "Adamant", for the nature line (the shipped `capitalize`). */
function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
