import type { HudPanelId } from '../../../../data/hudLayout';
import type { Keybinds } from '../../../../data/keybinds';
import { STRIP_CHIP_ACTIONS, chipLabel, type Rect, type Viewport } from './view';

/**
 * A panel frame's geometry (`D49` amended): the drag offset a card may keep and the
 * name its chip announces. Pure and total — no DOM, no Phaser, no clock — because
 * the clamp is the one rule a pointer drag must never bend: a card that leaves the
 * window is a card nobody can grab back.
 */

/** A panel's offset from its own default box, in window pixels. */
export type FrameVec = Readonly<{ dx: number; dy: number }>;

/** One axis of the clamp: the drag kept inside `[0, extent - size]`, or 0 when it cannot fit. */
function clampAxis(delta: number, start: number, size: number, extent: number): number {
  if (!Number.isFinite(delta) || !Number.isFinite(start)) return 0;
  if (!Number.isFinite(size) || !Number.isFinite(extent)) return 0;
  const low = -start;
  const high = extent - size - start;
  if (high < low) return 0;
  return Math.min(Math.max(delta, low), high);
}

/** The nearest offset that keeps `box` (its default rect) inside `viewport`. */
export function clampPanelOffset(offset: FrameVec, box: Rect, viewport: Viewport): FrameVec {
  return {
    dx: clampAxis(offset.dx, box.x, box.w, viewport.width),
    dy: clampAxis(offset.dy, box.y, box.h, viewport.height),
  };
}

/**
 * The chip's accessible label: the strip's own (`chipLabel`), so the card and the
 * collapsed chip name the same panel and the same live key. The board draws no chip
 * for the member detail window, so it gets none here either.
 */
export function frameLabel(id: HudPanelId, keybinds: Keybinds): string | null {
  if (id === 'detail') return null;
  return chipLabel(STRIP_CHIP_ACTIONS[id], keybinds);
}
