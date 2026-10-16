/**
 * The pure arithmetic of a scrolling grid window: the row offset that keeps
 * `rows` full rows on screen, the clamp that never lets the window sit between
 * two rows or past its end, the one-row step a wheel notch or an arrow takes, and
 * the item range the window shows. It is generic over the window it serves — the
 * route HUD's learnset band is its first caller, not its definition — so the
 * band's own column and row counts live in the scene, not here.
 *
 * It imports nothing, holds no state and reads no RNG, so the band's scroll is
 * unit-testable headless and the scene only draws what these return.
 */

/** The largest first-visible row index that still shows `rows` full rows, or 0. */
export function maxScrollTop(itemCount: number, cols: number, rows: number): number {
  if (cols < 1 || rows < 1) return 0;
  return Math.max(0, Math.ceil(itemCount / cols) - rows);
}

/** Clamps a row offset into `[0, maxTop]`, truncated to whole rows. */
export function clampScrollTop(top: number, maxTop: number): number {
  const rows = Number.isFinite(top) ? Math.trunc(top) : 0;
  const limit = Number.isFinite(maxTop) ? Math.max(0, Math.trunc(maxTop)) : 0;
  return Math.min(Math.max(0, rows), limit);
}

/** Moves the window `deltaRows` rows (positive = down the list) and clamps it. */
export function scrollByRows(top: number, deltaRows: number, maxTop: number): number {
  return clampScrollTop(top + deltaRows, maxTop);
}

/** The half-open item range the window shows at `top`. */
export function visibleRange(
  top: number,
  cols: number,
  rows: number,
  itemCount: number,
): Readonly<{ start: number; end: number }> {
  const start = clampScrollTop(top, maxScrollTop(itemCount, cols, rows)) * cols;
  return { start, end: Math.min(itemCount, start + cols * rows) };
}
