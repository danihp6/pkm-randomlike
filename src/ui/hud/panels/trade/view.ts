import { t } from '../../../../i18n';

/**
 * The trade card's layout model (`D49`): the board's `03i` pick sheet and `03j`
 * result card, measured as data. It mirrors the frames' own arithmetic — the header
 * band, the six party tiles, the sixteen-cell PC column, the give-away button and
 * the result card's portrait — so the Preact panel and the board cannot drift.
 * It reads no run, no scene and no dex: the scene module hands it the party, the
 * box and the room's line every time it repaints, in both states of the one panel.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;
/** The one panel's two states: the pick window, or the card a landed trade shows. */
export type TradeKind = 'pick' | 'result';

/** One party tile the player may give away. */
export type TradePartyTile = Readonly<{
  memberId: string;
  name: string;
  level: number;
  /** The dex sprite frame the portrait cell paints (null when it has no sheet). */
  frame: number | null;
  selected: boolean;
  box: Rect; // panel-relative
}>;

/** One PC cell: informational only — the rule only ever trades a party member. */
export type TradePcTile = Readonly<{
  memberId: string;
  name: string;
  frame: number | null;
  box: Rect; // panel-relative
}>;

export type TradeInput = Readonly<{
  /** 'pick' while the window offers the party, 'result' after a trade landed. */
  kind: TradeKind;
  /** The room's line: greeting, used, refused or a refusal of the last press. */
  message: string;
  /** True when a trade can still happen in this room (not used, party >= 2). */
  canTrade: boolean;
  party: readonly TradePartyTile[];
  pc: readonly TradePcTile[];
  /** The selected party index, or -1. */
  selected: number;
  /** The party and box sizes the meta line prints. */
  partyCount: number;
  pcCount: number;
  /** The received member, on 'result'; null on 'pick'. */
  received: Readonly<{
    name: string;
    level: number;
    type: string;
    frame: number | null;
  }> | null;
  open: boolean;
}>;

export type TradePanelView = Readonly<{
  open: boolean;
  kind: TradeKind;
  /** Viewport coordinates, from `tradePanelBox`. */
  box: Rect;
  /** The visible card's 1 px line, 12 px inside its top edge, panel-relative. */
  highlight: Rect;
  title: Readonly<{ text: string; box: Rect }>;
  meta: Readonly<{ text: string; box: Rect }>;
  message: Readonly<{ text: string; box: Rect }>;
  partyLabel: Readonly<{ text: string; box: Rect }>;
  pcLabel: Readonly<{ text: string; box: Rect }>;
  party: readonly TradePartyTile[];
  pc: readonly TradePcTile[];
  give: Readonly<{ label: string; enabled: boolean; box: Rect }> | null;
  close: Readonly<{ label: string; box: Rect }>;
  /**
   * The `03j` card, centred inside `box` on 'result'. `card` is panel-relative and
   * every rect inside it is card-relative.
   */
  result: Readonly<{
    card: Rect;
    highlight: Rect;
    title: string;
    titleBox: Rect;
    kicker: string;
    kickerBox: Rect;
    name: string;
    nameBox: Rect;
    added: string;
    addedBox: Rect;
    portrait: Rect;
    /** The received member's dex frame, painted inside `portrait`. */
    frame: number | null;
    type: Readonly<{ id: string; box: Rect }> | null;
    button: Readonly<{ label: string; box: Rect }>;
  }> | null;
}>;

/** The pick card's own rect, from `03i` / `m03i`. */
export const TRADE_CARD_W = 760;
export const TRADE_CARD_H = 560;
export const TRADE_CARD_RADIUS = 11;
export const TRADE_M_CARD_W = 374;
export const TRADE_M_CARD_H = 508;
/** The result card's own rect, from `03j` / `m03j`. */
export const TRADE_RESULT_W = 560;
export const TRADE_RESULT_H = 420;
export const TRADE_M_RESULT_W = 374;
export const TRADE_M_RESULT_H = 440;
/** The board's 12 px line inside the card's top edge, and its 24 px content inset. */
export const TRADE_HIGHLIGHT_INSET = 12;
export const TRADE_PAD_X = 24;
/** The desktop pick card: six 158 × 104 tiles at a 170 / 116 pitch, two a row. */
export const TRADE_PARTY_TILE_W = 158;
export const TRADE_PARTY_TILE_H = 104;
export const TRADE_PARTY_COLS = 2;
export const TRADE_PARTY_ROWS = 3;
export const TRADE_PARTY_TOP = 116;
export const TRADE_PARTY_PITCH_X = 170;
export const TRADE_PARTY_PITCH_Y = 116;
/** The desktop PC column: sixteen 76 × 76 cells at an 88 px pitch, four by four. */
export const TRADE_PC_CELL = 76;
export const TRADE_PC_COLS = 4;
export const TRADE_PC_ROWS = 4;
export const TRADE_PC_TOP = 116;
export const TRADE_PC_PITCH = 88;
export const TRADE_PC_GAP = 12;
/** The mobile pick sheet: three 104 × 64 tiles a row, twelve 56 px PC cells. */
export const TRADE_M_PARTY_TILE_W = 104;
export const TRADE_M_PARTY_TILE_H = 64;
export const TRADE_M_PARTY_COLS = 3;
export const TRADE_M_PARTY_ROWS = 2;
export const TRADE_M_PARTY_X = 16;
export const TRADE_M_PARTY_TOP = 92;
export const TRADE_M_PARTY_PITCH_X = 112;
export const TRADE_M_PARTY_PITCH_Y = 72;
export const TRADE_M_PC_CELL = 56;
export const TRADE_M_PC_COLS = 4;
export const TRADE_M_PC_ROWS = 3;
export const TRADE_M_PC_TOP = 254;
export const TRADE_M_PC_PITCH = 64;
export const TRADE_M_PC_GAP = 8;
/** The footer: the give-away button and its inset from the card's bottom edge. */
export const TRADE_GIVE_W = 340;
export const TRADE_GIVE_H = 44;
export const TRADE_GIVE_BOTTOM = 24;
export const TRADE_M_GIVE_W = 350;
export const TRADE_M_GIVE_BOTTOM = 20;
/** The dismiss ✕ the frame does not carry: a 24 px target, clear of every string. */
export const TRADE_CLOSE_SIZE = 24;
/**
 * The breakpoint the board's two frames switch at; `options.css`/`options/view.ts`
 * use the same 600 px.
 */
export const TRADE_NARROW_MAX = 600;
/** The card's own margin from the window edge, as `shopPanelBox` clamps it. */
const TRADE_MARGIN = 8;
/** The widest the meta, title and kicker lines get, and their header band. */
const TRADE_META_W = 296;
const TRADE_RESULT_META_W = 196;
const TRADE_M_RESULT_META_W = 296;
const TRADE_LINE_H = 20;
const TRADE_TITLE_H = 30;
const TRADE_M_TITLE_H = 23;
const TRADE_KICKER_H = 14;
const TRADE_NAME_H = 30;
const TRADE_M_NAME_H = 23;
/** The result card's portrait and its type chip, from `03j` / `m03j`. */
const TRADE_PORTRAIT = 128;
const TRADE_M_PORTRAIT = 96;
const TRADE_TYPE_CHIP = 24;

/** The two tiles/cells the pick card grids, as one box of the frame's own numbers. */
type Grid = Readonly<{
  w: number;
  h: number;
  cols: number;
  rows: number;
  x: number;
  y: number;
  pitchX: number;
  pitchY: number;
}>;

type PickRects = Readonly<{
  highlight: Rect;
  title: Rect;
  meta: Rect;
  message: Rect;
  partyLabel: Rect;
  pcLabel: Rect;
  tile: Grid;
  cell: Grid;
  give: Rect;
  close: Rect;
}>;

type ResultRects = Readonly<{
  card: Rect;
  highlight: Rect;
  title: Rect;
  meta: Rect;
  kicker: Rect;
  name: Rect;
  added: Rect;
  portrait: Rect;
  type: Rect;
  button: Rect;
}>;

function finiteInt(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** True on the board's narrow frame (`m03i` / `m03j`), where the card is a sheet. */
function narrow(viewport: Viewport): boolean {
  return Number.isFinite(viewport.width) && viewport.width <= TRADE_NARROW_MAX;
}

/**
 * The card's centred rect plus the HUD's own edge clamp, exactly as `shopPanelBox`
 * does it: the shipped 760 px card cannot fit a 390 px window, so the width and the
 * height give way before the margins do.
 */
export function tradePanelBox(viewport: Viewport): Rect {
  const card = narrow(viewport)
    ? { w: TRADE_M_CARD_W, h: TRADE_M_CARD_H }
    : { w: TRADE_CARD_W, h: TRADE_CARD_H };
  const width = Number.isFinite(viewport.width)
    ? Math.max(0, viewport.width)
    : card.w + TRADE_MARGIN * 2;
  const height = Number.isFinite(viewport.height)
    ? Math.max(0, viewport.height)
    : card.h + TRADE_MARGIN * 2;
  const w = Math.min(card.w, Math.max(160, width - TRADE_MARGIN * 2));
  const h = Math.min(card.h, Math.max(200, height - TRADE_MARGIN * 2));
  const x = clamp((width - w) / 2, TRADE_MARGIN, Math.max(TRADE_MARGIN, width - w - TRADE_MARGIN));
  const y = clamp((height - h) / 2, TRADE_MARGIN, Math.max(TRADE_MARGIN, height - h - TRADE_MARGIN));
  return { x, y, w, h };
}

/** The pick card's own rects, panel-relative: `03i` on the desk, `m03i` on a phone. */
function pickRects(box: Rect, phone: boolean): PickRects {
  const highlight = { x: TRADE_HIGHLIGHT_INSET, y: TRADE_HIGHLIGHT_INSET, w: box.w - 24, h: 1 };
  const giveW = phone ? Math.min(TRADE_M_GIVE_W, box.w - 24) : Math.min(TRADE_GIVE_W, box.w - 48);
  const giveH = TRADE_GIVE_H;
  const give: Rect = {
    x: (box.w - giveW) / 2,
    y: box.h - (phone ? TRADE_M_GIVE_BOTTOM : TRADE_GIVE_BOTTOM) - giveH,
    w: giveW,
    h: giveH,
  };
  if (phone) {
    return {
      highlight,
      title: { x: 16, y: 18, w: 75, h: TRADE_M_TITLE_H },
      // The frame carries no dismiss control; the ✕ takes the header's right corner
      // and the meta ends 8 px short of it so no string runs under a press target.
      meta: { x: box.w - 12 - TRADE_CLOSE_SIZE - 8 - 131, y: 22, w: 131, h: 12 },
      message: { x: 16, y: 44, w: 253, h: 12 },
      partyLabel: { x: 16, y: 78, w: 38, h: 12 },
      pcLabel: { x: 63, y: 240, w: 15, h: 12 },
      tile: {
        w: TRADE_M_PARTY_TILE_W,
        h: TRADE_M_PARTY_TILE_H,
        cols: TRADE_M_PARTY_COLS,
        rows: TRADE_M_PARTY_ROWS,
        x: TRADE_M_PARTY_X,
        y: TRADE_M_PARTY_TOP,
        pitchX: TRADE_M_PARTY_PITCH_X,
        pitchY: TRADE_M_PARTY_PITCH_Y,
      },
      cell: {
        w: TRADE_M_PC_CELL,
        h: TRADE_M_PC_CELL,
        cols: TRADE_M_PC_COLS,
        rows: TRADE_M_PC_ROWS,
        x: (box.w - (TRADE_M_PC_COLS * TRADE_M_PC_CELL + (TRADE_M_PC_COLS - 1) * TRADE_M_PC_GAP)) / 2,
        y: TRADE_M_PC_TOP,
        pitchX: TRADE_M_PC_PITCH,
        pitchY: TRADE_M_PC_PITCH,
      },
      give,
      close: { x: box.w - 12 - TRADE_CLOSE_SIZE, y: 10, w: TRADE_CLOSE_SIZE, h: TRADE_CLOSE_SIZE },
    };
  }
  return {
    highlight,
    title: { x: TRADE_PAD_X, y: 20, w: 300, h: TRADE_TITLE_H },
    meta: { x: box.w - TRADE_PAD_X - TRADE_META_W, y: 26, w: TRADE_META_W, h: 16 },
    message: { x: TRADE_PAD_X, y: 56, w: 560, h: TRADE_LINE_H },
    partyLabel: { x: TRADE_PAD_X, y: 96, w: 120, h: 14 },
    pcLabel: { x: 396, y: 96, w: 80, h: 14 },
    tile: {
      w: TRADE_PARTY_TILE_W,
      h: TRADE_PARTY_TILE_H,
      cols: TRADE_PARTY_COLS,
      rows: TRADE_PARTY_ROWS,
      x: TRADE_PAD_X,
      y: TRADE_PARTY_TOP,
      pitchX: TRADE_PARTY_PITCH_X,
      pitchY: TRADE_PARTY_PITCH_Y,
    },
    cell: {
      w: TRADE_PC_CELL,
      h: TRADE_PC_CELL,
      cols: TRADE_PC_COLS,
      rows: TRADE_PC_ROWS,
      x: box.w - TRADE_PAD_X - (TRADE_PC_COLS * TRADE_PC_CELL + (TRADE_PC_COLS - 1) * TRADE_PC_GAP),
      y: TRADE_PC_TOP,
      pitchX: TRADE_PC_PITCH,
      pitchY: TRADE_PC_PITCH,
    },
    give,
    // The footer's right end is the one band the frame leaves empty, so the dismiss
    // sits on the give-away button's centre line, flush with the content edge.
    close: {
      x: box.w - TRADE_PAD_X - TRADE_CLOSE_SIZE,
      y: give.y + (give.h - TRADE_CLOSE_SIZE) / 2,
      w: TRADE_CLOSE_SIZE,
      h: TRADE_CLOSE_SIZE,
    },
  };
}

/** The `03j` card, centred inside the pick box: its own rects are card-relative. */
function resultRects(box: Rect, phone: boolean): ResultRects {
  const cardW = Math.min(box.w, phone ? TRADE_M_RESULT_W : TRADE_RESULT_W);
  const cardH = Math.min(box.h, phone ? TRADE_M_RESULT_H : TRADE_RESULT_H);
  const card: Rect = { x: (box.w - cardW) / 2, y: (box.h - cardH) / 2, w: cardW, h: cardH };
  const highlight: Rect = { x: TRADE_HIGHLIGHT_INSET, y: TRADE_HIGHLIGHT_INSET, w: cardW - 24, h: 1 };
  if (phone) {
    const buttonW = Math.min(TRADE_M_GIVE_W, cardW - 24);
    return {
      card,
      highlight,
      title: { x: 16, y: 20, w: 300, h: TRADE_M_TITLE_H },
      meta: { x: cardW - 16 - TRADE_M_RESULT_META_W, y: 22, w: TRADE_M_RESULT_META_W, h: 16 },
      kicker: { x: 16, y: 62, w: cardW - 32, h: 12 },
      name: { x: 16, y: 232, w: cardW - 32, h: TRADE_M_NAME_H },
      added: { x: 16, y: 262, w: cardW - 32, h: 12 },
      portrait: { x: 139, y: 82, w: TRADE_M_PORTRAIT, h: TRADE_M_PORTRAIT },
      type: { x: 175, y: 244, w: TRADE_TYPE_CHIP, h: TRADE_TYPE_CHIP },
      button: {
        x: (cardW - buttonW) / 2,
        y: cardH - TRADE_M_GIVE_BOTTOM - TRADE_GIVE_H,
        w: buttonW,
        h: TRADE_GIVE_H,
      },
    };
  }
  const buttonW = Math.min(TRADE_GIVE_W, cardW - 48);
  return {
    card,
    highlight,
    title: { x: TRADE_PAD_X, y: 20, w: 300, h: TRADE_TITLE_H },
    meta: { x: cardW - TRADE_PAD_X - TRADE_RESULT_META_W, y: 26, w: TRADE_RESULT_META_W, h: 16 },
    kicker: { x: TRADE_PAD_X, y: 62, w: cardW - 48, h: TRADE_KICKER_H },
    name: { x: TRADE_PAD_X, y: 232, w: cardW - 48, h: TRADE_NAME_H },
    added: { x: TRADE_PAD_X, y: 268, w: cardW - 48, h: 16 },
    portrait: {
      x: (cardW - TRADE_PORTRAIT) / 2,
      y: 88,
      w: TRADE_PORTRAIT,
      h: TRADE_PORTRAIT,
    },
    type: { x: (cardW - TRADE_TYPE_CHIP) / 2, y: 296, w: TRADE_TYPE_CHIP, h: TRADE_TYPE_CHIP },
    button: {
      x: (cardW - buttonW) / 2,
      y: cardH - TRADE_GIVE_BOTTOM - TRADE_GIVE_H,
      w: buttonW,
      h: TRADE_GIVE_H,
    },
  };
}

/** The `index`-th tile of a grid, panel-relative, truncated to the cells that fit. */
function gridBox(grid: Grid, index: number): Rect {
  return {
    x: grid.x + (index % grid.cols) * grid.pitchX,
    y: grid.y + Math.floor(index / grid.cols) * grid.pitchY,
    w: grid.w,
    h: grid.h,
  };
}

/** Pure and total: same input ⇒ deep-equal view, and the input is never written. */
export function tradePanelView(input: TradeInput, viewport: Viewport): TradePanelView {
  const box = tradePanelBox(viewport);
  const phone = narrow(viewport);
  const pick = pickRects(box, phone);
  const received = input.kind === 'result' ? input.received : null;
  const result = received === null ? null : resultRects(box, phone);

  const partyTotal = input.party.length;
  const selected = partyTotal === 0 ? -1 : clamp(finiteInt(input.selected, 0), -1, partyTotal - 1);
  const party: TradePartyTile[] = [];
  for (let i = 0; i < Math.min(partyTotal, pick.tile.cols * pick.tile.rows); i++) {
    const tile = input.party[i];
    if (tile === undefined) continue;
    party.push({
      memberId: tile.memberId,
      name: tile.name,
      level: tile.level,
      frame: tile.frame,
      selected: i === selected,
      box: gridBox(pick.tile, i),
    });
  }
  const pc: TradePcTile[] = [];
  for (let i = 0; i < Math.min(input.pc.length, pick.cell.cols * pick.cell.rows); i++) {
    const tile = input.pc[i];
    if (tile === undefined) continue;
    pc.push({
      memberId: tile.memberId,
      name: tile.name,
      frame: tile.frame,
      box: gridBox(pick.cell, i),
    });
  }

  const give =
    result === null
      ? {
          label: t('trade.give'),
          enabled: input.canTrade && selected >= 0 && selected < partyTotal,
          box: pick.give,
        }
      : null;

  return {
    open: input.open,
    kind: input.kind,
    box,
    highlight: result === null ? pick.highlight : frameOf(result, result.highlight),
    title: {
      text: t('trade.title'),
      box: result === null ? pick.title : frameOf(result, result.title),
    },
    meta: {
      text:
        result === null
          ? t('trade.meta', {
              party: finiteInt(input.partyCount, partyTotal),
              pc: finiteInt(input.pcCount, input.pc.length),
            })
          : `${t('trade.title')} ${t('trade.complete')}`,
      box: result === null ? pick.meta : frameOf(result, result.meta),
    },
    message: { text: input.message, box: pick.message },
    partyLabel: { text: t('trade.party'), box: pick.partyLabel },
    pcLabel: { text: t('trade.pc'), box: pick.pcLabel },
    party,
    pc,
    give,
    close:
      result === null
        ? { label: '✕', box: pick.close }
        : { label: t('trade.close'), box: frameOf(result, result.button) },
    result:
      result === null || received === null
        ? null
        : {
            card: result.card,
            highlight: result.highlight,
            title: t('trade.title'),
            titleBox: result.title,
            kicker: t('trade.received'),
            kickerBox: result.kicker,
            name: received.name,
            nameBox: result.name,
            added: t('trade.added'),
            addedBox: result.added,
            portrait: result.portrait,
            frame: received.frame,
            type: received.type.length === 0 ? null : { id: received.type, box: result.type },
            button: { label: t('trade.close'), box: result.button },
          },
  };
}

/** A result card's rect lifted into the panel's own coordinates. */
function frameOf(result: ResultRects, rect: Rect): Rect {
  return { x: result.card.x + rect.x, y: result.card.y + rect.y, w: rect.w, h: rect.h };
}
