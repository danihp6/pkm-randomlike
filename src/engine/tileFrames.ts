import { WALL, type TileMap } from './map';
import type { AutotileRule, TilesetConfig } from './tileset';

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

  const rule = tileset.autotile?.find((candidate) => candidate.value === value);
  if (rule) return { source: 'atlas', frame: autotileFrame(map, x, y, rule) };

  const wallAdjacent = tileset.wallAdjacentVariants?.[value];
  if (wallAdjacent && isNearWall(map, x, y)) return { source: 'atlas', frame: variantFrame(x, y, wallAdjacent) };

  const variants = tileset.variants?.[value];
  if (variants) return { source: 'atlas', frame: variantFrame(x, y, variants) };

  const frame = tileset.frames[value];
  return frame === undefined ? null : { source: 'atlas', frame };
}
