/**
 * The pure geometry of the on-screen touch controls: where the direction pad and
 * the A / B buttons sit for a given screen, and which direction a press on the
 * pad means. It carries no Phaser import so the placement and the hit rules are
 * unit-testable headless; `touchControls.ts` draws the result.
 */

export type TouchDirection = 'up' | 'down' | 'left' | 'right';

export type TouchControlsLayout = Readonly<{
  /** The centre and full width of the direction pad. */
  pad: Readonly<{ x: number; y: number; size: number }>;
  a: Readonly<{ x: number; y: number; radius: number }>;
  b: Readonly<{ x: number; y: number; radius: number }>;
}>;

/**
 * The pad's arm length scales with the smaller screen edge, so it fits a phone
 * and a desktop. It is deliberately longer than the A / B scale below, so the
 * arms read as a slim cross rather than a square block.
 */
const PAD_SIZE_RATIO = 0.4;
const PAD_SIZE_MIN = 120;
const PAD_SIZE_MAX = 220;
/** The A / B buttons keep their own scale, so the pad can grow without them. */
const BUTTON_SCALE_RATIO = 0.34;
const BUTTON_SCALE_MIN = 120;
const BUTTON_SCALE_MAX = 200;
const MARGIN_RATIO = 0.16;
const BUTTON_RADIUS_RATIO = 0.26;
/** The fraction of the pad radius that reads as "no direction" (its centre). */
export const PAD_DEADZONE_RATIO = 0.16;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Where the pad and the A / B buttons sit on a `width` x `height` screen. */
export function touchControlsLayout(width: number, height: number): TouchControlsLayout {
  const edge = Math.min(width, height);
  const size = Math.round(clamp(edge * PAD_SIZE_RATIO, PAD_SIZE_MIN, PAD_SIZE_MAX));
  const buttonScale = Math.round(clamp(edge * BUTTON_SCALE_RATIO, BUTTON_SCALE_MIN, BUTTON_SCALE_MAX));
  const padMargin = Math.round(size * MARGIN_RATIO);
  const buttonMargin = Math.round(buttonScale * MARGIN_RATIO);
  const radius = Math.round(buttonScale * BUTTON_RADIUS_RATIO);
  const pad = { x: padMargin + size / 2, y: height - padMargin - size / 2, size };
  // A rides above and to the right of B, the Game Boy arrangement.
  const a = {
    x: width - buttonMargin - radius,
    y: height - buttonMargin - radius - Math.round(radius * 0.6),
    radius,
  };
  const b = {
    x: a.x - radius * 2 - Math.round(buttonScale * 0.22),
    y: a.y + Math.round(radius * 0.6),
    radius,
  };
  return { pad, a, b };
}

/**
 * The direction a press at (`px`, `py`) means on `layout`'s pad. A press in the
 * pad's dead centre is no direction; otherwise the dominant axis wins, so the
 * whole pad — corners included — walks.
 */
export function padDirection(
  px: number,
  py: number,
  layout: TouchControlsLayout,
): TouchDirection | null {
  const dx = px - layout.pad.x;
  const dy = py - layout.pad.y;
  if (Math.hypot(dx, dy) < layout.pad.size * PAD_DEADZONE_RATIO) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
