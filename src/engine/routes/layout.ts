/**
 * Layout styles: the shape a route takes follows the original FireRed/LeafGreen
 * map for its biome instead of a generic roguelike blob (`docs/routes-spec.md`
 * §2). A style is only shape data; the map semantics, the terrain passes and the
 * validation stay the same, so any biome tileset still renders the result.
 *
 * The two carvers match the real games, measured off the `pret/pokefirered`
 * decomp layouts:
 *
 *   route  Route 1: an open grass field (about 38% blocked) cut by one-tile
 *          tree hedges attached to the borders, so you snake through in the gaps.
 *   forest Viridian Forest: a labyrinth (about 57% blocked) of one-tile
 *          corridors through dense trees, with a few loops.
 *   cavern Mt. Moon: wide two-tile corridors and open rock chambers (about 40%
 *          blocked).
 *
 * The carving itself lives in `sketch.ts`; this module is the data the biome
 * picks (`src/data/biomes.ts`), kept pure so the balance can be tuned without
 * touching the generator.
 */

export type LayoutStyle = 'route' | 'forest' | 'cavern';

export type LayoutSpec = Readonly<{
  /** `hedges` leaves the field open and drops tree bars; `maze` carves a grid. */
  kind: 'hedges' | 'maze';
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
  route: {
    kind: 'hedges',
    startEdge: 'W',
    exitEdge: 'E',
    pathWidth: 2,
    bars: 90,
    barMin: 3,
    barMax: 9,
    corridorWidth: 2,
    braid: 0,
    jitter: 3,
  },
  forest: {
    kind: 'maze',
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
  cavern: {
    kind: 'maze',
    startEdge: 'S',
    exitEdge: 'N',
    pathWidth: 2,
    bars: 0,
    barMin: 3,
    barMax: 6,
    corridorWidth: 2,
    braid: 0.5,
    jitter: 0,
  },
};

export const DEFAULT_LAYOUT: LayoutStyle = 'route';

export function isLayoutStyle(value: unknown): value is LayoutStyle {
  return value === 'route' || value === 'forest' || value === 'cavern';
}
