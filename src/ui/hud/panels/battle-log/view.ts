/**
 * The battle message box's value model (`05b`/`m05b`): the board's measured box and
 * its two line rects, the live line the scene is revealing, the fixture parser and
 * the frame-step rule. Pure and total — the panel paints, the scene pushes, and the
 * only clock in the panel's world is `BATTLE_LOG_DWELL_MS` (and a hit frame's
 * shorter `HIT_FRAME_MS`).
 */

import type { BattleEvent } from '../../../../engine/battle/state';
import type { FeedFrame } from '../../../feed';
import { HP_FILL_MS } from '../battle-hp/view';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

export const BATTLE_LOG_SLUG: '05b-battle-message' = '05b-battle-message';
export const BATTLE_LOG_SLUGS: readonly ['05b-battle-message', 'm05b-battle-message'] = [
  '05b-battle-message',
  'm05b-battle-message',
];

/** The read hold after a line is fully revealed: 900 ms, the scene's only dwell. */
export const BATTLE_LOG_DWELL_MS: 900 = 900;

/** The shipped 45 ms floor a held confirm gives a frame (`FAST_HOLD_MS` in the canvas). */
const RUSH_HOLD_MS = 45;

/** 600: under it the phone column's card is used (`m05b`), the battle panels' breakpoint. */
export const BATTLE_LOG_BREAKPOINT = 600;
export const BATTLE_LOG_NARROW_QUERY = `(max-width: ${BATTLE_LOG_BREAKPOINT - 1}px)`;

/** At most two lines: the frame draws one message and its effect line. */
const MAX_LINES = 2;

/** 05b Battle · message · message box. */
const DESKTOP_BOX: Rect = { x: 664, y: 544, w: 576, h: 216 };
/** 05b Battle · message · message line 1. */
const DESKTOP_LINE_1: Rect = { x: 696, y: 580, w: 292, h: 20 };
/** 05b Battle · message · message line 2. */
const DESKTOP_LINE_2: Rect = { x: 696, y: 612, w: 294, h: 15 };

/** M 05b Battle · message · m menu panel. */
const NARROW_BOX: Rect = { x: 16, y: 592, w: 358, h: 236 };
/**
 * The two lines sit 16 px inside the phone card at y 620 and 646 (the frame's own copy).
 * The frame's text nodes are 224 and 153 wide because that is the copy's intrinsic
 * width; the panel takes the card's content column so a live line is never clipped.
 */
const NARROW_LINE_X = 32;
const NARROW_LINE_W = NARROW_BOX.w - (NARROW_LINE_X - NARROW_BOX.x) * 2;
const NARROW_LINE_1: Rect = { x: NARROW_LINE_X, y: 620, w: NARROW_LINE_W, h: 13 };
const NARROW_LINE_2: Rect = { x: NARROW_LINE_X, y: 646, w: NARROW_LINE_W, h: 13 };

export type BattleLogTone = 'primary' | 'effect';
export type BattleLogLineView = Readonly<{ text: string; tone: BattleLogTone }>;
/**
 * 0..2 lines. Live is at most one; the fixture carries the frame's two. `card` is the
 * live box when the battle mounts the feed — it is the battle menu's own card, so a
 * menu opening never resizes or moves the box — and absent in the fixture preview,
 * which draws the measured board.
 */
export type BattleLogView = Readonly<{
  visible: boolean;
  lines: readonly BattleLogLineView[];
  card?: Rect;
}>;

/**
 * The two boards' measured rects: the fixture preview's desktop box at 1280×800 and its
 * phone card under 600 px, exported for the fixture test and the diff. The live panel is
 * pushed its own card (`battleLogLayout`), so only the preview reads these.
 */
export function battleLogBoard(viewport: 'desktop' | 'narrow'): Readonly<{
  box: Readonly<{ x: number; y: number; w: number; h: number }>;
  line1: Readonly<{ x: number; y: number; w: number; h: number }>;
  line2: Readonly<{ x: number; y: number; w: number; h: number }>;
}> {
  if (viewport === 'narrow') {
    return { box: { ...NARROW_BOX }, line1: { ...NARROW_LINE_1 }, line2: { ...NARROW_LINE_2 } };
  }
  return { box: { ...DESKTOP_BOX }, line1: { ...DESKTOP_LINE_1 }, line2: { ...DESKTOP_LINE_2 } };
}

/** The line insets a board draws, relative to its card: `x` on both sides, `y` per line. */
type LineInset = Readonly<{ x: number; y1: number; y2: number; h1: number; h2: number }>;

/** 05b · message line 1 / 2: 32 px in, 36 and 68 px down. */
const DESKTOP_LINE_INSET: LineInset = { x: 32, y1: 36, y2: 68, h1: 20, h2: 15 };
/** m05b · the phone's two lines: 16 px in, 28 and 54 px down. */
const NARROW_LINE_INSET: LineInset = { x: 16, y1: 28, y2: 54, h1: 13, h2: 13 };

/**
 * The message box at the card the battle gives it: the feed shares the battle menu's
 * own window, so the box that shows a line and the box that opens a menu are one rect
 * and opening a menu can never resize or move it. The lines keep the frame's insets and
 * take the card's whole content column, so a live line is never clipped to the copy's
 * intrinsic width. Pure: the card is returned as a fresh rect.
 */
export function battleLogLayout(
  card: Rect,
  narrow: boolean,
): Readonly<{ box: Rect; line1: Rect; line2: Rect }> {
  const inset = narrow ? NARROW_LINE_INSET : DESKTOP_LINE_INSET;
  const w = Math.max(0, card.w - inset.x * 2);
  return {
    box: { ...card },
    line1: { x: card.x + inset.x, y: card.y + inset.y1, w, h: inset.h1 },
    line2: { x: card.x + inset.x, y: card.y + inset.y2, w, h: inset.h2 },
  };
}

/** The live line the scene is revealing (already localised). `null` = no line. */
export function liveBattleLogView(
  visible: boolean,
  line: string | null,
  card: Rect | null = null,
): BattleLogView {
  const lines: readonly BattleLogLineView[] =
    visible && line !== null ? [{ text: line, tone: 'primary' }] : [];
  return card === null ? { visible, lines } : { visible, lines, card };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTone(value: unknown): value is BattleLogTone {
  return value === 'primary' || value === 'effect';
}

/**
 * The frame's own payload (`design/fixtures/05b-battle-message.json`), or `null`
 * when it is not one this panel can draw: no `battleLog` block, a `visible` that is
 * not a boolean, more than two lines, a line without a string `text` or with an
 * unknown `tone`. It never throws.
 */
export function fixtureBattleLogView(payload: unknown): BattleLogView | null {
  if (!isObject(payload)) return null;
  const block = payload['battleLog'];
  if (!isObject(block)) return null;
  const visible = block['visible'];
  if (typeof visible !== 'boolean') return null;
  const lines = block['lines'];
  if (!Array.isArray(lines) || lines.length > MAX_LINES) return null;
  const parsed: BattleLogLineView[] = [];
  for (const line of lines) {
    if (!isObject(line)) return null;
    const text = line['text'];
    const tone = line['tone'];
    if (typeof text !== 'string' || !isTone(tone)) return null;
    parsed.push({ text, tone });
  }
  return { visible, lines: parsed };
}

/**
 * The feed's one clock, so the pacing is a pure rule the scene calls and a test
 * pins. A line that is still typing holds at zero; a revealed line banks the
 * frame's delta and advances once it reaches the hold — the rush floor when a
 * confirm is held, the frame's own hold otherwise.
 */
export function feedStep(
  typingDone: boolean,
  elapsedMs: number,
  holdMs: number,
  rush: boolean,
  deltaMs: number,
): Readonly<{ elapsedMs: number; advance: boolean }> {
  if (!typingDone) return { elapsedMs: 0, advance: false };
  const elapsedMsNext = elapsedMs + deltaMs;
  return { elapsedMs: elapsedMsNext, advance: elapsedMsNext >= (rush ? RUSH_HOLD_MS : holdMs) };
}

/**
 * The hold a landing-hit frame gets while another hit of the same move follows:
 * the fill's own `HP_FILL_MS` (300) plus one readable 150 ms beat — above the fill,
 * so a segment always finishes before the next one starts, and well under the
 * ordinary `BATTLE_LOG_DWELL_MS` (900).
 */
export const HIT_FRAME_MS: number = HP_FILL_MS + 150;

/** The six log keys a landing hit prints — the whole `battle.log.hit*` family. */
export const HIT_FRAME_KEYS: readonly string[] = [
  'battle.log.hit',
  'battle.log.hitCrit',
  'battle.log.hitSuper',
  'battle.log.hitCritSuper',
  'battle.log.hitWeak',
  'battle.log.hitCritWeak',
];

/**
 * The event kinds a hit frame never carries: each one means the frame is a state
 * change of its own (a faint, a status, a switch...) and not a plain landing hit.
 */
const NON_HIT_KINDS: readonly BattleEvent['kind'][] = [
  'status',
  'cure',
  'boost',
  'switch',
  'faint',
  'heal',
  'mega',
  'gmax',
  'forme',
  'item',
  'capture',
  'run',
  'end',
];

/**
 * True when `frames[index]` is a landing hit of a move's hit loop: the frame
 * carries at least one `damage` event, carries none of `status`, `cure`, `boost`,
 * `switch`, `faint`, `heal`, `mega`, `gmax`, `forme`, `item`, `capture`, `run`,
 * `end`, and carries a `text` event whose `key` is one of `HIT_FRAME_KEYS`.
 * Total: an out-of-range index, a missing frame, a frame with no events → `false`.
 */
export function hitFrameAt(frames: readonly FeedFrame[], index: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  const frame = frames[index];
  if (frame === undefined) return false;
  let damaged = false;
  let hitLine = false;
  for (const event of frame.events) {
    if (event.kind === 'damage') damaged = true;
    else if (NON_HIT_KINDS.includes(event.kind)) return false;
    else if (event.kind === 'text' && HIT_FRAME_KEYS.includes(event.key)) hitLine = true;
  }
  return damaged && hitLine;
}

/**
 * The hold the frame at `index` gets: `HIT_FRAME_MS` while it is a hit frame **and**
 * `frames[index + 1]` is also a hit frame; `dwellMs` otherwise. Pure and total.
 */
export function frameHoldMs(frames: readonly FeedFrame[], index: number, dwellMs: number): number {
  return hitFrameAt(frames, index) && hitFrameAt(frames, index + 1) ? HIT_FRAME_MS : dwellMs;
}
