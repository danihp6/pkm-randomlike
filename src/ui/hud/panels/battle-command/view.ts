import { FRLG_WINDOW_PADDING } from '../../../frlg';
import {
  MOVE_GRID_INSET,
  battleMovesBox,
  compactCard,
  type Rect,
  type Viewport,
} from '../battle-moves/view';

export type { Rect, Viewport };

export type BattleCommandRowId = 'fight' | 'bag' | 'switch' | 'run';

/** One command the scene offers, in the order the canvas grid draws it. */
export type BattleCommandRow = Readonly<{
  id: BattleCommandRowId;
  /** Already localised (`t('battle.command.*')`): the view reads no i18n. */
  label: string;
  /** False draws it dimmed; a press still emits and the scene refuses it. */
  enabled: boolean;
}>;

export type BattleCommandInput = Readonly<{
  /** True while `mode === 'menu'` or `mode === 'partner'`. */
  open: boolean;
  /** The battle menu card in **page** coordinates: `battleMovesBox(viewport)`. */
  card: Rect;
  /** One entry per offered command: four for the lead, two for the partner. */
  rows: readonly BattleCommandRow[];
  /** `menuIndex`, clamped by the view. */
  selected: number;
}>;

export type BattleCommandRowView = Readonly<{
  id: BattleCommandRowId;
  label: string;
  enabled: boolean;
  selected: boolean;
  /** Page coordinates. */
  box: Rect;
}>;

export type BattleCommandView = Readonly<{
  open: boolean;
  /** True for the 236 px phone card (`compactCard`). */
  compact: boolean;
  card: Rect;
  rows: readonly BattleCommandRowView[];
}>;

/** The command window's own column count, `MENU_GRID_COLS` in the scene. */
const GRID_COLS = 2;
/** `MENU_GRID_GAP`: the one gutter between two cells and between two rows. */
const GRID_GAP = 8;

/** The page rect of the card the command window shares with the move menu. */
export function battleCommandBox(viewport: Viewport): Rect {
  return battleMovesBox(viewport);
}

/** A row index clamped into the list it belongs to; `NaN` lands on the first. */
function clampIndex(value: number, count: number): number {
  if (count === 0 || !Number.isFinite(value)) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(value)));
}

/**
 * The command window as plain data: the four cells this panel lays out inside the
 * battle menu card. The four take the card's whole two-column width, so the 62 px
 * column the moves menu keeps for MEGA and G-MAX is the grid's own here.
 * Pure and total: out-of-range indices clamp, an empty list answers no row, and the
 * same input always yields deep-equal output.
 */
export function battleCommandView(input: BattleCommandInput): BattleCommandView {
  const card = input.card;
  const pad = FRLG_WINDOW_PADDING;
  const count = input.rows.length;
  const rows = Math.max(1, Math.ceil(count / GRID_COLS));
  const left = card.x + pad.x + MOVE_GRID_INSET;
  const right = card.x + card.w - pad.x - MOVE_GRID_INSET;
  const top = card.y + pad.top + MOVE_GRID_INSET;
  const bottom = card.y + card.h - pad.bottom - MOVE_GRID_INSET;
  const cellW = (right - left - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS;
  const cellH = (bottom - top - (rows - 1) * GRID_GAP) / rows;
  const selected = clampIndex(input.selected, count);
  const views = input.rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    enabled: row.enabled,
    selected: index === selected,
    box: {
      x: left + (index % GRID_COLS) * (cellW + GRID_GAP),
      y: top + Math.floor(index / GRID_COLS) * (cellH + GRID_GAP),
      w: cellW,
      h: cellH,
    },
  }));
  return {
    open: input.open,
    compact: compactCard(card),
    card,
    rows: views,
  };
}
