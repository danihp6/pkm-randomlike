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

/** The pad scales with the smaller screen edge, so it fits a phone and a desktop. */
const PAD_SIZE_RATIO = 0.34;
const PAD_SIZE_MIN = 120;
const PAD_SIZE_MAX = 200;
const MARGIN_RATIO = 0.16;
const BUTTON_RADIUS_RATIO = 0.26;
/** The fraction of the pad radius that reads as "no direction" (its centre). */
export const PAD_DEADZONE_RATIO = 0.16;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Where the pad and the A / B buttons sit on a `width` x `height` screen. */
export function touchControlsLayout(width: number, height: number): TouchControlsLayout {
  const size = Math.round(clamp(Math.min(width, height) * PAD_SIZE_RATIO, PAD_SIZE_MIN, PAD_SIZE_MAX));
  const margin = Math.round(size * MARGIN_RATIO);
  const radius = Math.round(size * BUTTON_RADIUS_RATIO);
  const pad = { x: margin + size / 2, y: height - margin - size / 2, size };
  // A rides above and to the right of B, the Game Boy arrangement.
  const a = { x: width - margin - radius, y: height - margin - radius - Math.round(radius * 0.6), radius };
  const b = {
    x: a.x - radius * 2 - Math.round(size * 0.22),
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
