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
import { battleHpBox } from '../battle-hp/view';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The four slots the battle's move grid always reserves (`MoveGrid`'s own `GRID_CELLS`). */
const SLOTS = 4;
/** The ⓘ button's box inside its cell, the same one `moveGridInfoAt` hit-tests. */
const INFO_SIZE = 22;
/** Its right-edge inset: the cell's side padding plus the button (`CELL_PAD` in `moveGrid`). */
const INFO_OFFSET = 36;
const INFO_TOP = 8;
/** The floating description card: its side margin, the gap from its cell, and its height floor. */
const INFO_MARGIN = 20;
const INFO_GAP = 8;
const INFO_BASE_H = 48;
const INFO_LINE_H = 13;
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

/** The gap the category column keeps from the ⓘ square: 36 px of ⓘ offset + this = the 44 px CSS `right`. */
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
/** The three category labels the grid prints, in the case the slot paints them. */
const CATEGORY_LABELS: readonly string[] = ['PHYSICAL', 'SPECIAL', 'STATUS'];
/** The category column: the widest label's own drawn px, so none of the three can spill. */
const CATEGORY_W = Math.max(...CATEGORY_LABELS.map((label) => Math.ceil(drawnTextWidth(label))));
/** The type chip's own padding, from `.kit-type`'s `padding: 0 6px`. */
const TYPE_CHIP_PAD = 6;
/** The type chip's text size, `--hud-type-tag-size` in `styles/root.css`. */
const TAG_SIZE = 8;
/** The slot's own column gap, from `.battle-moves__slot`'s `gap: 0 8px`. */
const CELL_GAP = 8;
/** The cell's own padding, from `.battle-moves__slot`: 8 px down, 14 px in on each side. */
const CELL_PAD_X = 14;
const CELL_PAD_Y = 8;
/** One body line (`--hud-type-body-line`) and the three lines a filled cell stacks. */
const BODY_LINE_H = 13;
const CELL_LINES = 3;

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
/** The ⓘ button's side, as the grid draws it. */
export const MOVE_INFO_SIZE = INFO_SIZE;

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
  /** The slot whose ⓘ popup floats, or null. */
  info: number | null;
  mega: boolean;
  gmax: boolean;
  megaArmed: boolean;
  gmaxArmed: boolean;
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
  /** The name column: past the type chip, a gap left of the category column. */
  nameBox: Rect;
  /** The category column: it ends left of the ⓘ by at least its gap. */
  categoryBox: Rect;
  /** The ⓘ button: `{ x: box.x + box.w - 36, y: box.y + 8, w: 22, h: 22 }`, empty slots none. */
  info: Rect | null;
}>;

export type BattleMovesView = Readonly<{
  open: boolean;
  card: Rect;
  slots: readonly BattleMoveSlotView[];
  back: Readonly<{ label: string; box: Rect }>;
  mega: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  gmax: Readonly<{ label: string; box: Rect; armed: boolean }> | null;
  /** The floating description card: the move's, or null when nothing is pinned. */
  info: Readonly<{ title: string; type: string; category: string; text: string; box: Rect }> | null;
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

/** The first text row's top inside a cell: three body lines centred in the cell's padding box. */
function categoryBandTop(box: Rect): number {
  const content = Math.max(0, box.h - CELL_PAD_Y * 2);
  return box.y + CELL_PAD_Y + Math.max(0, (content - CELL_LINES * BODY_LINE_H) / 2);
}

/**
 * The category column: the widest label's own width, right-aligned against the ⓘ's
 * gap, never reaching past the cell's own padding, on the cell's first text row.
 */
function categoryBoxOf(box: Rect, info: Rect): Rect {
  const right = info.x - MOVE_CATEGORY_GAP;
  const left = Math.max(box.x + CELL_PAD_X, right - CATEGORY_W);
  return { x: left, y: categoryBandTop(box), w: Math.max(0, right - left), h: BODY_LINE_H };
}

/** The type chip's box: its uppercased label at the tag size plus its own padding. */
function typeChipWidth(type: string): number {
  return Math.ceil(drawnTextWidth(type.toUpperCase(), TAG_SIZE)) + TYPE_CHIP_PAD * 2;
}

/**
 * The name column: it starts past the type chip and ends a gap left of the category
 * column. A cell too narrow to hold both collapses it to zero rather than letting the
 * name paint over the category or under the ⓘ; the ⓘ card carries the full name.
 */
function nameBoxOf(box: Rect, category: Rect, chip: number): Rect {
  const left = box.x + CELL_PAD_X + chip + CELL_GAP;
  const right = category.x - CELL_GAP;
  return { x: left, y: categoryBandTop(box), w: Math.max(0, right - left), h: BODY_LINE_H };
}

/** The empty container: no name, no stats, no ⓘ — the grid's own rule. */
function emptySlot(index: number, box: Rect, selected: boolean): BattleMoveSlotView {
  const rowY = categoryBandTop(box);
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
    // Nothing is printed in an empty cell, so its columns are zero-width marks at the right pad.
    nameBox: { x: box.x + box.w - CELL_PAD_X, y: rowY, w: 0, h: BODY_LINE_H },
    categoryBox: { x: box.x + box.w - CELL_PAD_X, y: rowY, w: 0, h: BODY_LINE_H },
    info: null,
  };
}

function slotView(
  cell: MoveGridSlot,
  index: number,
  rect: MoveGridRect,
  selected: number,
): BattleMoveSlotView {
  const box: Rect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  if (isEmptySlot(cell)) return emptySlot(index, box, index === selected);
  const info: Rect = {
    x: box.x + box.w - INFO_OFFSET,
    y: box.y + INFO_TOP,
    w: INFO_SIZE,
    h: INFO_SIZE,
  };
  const categoryBox = categoryBoxOf(box, info);
  const nameBox = nameBoxOf(box, categoryBox, typeChipWidth(cell.type));
  return {
    index,
    empty: false,
    name: elideToWidth(cell.name.toUpperCase(), nameBox.w),
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
    nameBox,
    categoryBox,
    info,
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

/** The floating card, or null when nothing is pinned, the slot is empty or the move has no text. */
function infoCardOf(
  input: BattleMovesInput,
  slots: readonly BattleMoveSlotView[],
  pinned: number | null,
): BattleMovesView['info'] {
  if (pinned === null) return null;
  const slot = slots[pinned];
  if (slot === undefined || slot.empty) return null;
  const cell = input.cells[pinned];
  if (isEmptySlot(cell) || cell.desc.length === 0) return null;
  const height = INFO_BASE_H + INFO_LINE_H * infoLineCount(cell.desc);
  const above = slot.box.y - INFO_GAP - height >= input.card.y;
  return {
    title: cell.name,
    type: cell.type,
    category: cell.category,
    text: cell.desc,
    box: {
      x: input.card.x + INFO_MARGIN,
      y: above ? slot.box.y - INFO_GAP - height : slot.box.y + slot.box.h + INFO_GAP,
      w: Math.max(0, input.card.w - INFO_MARGIN * 2),
      h: height,
    },
  };
}

/**
 * The move menu as plain data: the four cells `moveGridCellRects` lays out inside
 * the scene's own card, the ◀ control, the two forme columns and the floating
 * description. Pure and total: out-of-range indices clamp, an empty or absent slot
 * reads empty, and the same input always yields deep-equal output.
 */
export function battleMovesView(input: BattleMovesInput): BattleMovesView {
  const card = input.card;
  const pad = FRLG_WINDOW_PADDING;
  const mega = input.mega;
  const gmax = input.gmax;
  const rightReserve = (mega ? MOVE_MEGA_COL : 0) + (gmax ? MOVE_GMAX_COL : 0);
  const selected = clampIndex(input.selected);
  const pinned = input.info === null ? null : clampIndex(input.info);
  const right = card.x + card.w - pad.x - MOVE_GRID_INSET - rightReserve;
  const top = card.y + pad.top + MOVE_GRID_INSET;
  const bottom = card.y + card.h - pad.bottom - MOVE_GRID_INSET;
  // The identical call the canvas makes, so the two grids can never diverge.
  const rects = moveGridCellRects({
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
    cells: input.cells,
    selected,
    info: pinned,
    leftReserve: MOVE_BACK_COL,
    rightReserve,
  });
  const slots = input.cells
    .slice(0, rects.length)
    .map((cell, index) => slotView(cell, index, rects[index], selected));
  const control = { y: top, h: bottom - top };
  return {
    open: input.open,
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
    info: infoCardOf(input, slots, pinned),
  };
}
