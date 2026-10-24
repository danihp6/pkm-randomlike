/**
 * The mini-boss reward card's layout model (`D49`): the board's desktop card
 * (`03f`/`03g`) and its phone sheet (`m03f`/`m03g`), measured as data. The scene
 * module hands it the rows `rewardRows(items, pokemon)` already produced and the
 * arm the last press left; the panel paints exactly that. Pure and total: no
 * Phaser, no DOM, no run, no RNG, and the input is never written.
 *
 * The card is the board's three-row block — 560 × 342 on the desktop, a
 * 374 × 392 bottom sheet on the phone. A real card offers six rows, so the model
 * lays every row it is given at the board's own pitch and `rewardsRowBand` names
 * the band the panel clips and scrolls: the card never changes size with the
 * list, and no row is dropped or reordered.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** A CSS-ready atlas cell: `background-position: -x px -y px`. */
export type RewardsIcon = Readonly<{ url: string; size: number; x: number; y: number }>;

/** One row the card offers: an item or an unidentified Pokémon. */
export type RewardRowView = Readonly<{
  /** The row's index in `rewardRows` order (what a press sends back). */
  index: number;
  kind: 'item' | 'pokemon';
  /** The item's name, or the Pokémon's `STAT · Nature` label. */
  label: string;
  /** The item's short description; '' on a Pokémon row (it must leak nothing). */
  description: string;
  /** CSS atlas cell for an item icon; null on a Pokémon row. */
  icon: Readonly<{ url: string; size: number; x: number; y: number }> | null;
  /** The row armed by the last press and not yet committed. */
  armed: boolean;
  box: Rect; // panel-relative
}>;

export type RewardsInput = Readonly<{
  title: string;
  choose: string;
  rows: readonly RewardRowView[];
  armed: number; // -1 when nothing is armed
  open: boolean;
}>;

export type RewardsPanelView = Readonly<{
  open: boolean;
  box: Rect; // viewport coordinates, from rewardsPanelBox
  highlight: Rect; // the board's 1 px line 12 px inside the top edge
  title: Readonly<{ text: string; box: Rect }>;
  choose: Readonly<{ text: string; box: Rect }>;
  close: Readonly<{ label: string; box: Rect }>;
  rows: readonly RewardRowView[];
}>;

/** The two-step press, pure: what the card does to its own state on one press. */
export type RewardsAction = Readonly<{ armed: number; commit: number | null }>;

/** The board's desktop card (`03f`/`03g`): 560 × 342 at (360,196) on a 1280 × 800 stage. */
export const REWARDS_PANEL_W = 560;
export const REWARDS_PANEL_H = 342;
/** The board's phone sheet (`m03f`/`m03g`): 374 × 392 at (8,226) on a 390 × 844 stage. */
export const REWARDS_SHEET_W = 374;
export const REWARDS_SHEET_H = 392;
/** Below this width the phone sheet replaces the desktop card. */
export const REWARDS_NARROW = 600;
/** The card's own margin from the window edge, as `shopPanelBox` clamps it. */
export const REWARDS_MARGIN = 8;
/** The card's side padding: rows and copy start this far in. */
export const REWARDS_PAD_X = 20;
export const REWARDS_SHEET_PAD_X = 12;
/** The three row slots the board draws, at its pitch: `rowH + gap` apart. */
export const REWARDS_ROWS = 3;
export const REWARDS_ROW_H = 76;
export const REWARDS_SHEET_ROW_H = 64;
export const REWARDS_ROW_GAP = 8;
/** The first row's top edge, panel-relative. */
export const REWARDS_ROW_TOP = 78;
export const REWARDS_SHEET_ROW_TOP = 94;
/** The drawn ✕ and the copy boxes, exactly the board's own rects. */
export const REWARDS_CLOSE_SIZE = 24;
export const REWARDS_SHEET_CLOSE_SIZE = 14;
export const REWARDS_CLOSE_LABEL = '×';
export const REWARDS_TITLE: Rect = { x: 20, y: 16, w: 460, h: 30 };
export const REWARDS_CHOOSE: Rect = { x: 20, y: 44, w: 400, h: 20 };
export const REWARDS_SHEET_TITLE: Rect = { x: 12, y: 26, w: 234, h: 23 };
export const REWARDS_SHEET_CHOOSE: Rect = { x: 12, y: 56, w: 78, h: 12 };
/** The phone sheet's grab handle: 36 × 4, centred 12 px below its top edge. */
export const REWARDS_SHEET_HANDLE: Readonly<{ w: number; h: number; y: number }> = {
  w: 36,
  h: 4,
  y: 12,
};

/** The board seats its desktop card 33 px above the exact centre of the stage. */
const REWARDS_CARD_LIFT = 33;
/** The stage an unmeasurable viewport is laid out as (the board's own desktop frame). */
const REWARDS_STAGE: Viewport = { width: 1280, height: 800 };
/** The 1 px highlight sits this far inside the card's top and side edges. */
const REWARDS_HIGHLIGHT_INSET = 12;
/** The ✕ keeps its top edge 10 px inside the card and 32 px inside the sheet. */
const REWARDS_CLOSE_TOP = 10;
const REWARDS_SHEET_CLOSE_TOP = 32;

function finiteInt(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** A measured viewport, or the board's own stage when the scene has no size yet. */
function stageOf(viewport: Viewport): Viewport {
  const width =
    Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : REWARDS_STAGE.width;
  const height =
    Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : REWARDS_STAGE.height;
  return { width, height };
}

/**
 * The card's rect, from the board's own stage plus the HUD's edge clamp: the sheet
 * on a phone, the desktop card above `REWARDS_NARROW`, and both giving way to the
 * 8 px margin before they ever overflow the window.
 */
export function rewardsPanelBox(viewport: Viewport): Rect {
  const stage = stageOf(viewport);
  const sheet = stage.width < REWARDS_NARROW;
  const w = Math.min(
    sheet ? REWARDS_SHEET_W : REWARDS_PANEL_W,
    Math.max(160, stage.width - REWARDS_MARGIN * 2),
  );
  const h = Math.min(
    sheet ? REWARDS_SHEET_H : REWARDS_PANEL_H,
    Math.max(200, stage.height - REWARDS_MARGIN * 2),
  );
  const maxX = Math.max(REWARDS_MARGIN, stage.width - w - REWARDS_MARGIN);
  const maxY = Math.max(REWARDS_MARGIN, stage.height - h - REWARDS_MARGIN);
  const x = clamp((stage.width - w) / 2, REWARDS_MARGIN, maxX);
  const centred = clamp((stage.height - h) / 2, REWARDS_MARGIN, maxY);
  const y = sheet ? centred : clamp(centred - REWARDS_CARD_LIFT, REWARDS_MARGIN, maxY);
  return { x, y, w, h };
}

/** True when the card is the phone sheet, whose geometry differs from the desktop card. */
export function rewardsNarrow(box: Rect): boolean {
  return box.w < REWARDS_PANEL_W;
}

function rowHeight(box: Rect): number {
  return rewardsNarrow(box) ? REWARDS_SHEET_ROW_H : REWARDS_ROW_H;
}

function rowTop(box: Rect): number {
  return rewardsNarrow(box) ? REWARDS_SHEET_ROW_TOP : REWARDS_ROW_TOP;
}

function padXOf(box: Rect): number {
  return rewardsNarrow(box) ? REWARDS_SHEET_PAD_X : REWARDS_PAD_X;
}

/**
 * The band the panel paints its rows in: the board's three slots, which is what a
 * six-row card clips and scrolls inside.
 */
export function rewardsRowBand(view: RewardsPanelView): Rect {
  const padX = padXOf(view.box);
  return {
    x: padX,
    y: rowTop(view.box),
    w: view.box.w - padX * 2,
    h: REWARDS_ROWS * (rowHeight(view.box) + REWARDS_ROW_GAP) - REWARDS_ROW_GAP,
  };
}

/**
 * The card as data. The rows keep the order and the indices they arrive with; a
 * Pokémon row prints only its label — never an icon, a name or a description — so
 * an unidentified option cannot leak. `armed` is a row index, clamped into the
 * rows on offer, and `-1` marks nothing.
 */
export function rewardsPanelView(input: RewardsInput, viewport: Viewport): RewardsPanelView {
  const box = rewardsPanelBox(viewport);
  const narrow = rewardsNarrow(box);
  const padX = padXOf(box);
  const height = rowHeight(box);
  const top = rowTop(box);
  const pitch = height + REWARDS_ROW_GAP;
  const title = narrow ? REWARDS_SHEET_TITLE : REWARDS_TITLE;
  const choose = narrow ? REWARDS_SHEET_CHOOSE : REWARDS_CHOOSE;
  const closeSize = narrow ? REWARDS_SHEET_CLOSE_SIZE : REWARDS_CLOSE_SIZE;
  const closeTop = narrow ? REWARDS_SHEET_CLOSE_TOP : REWARDS_CLOSE_TOP;
  const total = input.rows.length;
  const armed = total === 0 ? -1 : clamp(finiteInt(input.armed, -1), -1, total - 1);

  const rows: RewardRowView[] = input.rows.map((row, i) => {
    const pokemon = row.kind === 'pokemon';
    return {
      index: row.index,
      kind: row.kind,
      label: row.label,
      description: pokemon ? '' : row.description,
      icon: pokemon ? null : row.icon,
      armed: row.index === armed,
      box: { x: padX, y: top + i * pitch, w: box.w - padX * 2, h: height },
    };
  });

  return {
    open: input.open,
    box,
    highlight: {
      x: REWARDS_HIGHLIGHT_INSET,
      y: REWARDS_HIGHLIGHT_INSET,
      w: box.w - REWARDS_HIGHLIGHT_INSET * 2,
      h: 1,
    },
    title: { text: input.title, box: title },
    choose: { text: input.choose, box: choose },
    close: {
      label: REWARDS_CLOSE_LABEL,
      box: { x: box.w - padX - closeSize, y: closeTop, w: closeSize, h: closeSize },
    },
    rows,
  };
}

/**
 * A press on row `index` while `armed` is the current arm. Pressing another row
 * arms it and commits nothing (`{ armed: index, commit: null }`); pressing the
 * armed row again commits exactly it (`{ armed, commit: index }`). Out-of-range
 * input never arms and never commits.
 */
export function rewardsPress(armed: number, index: number, count: number): RewardsAction {
  const total = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  if (total === 0) return { armed: -1, commit: null };
  const current = clamp(finiteInt(armed, -1), -1, total - 1);
  if (!Number.isFinite(index)) return { armed: current, commit: null };
  const target = Math.trunc(index);
  if (target < 0 || target >= total) return { armed: current, commit: null };
  if (target === current) return { armed: current, commit: target };
  return { armed: target, commit: null };
}
