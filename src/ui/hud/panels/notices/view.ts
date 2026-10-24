/**
 * The route's passive cards as data (`D49`, frames `03k` / `m03k`): the transient
 * notice strip, the floor's mission line and the area-entry banner, each one line
 * of text in a card at the top of the screen. The model measures the three rects
 * from the viewport and the board's safe area and copies the callers' strings; it
 * reads no run, no scene and no i18n, so the fixture and the panel cannot drift.
 */

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type Viewport = Readonly<{ width: number; height: number }>;

/** One line the panel can float; all three cards share the shape. */
export type NoticesLine = Readonly<{ text: string; box: Rect }>;

export type NoticesInput = Readonly<{
  /** The transient notice, or null while it is not up. */
  notice: string | null;
  /** The area-entry banner's line, or null. */
  area: string | null;
  /** The floor's mission line, or null when the run carries no mission. */
  mission: string | null;
}>;

export type NoticesPanelView = Readonly<{
  notice: NoticesLine | null;
  area: NoticesLine | null;
  mission: NoticesLine | null;
}>;

/**
 * The phone's safe-area inset (`design/tokens.json`, `docs/hud-fidelity.md` §5):
 * the canvas never respected it, so the DOM stack is the first thing on the board
 * that clears the notch. The top is where the strip starts; the bottom is the last
 * row the stack may touch.
 */
export const SAFE_AREA_TOP = 47;
export const SAFE_AREA_BOTTOM = 810;

/** Above this width the phone layout gives way to the board's desktop stack. */
const PHONE_MAX_WIDTH = 560;
/** The card's own margin from the window edge. */
const EDGE_MARGIN = 8;
/** The board's desktop strip (`03k`), the one card the frame carries. */
const NOTICE_W = 720;
const NOTICE_H = 56;
/** The board's phone card (`m03k`): 374 px wide at the 8 px gutter. */
const PHONE_CARD_W = 374;
/** The mission line, under the strip. */
const MISSION_W = 360;
const MISSION_H = 32;
/** The area-entry banner: the tallest card, boxed in the accent. */
const AREA_W = 360;
const AREA_H = 64;
/** The desktop stack's first row; the phone's comes from the safe area. */
const DESKTOP_TOP = 24;
/** One line plus a breather between two cards. */
const CARD_GAP = 8;
/** The board's own window, for a viewport the caller could not measure. */
const BOARD_W = 1280;
const BOARD_H = 800;

function widthOf(viewport: Viewport): number {
  return Number.isFinite(viewport.width) ? Math.max(0, viewport.width) : BOARD_W;
}

function heightOf(viewport: Viewport): number {
  return Number.isFinite(viewport.height) ? Math.max(0, viewport.height) : BOARD_H;
}

/** True on the phone: the width alone decides, so a landscape phone keeps the desktop stack. */
function isPhone(viewport: Viewport): boolean {
  return widthOf(viewport) <= PHONE_MAX_WIDTH;
}

/** A card's width: the board's, narrowed so it always keeps its 8 px margins. */
function cardWidth(viewport: Viewport, base: number): number {
  return Math.min(base, Math.max(0, widthOf(viewport) - EDGE_MARGIN * 2));
}

/** A card's left edge: the phone's gutter, or centred with the same margin floor. */
function cardLeft(viewport: Viewport, w: number): number {
  if (isPhone(viewport)) return EDGE_MARGIN;
  return Math.max(EDGE_MARGIN, (widthOf(viewport) - w) / 2);
}

/**
 * A card's top, held inside the safe area: the stack is laid out from the top and
 * a card that would cross the safe-area bottom (or a short window) moves up instead
 * of drawing past it. The design stack never clips at either board viewport.
 */
function cardTop(viewport: Viewport, top: number, h: number): number {
  const bottom = Math.min(heightOf(viewport), SAFE_AREA_BOTTOM);
  return Math.max(0, Math.min(top, bottom - h));
}

/** The stack's first row: the safe area's top on the phone, the board's 24 otherwise. */
function stackTop(viewport: Viewport): number {
  return isPhone(viewport) ? SAFE_AREA_TOP : DESKTOP_TOP;
}

/** The transient notice strip: the 720 × 56 board card, 374 on the phone. */
export function noticeBox(viewport: Viewport): Rect {
  const w = cardWidth(viewport, isPhone(viewport) ? PHONE_CARD_W : NOTICE_W);
  const h = NOTICE_H;
  return { x: cardLeft(viewport, w), y: cardTop(viewport, stackTop(viewport), h), w, h };
}

/** The floor's mission line: one slim card under the strip, 360 wide unless the phone widens it. */
export function missionBox(viewport: Viewport): Rect {
  const w = cardWidth(viewport, isPhone(viewport) ? PHONE_CARD_W : MISSION_W);
  const h = MISSION_H;
  const top = noticeBox(viewport).y + NOTICE_H + CARD_GAP;
  return { x: cardLeft(viewport, w), y: cardTop(viewport, top, h), w, h };
}

/** The area-entry banner: the boxed accent card, one gap under the mission line. */
export function areaBox(viewport: Viewport): Rect {
  const w = cardWidth(viewport, isPhone(viewport) ? PHONE_CARD_W : AREA_W);
  const h = AREA_H;
  const top = missionBox(viewport).y + MISSION_H + CARD_GAP;
  return { x: cardLeft(viewport, w), y: cardTop(viewport, top, h), w, h };
}

function line(text: string | null, box: Rect): NoticesLine | null {
  return text === null ? null : { text, box };
}

/** Pure and total: same input ⇒ deep-equal view, and the input is never written. */
export function noticesPanelView(input: NoticesInput, viewport: Viewport): NoticesPanelView {
  return {
    notice: line(input.notice, noticeBox(viewport)),
    area: line(input.area, areaBox(viewport)),
    mission: line(input.mission, missionBox(viewport)),
  };
}
