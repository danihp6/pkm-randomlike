import { t } from '../../../../i18n';

/**
 * The pause card's layout model (`D49`): the board's centred `03n` card, measured
 * as data. The scene module hands it its own three values — open, the selected row
 * and whether Reset is armed — and the panel paints exactly that. Pure and total:
 * no Phaser, no DOM, no run, no RNG, and the input is never written.
 *
 * The card is the board's 360 px card with the game's **two** rows, not the
 * board's four, so its height is the board's own formula `88 + 56 × rows` — 200 —
 * while the title, divider and first row keep the frame's card-relative offsets.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** The board's four rows are CONTINUE/OPTIONS/NEW RUN/EXIT; the game ships two. */
export type PauseRowId = 'settings' | 'reset';

export type PauseRowView = Readonly<{
  id: PauseRowId;
  /** The row's index in `PAUSE_ROW_IDS` order; what a press sends back. */
  index: number;
  /** `t('pause.settings')`, or `t('pause.resetArmed')` while Reset is armed. */
  label: string;
  selected: boolean;
  /** True only on the Reset row, and only after the first press. */
  armed: boolean;
  /** The row's own box, **card-relative**. */
  box: Rect;
  /** The label's box, **card-relative** (the board's 16 px line box). */
  labelBox: Rect;
}>;

export type PausePanelView = Readonly<{
  /** True while the menu is up. A closed card is `hidden` in the tree, not absent. */
  open: boolean;
  /** The full-stage scrim, **viewport** coordinates. */
  scrim: Rect;
  /** The card itself, **viewport** coordinates. */
  box: Rect;
  /** The 1 px line 12 px inside the card's top edge, card-relative. */
  highlight: Rect;
  /** The 1 px rule under the title, card-relative. */
  divider: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  /** Always exactly two rows, `[settings, reset]`, in this order. */
  rows: readonly PauseRowView[];
}>;

/** What the scene hands the live model: its own state, never a run or a battle. */
export type PauseInput = Readonly<{
  open: boolean;
  /** The cursor's row; clamped into `0…1` (a non-finite value lands on 0). */
  selected: number;
  /** True when `Reset run` was pressed once and awaits its second press. */
  armed: boolean;
}>;

/** The slug this task's fixture, its frame and `?hudFixture=` answer to. */
export const PAUSE_SLUG = '03n-panels-pause-menu';
export const PAUSE_ROW_IDS: readonly PauseRowId[] = ['settings', 'reset'];

/* The board's measured desktop card at 1280 × 800 (`design/frames/03n-panels-pause-menu.json`). */
export const PAUSE_CARD_W = 360;
export const PAUSE_CARD_H = 200; // 88 + PAUSE_ROW_PITCH × 2, the frame's own formula
export const PAUSE_CARD_RADIUS = 11;
export const PAUSE_MARGIN = 8; // the edge clamp, like REWARDS_MARGIN
export const PAUSE_HIGHLIGHT_INSET = 12; // the 1 px line
export const PAUSE_DIVIDER_TOP = 60; // card-relative, 1 px high
export const PAUSE_ROW_TOP = 76; // the first row's top, card-relative
export const PAUSE_ROW_H = 48;
export const PAUSE_ROW_PITCH = 56;
export const PAUSE_ROW_INSET = 24; // the card's side padding: 460 + 24 = 484

export const PAUSE_TITLE: Rect = { x: 24, y: 20, w: 200, h: 30 };
export const PAUSE_LABEL_INSET: Readonly<{ x: number; y: number; h: number }> = {
  x: 20,
  y: 17,
  h: 16,
};

const PAUSE_LABEL_KEYS: Readonly<Record<PauseRowId, 'pause.settings' | 'pause.reset'>> = {
  settings: 'pause.settings',
  reset: 'pause.reset',
};

/** The stage an unmeasurable viewport is laid out as (the board's own desktop frame). */
const PAUSE_STAGE: Viewport = { width: 1280, height: 800 };

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** The cursor's row: `trunc` then clamped into the two rows; a non-finite value lands on 0. */
function clampRow(selected: number): number {
  if (!Number.isFinite(selected)) return 0;
  return clamp(Math.trunc(selected), 0, PAUSE_ROW_IDS.length - 1);
}

/** A measured viewport, or the board's own stage when the scene has no size yet. */
function stageOf(viewport: Viewport): Viewport {
  const width =
    Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : PAUSE_STAGE.width;
  const height =
    Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : PAUSE_STAGE.height;
  return { width, height };
}

/** The card's rect from the viewport: centred, held `PAUSE_MARGIN` off every edge. */
export function pausePanelBox(viewport: Viewport): Rect {
  const stage = stageOf(viewport);
  const w = Math.min(PAUSE_CARD_W, Math.max(160, stage.width - PAUSE_MARGIN * 2));
  const h = Math.min(PAUSE_CARD_H, Math.max(120, stage.height - PAUSE_MARGIN * 2));
  const maxX = Math.max(PAUSE_MARGIN, stage.width - w - PAUSE_MARGIN);
  const maxY = Math.max(PAUSE_MARGIN, stage.height - h - PAUSE_MARGIN);
  return {
    x: clamp((stage.width - w) / 2, PAUSE_MARGIN, maxX),
    y: clamp((stage.height - h) / 2, PAUSE_MARGIN, maxY),
    w,
    h,
  };
}

/**
 * The card as data: the scrim and the card in viewport space, then the highlight,
 * the title, the divider and the two rows card-relative. Every width derives from
 * `box.w`, never from the 360 literal, so a clamped card still fits.
 */
function panelView(
  open: boolean,
  title: string,
  labels: readonly string[],
  selected: number,
  armed: boolean,
  viewport: Viewport,
): PausePanelView {
  const stage = stageOf(viewport);
  const box = pausePanelBox(viewport);
  const current = clampRow(selected);
  const inset = PAUSE_ROW_INSET;

  const rows = PAUSE_ROW_IDS.map((id, index): PauseRowView => {
    const top = PAUSE_ROW_TOP + index * PAUSE_ROW_PITCH;
    return {
      id,
      index,
      label: labels[index] ?? '',
      selected: index === current,
      armed: id === 'reset' && armed,
      box: { x: inset, y: top, w: box.w - inset * 2, h: PAUSE_ROW_H },
      labelBox: {
        x: inset + PAUSE_LABEL_INSET.x,
        y: top + PAUSE_LABEL_INSET.y,
        w: box.w - inset * 2 - PAUSE_LABEL_INSET.x * 2,
        h: PAUSE_LABEL_INSET.h,
      },
    };
  });

  return {
    open,
    scrim: { x: 0, y: 0, w: stage.width, h: stage.height },
    box,
    highlight: {
      x: PAUSE_HIGHLIGHT_INSET,
      y: PAUSE_HIGHLIGHT_INSET,
      w: box.w - PAUSE_HIGHLIGHT_INSET * 2,
      h: 1,
    },
    divider: { x: inset, y: PAUSE_DIVIDER_TOP, w: box.w - inset * 2, h: 1 },
    title: { text: title, box: PAUSE_TITLE },
    rows,
  };
}

/** The live card: the two shipped rows, localised, on the board's geometry. */
export function pausePanelView(input: PauseInput, viewport: Viewport): PausePanelView {
  const armed = input.armed === true;
  const labels: readonly string[] = PAUSE_ROW_IDS.map((id) =>
    id === 'reset' && armed ? t('pause.resetArmed') : t(PAUSE_LABEL_KEYS[id]),
  );
  return panelView(input.open, t('hud.menu'), labels, input.selected, armed, viewport);
}

type PlainRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** The fixture card, or null when `payload` is not a payload this panel can draw. */
export function fixturePausePanelView(payload: unknown, viewport: Viewport): PausePanelView | null {
  if (!isPlainObject(payload)) return null;
  const menu = payload.menu;
  if (!isPlainObject(menu)) return null;
  const { title, selected, armed, rows } = menu;
  if (!isNonEmptyString(title)) return null;
  if (typeof selected !== 'number' || !Number.isInteger(selected)) return null;
  if (typeof armed !== 'boolean') return null;
  if (!Array.isArray(rows) || rows.length !== PAUSE_ROW_IDS.length) return null;

  const labels: string[] = [];
  for (let index = 0; index < PAUSE_ROW_IDS.length; index += 1) {
    const row = rows[index];
    if (!isPlainObject(row)) return null;
    if (row.id !== PAUSE_ROW_IDS[index]) return null;
    if (!isNonEmptyString(row.label)) return null;
    labels.push(row.label);
  }

  return panelView(true, title, labels, selected, armed, viewport);
}
