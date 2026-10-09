import type { Tile } from '../grid';
import { FLOOR, tileAt, type TileMap } from '../map';
import type { AccessEdge } from './layout';

/**
 * The border doors of a route (`docs/routes-spec.md`): an opening is carved as a
 * **gap** in the solid tree ring, so the way out is the whole stretch of walkable
 * border cells, not the single cell the opening was seeded on. These helpers let
 * the scene answer "does this cell lead out, and by which edge" for any of them.
 *
 * A decorative **tree tip** (a crown the player can walk over,
 * `src/engine/tileFrames.ts`) sits on the left/right border too, but it is a `WALL`
 * in the raw route map — it only becomes walkable in the movement copy — so it is
 * never mistaken for a door.
 */

/** The cardinally ordered border edges, so a derivation is deterministic. */
export const BORDER_EDGES: readonly AccessEdge[] = ['N', 'E', 'S', 'W'];

/** The border edge a cell sits on, or null when it is not on the border. */
export function borderEdge(tile: Tile, width: number, height: number): AccessEdge | null {
  if (tile.x === 0) return 'W';
  if (tile.x === width - 1) return 'E';
  if (tile.y === 0) return 'N';
  if (tile.y === height - 1) return 'S';
  return null;
}

/**
 * The edge a border cell exits through: its border edge when the cell is a carved
 * opening (raw `FLOOR`) and the route declares an opening on that edge. Any cell
 * of the gap counts, not just the seeded one. When `approach` is given, the cell
 * only exits if the step that landed on it was taken toward that same border — so
 * walking **along** a wide gap, or standing on one after a transition, never
 * bounces the player back out. Null for a wall, a tree tip or an opening-less edge.
 */
export function exitEdgeAt(
  tiles: TileMap,
  width: number,
  height: number,
  openingEdges: readonly AccessEdge[],
  tile: Tile,
  approach?: AccessEdge,
): AccessEdge | null {
  const edge = borderEdge(tile, width, height);
  if (!edge) return null;
  if (approach !== undefined && approach !== edge) return null;
  if (tileAt(tiles, tile) !== FLOOR) return null;
  return openingEdges.includes(edge) ? edge : null;
}
