import { t, type TranslationKey } from '../i18n';
import { getItem, type ItemKind } from '../data/items';
import type { BagCounts } from '../engine/run';

/**
 * The bag's pockets, in the order the HUD's FRLG tab strip shows them. The run
 * catalogue produces `equipment` (held items), `consumable` (heals and status
 * cures), `machine` (the TMs in `src/data/tms.ts`), `ball` and `valuable`
 * (treasure to sell).
 */
export type BagCategory = 'equipment' | 'consumable' | 'machine' | 'ball' | 'valuable';

export const BAG_CATEGORIES: readonly BagCategory[] = [
  'equipment',
  'consumable',
  'machine',
  'ball',
  'valuable',
];

/** The pocket's tab label, as a key: a table of translated strings would freeze the locale. */
export const BAG_CATEGORY_LABELS: Readonly<Record<BagCategory, TranslationKey>> = {
  equipment: 'bag.equipment',
  consumable: 'bag.consumable',
  machine: 'bag.machine',
  ball: 'bag.ball',
  valuable: 'bag.valuable',
};

/** The pocket's tab text in the current locale, resolved as the tab is drawn. */
export function bagCategoryLabel(category: BagCategory): string {
  return t(BAG_CATEGORY_LABELS[category]);
}

/** The pocket an item kind belongs to; a kind never lands in two pockets. */
export function bagCategoryForKind(kind: ItemKind): BagCategory {
  switch (kind) {
    case 'ball':
      return 'ball';
    case 'held':
      return 'equipment';
    case 'valuable':
      return 'valuable';
    case 'tm':
      return 'machine';
    case 'heal':
    case 'status':
      return 'consumable';
  }
}

/** The pocket a run item belongs to, or null when the catalogue has no such id. */
export function bagCategoryFor(itemId: string): BagCategory | null {
  const item = getItem(itemId);
  return item ? bagCategoryForKind(item.kind) : null;
}

/** The bag stacks in `category`, preserving the bag's own order. */
export function bagForCategory(bag: readonly BagCounts[], category: BagCategory): readonly BagCounts[] {
  return bag.filter((stack) => bagCategoryFor(stack.itemId) === category);
}

/**
 * The pocket one arrow press selects, wrapped over the pockets on offer
 * (`left`/`up` = previous, `right`/`down` = next). A one-pocket list answers itself.
 */
export function stepBagTab(
  pockets: readonly BagCategory[],
  category: BagCategory,
  action: BagGridDirection,
): BagCategory {
  if (pockets.length === 0) return category;
  const found = pockets.indexOf(category);
  const from = found >= 0 ? found : 0;
  const offset = action === 'left' || action === 'up' ? -1 : 1;
  return pockets[(from + offset + pockets.length) % pockets.length];
}

/** The pocket `offset` steps from `category`, wrapping through the whole list. */
export function cycleBagCategory(category: BagCategory, offset: number): BagCategory {
  const index = BAG_CATEGORIES.indexOf(category);
  const next = (index + offset + BAG_CATEGORIES.length) % BAG_CATEGORIES.length;
  return BAG_CATEGORIES[next];
}

/** The bag row cursor after `delta`, wrapping; 0 for an empty list. */
export function stepBagCursor(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const from = Number.isFinite(index) ? Math.trunc(index) : 0;
  const current = Math.min(Math.max(0, from), count - 1);
  return (((current + delta) % count) + count) % count;
}

/**
 * The bag grid's fixed width: every bag surface draws five columns, whether the
 * route's HUD window or the battle's menu box, so the two read as one bag.
 */
export const BAG_GRID_COLS = 5;

/** The gap between two grid cells, both axes, in px. */
export const BAG_GRID_GAP = 6;

export type BagGridDirection = 'up' | 'down' | 'left' | 'right';

/** A rect in the caller's own coordinate space. */
export type BagGridRect = Readonly<{ x: number; y: number; w: number; h: number }>;

export interface BagGridOptions {
  /** Columns to lay out. Default `BAG_GRID_COLS` (5). Never below 1. */
  readonly columns?: number;
  /** Gap between cells, both axes. Default `BAG_GRID_GAP` (6). Never below 0. */
  readonly gap?: number;
  /** Rows to lay out. Default `bagGridRows(count, columns)`. Never below 1. */
  readonly rows?: number;
  /** An upper bound on the cell's side, so a wide band cannot make huge cells. */
  readonly maxCell?: number;
}

export interface BagGridMetrics {
  readonly columns: number;
  readonly rows: number;
  readonly gap: number;
  /** The cell's side in px. `cellH === cellW` always: the cells are square. */
  readonly cellW: number;
  readonly cellH: number;
  /** `rows * columns` rects, row-major (index 0 top-left), all `cellW` square. */
  readonly cells: readonly BagGridRect[];
}

/** A count folded into a stack number: finite, whole and never negative. */
function stackCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

/** The rows a count needs at `columns` wide: `max(1, ceil(count / columns))`. */
export function bagGridRows(count: number, columns: number = BAG_GRID_COLS): number {
  const cols = Math.max(1, Math.trunc(columns));
  return Math.max(1, Math.ceil(stackCount(count) / cols));
}

/**
 * Lays the grid out inside `bounds`: the largest integer square that fits both
 * axes, centred horizontally and anchored at the top, always `rows * columns`
 * cells long so the caller draws the empty tail of a short pocket.
 */
export function bagGridLayout(
  bounds: BagGridRect,
  count: number,
  options: BagGridOptions = {},
): BagGridMetrics {
  const columns = Math.max(1, Math.trunc(options.columns ?? BAG_GRID_COLS));
  const gap = Math.max(0, Math.trunc(options.gap ?? BAG_GRID_GAP));
  const rows = Math.max(1, Math.trunc(options.rows ?? bagGridRows(count, columns)));
  const fit = Math.min((bounds.w - (columns - 1) * gap) / columns, (bounds.h - (rows - 1) * gap) / rows);
  let cell = Math.max(1, Math.floor(fit));
  if (options.maxCell !== undefined && Number.isFinite(options.maxCell)) {
    cell = Math.max(1, Math.min(cell, Math.trunc(options.maxCell)));
  }
  const gridW = columns * cell + (columns - 1) * gap;
  const originX = bounds.x + Math.floor((bounds.w - gridW) / 2);
  const originY = bounds.y;
  const cells: BagGridRect[] = [];
  for (let i = 0; i < rows * columns; i++) {
    cells.push({
      x: originX + (i % columns) * (cell + gap),
      y: originY + Math.floor(i / columns) * (cell + gap),
      w: cell,
      h: cell,
    });
  }
  return { columns, rows, gap, cellW: cell, cellH: cell, cells };
}

/** The cell **slot** `index` (not a stack), or null when it is out of range. */
export function bagGridCell(metrics: BagGridMetrics, index: number): BagGridRect | null {
  if (!Number.isFinite(index)) return null;
  const slot = Math.trunc(index);
  return slot >= 0 && slot < metrics.cells.length ? metrics.cells[slot] : null;
}

/** The stack index under a point, or null (outside the grid, in a gap, past `count`). */
export function bagGridIndexAt(
  metrics: BagGridMetrics,
  x: number,
  y: number,
  count: number,
): number | null {
  const stacks = stackCount(count);
  if (stacks <= 0 || metrics.cells.length === 0) return null;
  const first = metrics.cells[0];
  const stride = metrics.cellW + metrics.gap;
  const column = Math.floor((x - first.x) / stride);
  const row = Math.floor((y - first.y) / stride);
  if (column < 0 || column >= metrics.columns || row < 0 || row >= metrics.rows) return null;
  const index = row * metrics.columns + column;
  if (index >= stacks) return null;
  const cell = metrics.cells[index];
  if (cell === undefined) return null;
  if (x > cell.x + cell.w || y > cell.y + cell.h) return null;
  return index;
}

/** The cursor after one step, row-major; see the stepping rule below. */
export function stepBagGrid(
  index: number,
  direction: BagGridDirection,
  count: number,
  columns: number = BAG_GRID_COLS,
): number {
  const stacks = stackCount(count);
  if (stacks <= 0 || !Number.isFinite(index)) return 0;
  const cols = Math.max(1, Math.trunc(columns));
  const current = Math.min(Math.max(0, Math.trunc(index)), stacks - 1);
  const rows = bagGridRows(stacks, cols);
  const row = Math.floor(current / cols);
  const column = current % cols;
  let nextRow = row;
  let nextColumn = column;
  if (direction === 'up') nextRow = (row - 1 + rows) % rows;
  else if (direction === 'down') nextRow = (row + 1) % rows;
  else if (direction === 'left') nextColumn = (column - 1 + cols) % cols;
  else nextColumn = (column + 1) % cols;
  return Math.min(nextRow * cols + nextColumn, stacks - 1);
}

/** Where the bag's cursor sits: on the pocket row or in the stack grid. */
export type BagFocus = 'tabs' | 'grid';

/**
 * One arrow press while the bag is open, for the **focus** it lands in and the
 * grid cursor that goes with it. `count`/`columns` describe the stacks on screen
 * (the shipped `stepBagGrid` rule); a focus that stays on the tabs keeps `index`.
 * `up` from the grid's top row climbs to the pockets, `down` from them returns to
 * the first stack, so the pocket row is reachable with the arrows alone.
 */
export function stepBagFocus(
  focus: BagFocus,
  index: number,
  action: BagGridDirection,
  count: number,
  columns: number = BAG_GRID_COLS,
): Readonly<{ focus: BagFocus; index: number }> {
  if (focus === 'tabs') {
    return action === 'down' ? { focus: 'grid', index: 0 } : { focus: 'tabs', index };
  }
  const cols = Math.max(1, Math.trunc(columns));
  if (action === 'up' && Math.floor(index / cols) === 0) return { focus: 'tabs', index };
  return { focus: 'grid', index: stepBagGrid(index, action, count, columns) };
}

/**
 * The stacks whose catalogue name contains `query` (trimmed, case-insensitive),
 * in bag order. The name is the catalogue's own **English** one in every locale
 * (`D43`: item names are content, not chrome).
 */
export function filterBagStacks(stacks: readonly BagCounts[], query: string): readonly BagCounts[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return stacks;
  return stacks.filter((stack) =>
    (getItem(stack.itemId)?.name ?? stack.itemId).toLowerCase().includes(needle),
  );
}

/** The candy colour the run has already discovered for `itemId`, or null. */
export function bagDiscoveredCandy(itemId: string, discoveredCandy: readonly string[]): string | null {
  const colour = getItem(itemId)?.candy;
  return colour !== undefined && discoveredCandy.includes(colour) ? colour : null;
}

/** One drawn bag cell, as both surfaces paint it. */
export type BagGridDebugCell = Readonly<{
  index: number;
  itemId: string | null;
  count: number;
  badge: string;
  iconFrame: number | null;
  selected: boolean;
  fill: number;
  fillAlpha: number;
  stroke: number;
  strokeAlpha: number;
  rect: BagGridRect;
}>;

/** The dev-only read of a drawn bag grid. */
export type BagGridDebugState = Readonly<{
  category: BagCategory;
  query: string;
  focused: boolean;
  columns: number;
  rows: number;
  cellW: number;
  cellH: number;
  gap: number;
  search: BagGridRect;
  grid: BagGridRect;
  tabs: readonly Readonly<{ category: BagCategory; rect: BagGridRect }>[];
  cells: readonly BagGridDebugCell[];
  info: Readonly<{ visible: boolean; text: string; x: number; width: number }>;
  footer: string;
}>;
