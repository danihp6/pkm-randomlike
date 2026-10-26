import { itemIconFrame } from '../../../../data/itemIcons';
import { t } from '../../../../i18n';
import { BAG_GRID_COLS, BAG_GRID_GAP, bagGridLayout, type BagCategory } from '../../../bag';
import { FRLG_WINDOW_PADDING } from '../../../frlg';
import { battleMovesBox } from '../battle-moves';
import type { BattleBagIntent } from './mount';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The bag's card is the battle's menu box: one rect for every mode. */
export const battleBagBox = battleMovesBox;

/** The battle window's own numbers, mirrored from `renderBagMenu` so a test can pin them. */
const TAB_W = 120;
const TAB_H = 26;
const TAB_GAP = 4;
/** The gap between the tab strip and the filter field, and between it and the grid. */
const ROW_GAP = 8;
const SEARCH_H = 24;
/** The selected stack's line under the grid, and the gap above it. */
const DETAIL_H = 20;
const DETAIL_GAP = 6;
const GRID_ROWS = 2;
/** An upper bound on the cell's side, so the wide band cannot make huge cells. */
const CELL_MAX = 56;
const INFO_W = 320;
/** The item card's bottom sits this far above the grid band. */
const INFO_GAP = 8;
const INFO_BASE_H = 48;
const INFO_LINE_H = 13;
/** The width the shipped `InfoPopup` wraps a description line at. */
const INFO_WRAP = 44;
/** The ◀ control's glyph box, and its inset from the content's left edge. */
const BACK_SIZE = 36;
const BACK_INSET = 14;
/** The most stacks the two rows hold: `MENU_BAG_CAP`, the grid's own capacity. */
const CAP = GRID_ROWS * BAG_GRID_COLS;

export type BattleBagCell = Readonly<{
  /** The stack's index in `rows` (what a press sends back). */
  index: number;
  /** Empty on a tail cell past the last stack: the dim outline with no badge. */
  itemId: string;
  name: string;
  count: number;
  frame: number | null;
  selected: boolean;
  box: Rect;
}>;

export type BattleBagInput = Readonly<{
  open: boolean;
  card: Rect;
  tabs: readonly Readonly<{ category: BagCategory; label: string; active: boolean }>[];
  query: string;
  focused: boolean;
  rows: readonly Readonly<{ itemId: string; name: string; count: number }>[];
  selected: number;
  detail: string;
  info: Readonly<{ text: string }> | null;
  empty: string | null;
}>;

export type BattleBagView = Readonly<{
  open: boolean;
  box: Rect;
  tabs: readonly Readonly<{ category: BagCategory; label: string; active: boolean; box: Rect }>[];
  search: Readonly<{ box: Rect; text: string; placeholder: string; focused: boolean }>;
  grid: Readonly<{ box: Rect; columns: number; rows: number; cellW: number; gap: number }>;
  cells: readonly BattleBagCell[];
  detail: Readonly<{ text: string; box: Rect }>;
  info: Readonly<{ text: string; box: Rect }> | null;
  empty: Readonly<{ text: string; box: Rect }> | null;
  back: Readonly<{ label: string; box: Rect }>;
}>;

/** The cursor clamped into the stacks on screen; `NaN` lands on the first. */
function clampIndex(value: number, count: number): number {
  if (count <= 0 || !Number.isFinite(value)) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(value)));
}

/** The press a cell answers with: a stack spends its stack, an empty cell picks itself. */
export function cellPressIntent(cell: BattleBagCell): BattleBagIntent {
  return cell.itemId !== ''
    ? { type: 'use', itemId: cell.itemId }
    : { type: 'select', index: cell.index };
}

/** The item card's wrapped line count: 44 characters a line, per paragraph. */
export function infoLineCount(text: string): number {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    lines += Math.ceil(paragraph.length / INFO_WRAP);
  }
  return lines;
}

/** A stack as the scene hands it: the catalogue name and the count left in the bag. */
type RecentStack = Readonly<{ itemId: string; name: string; count: number }>;

/** A stack's cell, or the dim outline a tail cell past the last stack draws. */
function cellOf(
  index: number,
  rect: Rect,
  row: RecentStack | undefined,
  selected: number,
): BattleBagCell {
  if (row === undefined) {
    return { index, itemId: '', name: '', count: 0, frame: null, selected: false, box: rect };
  }
  return {
    index,
    itemId: row.itemId,
    name: row.name,
    count: row.count,
    frame: itemIconFrame(row.itemId),
    selected: index === selected,
    box: rect,
  };
}

/** The floating item card, or null when no stack is selected. */
function infoCardOf(input: BattleBagInput, above: number, padX: number): BattleBagView['info'] {
  if (input.info === null) return null;
  const height = INFO_BASE_H + INFO_LINE_H * infoLineCount(input.info.text);
  return { text: input.info.text, box: { x: padX, y: above - height, w: INFO_W, h: height } };
}

/**
 * The battle's bag as plain data: the pocket chips, the filter field, the 5×2 grid
 * of the pocket's stacks, the selected stack's line, the floating item card and the
 * ◀ control, all measured inside the card the scene already laid out. Every rect
 * but `box` is card-relative. Pure and total: out-of-range indices clamp, the stacks
 * cap at the grid's ten boxes, and the same input always yields deep-equal output.
 */
export function battleBagView(input: BattleBagInput): BattleBagView {
  const card = input.card;
  const pad = FRLG_WINDOW_PADDING;
  const contentW = Math.max(0, card.w - pad.x * 2);
  const rows = input.rows.slice(0, CAP);
  const selected = clampIndex(input.selected, rows.length);

  const tabs = input.tabs.map((tab, slot) => ({
    category: tab.category,
    label: tab.label,
    active: tab.active,
    box: { x: pad.x + slot * (TAB_W + TAB_GAP), y: pad.top, w: TAB_W, h: TAB_H },
  }));

  const searchY = pad.top + TAB_H + ROW_GAP;
  const search = {
    box: { x: pad.x, y: searchY, w: contentW, h: SEARCH_H },
    text: input.query,
    placeholder: t('hud.searchItems'),
    focused: input.focused,
  };

  const gridY = searchY + SEARCH_H + ROW_GAP;
  const grid: Rect = {
    x: pad.x,
    y: gridY,
    w: contentW,
    h: Math.max(0, card.h - pad.bottom - DETAIL_H - DETAIL_GAP - gridY),
  };
  // The identical call the canvas makes, so the two grids can never diverge.
  const metrics = bagGridLayout(grid, rows.length, {
    rows: GRID_ROWS,
    gap: BAG_GRID_GAP,
    maxCell: CELL_MAX,
  });
  const cells = metrics.cells.map((rect, index) => cellOf(index, rect, rows[index], selected));

  return {
    open: input.open,
    box: card,
    tabs,
    search,
    grid: {
      box: grid,
      columns: metrics.columns,
      rows: metrics.rows,
      cellW: metrics.cellW,
      gap: metrics.gap,
    },
    cells,
    detail: {
      text: input.detail,
      box: {
        x: pad.x,
        y: card.h - pad.bottom - DETAIL_H,
        w: contentW,
        h: DETAIL_H,
      },
    },
    info: infoCardOf(input, gridY - INFO_GAP, pad.x),
    empty: input.empty === null ? null : { text: input.empty, box: grid },
    back: {
      label: '\u25c0',
      box: {
        x: pad.x + BACK_INSET,
        y: (gridY + card.h - pad.bottom) / 2,
        w: BACK_SIZE,
        h: BACK_SIZE,
      },
    },
  };
}
