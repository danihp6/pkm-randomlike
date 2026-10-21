import { MAX_PARTY_SIZE } from '../engine/run/state';
import { PORTRAIT_SIZE } from '../data/portraits';
import { FRLG_HPBAR } from './frlg';
import { FRLG_FONT_SIZE, frlgFontData } from './frlgFont';

/**
 * The pure geometry of the battle's SWITCH grid: one row per party member, in a
 * single column, every row the same size whether the party holds two Pokémon or
 * six. The panel keeps its shape and each row is exactly a sixth of the window's
 * content height, so the row's contents (portrait, name and HP bar) scale down
 * into the row instead of the row growing around them — a short party leaves the
 * lower sixths empty rather than stretching its cells. It carries no Phaser
 * import, so the arithmetic and the label truncation are unit-testable headless;
 * `BattleScene` only draws what it returns.
 */

export type PartyGridRect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** The content insets of the window the grid is drawn in. */
export type PartyGridPadding = Readonly<{ x: number; top: number; bottom: number }>;

export interface PartyGridOptions {
  /** The panel's content insets — pass `FRLG_WINDOW_PADDING`. Required: no default. */
  readonly padding: PartyGridPadding;
  /** How many rows the grid always lays out. Default `MAX_PARTY_SIZE` (6). */
  readonly rows?: number;
  /** The vertical gap between rows. Default 8 (`MENU_GRID_GAP`). */
  readonly gap?: number;
  /** The column reserved at the left for the ◀ back control. Default 64 (`MOVE_BACK_COL`). */
  readonly backColumn?: number;
  /** The inset the grid keeps from the window's content box. Default 8 (`MOVE_GRID_INSET`). */
  readonly inset?: number;
  /** The largest avatar scale allowed. Default 0.9 (`PARTY_AVATAR_SCALE`). */
  readonly avatarScaleCap?: number;
  /** The largest HP-bar scale allowed. Default 0.4 (`PARTY_CELL_HPBAR_SCALE`). */
  readonly hpBarScaleCap?: number;
  /** The HP bar texture's own width. Default 268 (`FRLG_HPBAR.width`). */
  readonly hpBarWidth?: number;
  /** The HP bar texture's own height. Default 28 (`FRLG_HPBAR.height`). */
  readonly hpBarHeight?: number;
}

export interface PartyGridMetrics {
  /** One rect per row, always `rows` long — index 0 is the lead, top to bottom. */
  readonly rects: readonly PartyGridRect[];
  readonly rowW: number;
  readonly rowH: number;
  /** The portrait scale for this row height. */
  readonly avatarScale: number;
  /** The HP-bar scale for this row height. */
  readonly hpBarScale: number;
  /** The width a row's label may occupy before it is truncated. */
  readonly labelMaxWidth: number;
}

/** The vertical gap between rows, as the command and moves grids use. */
const DEFAULT_GAP = 8;
/** The column reserved at the left of the grid for the ◀ back control. */
const DEFAULT_BACK_COLUMN = 64;
/** The inset the grid keeps from the window's content box. */
const DEFAULT_INSET = 8;
const DEFAULT_AVATAR_SCALE_CAP = 0.9;
const DEFAULT_HPBAR_SCALE_CAP = 0.4;

/** The lead, avatar gap and trail the label's own width is measured around. */
const ROW_LEAD = 8;
const AVATAR_LABEL_GAP = 6;
const ROW_TRAIL = 8;
/** The clearance the row's contents keep from the row's top and bottom edges. */
const ROW_CONTENT_CLEARANCE = 4;
/** The narrowest a truncated label may become before it reads as no name at all. */
const MIN_LABEL_WIDTH = 24;
const ELLIPSIS = '...';

const FONT = frlgFontData();

function glyphAdvance(code: number, scale: number): number {
  const glyph = FONT.chars[code];
  return glyph ? glyph.xAdvance * scale : 0;
}

function textWidth(text: string, size: number): number {
  const scale = size / FRLG_FONT_SIZE;
  let width = 0;
  for (const char of text) width += glyphAdvance(char.codePointAt(0) ?? 0, scale);
  return width;
}

/**
 * The party rows a battle marks as **on the field**, in slot order: slot 0's party
 * index first and slot 1's second, skipping `-1` and duplicates. A single battle
 * answers `[activeIndex]`; an empty side answers `[]`. Those rows are exactly the
 * ones `switchablePartyIndices` already refuses, so the scene marks the party
 * members the player cannot switch to.
 */
export function partyGridFieldRows(activeIndex: number, secondActiveIndex: number): readonly number[] {
  const rows: number[] = [];
  for (const index of [activeIndex, secondActiveIndex]) {
    if (index < 0 || rows.includes(index)) continue;
    rows.push(index);
  }
  return rows;
}

/**
 * The row rects of the SWITCH grid for the window `menu`. The grid is always
 * `rows` rows of one column at a fixed cell size — never sized from a member
 * count — so the caller draws only the members it has and leaves the rest empty.
 */
export function partyGridLayout(menu: PartyGridRect, options: PartyGridOptions): PartyGridMetrics {
  const { padding } = options;
  const rows = options.rows ?? MAX_PARTY_SIZE;
  const gap = options.gap ?? DEFAULT_GAP;
  const backColumn = options.backColumn ?? DEFAULT_BACK_COLUMN;
  const inset = options.inset ?? DEFAULT_INSET;
  const avatarScaleCap = options.avatarScaleCap ?? DEFAULT_AVATAR_SCALE_CAP;
  const hpBarScaleCap = options.hpBarScaleCap ?? DEFAULT_HPBAR_SCALE_CAP;
  const hpBarWidth = options.hpBarWidth ?? FRLG_HPBAR.width;
  const hpBarHeight = options.hpBarHeight ?? FRLG_HPBAR.height;

  const contentLeft = menu.x + padding.x;
  const contentRight = menu.x + menu.w - padding.x - inset;
  const contentTop = menu.y + padding.top + inset;
  const contentBottom = menu.y + menu.h - padding.bottom - inset;

  const rowX = contentLeft + backColumn;
  const rowW = contentRight - rowX;
  const rowH = (contentBottom - contentTop - (rows - 1) * gap) / rows;

  const rects: PartyGridRect[] = [];
  for (let i = 0; i < rows; i++) {
    rects.push({ x: rowX, y: contentTop + i * (rowH + gap), w: rowW, h: rowH });
  }

  const avatarScale = Math.min(
    avatarScaleCap,
    Math.max(0, (rowH - ROW_CONTENT_CLEARANCE) / PORTRAIT_SIZE),
  );
  const hpBarScale = Math.min(hpBarScaleCap, Math.max(0, (rowH - ROW_CONTENT_CLEARANCE) / hpBarHeight));
  const labelMaxWidth = Math.max(
    MIN_LABEL_WIDTH,
    rowW -
      ROW_LEAD -
      PORTRAIT_SIZE * avatarScale -
      AVATAR_LABEL_GAP -
      hpBarWidth * hpBarScale -
      ROW_TRAIL,
  );

  return { rects, rowW, rowH, avatarScale, hpBarScale, labelMaxWidth };
}

/**
 * The widest prefix of `text` that fits `maxWidth` at font `size`, with `...`
 * appended when it had to cut. Measured on the shipped bitmap font's advances,
 * so a long nickname is truncated on one line and never wraps or stretches the
 * row it is drawn in.
 */
export function fitPartyLabel(text: string, maxWidth: number, size: number): string {
  if (textWidth(text, size) <= maxWidth) return text;

  const ellipsisWidth = textWidth(ELLIPSIS, size);
  if (ellipsisWidth > maxWidth) return ELLIPSIS;

  const scale = size / FRLG_FONT_SIZE;
  const chars = Array.from(text);
  let width = 0;
  let cut = 0;
  for (let i = 0; i < chars.length; i++) {
    const next = width + glyphAdvance(chars[i].codePointAt(0) ?? 0, scale);
    if (next + ellipsisWidth > maxWidth) break;
    width = next;
    cut = i + 1;
  }
  return `${chars.slice(0, cut).join('')}${ELLIPSIS}`;
}
