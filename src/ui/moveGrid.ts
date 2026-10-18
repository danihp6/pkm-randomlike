import type Phaser from 'phaser';
import { addFrlgText, FRLG_INK } from './frlgFont';
import {
  FRLG_ACCENT,
  FRLG_MUTED,
  FRLG_NEGATIVE,
  FRLG_POSITIVE,
  FRLG_ROW_FILL,
  FRLG_ROW_STROKE,
  FRLG_SELECTED_FILL,
  FRLG_SELECTED_STROKE,
  FRLG_WINDOW_PADDING,
} from './frlg';
import { typeColor } from './typeColors';
import { TYPE_ICON_TEXTURE_KEY, TYPE_ICON_W, typeIconFrame } from '../data/typeIcons';
import {
  MOVE_CATEGORY_ICON_W,
  MOVE_CATEGORY_TEXTURE_KEY,
  categoryIconFrame,
} from '../data/moveCategoryIcons';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../data/statusIcons';
import { InfoPopup, type InfoPopupBadge, type InfoPopupChip, type InfoPopupContent } from './infoPopup';
import { t } from '../i18n';

/**
 * The shared moves grid + floating info popup. The battle's FIGHT menu and the
 * route HUD's detail panel both draw the same component, so a move cell looks and
 * reads identically in both: a glass cell with the type badge, category badge, PP
 * and power/accuracy, an ⓘ button, and a description window that floats over the
 * scene while the button is asked for.
 *
 * The component owns its visuals but not the input: each scene wires its own
 * pointer zones and asks `indexAt` / `infoAt` where a point landed, then passes
 * the current selection and info index back through `layout`.
 */

/** One drawn move cell. Plain data, so the battle and the HUD both feed it. */
export type MoveGridCell = Readonly<{
  name: string;
  type: string;
  category: string;
  pp: number;
  maxPp: number;
  desc: string;
  /** Effective power (battle) or printed base power (HUD). */
  power: number;
  basePower: number;
  /** Effective (battle) or printed (HUD) hit chance, or null when it never misses. */
  accuracy: number | null;
  baseAccuracy: number | null;
  /** Primary status the move inflicts, for the popup badge. */
  status: string | null;
  enabled: boolean;
}>;

/** An empty slot: the grid draws its container and nothing inside it. */
export type MoveGridEmptyCell = Readonly<{ empty: true }>;

/** What the grid draws in one slot: a move cell, or the empty container. */
export type MoveGridSlot = MoveGridCell | MoveGridEmptyCell;

/** A laid-out slot rectangle, in the coordinates the last `layout` used. */
export type MoveGridRect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The window rect to fill and the slots to draw; the rest has sane defaults. */
export type MoveGridOptions = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  /** One entry per slot to draw (at most 4): a move cell or `{ empty: true }`. */
  cells: readonly MoveGridSlot[];
  /** The cell drawn as selected (raised stroke), or -1 for none. */
  selected: number;
  /** The cell whose info popup floats, or null. */
  info: number | null;
  columns?: number;
  gap?: number;
  inset?: number;
  /** Extra columns kept clear at the left (a ◀ back control) or right (MEGA). */
  leftReserve?: number;
  rightReserve?: number;
  /**
   * Anchor the info popup to the hovered cell's top instead of the window's, so
   * the HUD's detail panel floats the description right over the move it is for.
   */
  popupAtCell?: boolean;
}>;

/** The grid always reserves a full 2x2, so a short list keeps one cell size. */
const GRID_CELLS = 4;
const GRID_COLS = 2;
const GRID_GAP = 8;
/** Inner padding of a cell (sides) and the gap from the cell's top edge. */
const CELL_PAD = 14;
const CELL_TOP = 8;
const GRID_INSET = 8;
/** The ⓘ button in each cell that reveals the info popup. */
const INFO_SIZE = 22;
/** Below this cell width the power/accuracy line drops under the category row. */
const CELL_NARROW = 220;
/** The power / accuracy column reserved at a wide cell's right. */
const STAT_COL = 66;
/** The gap between the info anchor (a cell's top) and the description window. */
const POPUP_GAP = 8;
/** The category badge is 32x14; 1.5x reads clearly beside the 16px cell text. */
const CATEGORY_ICON_SCALE = 1.5;

/** Green when a stat line reads above its base, red when below, ink when level. */
const STAT_UP = FRLG_POSITIVE;
const STAT_DOWN = FRLG_NEGATIVE;

/** An ordinary cell's fill and 1px outline, and the selected / disabled pair. */
type CellTone = Readonly<{ fill: number; fillAlpha: number; stroke: number; strokeAlpha: number }>;

const ROW_TONE: CellTone = {
  fill: FRLG_ROW_FILL.colour,
  fillAlpha: FRLG_ROW_FILL.alpha,
  stroke: FRLG_ROW_STROKE.colour,
  strokeAlpha: FRLG_ROW_STROKE.alpha,
};
const SELECTED_TONE: CellTone = {
  fill: FRLG_SELECTED_FILL.colour,
  fillAlpha: FRLG_SELECTED_FILL.alpha,
  stroke: FRLG_SELECTED_STROKE.colour,
  strokeAlpha: FRLG_SELECTED_STROKE.alpha,
};
/** A marked (disabled) cell keeps the ordinary fill and takes a muted outline. */
const MARKED_TONE: CellTone = {
  fill: FRLG_ROW_FILL.colour,
  fillAlpha: FRLG_ROW_FILL.alpha,
  stroke: FRLG_MUTED,
  strokeAlpha: 0.5,
};

/** A cell's tone from its own state: selected, marked (disabled) or ordinary. */
function cellTone(selected: boolean, marked: boolean): CellTone {
  if (selected) return SELECTED_TONE;
  return marked ? MARKED_TONE : ROW_TONE;
}

/** The one empty slot every padding answer shares: it carries no data at all. */
const EMPTY_SLOT: MoveGridEmptyCell = { empty: true };

/** True when there is no move at that slot: `{ empty: true }`, or no slot at all. */
export function isEmptySlot(slot: MoveGridSlot | undefined): slot is MoveGridEmptyCell {
  return slot === undefined || 'empty' in slot;
}

/**
 * Exactly `slots` slots: the first `slots` of `cells`, then `{ empty: true }` until
 * the count fits. `slots` is clamped to 0..4 (the grid's `GRID_CELLS`).
 */
export function padMoveGridCells(
  cells: readonly MoveGridCell[],
  slots: number,
): readonly MoveGridSlot[] {
  const wanted = Math.trunc(slots);
  const total = Number.isFinite(wanted) ? Math.min(Math.max(0, wanted), GRID_CELLS) : 0;
  const padded: MoveGridSlot[] = cells.slice(0, total);
  while (padded.length < total) padded.push(EMPTY_SLOT);
  return padded;
}

/**
 * One rect per slot the grid will draw, row-major, in `Math.min(cells.length, 4)`
 * entries — 0 for an empty list, 4 for a padded one. The grid always reserves its
 * full 2x2, so a rect's geometry does not depend on how many cells there are.
 */
export function moveGridCellRects(options: MoveGridOptions): readonly MoveGridRect[] {
  const cols = options.columns ?? GRID_COLS;
  const gap = options.gap ?? GRID_GAP;
  const inset = options.inset ?? GRID_INSET;
  const leftReserve = options.leftReserve ?? 0;
  const rightReserve = options.rightReserve ?? 0;
  const pad = FRLG_WINDOW_PADDING;
  const rows = Math.ceil(GRID_CELLS / cols);
  const left = options.x + pad.x + leftReserve;
  const right = options.x + options.w - pad.x - inset - rightReserve;
  const top = options.y + pad.top + inset;
  const bottom = options.y + options.h - pad.bottom - inset;
  const cellW = (right - left - (cols - 1) * gap) / cols;
  const cellH = (bottom - top - (rows - 1) * gap) / rows;
  const count = Math.min(options.cells.length, GRID_CELLS);
  const rects: MoveGridRect[] = [];
  for (let i = 0; i < count; i++) {
    rects.push({
      x: left + (i % cols) * (cellW + gap),
      y: top + Math.floor(i / cols) * (cellH + gap),
      w: cellW,
      h: cellH,
    });
  }
  return rects;
}

/** The slot index under a grid-local point, or null outside every rect. */
export function moveGridIndexAt(rects: readonly MoveGridRect[], x: number, y: number): number | null {
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return i;
  }
  return null;
}

/** True when the point is on that slot's ⓘ button; an empty slot has none. */
export function moveGridInfoAt(
  slot: MoveGridSlot | undefined,
  rect: MoveGridRect | undefined,
  localX: number,
  localY: number,
): boolean {
  if (rect === undefined || isEmptySlot(slot)) return false;
  const bx = rect.w - CELL_PAD - INFO_SIZE;
  const by = CELL_TOP;
  return localX >= bx && localX <= bx + INFO_SIZE && localY >= by && localY <= by + INFO_SIZE;
}

/** The power line's colour: green raised above its base, red lowered, else ink. */
function powerTint(cell: MoveGridCell): number {
  if (cell.power > cell.basePower) return STAT_UP;
  if (cell.power < cell.basePower) return STAT_DOWN;
  return FRLG_INK;
}

/** `ACC 100`, with an ↑ / ↓ when stages or abilities moved the hit chance. */
function accuracyLabel(cell: MoveGridCell): string {
  if (cell.baseAccuracy === null || cell.accuracy === null) return t('move.accNone');
  const arrow =
    cell.accuracy > cell.baseAccuracy ? ' \u2191' : cell.accuracy < cell.baseAccuracy ? ' \u2193' : '';
  return t('move.acc', { value: `${cell.accuracy}${arrow}` });
}

/** Green for a raised hit chance, red for a lowered one, ink when unchanged. */
function accuracyTint(cell: MoveGridCell): number {
  if (cell.baseAccuracy === null || cell.accuracy === null) return FRLG_INK;
  if (cell.accuracy > cell.baseAccuracy) return STAT_UP;
  if (cell.accuracy < cell.baseAccuracy) return STAT_DOWN;
  return FRLG_INK;
}

/**
 * The floating description window's content for a move cell: the type badge, the
 * status badge and the move's own text, with the coloured chip standing in for a
 * type the atlas lacks. Pure, so the grid and the battle's switch window float the
 * same window from the same builder.
 */
export function moveInfoContent(cell: MoveGridCell): InfoPopupContent {
  const typeFrame = typeIconFrame(cell.type);
  const statusFrame = cell.status ? statusIconFrame(cell.status) : null;
  const badges: InfoPopupBadge[] = [];
  if (typeFrame !== null) badges.push({ textureKey: TYPE_ICON_TEXTURE_KEY, frame: typeFrame, y: 0 });
  if (statusFrame !== null) {
    badges.push({ textureKey: STATUS_ICON_TEXTURE_KEY, frame: statusFrame, y: 20 });
  }
  // A type the atlas lacks still falls back to the text chip.
  const chip: InfoPopupChip | null =
    typeFrame === null ? { label: cell.type.toUpperCase(), color: typeColor(cell.type), y: 0 } : null;
  return { text: cell.desc, badges, chip };
}

export class MoveGrid {
  private cells: Phaser.GameObjects.Rectangle[] = [];
  private names: Phaser.GameObjects.BitmapText[] = [];
  private typeIcons: Phaser.GameObjects.Image[] = [];
  private categoryIcons: Phaser.GameObjects.Image[] = [];
  private ppTexts: Phaser.GameObjects.BitmapText[] = [];
  private powerTexts: Phaser.GameObjects.BitmapText[] = [];
  private accuracyTexts: Phaser.GameObjects.BitmapText[] = [];
  private infoButtons: Phaser.GameObjects.Rectangle[] = [];
  private infoLabels: Phaser.GameObjects.BitmapText[] = [];
  private popup: InfoPopup;
  /** The laid-out slot rects, for hit testing until the next layout. */
  private cellRects: readonly MoveGridRect[] = [];
  /** The slots the last layout drew, so `isEmpty` can answer for any index. */
  private slots: readonly MoveGridSlot[] = [];

  constructor(scene: Phaser.Scene, container?: Phaser.GameObjects.Container) {
    this.cells = Array.from({ length: GRID_CELLS }, () =>
      scene.add
        .rectangle(0, 0, 10, 10, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setOrigin(0, 0)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
        .setVisible(false),
    );
    this.names = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false),
    );
    this.typeIcons = Array.from({ length: GRID_CELLS }, () =>
      scene.add.image(0, 0, TYPE_ICON_TEXTURE_KEY, 0).setOrigin(0, 0).setVisible(false),
    );
    this.categoryIcons = Array.from({ length: GRID_CELLS }, () =>
      scene.add.image(0, 0, MOVE_CATEGORY_TEXTURE_KEY, 0).setOrigin(0, 0).setVisible(false),
    );
    this.ppTexts = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, '', { size: 16, tint: FRLG_INK }).setVisible(false),
    );
    this.powerTexts = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }).setVisible(false),
    );
    this.accuracyTexts = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, '', { size: 16, tint: FRLG_INK, origin: [1, 0] }).setVisible(false),
    );
    this.infoButtons = Array.from({ length: GRID_CELLS }, () =>
      scene.add
        .rectangle(0, 0, INFO_SIZE, INFO_SIZE, FRLG_ROW_FILL.colour, FRLG_ROW_FILL.alpha)
        .setStrokeStyle(1, FRLG_ROW_STROKE.colour, FRLG_ROW_STROKE.alpha)
        .setVisible(false),
    );
    this.infoLabels = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, 'i', { size: 16, tint: FRLG_INK, origin: 0.5 }).setVisible(false),
    );

    const objects: Phaser.GameObjects.GameObject[] = [
      ...this.cells,
      ...this.names,
      ...this.typeIcons,
      ...this.categoryIcons,
      ...this.ppTexts,
      ...this.powerTexts,
      ...this.accuracyTexts,
      ...this.infoButtons,
      ...this.infoLabels,
    ];
    if (container) container.add(objects);
    // The popup is built last so it floats over the grid and the scene behind it.
    this.popup = new InfoPopup(scene, container);
  }

  /**
   * Lays out the grid inside the window rect, paints each slot and floats the info
   * popup for the asked cell. Slots beyond the list, and every piece with no data,
   * are hidden; an empty slot draws its container alone.
   */
  layout(options: MoveGridOptions): void {
    this.slots = options.cells;
    // One rect per drawn slot: every piece below is positioned from its own rect,
    // so a drawn slot and its hit rect can never diverge.
    this.cellRects = moveGridCellRects(options);
    const first = this.cellRects[0];
    const narrow = first !== undefined && first.w < CELL_NARROW;
    // The type badge matches the category badge in size, so the two read as one
    // stacked column; the name starts past it.
    const iconScale = narrow ? 1.25 : CATEGORY_ICON_SCALE;
    const iconW = Math.round(TYPE_ICON_W * iconScale);
    const count = this.cellRects.length;

    for (let i = 0; i < GRID_CELLS; i++) {
      if (i >= count) {
        this.hidePiece(i);
        continue;
      }
      const cell = options.cells[i];
      const rect = this.cellRects[i];
      if (isEmptySlot(cell)) {
        // An empty container is its rectangle and stroke, nothing else: it takes a
        // dropped move, but it has no name, no badge and no ⓘ to float from.
        const selected = i === options.selected;
        const tone = cellTone(selected, false);
        this.cells[i]
          .setPosition(rect.x, rect.y)
          .setSize(rect.w, rect.h)
          .setFillStyle(tone.fill, tone.fillAlpha)
          .setStrokeStyle(1, tone.stroke, tone.strokeAlpha)
          .setVisible(true);
        this.hideCellPieces(i);
        continue;
      }
      const alpha = cell.enabled ? 1 : 0.4;

      const nameX = rect.x + CELL_PAD + iconW + (narrow ? 2 : 6);
      const nameRight = rect.x + rect.w - CELL_PAD - INFO_SIZE - 6 - (narrow ? 0 : STAT_COL);
      this.names[i]
        .setText(cell.name)
        .setAlpha(alpha)
        .setFontSize(16)
        .setMaxWidth(Math.max(40, nameRight - nameX - 6))
        .setOrigin(0, 0)
        .setPosition(nameX, rect.y + CELL_TOP)
        .setVisible(true);

      const typeFrame = typeIconFrame(cell.type);
      if (typeFrame !== null) {
        this.typeIcons[i]
          .setFrame(typeFrame)
          .setAlpha(alpha)
          .setPosition(rect.x + CELL_PAD, rect.y + CELL_TOP + (narrow ? 1 : 0))
          .setScale(iconScale)
          .setVisible(true);
      } else {
        this.typeIcons[i].setVisible(false);
      }

      const categoryFrame = categoryIconFrame(cell.category);
      if (categoryFrame !== null) {
        this.categoryIcons[i]
          .setFrame(categoryFrame)
          .setAlpha(alpha)
          .setScale(iconScale)
          .setPosition(rect.x + CELL_PAD, rect.y + CELL_TOP + (narrow ? 20 : 22))
          .setVisible(true);
      } else {
        this.categoryIcons[i].setVisible(false);
      }

      const catW = MOVE_CATEGORY_ICON_W * iconScale;
      this.ppTexts[i]
        .setText(t('move.pp', { pp: cell.pp, max: cell.maxPp }))
        .setAlpha(alpha)
        .setPosition(rect.x + CELL_PAD + catW + 6, rect.y + CELL_TOP + (narrow ? 22 : 24))
        .setVisible(true);

      this.powerTexts[i]
        .setText(cell.basePower > 0 ? t('move.pwr', { value: cell.power }) : t('move.pwrNone'))
        .setTint(powerTint(cell))
        .setAlpha(alpha)
        .setOrigin(narrow ? 0 : 1, 0)
        .setPosition(
          narrow ? rect.x + CELL_PAD : rect.x + rect.w - CELL_PAD - INFO_SIZE - 6,
          narrow ? rect.y + CELL_TOP + 44 : rect.y + CELL_TOP,
        )
        .setVisible(true);

      this.accuracyTexts[i]
        .setText(accuracyLabel(cell))
        .setTint(accuracyTint(cell))
        .setAlpha(alpha)
        .setOrigin(1, 0)
        .setPosition(
          narrow ? rect.x + rect.w - CELL_PAD : rect.x + rect.w - CELL_PAD - INFO_SIZE - 6,
          narrow ? rect.y + CELL_TOP + 44 : rect.y + CELL_TOP + 22,
        )
        .setVisible(true);

      const buttonX = rect.x + rect.w - CELL_PAD - INFO_SIZE / 2;
      const buttonY = rect.y + CELL_TOP + INFO_SIZE / 2;
      const active = options.info === i;
      const buttonTone = cellTone(active, false);
      this.infoButtons[i]
        .setPosition(buttonX, buttonY)
        .setSize(INFO_SIZE, INFO_SIZE)
        .setFillStyle(buttonTone.fill, buttonTone.fillAlpha)
        .setStrokeStyle(1, buttonTone.stroke, buttonTone.strokeAlpha)
        .setAlpha(alpha)
        .setVisible(true);
      this.infoLabels[i].setPosition(buttonX, buttonY).setAlpha(alpha).setVisible(true);

      const selected = i === options.selected;
      // A disabled cell reads by shape as well as by luminance: it takes the muted
      // 1-px outline, so "cannot be picked" never rests on alpha alone.
      const marked = selected || !cell.enabled;
      const tone = cellTone(selected, marked);
      this.names[i].setTint(selected ? FRLG_ACCENT : FRLG_INK);
      this.cells[i]
        .setPosition(rect.x, rect.y)
        .setSize(rect.w, rect.h)
        .setFillStyle(tone.fill, tone.fillAlpha)
        .setStrokeStyle(1, tone.stroke, tone.strokeAlpha)
        .setVisible(true);
    }

    this.drawPopup(options);
  }

  /** Hides every piece: cells, badges, text, info buttons and the popup. */
  hide(): void {
    this.cellRects = [];
    this.slots = [];
    for (let i = 0; i < GRID_CELLS; i++) this.hidePiece(i);
    this.popup.hide();
  }

  /**
   * The index of the slot under a window-local point, or null outside one. An
   * empty container answers too: it is a drop target like any other slot.
   */
  indexAt(x: number, y: number): number | null {
    return moveGridIndexAt(this.cellRects, x, y);
  }

  /** The laid-out rect of a slot, in the coordinates the last `layout` used. */
  cellRect(index: number): MoveGridRect | null {
    return this.cellRects[index] ?? null;
  }

  /** True when a slot-local point falls inside that slot's ⓘ button. */
  infoAt(index: number, localX: number, localY: number): boolean {
    return moveGridInfoAt(this.slots[index], this.cellRects[index], localX, localY);
  }

  /** True when the last `layout` drew no move at `index`. */
  isEmpty(index: number): boolean {
    return isEmptySlot(this.slots[index]);
  }

  /** Hides everything a slot draws inside its rectangle, stroke excluded. */
  private hideCellPieces(i: number): void {
    this.names[i].setVisible(false);
    this.typeIcons[i].setVisible(false);
    this.categoryIcons[i].setVisible(false);
    this.ppTexts[i].setVisible(false);
    this.powerTexts[i].setVisible(false);
    this.accuracyTexts[i].setVisible(false);
    this.infoButtons[i].setVisible(false);
    this.infoLabels[i].setVisible(false);
  }

  private hidePiece(i: number): void {
    this.cells[i].setVisible(false);
    this.hideCellPieces(i);
  }

  /**
   * Floats the info popup for the asked cell through the shared `InfoPopup`,
   * above the anchor when there is room and below it otherwise. The anchor is the
   * hovered cell's top (HUD) or the whole window's (battle). An empty slot floats
   * nothing: there is no description to show.
   */
  private drawPopup(options: MoveGridOptions): void {
    const index = options.info;
    const cell = index === null ? undefined : options.cells[index];
    if (isEmptySlot(cell) || !cell || cell.desc.length === 0) {
      this.popup.hide();
      return;
    }
    const rect = options.popupAtCell === true && index !== null ? this.cellRects[index] : undefined;
    const anchorY = rect ? rect.y : options.y;
    const belowY = rect ? rect.y + rect.h + POPUP_GAP : options.y + options.h + POPUP_GAP;
    this.popup.show(
      {
        x: options.x,
        width: options.w,
        above: anchorY - POPUP_GAP,
        below: belowY,
      },
      moveInfoContent(cell),
    );
  }
}
