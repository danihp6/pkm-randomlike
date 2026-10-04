import { CARPET, CHEST, EXIT, FLOOR, ITEM, TRAP, WALL, WATER } from './map';

/**
 * The atlas contract every biome tileset must satisfy, so a route can swap its
 * tileset and keep rendering the same map values. Layout: 4 cols x 13 rows of
 * 24x24 cells (96x312) drawn from the biome sheet, plus a shared 5x1 sheet for
 * the biome-agnostic tiles (exit, trap, chest, item, carpet).
 */
export const TILE_SIZE = 24;
export const TILESET_COLS = 4;
export const TILESET_ROWS = 13;
export const ATLAS_WIDTH = TILE_SIZE * TILESET_COLS;
export const ATLAS_HEIGHT = TILE_SIZE * TILESET_ROWS;

export const FRAME_FLOOR = 0;
export const FRAME_FLOOR_ALT_1 = 1;
export const FRAME_FLOOR_ALT_2 = 2;
export const FRAME_STAIRS = 3;
export const FRAME_TRAP = 4;
export const FRAME_CHEST = 5;
export const FRAME_ITEM = 6;
export const FRAME_WALL_INTERIOR = 7;
export const FRAME_WALL_EDGE_N = 8;
export const FRAME_WALL_EDGE_E = 9;
export const FRAME_WALL_EDGE_S = 10;
export const FRAME_WALL_EDGE_W = 11;
export const FRAME_WALL_CORNER_NE = 12;
export const FRAME_WALL_CORNER_NW = 13;
export const FRAME_WALL_CORNER_SE = 14;
export const FRAME_WALL_CORNER_SW = 15;
/**
 * Inner (concave) corners: both cardinal neighbours on that side are open floor
 * but the diagonal between them is still wall - the inside hinge of an L-shaped
 * room/corridor junction, as opposed to CORNER_* (convex, diagonal also open).
 */
export const FRAME_WALL_INNER_CORNER_NE = 16;
export const FRAME_WALL_INNER_CORNER_NW = 17;
export const FRAME_WALL_INNER_CORNER_SE = 18;
export const FRAME_WALL_INNER_CORNER_SW = 19;
/**
 * Diagonal-only corners: no cardinal neighbour is open, just one diagonal - a
 * plain rectangular room's outer ring corner. Distinct from CORNER_* because
 * the art needed differs: CORNER_* is mostly wall with two open sides, this one
 * is wall on all 4 cardinal sides and only opens on the diagonal point.
 */
export const FRAME_WALL_DIAGONAL_CORNER_NE = 20;
export const FRAME_WALL_DIAGONAL_CORNER_NW = 21;
export const FRAME_WALL_DIAGONAL_CORNER_SE = 22;
export const FRAME_WALL_DIAGONAL_CORNER_SW = 23;

/**
 * Water autotile shapes - same shape vocabulary as FRAME_WALL_*, one slot per
 * shape a biome tileset needs. Water is solid (`map.ts`'s SOLID), so it's an
 * obstacle to carve around, not a hazard.
 */
export const FRAME_WATER_INTERIOR = 24;
export const FRAME_WATER_EDGE_N = 25;
export const FRAME_WATER_EDGE_E = 26;
export const FRAME_WATER_EDGE_S = 27;
export const FRAME_WATER_EDGE_W = 28;
export const FRAME_WATER_CORNER_NE = 29;
export const FRAME_WATER_CORNER_NW = 30;
export const FRAME_WATER_CORNER_SE = 31;
export const FRAME_WATER_CORNER_SW = 32;
export const FRAME_WATER_INNER_CORNER_NE = 33;
export const FRAME_WATER_INNER_CORNER_NW = 34;
export const FRAME_WATER_INNER_CORNER_SE = 35;
export const FRAME_WATER_INNER_CORNER_SW = 36;
export const FRAME_WATER_DIAGONAL_CORNER_NE = 37;
export const FRAME_WATER_DIAGONAL_CORNER_NW = 38;
export const FRAME_WATER_DIAGONAL_CORNER_SE = 39;
export const FRAME_WATER_DIAGONAL_CORNER_SW = 40;

export const FRAME_FLOOR_ALT_3 = 41;
export const FRAME_FLOOR_ALT_4 = 42;
export const FRAME_FLOOR_ALT_5 = 43;

/**
 * The remaining 4-neighbour bit combinations: two open sides opposite each other
 * (a straight corridor through the tile), three open sides (T-junction, named
 * for its closed side) and all four open (an isolated pillar).
 */
export const FRAME_WALL_STRAIGHT_NS = 44;
export const FRAME_WALL_STRAIGHT_EW = 45;
export const FRAME_WALL_TEE_N = 46;
export const FRAME_WALL_TEE_E = 47;
export const FRAME_WALL_TEE_S = 48;
export const FRAME_WALL_TEE_W = 49;
export const FRAME_WALL_CROSS = 50;

/**
 * The last cell of the 4x13 sheet, same slot for every biome: the rocky lip that
 * a route's one-way ledges draw. The PMD sheets leave it unused; the FRLG fields
 * stamp their own cliff tile there (`docs/tileset-spec.md` §6).
 */
export const FRAME_LEDGE = 51;

export const COMMON_TILE_SIZE = 24;
export const COMMON_ATLAS_COLS = 5;
export const COMMON_ATLAS_ROWS = 1;
export const COMMON_FRAME_STAIRS = 0;
export const COMMON_FRAME_TRAP = 1;
export const COMMON_FRAME_CHEST = 2;
export const COMMON_FRAME_ITEM = 3;
export const COMMON_FRAME_CARPET = 4;

/** Named slots for one autotile shape family (interior/edges/corners/...). */
export type AutotileShapeSet = Readonly<{
  interior: number;
  edgeN: number;
  edgeE: number;
  edgeS: number;
  edgeW: number;
  cornerNE: number;
  cornerNW: number;
  cornerSE: number;
  cornerSW: number;
  innerCornerNE: number;
  innerCornerNW: number;
  innerCornerSE: number;
  innerCornerSW: number;
  diagonalCornerNE: number;
  diagonalCornerNW: number;
  diagonalCornerSE: number;
  diagonalCornerSW: number;
  straightNS: number;
  straightEW: number;
  teeN: number;
  teeE: number;
  teeS: number;
  teeW: number;
  cross: number;
}>;

/**
 * A tile matching `value` picks its frame based on which of its 4-neighbours
 * are not `value` - see `tileFrames.ts`.
 */
export type AutotileRule = Readonly<{
  value: number;
  openValue: number;
  variants: AutotileShapeSet;
}>;

/**
 * A whole multi-tile wall motif anchored to the top-left of a wall mass, so the
 * mass reads as a run of complete objects (fireRed trees, Mt. Moon boulders)
 * instead of one repeated stamp. `rows[0]` is the mass's top layer and
 * `rows[rows.length - 1]` its base layer; the rows between them cycle vertically,
 * and `cols` frames repeat across x. See `tileFrames.ts`'s `patternFrame`.
 */
export type WallPattern = Readonly<{
  value: number;
  cols: number;
  rows: readonly (readonly number[])[];
}>;

export type TilesetConfig = Readonly<{
  atlas: Readonly<{
    tileSize: number;
    cols: number;
    rows: number;
    width: number;
    height: number;
  }>;
  /** Default frame per map value, used when no autotile rule matches. */
  frames: Readonly<Record<number, number>>;
  autotile?: readonly AutotileRule[];
  /**
   * A repeating multi-tile motif for one map value (walls), taking priority over
   * `autotile`: the frame is anchored to the mass's top-left so a wall reads as
   * whole trees/boulders. See `WallPattern`.
   */
  wallPattern?: WallPattern;
  /** Map values that pick one of several frames for visual variety, deterministically per tile. */
  variants?: Readonly<Record<number, readonly number[]>>;
  /**
   * Like `variants`, but only for a tile cardinally adjacent to a WALL - takes
   * priority there. Lets a tileset reserve its clean frame for open interiors
   * and save shadow/edge decoration for tiles that actually border a wall.
   */
  wallAdjacentVariants?: Readonly<Record<number, readonly number[]>>;
  /** Map values drawn from the shared common atlas instead of the biome sheet. */
  commonFrames?: Readonly<Record<number, number>>;
}>;

export const WALL_SHAPES: AutotileShapeSet = {
  interior: FRAME_WALL_INTERIOR,
  edgeN: FRAME_WALL_EDGE_N,
  edgeE: FRAME_WALL_EDGE_E,
  edgeS: FRAME_WALL_EDGE_S,
  edgeW: FRAME_WALL_EDGE_W,
  cornerNE: FRAME_WALL_CORNER_NE,
  cornerNW: FRAME_WALL_CORNER_NW,
  cornerSE: FRAME_WALL_CORNER_SE,
  cornerSW: FRAME_WALL_CORNER_SW,
  innerCornerNE: FRAME_WALL_INNER_CORNER_NE,
  innerCornerNW: FRAME_WALL_INNER_CORNER_NW,
  innerCornerSE: FRAME_WALL_INNER_CORNER_SE,
  innerCornerSW: FRAME_WALL_INNER_CORNER_SW,
  diagonalCornerNE: FRAME_WALL_DIAGONAL_CORNER_NE,
  diagonalCornerNW: FRAME_WALL_DIAGONAL_CORNER_NW,
  diagonalCornerSE: FRAME_WALL_DIAGONAL_CORNER_SE,
  diagonalCornerSW: FRAME_WALL_DIAGONAL_CORNER_SW,
  straightNS: FRAME_WALL_STRAIGHT_NS,
  straightEW: FRAME_WALL_STRAIGHT_EW,
  teeN: FRAME_WALL_TEE_N,
  teeE: FRAME_WALL_TEE_E,
  teeS: FRAME_WALL_TEE_S,
  teeW: FRAME_WALL_TEE_W,
  cross: FRAME_WALL_CROSS,
};

export const WATER_SHAPES: AutotileShapeSet = {
  interior: FRAME_WATER_INTERIOR,
  edgeN: FRAME_WATER_EDGE_N,
  edgeE: FRAME_WATER_EDGE_E,
  edgeS: FRAME_WATER_EDGE_S,
  edgeW: FRAME_WATER_EDGE_W,
  cornerNE: FRAME_WATER_CORNER_NE,
  cornerNW: FRAME_WATER_CORNER_NW,
  cornerSE: FRAME_WATER_CORNER_SE,
  cornerSW: FRAME_WATER_CORNER_SW,
  innerCornerNE: FRAME_WATER_INNER_CORNER_NE,
  innerCornerNW: FRAME_WATER_INNER_CORNER_NW,
  innerCornerSE: FRAME_WATER_INNER_CORNER_SE,
  innerCornerSW: FRAME_WATER_INNER_CORNER_SW,
  diagonalCornerNE: FRAME_WATER_DIAGONAL_CORNER_NE,
  diagonalCornerNW: FRAME_WATER_DIAGONAL_CORNER_NW,
  diagonalCornerSE: FRAME_WATER_DIAGONAL_CORNER_SE,
  diagonalCornerSW: FRAME_WATER_DIAGONAL_CORNER_SW,
  // Ponds are carved as small blobs, which by construction only ever produce
  // corner shapes - these are unreachable, so they fall back to plain water
  // rather than spending atlas space on art nothing draws.
  straightNS: FRAME_WATER_INTERIOR,
  straightEW: FRAME_WATER_INTERIOR,
  teeN: FRAME_WATER_INTERIOR,
  teeE: FRAME_WATER_INTERIOR,
  teeS: FRAME_WATER_INTERIOR,
  teeW: FRAME_WATER_INTERIOR,
  cross: FRAME_WATER_INTERIOR,
};

/** Map values that render as a plain ground tile under their own sprite. */
export const COMMON_FRAMES: Readonly<Record<number, number>> = {
  [CARPET]: COMMON_FRAME_CARPET,
};

export const GROUND_VALUES: readonly number[] = [FLOOR, TRAP, CHEST, ITEM];
export const ALL_MAP_VALUES: readonly number[] = [
  FLOOR,
  WALL,
  EXIT,
  TRAP,
  CHEST,
  ITEM,
  WATER,
  CARPET,
];
