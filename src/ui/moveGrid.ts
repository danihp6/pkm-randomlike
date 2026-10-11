import type Phaser from 'phaser';
import { addFrlgText, FRLG_FONT_SIZE, FRLG_INK } from './frlgFont';
import { addFrlgWindow, FRLG_WINDOW_PADDING } from './frlg';
import { typeColor, typeTint } from './typeColors';
import { TYPE_ICON_TEXTURE_KEY, TYPE_ICON_W, typeIconFrame } from '../data/typeIcons';
import { MOVE_CATEGORY_ICON_W, MOVE_CATEGORY_TEXTURE_KEY, categoryIconFrame } from '../data/moveCategoryIcons';
import { STATUS_ICON_TEXTURE_KEY, statusIconFrame } from '../data/statusIcons';

/**
 * The shared moves grid + floating info popup. The battle's FIGHT menu and the
 * route HUD's detail panel both draw the same component, so a move cell looks and
 * reads identically in both: a type-tinted cell with the type badge, category
 * badge, PP and power/accuracy, an ⓘ button, and a description window that floats
 * over the scene while the button is asked for.
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

/** The window rect to fill and the cells to draw; the rest has sane defaults. */
export type MoveGridOptions = Readonly<{
  x: number;
  y: number;
  w: number;
  h: number;
  cells: readonly MoveGridCell[];
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

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

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
/** The move description popup that floats over the scene on demand. */
const POPUP_MIN_H = 56;
const POPUP_GAP = 8;
/** The popup's left column: the type badge and, under it, the status badge. */
const POPUP_ICON_COL = 44;
/** The category badge is 32x14; 1.5x reads clearly beside the 16px cell text. */
const CATEGORY_ICON_SCALE = 1.5;

/** Green when a stat line reads above its base, red when below, ink when level. */
const STAT_UP = 0x1b7a3d;
const STAT_DOWN = 0xb3261e;

/** The power line's colour: green raised above its base, red lowered, else ink. */
function powerTint(cell: MoveGridCell): number {
  if (cell.power > cell.basePower) return STAT_UP;
  if (cell.power < cell.basePower) return STAT_DOWN;
  return FRLG_INK;
}

/** `ACC 100`, with an ↑ / ↓ when stages or abilities moved the hit chance. */
function accuracyLabel(cell: MoveGridCell): string {
  if (cell.baseAccuracy === null || cell.accuracy === null) return 'ACC --';
  const arrow =
    cell.accuracy > cell.baseAccuracy ? ' \u2191' : cell.accuracy < cell.baseAccuracy ? ' \u2193' : '';
  return `ACC ${cell.accuracy}${arrow}`;
}

/** Green for a raised hit chance, red for a lowered one, ink when unchanged. */
function accuracyTint(cell: MoveGridCell): number {
  if (cell.baseAccuracy === null || cell.accuracy === null) return FRLG_INK;
  if (cell.accuracy > cell.baseAccuracy) return STAT_UP;
  if (cell.accuracy < cell.baseAccuracy) return STAT_DOWN;
  return FRLG_INK;
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
  private popup: Phaser.GameObjects.NineSlice;
  private popupType: Phaser.GameObjects.Rectangle;
  private popupTypeText: Phaser.GameObjects.BitmapText;
  private popupTypeIcon: Phaser.GameObjects.Image;
  private popupStatusIcon: Phaser.GameObjects.Image;
  private popupText: Phaser.GameObjects.BitmapText;
  /** The laid-out cell rects, for hit testing until the next layout. */
  private cellRects: Rect[] = [];

  constructor(scene: Phaser.Scene, container?: Phaser.GameObjects.Container) {
    this.cells = Array.from({ length: GRID_CELLS }, () =>
      scene.add
        .rectangle(0, 0, 10, 10, 0xe6e3f2)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xb9b4d0)
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
        .rectangle(0, 0, INFO_SIZE, INFO_SIZE, 0xcfcce2)
        .setStrokeStyle(2, 0x9a94b8)
        .setVisible(false),
    );
    this.infoLabels = Array.from({ length: GRID_CELLS }, () =>
      addFrlgText(scene, 0, 0, 'i', { size: 16, tint: FRLG_INK, origin: 0.5 }).setVisible(false),
    );
    // The popup is built last so it floats over the grid and the scene behind it.
    this.popup = addFrlgWindow(scene, 0, 0, 300, POPUP_MIN_H).setVisible(false);
    this.popupType = scene.add
      .rectangle(0, 0, TYPE_ICON_W, 14, 0x9aa0b4)
      .setOrigin(0, 0)
      .setVisible(false);
    this.popupTypeText = addFrlgText(scene, 0, 0, '', {
      size: 16,
      tint: 0xf8fafc,
      origin: [0.5, 0],
    }).setVisible(false);
    this.popupTypeIcon = scene.add
      .image(0, 0, TYPE_ICON_TEXTURE_KEY, 0)
      .setOrigin(0, 0)
      .setVisible(false);
    this.popupStatusIcon = scene.add
      .image(0, 0, STATUS_ICON_TEXTURE_KEY, 0)
      .setOrigin(0, 0)
      .setVisible(false);
    this.popupText = addFrlgText(scene, 0, 0, '', { tint: FRLG_INK, lineSpacing: 4 }).setVisible(false);

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
      this.popup,
      this.popupType,
      this.popupTypeText,
      this.popupTypeIcon,
      this.popupStatusIcon,
      this.popupText,
    ];
    if (container) container.add(objects);
  }

  /**
   * Lays out the grid inside the window rect, paints each cell and floats the info
   * popup for the asked cell. Cells beyond the list, and every piece with no data,
   * are hidden.
   */
  layout(options: MoveGridOptions): void {
    const cols = options.columns ?? GRID_COLS;
    const gap = options.gap ?? GRID_GAP;
    const inset = options.inset ?? GRID_INSET;
    const leftReserve = options.leftReserve ?? 0;
    const rightReserve = options.rightReserve ?? 0;
    const pad = FRLG_WINDOW_PADDING;
    const rows = Math.ceil(GRID_CELLS / cols);
    const left = options.x + pad.x;
    const right = options.x + options.w - pad.x - inset;
    const top = options.y + pad.top + inset;
    const bottom = options.y + options.h - pad.bottom - inset;
    const gridLeft = left + leftReserve;
    const gridRight = right - rightReserve;
    const cellW = (gridRight - gridLeft - (cols - 1) * gap) / cols;
    const cellH = (bottom - top - (rows - 1) * gap) / rows;
    const narrow = cellW < CELL_NARROW;
    const cellX = (i: number): number => gridLeft + (i % cols) * (cellW + gap);
    const cellY = (i: number): number => top + Math.floor(i / cols) * (cellH + gap);
    // The type badge matches the category badge in size, so the two read as one
    // stacked column; the name starts past it.
    const iconScale = narrow ? 1.25 : CATEGORY_ICON_SCALE;
    const iconW = Math.round(TYPE_ICON_W * iconScale);
    const count = options.cells.length;
    this.cellRects = [];

    for (let i = 0; i < GRID_CELLS; i++) {
      const cell = i < count ? options.cells[i] : undefined;
      const visible = cell !== undefined;
      const alpha = cell && cell.enabled ? 1 : 0.4;
      if (!cell) {
        this.hidePiece(i);
        continue;
      }
      this.cellRects.push({ x: cellX(i), y: cellY(i), w: cellW, h: cellH });

      const nameX = cellX(i) + CELL_PAD + iconW + (narrow ? 2 : 6);
      const nameRight = cellX(i) + cellW - CELL_PAD - INFO_SIZE - 6 - (narrow ? 0 : STAT_COL);
      this.names[i]
        .setText(cell.name)
        .setAlpha(alpha)
        .setFontSize(16)
        .setMaxWidth(Math.max(40, nameRight - nameX - 6))
        .setOrigin(0, 0)
        .setPosition(nameX, cellY(i) + CELL_TOP)
        .setVisible(true);

      const typeFrame = typeIconFrame(cell.type);
      if (typeFrame !== null) {
        this.typeIcons[i]
          .setFrame(typeFrame)
          .setAlpha(alpha)
          .setPosition(cellX(i) + CELL_PAD, cellY(i) + CELL_TOP + (narrow ? 1 : 0))
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
          .setPosition(cellX(i) + CELL_PAD, cellY(i) + CELL_TOP + (narrow ? 20 : 22))
          .setVisible(true);
      } else {
        this.categoryIcons[i].setVisible(false);
      }

      const catW = MOVE_CATEGORY_ICON_W * iconScale;
      this.ppTexts[i]
        .setText(`PP ${cell.pp}/${cell.maxPp}`)
        .setAlpha(alpha)
        .setPosition(cellX(i) + CELL_PAD + catW + 6, cellY(i) + CELL_TOP + (narrow ? 22 : 24))
        .setVisible(true);

      this.powerTexts[i]
        .setText(cell.basePower > 0 ? `PWR ${cell.power}` : 'PWR --')
        .setTint(powerTint(cell))
        .setAlpha(alpha)
        .setOrigin(narrow ? 0 : 1, 0)
        .setPosition(
          narrow ? cellX(i) + CELL_PAD : cellX(i) + cellW - CELL_PAD - INFO_SIZE - 6,
          narrow ? cellY(i) + CELL_TOP + 44 : cellY(i) + CELL_TOP,
        )
        .setVisible(true);

      this.accuracyTexts[i]
        .setText(accuracyLabel(cell))
        .setTint(accuracyTint(cell))
        .setAlpha(alpha)
        .setOrigin(1, 0)
        .setPosition(
          narrow ? cellX(i) + cellW - CELL_PAD : cellX(i) + cellW - CELL_PAD - INFO_SIZE - 6,
          narrow ? cellY(i) + CELL_TOP + 44 : cellY(i) + CELL_TOP + 22,
        )
        .setVisible(true);

      const buttonX = cellX(i) + cellW - CELL_PAD - INFO_SIZE / 2;
      const buttonY = cellY(i) + CELL_TOP + INFO_SIZE / 2;
      const active = options.info === i;
      this.infoButtons[i]
        .setPosition(buttonX, buttonY)
        .setSize(INFO_SIZE, INFO_SIZE)
        .setFillStyle(active ? 0xf7e0a6 : 0xcfcce2)
        .setStrokeStyle(2, active ? 0x2f2c4d : 0x9a94b8)
        .setAlpha(alpha)
        .setVisible(true);
      this.infoLabels[i].setPosition(buttonX, buttonY).setAlpha(alpha).setVisible(true);

      const selected = i === options.selected;
      this.cells[i]
        .setPosition(cellX(i), cellY(i))
        .setSize(cellW, cellH)
        .setFillStyle(typeTint(cell.type, selected ? 0.35 : 0.72))
        .setStrokeStyle(selected ? 3 : 2, selected ? 0x2f2c4d : 0x9a94b8)
        .setVisible(visible);
    }

    this.drawPopup(options);
  }

  /** Hides every piece: cells, badges, text, info buttons and the popup. */
  hide(): void {
    this.cellRects = [];
    for (let i = 0; i < GRID_CELLS; i++) this.hidePiece(i);
    this.hidePopup();
  }

  /** The index of the cell under a window-local point, or null outside one. */
  indexAt(x: number, y: number): number | null {
    for (let i = 0; i < this.cellRects.length; i++) {
      const rect = this.cellRects[i];
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return i;
    }
    return null;
  }

  /** The laid-out rect of a cell, in the coordinates the last `layout` used. */
  cellRect(index: number): Rect | null {
    return this.cellRects[index] ?? null;
  }

  /** True when a cell-local point falls inside that cell's ⓘ button. */
  infoAt(index: number, localX: number, localY: number): boolean {
    const rect = this.cellRects[index];
    if (!rect) return false;
    const bx = rect.w - CELL_PAD - INFO_SIZE;
    const by = CELL_TOP;
    return localX >= bx && localX <= bx + INFO_SIZE && localY >= by && localY <= by + INFO_SIZE;
  }

  /** The ⓘ button rect of a cell, relative to the cell's top-left, or null. */
  infoRect(index: number): Rect | null {
    if (!this.cellRects[index]) return null;
    return { x: this.cellRects[index].w - CELL_PAD - INFO_SIZE, y: CELL_TOP, w: INFO_SIZE, h: INFO_SIZE };
  }

  private hidePiece(i: number): void {
    this.cells[i].setVisible(false);
    this.names[i].setVisible(false);
    this.typeIcons[i].setVisible(false);
    this.categoryIcons[i].setVisible(false);
    this.ppTexts[i].setVisible(false);
    this.powerTexts[i].setVisible(false);
    this.accuracyTexts[i].setVisible(false);
    this.infoButtons[i].setVisible(false);
    this.infoLabels[i].setVisible(false);
  }

  /** The popup's description font: large on a full-width menu, small on a phone. */
  private popupFontSize(width: number): number {
    return width >= 500 ? FRLG_FONT_SIZE : 16;
  }

  /** The popup height, measured from the revealed move's wrapped description. */
  private popupHeight(cell: MoveGridCell, width: number): number {
    const pad = FRLG_WINDOW_PADDING;
    this.popupText
      .setFontSize(this.popupFontSize(width))
      .setText(cell.desc)
      .setMaxWidth(width - pad.x * 2 - POPUP_ICON_COL - 12);
    return Math.max(POPUP_MIN_H, pad.top + Math.max(24, this.popupText.height) + pad.bottom);
  }

  /** Floats the info popup over the grid, above it when there is room, else below. */
  private drawPopup(options: MoveGridOptions): void {
    const index = options.info;
    const cell = index === null ? undefined : options.cells[index];
    if (!cell || cell.desc.length === 0) {
      this.hidePopup();
      return;
    }
    const pad = FRLG_WINDOW_PADDING;
    const size = this.popupFontSize(options.w);
    const height = this.popupHeight(cell, options.w);
    // Over the hovered cell (HUD) or above the whole window (battle).
    const rect = index !== null ? this.cellRects[index] : undefined;
    const anchorY = options.popupAtCell === true && rect ? rect.y : options.y;
    const belowY =
      options.popupAtCell === true && rect ? rect.y + rect.h + POPUP_GAP : options.y + options.h + POPUP_GAP;
    const above = anchorY - height - POPUP_GAP;
    const x = options.x;
    const y = above >= 0 ? above : belowY;
    const iconY = y + pad.top;
    this.popup.setSlices(options.w, height).setPosition(x, y).setVisible(true);

    const typeFrame = typeIconFrame(cell.type);
    if (typeFrame !== null) {
      this.popupTypeIcon.setFrame(typeFrame).setPosition(x + pad.x, iconY).setVisible(true);
      this.popupType.setVisible(false);
      this.popupTypeText.setVisible(false);
    } else {
      // The FRLG sheet predates Fairy; keep the text chip as the fallback.
      this.popupTypeIcon.setVisible(false);
      this.popupType
        .setPosition(x + pad.x, iconY)
        .setSize(TYPE_ICON_W, 14)
        .setFillStyle(typeColor(cell.type))
        .setVisible(true);
      this.popupTypeText
        .setText(cell.type.toUpperCase())
        .setPosition(x + pad.x + TYPE_ICON_W / 2, iconY + 2)
        .setVisible(true);
    }

    const statusFrame = cell.status ? statusIconFrame(cell.status) : null;
    if (statusFrame !== null) {
      this.popupStatusIcon.setFrame(statusFrame).setPosition(x + pad.x, iconY + 20).setVisible(true);
    } else {
      this.popupStatusIcon.setVisible(false);
    }

    this.popupText
      .setText(cell.desc)
      .setFontSize(size)
      .setMaxWidth(options.w - pad.x * 2 - POPUP_ICON_COL - 12)
      .setPosition(x + pad.x + POPUP_ICON_COL, iconY + Math.max(0, (24 - size) / 2))
      .setVisible(true);
  }

  private hidePopup(): void {
    this.popup.setVisible(false);
    this.popupText.setVisible(false);
    this.popupType.setVisible(false);
    this.popupTypeText.setVisible(false);
    this.popupTypeIcon.setVisible(false);
    this.popupStatusIcon.setVisible(false);
  }
}
