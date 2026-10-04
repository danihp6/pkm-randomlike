import {
  CARPET,
  CHEST,
  FLOOR,
  ITEM,
  LEDGE,
  TALL_GRASS,
  TRAP,
  WALL,
  WATER,
} from '../../engine/map';
import {
  ATLAS_HEIGHT,
  ATLAS_WIDTH,
  COMMON_FRAME_CARPET,
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
  FRAME_WALL_EDGE_E,
  FRAME_WALL_EDGE_N,
  FRAME_WALL_EDGE_S,
  FRAME_WALL_EDGE_W,
  FRAME_WALL_INTERIOR,
  FRAME_WATER_INTERIOR,
  TILESET_COLS,
  TILESET_ROWS,
  TILE_SIZE,
  WALL_SHAPES,
  WATER_SHAPES,
  type TilesetConfig,
} from '../../engine/tileset';

/**
 * FRAME_FLOOR is the plain dirt-path crop with no sprouts. The other floor
 * frames all carry a visible speckle meant to read as a border decal, so they
 * are reserved for tiles that actually touch a wall.
 */
const FLOOR_CLEAN = [FRAME_FLOOR];
const FLOOR_WALL_ADJACENT = [
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
];

export const WOOD_TILESET: TilesetConfig = {
  atlas: {
    tileSize: TILE_SIZE,
    cols: TILESET_COLS,
    rows: TILESET_ROWS,
    width: ATLAS_WIDTH,
    height: ATLAS_HEIGHT,
  },
  frames: {
    [FLOOR]: FRAME_FLOOR,
    [WALL]: FRAME_WALL_INTERIOR,
    [TRAP]: FRAME_FLOOR,
    [CHEST]: FRAME_FLOOR,
    [ITEM]: FRAME_FLOOR,
    [CARPET]: FRAME_FLOOR,
    [WATER]: FRAME_WATER_INTERIOR,
    [TALL_GRASS]: FRAME_FLOOR,
    [LEDGE]: FRAME_FLOOR,
  },
  autotile: [
    {
      value: WALL,
      openValue: FLOOR,
      variants: {
        ...WALL_SHAPES,
        // This sheet has no dedicated straight/T-junction/pillar art. Reusing
        // the edge tile whose open side matches the shape's most prominent open
        // side puts a real border there instead of a flat interior block.
        straightNS: FRAME_WALL_EDGE_N,
        straightEW: FRAME_WALL_EDGE_W,
        teeN: FRAME_WALL_EDGE_S,
        teeE: FRAME_WALL_EDGE_W,
        teeS: FRAME_WALL_EDGE_N,
        teeW: FRAME_WALL_EDGE_E,
        cross: FRAME_WALL_EDGE_N,
      },
    },
    { value: WATER, openValue: FLOOR, variants: WATER_SHAPES },
  ],
  variants: {
    [FLOOR]: FLOOR_CLEAN,
    [TRAP]: FLOOR_CLEAN,
    [CHEST]: FLOOR_CLEAN,
    [ITEM]: FLOOR_CLEAN,
    [TALL_GRASS]: FLOOR_CLEAN,
  },
  wallAdjacentVariants: {
    [FLOOR]: FLOOR_WALL_ADJACENT,
    [TRAP]: FLOOR_WALL_ADJACENT,
    [CHEST]: FLOOR_WALL_ADJACENT,
    [ITEM]: FLOOR_WALL_ADJACENT,
    [TALL_GRASS]: FLOOR_WALL_ADJACENT,
  },
  commonFrames: { [CARPET]: COMMON_FRAME_CARPET },
};
