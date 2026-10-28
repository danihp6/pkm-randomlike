import fontManifest from '../../../../data/ui/font.json';
import { t } from '../../../../i18n';
import { FRLG_WINDOW_PADDING } from '../../../frlg';
import {
  isEmptySlot,
  moveGridCellRects,
  type MoveGridCell,
  type MoveGridRect,
  type MoveGridSlot,
} from '../../../moveGrid';
import { MOVE_ICON_BOX } from '../../kit/moveIcons';
import { battleHpBox } from '../battle-hp/view';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The five label boxes of one cell; the type chip has its own box on the slot. */
export type BattleCellTextBoxes = Readonly<{
  name: Rect;
  category: Rect;
  pp: Rect;
  power: Rect;
  accuracy: Rect;
}>;

/** The four slots the battle's move grid always reserves (`MoveGrid`'s own `GRID_CELLS`). */
const SLOTS = 4;
/** The ⓘ button's box, as the canvas still draws it (`moveGridInfoAt` hit-tests it there). */
const INFO_SIZE = 22;
/** The card's side margin and the gap it keeps from the menu card's top edge. */
const INFO_MARGIN = 20;
const INFO_GAP = 8;
/** The width the shipped `InfoPopup` wraps a description line at. */
const INFO_WRAP = 44;
/** The ◀ control's height. */
const BACK_H = 36;
/** The wide card's side margin inside the battle square, its bottom offset and its height. */
const CARD_MARGIN = 36;
const CARD_FROM_BOTTOM = 218;
const CARD_H = 192;
/** The clearance the wide card keeps from the HP column's right edge, and its narrowest width. */
const CARD_CLEARANCE = 8;
const CARD_MIN_W = 240;

/** The gap the category column keeps from its cell's neighbour box, in the panel's own arithmetic. */
export const MOVE_CATEGORY_GAP = 8;
/** The glyph advances `src/data/ui/font.json` carries, keyed by code point. */
const ADVANCES = new Map<number, number>(
  fontManifest.glyphs.map((glyph) => [glyph.code, glyph.xAdvance] as const),
);
/**
 * The px one manifest advance unit is drawn at. The manifest's metrics are laid out
 * at `scale` times the size they were drawn for (the atlas is 2x), so a glyph asked
 * for at `size` px scales by `size / FONT_UNIT` — 16 today.
 */
const FONT_UNIT = fontManifest.size / fontManifest.scale;
/** The HUD body size this panel draws with: `--hud-type-body-size` in `styles/root.css`. */
const BODY_SIZE = 10;
/** The glyph an elided string ends in, so a cut name always reads as cut. */
const ELLIPSIS = '\u2026';
/** The slot's own column gap, from `.battle-moves__slot`'s `gap: 0 8px`. */
const CELL_GAP = 8;
/** The cell's own padding, from `.battle-moves__slot`: 8 px down, 14 px in on each side. */
const CELL_PAD_X = 14;
const CELL_PAD_Y = 8;
/** One body line (`--hud-type-body-line`): the three a wide cell stacks, the six a compact one. */
const BODY_LINE_H = 13;
const CELL_LINES = 3;
const COMPACT_CELL_LINES = 6;
/** The accuracy column: the widest line a cell prints (`ACC 300 ↑`), so none of them is elided. */
const ACCURACY_W = 68;

/** The drawn px of `text` at `size` (default: `--hud-type-body-size`, 10 px), from `font.json`. */
export function drawnTextWidth(text: string, size: number = BODY_SIZE): number {
  let units = 0;
  for (const char of text) units += ADVANCES.get(char.codePointAt(0) ?? 0) ?? 0;
  return (units * size) / FONT_UNIT;
}

/**
 * `text` reduced to the widest prefix that fits `width`, ending in `'\u2026'` when a
 * glyph had to go; `text` itself when it already fits, `''` when nothing fits. Total:
 * a negative or zero width returns `''`.
 */
export function elideToWidth(text: string, width: number): string {
  if (!(width > 0)) return '';
  if (drawnTextWidth(text) <= width) return text;
  const budget = width - drawnTextWidth(ELLIPSIS);
  if (budget < 0) return '';
  let used = 0;
  let head = '';
  for (const char of text) {
    const advance = drawnTextWidth(char);
    if (used + advance > budget) break;
    used += advance;
    head += char;
  }
  return head.length === 0 ? '' : `${head}${ELLIPSIS}`;
}

/** Below this square side the stacked, full-width phone card is used. */
export const BATTLE_COMPACT = 700;
/** The battle plays inside a centred square, at most this many pixels a side. */
export const BATTLE_STAGE_MAX = 900;
/** Width reserved at the left of the grid for the ◀ control. */
export const MOVE_BACK_COL = 64;
/** Width reserved at the right of the grid for the Mega control (D34). */
export const MOVE_MEGA_COL = 62;
/** Width reserved at the right of the grid for the G-Max control (D44). */
export const MOVE_GMAX_COL = 62;
export const MOVE_GRID_INSET = 8;
/** The ⓘ button's side, as the canvas grid still draws it. */
export const MOVE_INFO_SIZE = INFO_SIZE;
/** The target step's prompt row: one px under the card's top edge, one ⓘ tall. */
export const MOVE_TARGET_TOP = 1;
export const MOVE_TARGET_H = MOVE_INFO_SIZE;
/** The move card's height: the board's `attack detail` (`05`, 576×160). */
export const INFO_CARD_H = 160;
/**
 * The clearance the phone's card keeps between its own top edge and the player's HP
 * box: `PHONE_H` (80) plus the 8 px gutter `battleHpBox` leaves under it, so the card
 * ends 8 px above that box.
 */
export const COMPACT_CARD_CLEARANCE = 88;

/**
 * The page-space card the scene's own `menu` rect becomes: the battle square's
 * menu box moved by the camera viewport's origin, exactly the arithmetic
 * `refreshHud` lays the canvas out with. On the wide layout its left edge starts
 * where the HP column ends — the foe's column right edge plus a gutter — so the
 * card never covers an HP box; the phone card already sits below both of them and
 * keeps its shipped rect.
 */
export function battleMovesBox(viewport: Viewport): Rect {
  const wide = viewport.width > viewport.height;
  const stageW = wide ? Math.min(viewport.height, BATTLE_STAGE_MAX) : viewport.width;
  const stageH = wide ? stageW : viewport.height;
  const offX = Math.round((viewport.width - stageW) / 2);
  const offY = Math.round((viewport.height - stageH) / 2);
  const compact = stageW < BATTLE_COMPACT;
  if (compact) {
    const menu = { x: 16, y: stageH - 236 - 16, w: stageW - 32, h: 236 };
    return { x: offX + menu.x, y: offY + menu.y, w: menu.w, h: menu.h };
  }
  const enemy = battleHpBox(viewport, 'enemy', 0);
  const left = Math.max(offX + CARD_MARGIN, enemy.x + enemy.w + CARD_CLEARANCE);
  const right = offX + stageW - CARD_MARGIN;
  return {
    x: left,
    y: offY + stageH - CARD_FROM_BOTTOM,
    w: Math.max(CARD_MIN_W, right - left),
    h: CARD_H,
  };
}

/** Everything the panel needs, in plain data; the scene builds it (no engine import here). */
export type BattleMovesInput = Readonly<{
  /** True while `mode === 'moves'`. */
  open: boolean;
  /** The card in **page** coordinates: `menu` + the camera viewport's offset. */
  card: Rect;
  /** The four slots, exactly `padMoveGridCells(cells, MAX_MOVES)` of the canvas's own cells. */
  cells: readonly MoveGridSlot[];
  /** `menuIndex`. */
  selected: number;
  /** The canvas's pinned ⓘ slot; the DOM panel never reads it (the cursor is the card). */
  info: number | null;
  mega: boolean;
  gmax: boolean;
  megaArmed: boolean;
  gmaxArmed: boolean;
  /** The marked foe's name while the target step is open; null while it is closed. */
  target: string | null;
}>;

export type BattleMoveSlotView = Readonly<{
  index: number;
  empty: boolean;
  /**
   * The name as painted: the cell's name uppercased (the slot's `text-transform`)
   * and cut to `nameBox.w`, so it is never wider than its own box.
   */
  name: string;
  type: string;
  category: string;
  pp: string;
  power: string;
  accuracy: string;
  /** Green when power > basePower, red when below, ink when level (the canvas's own rule). */
  powerTone: 'up' | 'down' | 'level';
  accuracyTone: 'up' | 'down' | 'level';
  enabled: boolean;
  selected: boolean;
  box: Rect;
  /** The cell's first line: from its side padding to a gap left of the category glyph. */
  nameBox: Rect;
  /** The category glyph's box: its own 24 px square, ending on the cell's right padding edge. */
  categoryBox: Rect;
  /** The five labels' own boxes, laid out for the card's width class (`cellTextBoxes`). */
  boxes: BattleCellTextBoxes;
  /** The type badge's box: the wide cell's stat gutter, the compact cell's first row. */
  typeBox: Rect;
}>;

/** The board's card: the cursor's move, laid out above the menu. */
export type BattleMoveInfoView = Readonly<{
  /** The move's display name (`MoveGridCell.name`, unmodified). */
  title: string;
  /** The atlas type the badge draws. */
  type: string;
  /** The atlas category the glyph draws. */
  category: string;
  /** `ppLabel(cell)`, the same string the cell prints. */
  pp: string;
  power: string;
  accuracy: string;
  /** `MoveGridCell.desc`, which may be `''`. */
  text: string;
  /** Viewport coordinates. */
  box: Rect;
}>;

export type BattleMovesView = Readonly<{
  open: boolean;
  /** True for the compact card: its cells stack their labels in one column. */
  compact: boolean;
  card: Rect;
  slots: readonly BattleMoveSlotView[];
  back: Readonly<{ label: string; box: Rect }>;
  mega: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  gmax: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  /** The step's prompt row: the question naming the marked foe, or null. */
  target: Readonly<{ label: string; box: Rect }> | null;
  /** The cursor's move, or null while the menu is closed or the cursor is on an empty cell. */
  info: BattleMoveInfoView | null;
}>;

/** A slot index clamped into the one grid the panel draws; `NaN` lands on the first. */
function clampIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(SLOTS - 1, Math.max(0, Math.trunc(value)));
}

/** The stat line's tone: raised above its base, lowered below it, or level. */
function toneOf(value: number | null, base: number | null): 'up' | 'down' | 'level' {
  if (value === null || base === null) return 'level';
  if (!Number.isFinite(value) || !Number.isFinite(base)) return 'level';
  if (value > base) return 'up';
  if (value < base) return 'down';
  return 'level';
}

/** `ACC 100`, with an ↑ / ↓ when stages or abilities moved the hit chance. */
function accuracyLabel(cell: MoveGridCell): string {
  if (cell.baseAccuracy === null || cell.accuracy === null) return t('move.accNone');
  const arrow =
    cell.accuracy > cell.baseAccuracy ? ' \u2191' : cell.accuracy < cell.baseAccuracy ? ' \u2193' : '';
  return t('move.acc', { value: `${cell.accuracy}${arrow}` });
}

/** `PP 12/15`, the shipped grid's own line. */
function ppLabel(cell: MoveGridCell): string {
  return t('move.pp', { pp: cell.pp, max: cell.maxPp });
}

/** `PWR 90`, or the dash a status move reads. */
function powerLabel(cell: MoveGridCell): string {
  return cell.basePower > 0 ? t('move.pwr', { value: cell.power }) : t('move.pwrNone');
}

/** The first text row's top inside a wide cell: three body lines centred in its padding box. */
function categoryBandTop(box: Rect): number {
  const content = Math.max(0, box.h - CELL_PAD_Y * 2);
  return box.y + CELL_PAD_Y + Math.max(0, (content - CELL_LINES * BODY_LINE_H) / 2);
}

/**
 * The wide cell's category column: the glyph's own 24 px box, ending on the cell's
 * right padding edge, on the cell's first text row.
 */
function categoryBoxOf(box: Rect): Rect {
  const right = box.x + box.w - CELL_PAD_X;
  const left = Math.max(box.x + CELL_PAD_X, right - MOVE_ICON_BOX);
  return { x: left, y: categoryBandTop(box), w: Math.max(0, right - left), h: MOVE_ICON_BOX };
}

/**
 * The wide cell's name column: its own first line, from the side padding to a gap
 * left of the category glyph — one count of each, so the category takes only the
 * width it is drawn in and the freed ⓘ column goes back to the name. The type badge
 * sits in the stat gutter below, never on this line, so no type can charge the move's
 * name for its own width.
 */
function nameBoxOf(box: Rect, category: Rect): Rect {
  const left = box.x + CELL_PAD_X;
  const right = category.x - CELL_GAP;
  return { x: left, y: categoryBandTop(box), w: Math.max(0, right - left), h: BODY_LINE_H };
}

/** A cell's content box: its own padding taken off all four edges. */
function contentBoxOf(cell: Rect): Rect {
  return {
    x: cell.x + CELL_PAD_X,
    y: cell.y + CELL_PAD_Y,
    w: Math.max(0, cell.w - CELL_PAD_X * 2),
    h: Math.max(0, cell.h - CELL_PAD_Y * 2),
  };
}

/** The compact cell's first row: its six lines fill the padding box it is centred in. */
function compactBandTop(cell: Rect): number {
  const content = contentBoxOf(cell);
  return content.y + Math.max(0, (content.h - COMPACT_CELL_LINES * BODY_LINE_H) / 2);
}

/**
 * The wide cell's boxes: the shipped three-line grid. The name and the category
 * glyph share the first line, PP takes the second and the power / accuracy pair the
 * third — the stats one gap past the type badge's own 24 px column, as the old
 * stylesheet's first track put them, and the accuracy right-aligned at the padding
 * edge.
 */
function wideCellTextBoxes(cell: Rect): BattleCellTextBoxes {
  const category = categoryBoxOf(cell);
  const name = nameBoxOf(cell, category);
  const right = cell.x + cell.w - CELL_PAD_X;
  const band = categoryBandTop(cell);
  const gutter = name.x + MOVE_ICON_BOX + CELL_GAP;
  const accuracy: Rect = {
    x: right - ACCURACY_W,
    y: band + BODY_LINE_H * 2,
    w: ACCURACY_W,
    h: BODY_LINE_H,
  };
  return {
    name,
    category,
    pp: { x: gutter, y: band + BODY_LINE_H, w: Math.max(0, right - gutter), h: BODY_LINE_H },
    power: {
      x: gutter,
      y: band + BODY_LINE_H * 2,
      w: Math.max(0, accuracy.x - CELL_GAP - gutter),
      h: BODY_LINE_H,
    },
    accuracy,
  };
}

/**
 * The compact cell's boxes: one label a line — the type badge, the category glyph,
 * the name and the three stat lines — because the phone cell's 91 px content box
 * cannot hold two of them side by side (`PP 15/15` and `PWR 90` alone are 105 px with
 * their gap). The six lines fill the cell's padding box, and the category keeps its
 * 24 px column on the content box's right edge, the glyph the badge shares the first
 * row with having left no column of its own.
 */
function compactCellTextBoxes(cell: Rect): BattleCellTextBoxes {
  const content = contentBoxOf(cell);
  const band = compactBandTop(cell);
  const plane = (row: number): Rect => ({
    x: content.x,
    y: band + row * BODY_LINE_H,
    w: content.w,
    h: BODY_LINE_H,
  });
  const right = content.x + content.w;
  const left = Math.max(content.x, right - MOVE_ICON_BOX);
  return {
    name: plane(2),
    category: { x: left, y: band + BODY_LINE_H, w: Math.max(0, right - left), h: BODY_LINE_H },
    pp: plane(3),
    power: plane(4),
    accuracy: plane(5),
  };
}

/**
 * The text boxes of one cell, laid out for the card's width class: the wide cell keeps
 * the shipped three-line grid, the compact one stacks its six lines. The third
 * argument is the canvas's own call shape and no longer moves any box: the type
 * badge's width is the same 24 px for every type.
 */
export function cellTextBoxes(cell: Rect, compact: boolean, _type = ''): BattleCellTextBoxes {
  return compact ? compactCellTextBoxes(cell) : wideCellTextBoxes(cell);
}

/** True when `inner` lies inside `outer` on all four edges, within `tolerance` px. */
export function fitsInside(inner: Rect, outer: Rect, tolerance = 0.5): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  );
}

/**
 * The type badge's box: the wide cell's left gutter, centred over its two stat lines,
 * and the compact cell's own first row, above the category glyph.
 */
function typeBoxOf(cell: Rect, compact: boolean): Rect {
  const y = compact ? compactBandTop(cell) : categoryBandTop(cell) + BODY_LINE_H + 1;
  return { x: contentBoxOf(cell).x, y, w: MOVE_ICON_BOX, h: MOVE_ICON_BOX };
}

/** The empty container: no name and no stats — the grid's own rule. */
function emptySlot(index: number, box: Rect, selected: boolean): BattleMoveSlotView {
  const rowY = categoryBandTop(box);
  // Nothing is printed in an empty cell, so its columns are zero-width marks at the right pad.
  const mark = (): Rect => ({ x: box.x + box.w - CELL_PAD_X, y: rowY, w: 0, h: BODY_LINE_H });
  const nameBox = mark();
  const categoryBox = mark();
  return {
    index,
    empty: true,
    name: '',
    type: '',
    category: '',
    pp: '',
    power: '',
    accuracy: '',
    powerTone: 'level',
    accuracyTone: 'level',
    enabled: false,
    selected,
    box,
    nameBox,
    categoryBox,
    boxes: { name: nameBox, category: categoryBox, pp: mark(), power: mark(), accuracy: mark() },
    typeBox: { x: box.x + CELL_PAD_X, y: rowY, w: 0, h: BODY_LINE_H },
  };
}

function slotView(
  cell: MoveGridSlot,
  index: number,
  rect: MoveGridRect,
  selected: number,
  compact: boolean,
): BattleMoveSlotView {
  const box: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  if (isEmptySlot(cell)) return emptySlot(index, box, index === selected);
  const boxes = cellTextBoxes(box, compact, cell.type);
  return {
    index,
    empty: false,
    name: elideToWidth(cell.name.toUpperCase(), boxes.name.w),
    type: cell.type,
    category: cell.category,
    pp: ppLabel(cell),
    power: powerLabel(cell),
    accuracy: accuracyLabel(cell),
    powerTone: toneOf(cell.power, cell.basePower),
    accuracyTone: toneOf(cell.accuracy, cell.baseAccuracy),
    enabled: cell.enabled,
    selected: index === selected,
    box,
    nameBox: boxes.name,
    categoryBox: boxes.category,
    boxes,
    typeBox: typeBoxOf(box, compact),
  };
}

/** The description's wrapped line count: 44 characters a line, per paragraph (`InfoPopup`'s floor). */
export function infoLineCount(text: string): number {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    lines += Math.ceil(paragraph.length / INFO_WRAP);
  }
  return lines;
}

/**
 * The board's card: the cursor's move, or null while the menu is closed, the cursor's
 * slot is empty or the grid has no such slot. It floats above the menu card's top edge
 * — the phone's 88 px clear of its own HP box, so it ends 8 px above it — and it is
 * always `INFO_CARD_H` tall, so a long description clips instead of growing it. The
 * move's text is never a reason to hide the head.
 */
function infoCardOf(
  input: BattleMovesInput,
  slots: readonly BattleMoveSlotView[],
  selected: number,
): BattleMoveInfoView | null {
  if (!input.open) return null;
  const slot = slots[selected];
  if (slot === undefined || slot.empty) return null;
  const cell = input.cells[selected];
  if (isEmptySlot(cell)) return null;
  const clearance = compactCard(input.card) ? COMPACT_CARD_CLEARANCE : 0;
  return {
    title: cell.name,
    type: cell.type,
    category: cell.category,
    pp: ppLabel(cell),
    power: powerLabel(cell),
    accuracy: accuracyLabel(cell),
    text: cell.desc,
    box: {
      x: input.card.x + INFO_MARGIN,
      y: input.card.y - clearance - INFO_GAP - INFO_CARD_H,
      w: Math.max(0, input.card.w - INFO_MARGIN * 2),
      h: INFO_CARD_H,
    },
  };
}

/**
 * True when the card is the compact one `battleMovesBox` builds. The card carries no
 * viewport and the two branches' widths overlap (a 568 px menu card is the compact one
 * at 600×600 and the wide one at 1280×800), so the width class is read off the one
 * measurement they never share: the phone card is the 236 px menu square, the wide one
 * the 192 px card.
 */
export function compactCard(card: Rect): boolean {
  return card.h > CARD_H;
}

/** The step's prompt row, or null while nothing is marked: an empty name reads as closed. */
function targetRowOf(input: BattleMovesInput): BattleMovesView['target'] {
  const name = input.target;
  if (name === null || name === '') return null;
  return {
    label: t('battle.targetPrompt', { name }),
    box: {
      x: input.card.x + FRLG_WINDOW_PADDING.x,
      y: input.card.y + MOVE_TARGET_TOP,
      w: input.card.w - FRLG_WINDOW_PADDING.x * 2,
      h: MOVE_TARGET_H,
    },
  };
}

/**
 * The move menu as plain data: the four cells `moveGridCellRects` lays out inside
 * the scene's own card, the ◀ control, the two forme columns and the card that
 * describes the cursor's move. Pure and total: out-of-range indices clamp, an empty
 * or absent slot reads empty, and the same input always yields deep-equal output.
 */
export function battleMovesView(input: BattleMovesInput): BattleMovesView {
  const card = input.card;
  const pad = FRLG_WINDOW_PADDING;
  const compact = compactCard(card);
  const mega = input.mega;
  const gmax = input.gmax;
  const rightReserve = (mega ? MOVE_MEGA_COL : 0) + (gmax ? MOVE_GMAX_COL : 0);
  const selected = clampIndex(input.selected);
  const right = card.x + card.w - pad.x - MOVE_GRID_INSET - rightReserve;
  const top = card.y + pad.top + MOVE_GRID_INSET;
  const bottom = card.y + card.h - pad.bottom - MOVE_GRID_INSET;
  // The identical call the canvas makes, so the two grids can never diverge. The DOM
  // panel has no pinned cell of its own: the cursor is the card.
  const rects = moveGridCellRects({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
    cells: input.cells,
    selected,
    info: null,
    leftReserve: MOVE_BACK_COL,
    rightReserve,
  });
  const slots = input.cells
    .slice(0, rects.length)
    .map((cell, index) => slotView(cell, index, rects[index], selected, compact));
  const control = { y: top, h: bottom - top };
  return {
    open: input.open,
    compact,
    card,
    slots,
    back: {
      label: '\u25c0',
      box: { x: card.x + pad.x, y: card.y + card.h / 2 - BACK_H / 2, w: MOVE_BACK_COL, h: BACK_H },
    },
    mega: mega
      ? {
          label: input.megaArmed ? t('battle.megaIntent') : t('battle.mega'),
          box: { x: right - MOVE_MEGA_COL, ...control, w: MOVE_MEGA_COL },
          armed: input.megaArmed,
        }
      : null,
    gmax: gmax
      ? {
          label: input.gmaxArmed ? t('battle.gmaxIntent') : t('battle.gmax'),
          box: {
            x: right - (mega ? MOVE_MEGA_COL : 0) - MOVE_GMAX_COL,
            ...control,
            w: MOVE_GMAX_COL,
          },
          armed: input.gmaxArmed,
        }
      : null,
    target: targetRowOf(input),
    info: infoCardOf(input, slots, selected),
  };
}
