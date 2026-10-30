import type { HudPanelLayout } from '../../../../data/hudLayout';
import { clampPanelOffset, type FrameVec } from './panelFrameView';
import type { Rect, Viewport } from './view';

/**
 * A collapsed panel's badge gesture (`D49` amended): the same slop, the same clamp
 * and the same committed record the open card's chip writes, so a badge drag and a
 * card drag are one rule and the reopened card inherits the offset it was given.
 *
 * Pure and total: no DOM, no Preact, no RNG. The pointer is the component's job; the
 * arithmetic that decides "press or drag" and "how far, but not off the screen" is
 * here, where a headless test can read it.
 */

/** The shipped slop, moved here so the card and the badge share it. */
export const DRAG_SLOP = 3;

export type BadgeDragStart = Readonly<{
  pointerX: number;
  pointerY: number;
  /** The panel's saved offset when the gesture started. */
  dx: number;
  dy: number;
  /** The badge's base top-left (phone slot, or the docked slot) before the offset. */
  originX: number;
  originY: number;
}>;

export type BadgeDragResult = Readonly<{
  /** The offset to commit, already clamped so the badge stays inside the viewport. */
  dx: number;
  dy: number;
  /** False under the slop: the gesture is a press, not a drag. */
  moved: boolean;
}>;

/**
 * The offset a badge gesture commits. Under the slop the start offset comes back
 * untouched, so a tap writes nothing; a drag adds the pointer's travel and is held
 * inside the window less the badge, because the origin is the slot it started from
 * and a badge that leaves the screen is a panel nobody can open again. A window with
 * no size to clamp against keeps the start offset rather than inventing a corner.
 */
export function badgeDrag(
  start: BadgeDragStart,
  pointer: Readonly<{ x: number; y: number }>,
  viewport: Viewport,
  badgeSize: number,
): BadgeDragResult {
  const mx = pointer.x - start.pointerX;
  const my = pointer.y - start.pointerY;
  const moved = Math.max(Math.abs(mx), Math.abs(my)) >= DRAG_SLOP;
  if (!moved) return { dx: start.dx, dy: start.dy, moved };
  if (!(viewport.width > 0) || !(viewport.height > 0)) {
    return { dx: start.dx, dy: start.dy, moved };
  }
  const origin: Rect = { x: start.originX, y: start.originY, w: badgeSize, h: badgeSize };
  const live: FrameVec = { dx: start.dx + mx, dy: start.dy + my };
  const clamped = clampPanelOffset(live, origin, viewport);
  return { dx: clamped.dx, dy: clamped.dy, moved };
}

/**
 * The record a badge drag commits: the gesture's clamped offset over the panel's own
 * collapsed flag, which a drag never changes — a badge that moved is still collapsed.
 */
export function badgeLayout(collapsed: boolean, drag: BadgeDragResult): HudPanelLayout {
  return { dx: drag.dx, dy: drag.dy, collapsed };
}
