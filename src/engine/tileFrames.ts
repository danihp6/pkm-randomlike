import type { Tile } from './grid';
import { FLOOR, WALL, padMap, type TileMap } from './map';
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
 * Which cell of the motif `(x, y)` draws as: the row index into
 * `pattern.rows` and the column index into that row. The phase is anchored to
 * the cell's own **contiguous wall run**, so a run a lane detached from the stack
 * above or below draws as a whole object: its top adds the crown (`rows[0]`, the
 * walkable tip) when there is no tree above it, and its bottom the base when
 * there is no tree below. Before, the whole column anchored the phase, so such a
 * run drew as a mid-stack slice - a crown/body over ground with no tree above,
 * and no trunk at its own foot. `cleanWalls` guarantees the runs are whole
 * objects, so re-anchoring only ever adds the cap the run is missing.
 *
 * With `border`, a mass that reaches the map's top or bottom edge is a **window**
 * into the forest continuing past the limit: it is extended two rows outward (one
 * tree's overlap) before the phase is read, so its visible edge is a mid-stack
 * crown/body and the motif is never cut into a crop at the border. Interior runs are
 * unchanged, so a detached tree still shows its own crown and trunk.
 */
export function patternCell(
  map: TileMap,
  x: number,
  y: number,
  pattern: WallPattern,
  border = false,
): Readonly<{ row: number; col: number }> {
  const { height } = dimensions(map);
  const value = pattern.value;

  let top = y;
  while (top > 0 && map[top - 1][x] === value) top--;
  let bottom = y;
  while (bottom < height - 1 && map[bottom + 1][x] === value) bottom++;
  if (border) {
    const touchesTop = top === 0;
    const touchesBottom = bottom === height - 1;
    const short = bottom - top + 1 < Math.max(2, pattern.rows.length - 2);
    if (touchesTop) top -= 2;
    if (touchesBottom) bottom += 2;
    // A border piece too short to show a whole object reads as mid-stack, not a
    // lone trunk/crown: extend its other end too, so the visible rows are the
    // crown/body a lane would see in a forest that goes on past the edge.
    if (short) {
      if (touchesTop) bottom += 2;
      if (touchesBottom) top -= 2;
    }
  }

  const depth = y - top;
  const foot = bottom - y;
  const last = pattern.rows.length - 1;
  // `rows[0]` is the mass's top and `rows[last]` its trunk foot. The row just
  // above the foot is the mass's own lower leaves (`last - 1`) and its second row
  // is its upper leaves (`1`). In between, the interior alternates the crown laid
  // on the tree's own upper body (`2`) with the body row laid on the trunk of the
  // tree above (`3`), so the trunk stays hidden and only shows at the mass's foot.
  const aboveFoot = depth >= 2 && foot === 1;
  const row = depth === 0 ? 0 : foot === 0 ? last : aboveFoot ? last - 1 : depth === 1 ? 1 : depth % 2 === 0 ? 2 : 3;
  // The pattern column stays anchored to the column's own first wall cell, so a
  // lane that bites the side below the top cannot slide the run's columns aside.
  let colTop = 0;
  while (colTop < height && map[colTop][x] !== value) colTop++;
  const left = runLength(map, x, colTop, { x: -1, y: 0 }, value);
  const right = runLength(map, x, colTop, { x: 1, y: 0 }, value);
  // Centre the motif on a wall narrower than the pattern, so a lone one-tile
  // hedge shows the whole tree's middle column instead of its left edge.
  const span = left + 1 + right;
  const offset = span >= pattern.cols ? 0 : Math.floor((pattern.cols - span) / 2);
  return { row, col: (left + offset) % pattern.cols };
}

/**
 * Resolves a whole wall motif: the mass's top row is `rows[0]`, its bottom row
 * is the last one, and the rows in between cycle by depth so a tall wall reads
 * as stacked objects. The column repeats across x from the mass's left edge.
 */
export function patternFrame(map: TileMap, x: number, y: number, pattern: WallPattern, border = false): number {
  const { row, col } = patternCell(map, x, y, pattern, border);
  return pattern.rows[row][col];
}

/**
 * The wall cells that draw as the motif's **pure top row** (`rows[0]`, the crown
 * over open ground), as `x,y` keys. These are the walkable tips: a tree's own
 * crown, never a middle `rows[2]` crown laid over the tree above. A cell on the
 * one-tile border ring is never a tip: the border is the fence (and the outer
 * masses are a window into the forest past the limit, `patternCell`). The route
 * scene walks on the tips and draws them over the player.
 */
export function treeTipKeys(map: TileMap, tileset: TilesetConfig, pad = 0): Set<string> {
  const keys = new Set<string>();
  const pattern = tileset.wallPattern;
  if (!pattern) return keys;
  const height = map.length;
  const width = height > 0 ? map[0].length : 0;
  const framed = pad > 0 ? padMap(map, pad, FLOOR) : map;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) continue;
      if (map[y][x] !== pattern.value) continue;
      if (patternCell(framed, x + pad, y + pad, pattern).row === 0) keys.add(`${x},${y}`);
    }
  }
  return keys;
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
 * renderer only turns the result into a draw call. With `border`, the wall motif's
 * outer rows draw the forest continuing past the limit (`patternCell`).
 */
export function resolveTileFrame(
  map: TileMap,
  x: number,
  y: number,
  tileset: TilesetConfig,
  border = false,
): TileFrame | null {
  const { width, height } = dimensions(map);
  if (x < 0 || x >= width || y < 0 || y >= height) return null;
  const value = map[y][x];
  const commonFrame = tileset.commonFrames?.[value];
  if (commonFrame !== undefined) return { source: 'common', frame: commonFrame };

  if (tileset.wallPattern && tileset.wallPattern.value === value) {
    return { source: 'atlas', frame: patternFrame(map, x, y, tileset.wallPattern, border) };
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
