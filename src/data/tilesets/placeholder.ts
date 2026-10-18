import { CHEST, CARPET, FLOOR, ITEM, LEDGE, TALL_GRASS, TRAP, WALL, WATER } from '../../engine/map';
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
  FRAME_WALL_INTERIOR,
  FRAME_WATER_INTERIOR,
  TILESET_COLS,
  TILESET_ROWS,
  TILE_SIZE,
  WALL_SHAPES,
  WATER_SHAPES,
  type TilesetConfig,
} from '../../engine/tileset';

const FLOOR_VARIANTS = [
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
];

/**
 * The procedural sheet, kept as a **test fixture**: a `TilesetConfig` with the
 * shared atlas contract (no `grassRustle`, no `wallPattern`) that the frame tests
 * build against. It is not a registry row, so no route renders it.
 */
export const PLACEHOLDER_TILESET: TilesetConfig = {
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
    // No dedicated tall-grass or ledge art yet: both fall back to ground so the
    // route still reads. The grass tuft and the ledge lip are separate overlay
    // sprites, drawn on top (see docs/tileset-spec.md).
    [TALL_GRASS]: FRAME_FLOOR,
    [LEDGE]: FRAME_FLOOR,
  },
  autotile: [
    { value: WALL, openValue: FLOOR, variants: WALL_SHAPES },
    { value: WATER, openValue: FLOOR, variants: WATER_SHAPES },
  ],
  variants: {
    [FLOOR]: FLOOR_VARIANTS,
    [TRAP]: FLOOR_VARIANTS,
    [CHEST]: FLOOR_VARIANTS,
    [ITEM]: FLOOR_VARIANTS,
    [TALL_GRASS]: FLOOR_VARIANTS,
    [LEDGE]: FLOOR_VARIANTS,
  },
  commonFrames: { [CARPET]: COMMON_FRAME_CARPET },
};
