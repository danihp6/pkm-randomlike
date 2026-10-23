import { t } from '../../../../i18n';
import type { ShopRow } from '../../../shop';

/**
 * The Mart's layout model (`D49`): the floating card `src/scenes/rooms/shop.ts`
 * draws in Phaser, measured as data. It mirrors the shipped card's own arithmetic
 * — the header band, the money line, the BUY / SELL tabs, the seven-row list window,
 * the message and the hint — so the Preact panel and the canvas card cannot drift.
 * It reads no run and no scene: the scene module hands it the rows, the title and
 * the money every time it repaints.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
export type ShopMode = 'buy' | 'sell';

/** A CSS-ready atlas cell: `background-position: -x px -y px`. */
export type ShopIcon = Readonly<{ url: string; size: number; x: number; y: number }>;

/** The card's whole state: what the scene holds and what the pure view reads. */
export type ShopInput = Readonly<{
  title: string;
  mode: ShopMode;
  rows: readonly ShopRow[];
  scroll: number;
  selected: number;
  money: number;
  message: string;
  empty: string;
  open: boolean;
}>;

export type ShopRowView = Readonly<{
  /** The row's index in the tab's full list (what a press sends back). */
  index: number;
  itemId: string;
  name: string;
  /** `¥300`, the string the card prints. */
  price: string;
  /** `x2`, or '' when the run holds none. */
  owned: string;
  /** False on a BUY row the run cannot afford (its price reads in the warning tone). */
  affordable: boolean;
  selected: boolean;
  box: Rect;
  icon: ShopIcon | null;
}>;

export type ShopPanelView = Readonly<{
  /** False while the Merchant's card is closed or the route is paused. */
  open: boolean;
  /** Viewport coordinates, from `shopPanelBox`. */
  box: Rect;
  title: string;
  /** Panel-relative, exactly the shipped card's own control rects. */
  highlight: Rect;
  money: Readonly<{ text: string; box: Rect }>;
  tabs: readonly Readonly<{ mode: ShopMode; label: string; active: boolean; box: Rect }>[];
  list: Readonly<{ box: Rect }>;
  rows: readonly ShopRowView[];
  /** `1` while the first of `rows` is list index `scroll`; the wheel steps it. */
  scroll: number;
  message: Readonly<{ text: string; box: Rect }>;
  hint: Readonly<{ text: string; box: Rect }>;
  empty: Readonly<{ text: string; box: Rect }> | null;
  /** The card's drawn ✕, in the header band. */
  close: Readonly<{ label: string; box: Rect }>;
}>;

/** The shipped card's own constants (`src/scenes/rooms/shop.ts`), pinned here. */
export const SHOP_PANEL_W = 640;
export const SHOP_PANEL_H = 540;
export const SHOP_HEADER_H = 44;
export const SHOP_PAD_X = 20;
export const SHOP_PAD_BOTTOM = 8;
export const SHOP_ROW_H = 44;
export const SHOP_ROWS = 7;
export const SHOP_TAB_W = 108;
export const SHOP_TAB_H = 30;
export const SHOP_TAB_GAP = 6;
export const SHOP_LIST_TOP = 68;

/** The card's own margin from the window edge, as `addFloatingPanel` clamps it. */
const SHOP_MARGIN = 8;
/** The drawn ✕, `FLOATING_CLOSE_SIZE` at the header's own centre line. */
const SHOP_CLOSE_SIZE = 24;
/** The drawn label on the ✕ button: the card's two arms have no text of their own. */
const SHOP_CLOSE_LABEL = '✕';
/** The money, message and hint line boxes, as the card's FRLG 16 px text sets them. */
const SHOP_LINE_H = 20;
/** The tab strip and the list window's own offsets inside the content band. */
const SHOP_TABS_TOP = 26;
/** The list window's inner padding: rows start 6 px in on both axes. */
const SHOP_LIST_PAD = 6;
/** The hint line sits one line plus a 4 px breather under the message. */
const SHOP_HINT_GAP = 24;

/** The tabs in the order the card draws them. */
const SHOP_MODES: readonly ShopMode[] = ['buy', 'sell'];

function finiteInt(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * The card's centred rect, from `addFloatingPanel` plus the HUD's own edge clamp:
 * the shipped 640 px card cannot fit a 390 px window, so the width and the height
 * give way before the margins do.
 */
export function shopPanelBox(viewport: Viewport): Rect {
  const width = Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : SHOP_PANEL_W + 16;
  const height = Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : SHOP_PANEL_H + 16;
  const w = Math.min(SHOP_PANEL_W, Math.max(160, width - SHOP_MARGIN * 2));
  const h = Math.min(SHOP_PANEL_H, Math.max(200, height - SHOP_MARGIN * 2));
  const x = clamp((width - w) / 2, SHOP_MARGIN, Math.max(SHOP_MARGIN, width - w - SHOP_MARGIN));
  const y = clamp((height - h) / 2, SHOP_MARGIN, Math.max(SHOP_MARGIN, height - h - SHOP_MARGIN));
  return { x, y, w, h };
}

/** The content band inside the card: below the header, above the bottom padding. */
export function shopContentRect(box: Rect): Rect {
  return {
    x: SHOP_PAD_X,
    y: SHOP_HEADER_H,
    w: box.w - SHOP_PAD_X * 2,
    h: box.h - SHOP_HEADER_H - SHOP_PAD_BOTTOM,
  };
}

/** Pure and total: same input ⇒ deep-equal view, and the input is never written. */
export function shopPanelView(
  input: ShopInput,
  viewport: Viewport,
  icon: (itemId: string) => ShopIcon | null,
): ShopPanelView {
  const box = shopPanelBox(viewport);
  const content = shopContentRect(box);
  const right = content.x + content.w;

  const money: Rect = { x: right, y: content.y, w: 0, h: SHOP_LINE_H };
  const tabs = SHOP_MODES.map((mode, i) => ({
    mode,
    label: t(mode === 'buy' ? 'mart.buy' : 'mart.sell'),
    active: mode === input.mode,
    box: {
      x: content.x + i * (SHOP_TAB_W + SHOP_TAB_GAP),
      y: content.y + SHOP_TABS_TOP,
      w: SHOP_TAB_W,
      h: SHOP_TAB_H,
    },
  }));
  const list: Rect = {
    x: content.x,
    y: content.y + SHOP_LIST_TOP,
    w: content.w,
    h: SHOP_ROWS * SHOP_ROW_H + 12,
  };

  const total = input.rows.length;
  const scroll = clamp(finiteInt(input.scroll, 0), 0, Math.max(0, total - SHOP_ROWS));
  const selected = total === 0 ? -1 : clamp(finiteInt(input.selected, 0), -1, total - 1);

  const rows: ShopRowView[] = [];
  for (let i = 0; i < SHOP_ROWS; i++) {
    const index = scroll + i;
    const row = input.rows[index];
    if (row === undefined) continue;
    rows.push({
      index,
      itemId: row.itemId,
      name: row.name,
      price: `¥${row.price}`,
      owned: row.owned > 0 ? `x${row.owned}` : '',
      // A sale's price is what the shop pays, never a cost: only a BUY row can be
      // out of reach.
      affordable: input.mode === 'sell' || row.affordable,
      selected: index === selected,
      box: {
        x: list.x + SHOP_LIST_PAD,
        y: list.y + SHOP_LIST_PAD + i * SHOP_ROW_H,
        w: list.w - SHOP_LIST_PAD * 2,
        h: SHOP_ROW_H - 4,
      },
      icon: icon(row.itemId),
    });
  }

  const message: Rect = { x: content.x, y: list.y + list.h + 12, w: content.w, h: SHOP_LINE_H };
  const hint: Rect = { x: right, y: message.y + SHOP_HINT_GAP, w: 0, h: SHOP_LINE_H };

  return {
    open: input.open,
    box,
    title: input.title,
    highlight: { x: 12, y: 12, w: box.w - 24, h: 1 },
    money: { text: t('mart.money', { amount: input.money }), box: money },
    tabs,
    list: { box: list },
    rows,
    scroll,
    message: { text: input.message, box: message },
    hint: { text: t('mart.controls'), box: hint },
    empty:
      total === 0
        ? { text: input.empty, box: { x: list.x + list.w / 2, y: list.y + 20, w: 0, h: SHOP_LINE_H } }
        : null,
    close: {
      label: SHOP_CLOSE_LABEL,
      box: {
        x: box.w - SHOP_PAD_X - SHOP_CLOSE_SIZE,
        y: SHOP_HEADER_H / 2 - SHOP_CLOSE_SIZE / 2,
        w: SHOP_CLOSE_SIZE,
        h: SHOP_CLOSE_SIZE,
      },
    },
  };
}
