/**
 * Layout styles: the shape a route takes. For now there is exactly one, the
 * FireRed/LeafGreen **forest** (`docs/routes-spec.md` §2): it carves an open
 * field and the player enters from the south and leaves north. `route` (Route 1)
 * and `cavern` (Mt. Moon) are removed until their interiors come back; the
 * `hedges` and `maze` carvers stay parked in `sketch.ts`.
 *
 * A style is only shape data; the map semantics, the terrain passes and the
 * validation stay the same, so any biome tileset still renders the result.
 */

export type LayoutStyle = 'forest';

export type LayoutSpec = Readonly<{
  /**
   * `open` clears the interior to plain ground (only the border trees remain);
   * `hedges` leaves the field open and drops tree bars; `maze` carves a grid.
   */
  kind: 'open' | 'hedges' | 'maze';
  /** Edge the player enters from. */
  startEdge: 'W' | 'S';
  /** Edge the exit sits on, opposite the start. */
  exitEdge: 'E' | 'N';
  /** Width of the guaranteed start-to-exit path, kept clear of bars and hazards. */
  pathWidth: number;
  /** hedges: how many tree bars to drop, and their length range. */
  bars: number;
  barMin: number;
  barMax: number;
  /** maze: corridor width in tiles. */
  corridorWidth: number;
  /** maze: fraction of walls opened back up into loops (0 = perfect maze). */
  braid: number;
  /** hedges: how far a spine waypoint may stray from the straight start-exit line. */
  jitter: number;
}>;

export const LAYOUTS: Readonly<Record<LayoutStyle, LayoutSpec>> = {
  forest: {
    kind: 'open',
    startEdge: 'S',
    exitEdge: 'N',
    pathWidth: 1,
    bars: 0,
    barMin: 3,
    barMax: 6,
    corridorWidth: 1,
    braid: 0.2,
    jitter: 0,
  },
};

export const DEFAULT_LAYOUT: LayoutStyle = 'forest';

export function isLayoutStyle(value: unknown): value is LayoutStyle {
  return value === 'forest';
}
