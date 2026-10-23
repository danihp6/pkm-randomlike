import { t } from '../../../../i18n';
import { FRLG_WINDOW_PADDING } from '../../../frlg';
import {
  isEmptySlot,
  moveGridCellRects,
  type MoveGridCell,
  type MoveGridRect,
  type MoveGridSlot,
} from '../../../moveGrid';

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
 * `refreshHud` lays the canvas out with.
 */
export function battleMovesBox(viewport: Viewport): Rect {
  const wide = viewport.width > viewport.height;
  const stageW = wide ? Math.min(viewport.height, BATTLE_STAGE_MAX) : viewport.width;
  const stageH = wide ? stageW : viewport.height;
  const offX = Math.round((viewport.width - stageW) / 2);
  const offY = Math.round((viewport.height - stageH) / 2);
  const compact = stageW < BATTLE_COMPACT;
  const menu = compact
    ? { x: 16, y: stageH - 236 - 16, w: stageW - 32, h: 236 }
    : { x: 36, y: stageH - 218, w: stageW - 72, h: 192 };
  return { x: offX + menu.x, y: offY + menu.y, w: menu.w, h: menu.h };
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

/** The empty container: no name, no stats, no ⓘ — the grid's own rule. */
function emptySlot(index: number, box: Rect, selected: boolean): BattleMoveSlotView {
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
  return {
    index,
    empty: false,
    name: cell.name,
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
    info: {
      x: box.x + box.w - INFO_OFFSET,
      y: box.y + INFO_TOP,
      w: INFO_SIZE,
      h: INFO_SIZE,
    },
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
