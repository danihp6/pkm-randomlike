import {
  CARPET,
  CHEST,
  EXIT,
  FLOOR,
  ITEM,
  LEDGE,
  TALL_GRASS,
  TRAP,
  WALL,
  WATER,
} from '../../engine/map';
import {
  COMMON_FRAME_CARPET,
  COMMON_FRAME_STAIRS,
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
  TILESET_COLS,
  TILESET_ROWS,
  WALL_SHAPES,
  WATER_SHAPES,
  type TilesetConfig,
} from '../../engine/tileset';

/**
 * FireRed/LeafGreen atlases are native 16px (`D18`), so this tileset declares its
 * own cell size and the scene scales each cell up to the 24px world tile. The
 * sheets are composed by `scripts/frlg/build-tilesets.mjs` from the gitignored
 * `sprite-sources/frlg/` rips.
 */
export const FRLG_TILE_SIZE = 16;
export const FRLG_ATLAS_WIDTH = FRLG_TILE_SIZE * TILESET_COLS;
export const FRLG_ATLAS_HEIGHT = FRLG_TILE_SIZE * TILESET_ROWS;

/** The plain field is the clean frame; the speckled cells dress a wall edge. */
const FLOOR_CLEAN = [FRAME_FLOOR];
const FLOOR_WALL_ADJACENT = [
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
];

/**
 * The FRLG route fields (grass, forest, cave) share one atlas layout:
 * floor variants, the wall autotile shapes drawn as a repeated border and the
 * rocky-banked pond. FRLG draws a route border as a single repeated obstacle
 * tile, so every wall shape resolves to that tile; only the art per biome
 * differs, which is why one config serves all four sheets.
 */
export const FRLG_TILESET: TilesetConfig = {
  atlas: {
    tileSize: FRLG_TILE_SIZE,
    cols: TILESET_COLS,
    rows: TILESET_ROWS,
    width: FRLG_ATLAS_WIDTH,
    height: FRLG_ATLAS_HEIGHT,
  },
  frames: {
    [FLOOR]: FRAME_FLOOR,
    [WALL]: WALL_SHAPES.interior,
    [EXIT]: FRAME_FLOOR,
    [TRAP]: FRAME_FLOOR,
    [CHEST]: FRAME_FLOOR,
    [ITEM]: FRAME_FLOOR,
    [CARPET]: FRAME_FLOOR,
    [WATER]: WATER_SHAPES.interior,
    // Tall grass and ledges have no dedicated FRLG frame yet (the route draws
    // the tall-grass tuft as an overlay, `docs/tileset-spec.md` §6).
    [TALL_GRASS]: FRAME_FLOOR,
    [LEDGE]: FRAME_FLOOR,
  },
  autotile: [
    { value: WALL, openValue: FLOOR, variants: WALL_SHAPES },
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
  commonFrames: { [EXIT]: COMMON_FRAME_STAIRS, [CARPET]: COMMON_FRAME_CARPET },
};
