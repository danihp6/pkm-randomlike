import type { Tile } from './grid';
import { FLOOR, WALL, type TileMap } from './map';
import type { AutotileRule, TilesetConfig, WallPattern } from './tileset';

export type TileFrameSource = 'atlas' | 'common';
export type TileFrame = Readonly<{ source: TileFrameSource; frame: number }>;

function dimensions(map: TileMap): { width: number; height: number } {
  const height = map.length;
  const width = height > 0 ? map[0].length : 0;
  return { width, height };
}

/**
 * Generic neighbour-aware framing for any AutotileRule (walls, water, ...).
 * Any tile that isn't this rule's own value counts as open, so a wall next to a
 * chest still picks an edge/corner frame instead of its walled-off interior one.
 */
export function autotileFrame(map: TileMap, x: number, y: number, rule: AutotileRule): number {
  const { width, height } = dimensions(map);
  const isOpen = (nx: number, ny: number): boolean => {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
    return map[ny][nx] !== rule.value;
  };
  const bits = (isOpen(x, y - 1) ? 1 : 0) | (isOpen(x + 1, y) ? 2 : 0) | (isOpen(x, y + 1) ? 4 : 0) | (isOpen(x - 1, y) ? 8 : 0);
  const { variants } = rule;
  switch (bits) {
    case 1:
      return variants.edgeN;
    case 2:
      return variants.edgeE;
    case 4:
      return variants.edgeS;
    case 8:
      return variants.edgeW;
    case 5:
      return variants.straightNS;
    case 10:
      return variants.straightEW;
    case 7:
      return variants.teeW;
    case 11:
      return variants.teeS;
    case 13:
      return variants.teeE;
    case 14:
      return variants.teeN;
    case 15:
      return variants.cross;
    // Both cardinal sides of the corner are open floor. If the diagonal between
    // them is open too it's a straight double-edge stub (rare) - same as the
    // plain convex corner. If the diagonal is still wall, this tile is the
    // inside hinge of an L-shaped junction.
    case 3:
      return isOpen(x + 1, y - 1) ? variants.cornerNE : variants.innerCornerNE;
    case 6:
      return isOpen(x + 1, y + 1) ? variants.cornerSE : variants.innerCornerSE;
    case 12:
      return isOpen(x - 1, y + 1) ? variants.cornerSW : variants.innerCornerSW;
    case 9:
      return isOpen(x - 1, y - 1) ? variants.cornerNW : variants.innerCornerNW;
    default: {
      // No cardinal neighbour is open - the common case for a plain rectangular
      // room's outer ring, where floor only touches this wall diagonally.
      const ne = isOpen(x + 1, y - 1);
      const nw = isOpen(x - 1, y - 1);
      const se = isOpen(x + 1, y + 1);
      const sw = isOpen(x - 1, y + 1);
      if (ne && !nw && !se && !sw) return variants.diagonalCornerNE;
      if (nw && !ne && !se && !sw) return variants.diagonalCornerNW;
      if (se && !ne && !nw && !sw) return variants.diagonalCornerSE;
      if (sw && !ne && !nw && !se) return variants.diagonalCornerSW;
      return variants.interior;
    }
  }
}

/** Stable positional hash, so a map's decoration is a pure function of the seed-independent tile. */
export function variantFrame(x: number, y: number, options: readonly number[]): number {
  const index = (((x * 374761393 + y * 668265263) % options.length) + options.length) % options.length;
  return options[index];
}

/** How many neighbours in `dir` share the tile's own value before the mass ends. */
function runLength(map: TileMap, x: number, y: number, dir: Tile, value: number): number {
  const { width, height } = dimensions(map);
  let run = 0;
  let cx = x + dir.x;
  let cy = y + dir.y;
  while (cx >= 0 && cx < width && cy >= 0 && cy < height && map[cy][cx] === value) {
    run += 1;
    cx += dir.x;
    cy += dir.y;
  }
  return run;
}

/**
 * Resolves a whole wall motif: the mass's top row is `rows[0]`, its bottom row
 * is the last one, and the rows in between cycle by depth so a tall wall reads
 * as stacked objects. The column repeats across x from the mass's left edge.
 *
 * The phase is anchored to the column's own **first and last wall cell**, so a
 * lane that crosses the column is a hole in the stack instead of two shorter
 * trees that re-anchor half-way down (normalising the extremes is `cleanTrees`).
 * The pattern column is anchored to those cells too, so a lane that bites the
 * side below the top cannot slide the trees there one pattern column aside.
 */
export function patternFrame(map: TileMap, x: number, y: number, pattern: WallPattern): number {
  const { height } = dimensions(map);
  const value = pattern.value;
  let top = 0;
  while (top < height && map[top][x] !== value) top++;
  let bottom = height - 1;
  while (bottom >= 0 && map[bottom][x] !== value) bottom--;

  const depth = y - top;
  const foot = bottom - y;
  const last = pattern.rows.length - 1;
  // `rows[0]` is the mass's top and `rows[last]` its trunk foot. The row just
  // above the foot is the mass's own lower leaves (`last - 1`) and its second row
  // is its upper leaves (`1`). In between, the interior alternates the crown laid
  // on the tree's own upper body (`2`) with the body row laid on the trunk of the
  // tree above (`3`), so the trunk stays hidden and only shows at the mass's foot.
  const aboveFoot = depth >= 2 && foot === 1;
  const rowIndex = depth === 0 ? 0 : foot === 0 ? last : aboveFoot ? last - 1 : depth === 1 ? 1 : depth % 2 === 0 ? 2 : 3;
  const row = pattern.rows[rowIndex];
  const left = runLength(map, x, top, { x: -1, y: 0 }, value);
  const right = runLength(map, x, top, { x: 1, y: 0 }, value);
  // Centre the motif on a wall narrower than the pattern, so a lone one-tile
  // hedge shows the whole tree's middle column instead of its left edge.
  const span = left + 1 + right;
  const offset = span >= pattern.cols ? 0 : Math.floor((pattern.cols - span) / 2);
  return row[(left + offset) % pattern.cols];
}

export function isNearWall(map: TileMap, x: number, y: number): boolean {
  const { width, height } = dimensions(map);
  const isWall = (nx: number, ny: number): boolean =>
    nx >= 0 && nx < width && ny >= 0 && ny < height && map[ny][nx] === WALL;
  return isWall(x, y - 1) || isWall(x + 1, y) || isWall(x, y + 1) || isWall(x - 1, y);
}

/**
 * Resolves which atlas frame draws `(x, y)`, or null when the map value has no
 * frame (an empty cell, or a tileset that intentionally hides it). Pure: the
 * renderer only turns the result into a draw call.
 */
export function resolveTileFrame(map: TileMap, x: number, y: number, tileset: TilesetConfig): TileFrame | null {
  const { width, height } = dimensions(map);
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  const value = map[y][x];
  const commonFrame = tileset.commonFrames?.[value];
  if (commonFrame !== undefined) return { source: 'common', frame: commonFrame };

  if (tileset.wallPattern && tileset.wallPattern.value === value) {
    return { source: 'atlas', frame: patternFrame(map, x, y, tileset.wallPattern) };
  }

  const rule = tileset.autotile?.find((candidate) => candidate.value === value);
  if (rule) return { source: 'atlas', frame: autotileFrame(map, x, y, rule) };

  const wallAdjacent = tileset.wallAdjacentVariants?.[value];
  if (wallAdjacent && isNearWall(map, x, y)) return { source: 'atlas', frame: variantFrame(x, y, wallAdjacent) };

  const variants = tileset.variants?.[value];
  if (variants) return { source: 'atlas', frame: variantFrame(x, y, variants) };

  const frame = tileset.frames[value];
  return frame === undefined ? null : { source: 'atlas', frame };
}

/**
 * The floor frame a cell would draw if it were ground, used to lay a floor under
 * every tile so a wall frame with a transparent ground (the FRLG tree) shows the
 * same floor — including its wall-edge variant — as the tiles beside it.
 */
export function resolveGroundFrame(map: TileMap, x: number, y: number, tileset: TilesetConfig): TileFrame {
  const wallAdjacent = tileset.wallAdjacentVariants?.[FLOOR];
  if (wallAdjacent && isNearWall(map, x, y)) return { source: 'atlas', frame: variantFrame(x, y, wallAdjacent) };
  const variants = tileset.variants?.[FLOOR];
  if (variants) return { source: 'atlas', frame: variantFrame(x, y, variants) };
  return { source: 'atlas', frame: tileset.frames[FLOOR] ?? 0 };
}
