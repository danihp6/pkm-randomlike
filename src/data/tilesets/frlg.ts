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
  FRAME_LEDGE,
  TILESET_COLS,
  TILESET_ROWS,
  WATER_SHAPES,
  type TilesetConfig,
  type WallPattern,
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

/**
 * FRLG walls are whole objects, not a per-shape stamp: the tree is the real
 * FireRed 3x4 block from the bottom-left of the sheet, three tiles wide. These
 * frames hold its cells and must stay in step with `build-tilesets.mjs`:
 *
 * - `TOP` is the crown against open ground (the mass's top row),
 * - `BODY` is the tree's own upper leaves,
 * - `CROWN` is the next tree's crown laid over the lower leaves of the tree above,
 * - `MID` is a tree's upper leaves laid over the trunk of the tree above (so the
 *   trunk is hidden and its lower leaves never show through the body),
 * - `LOWER` is the mass's lower leaves (the row above the foot),
 * - `BASE` is the trunk platform at the foot of a mass,
 * so two stacked trees read `TOP, BODY, CROWN, MID, CROWN, ...`: each crown lands
 * on the lower-body row of the tree above and the body row covers its trunk, so a
 * trunk only shows at the foot.
 */
export const FRLG_WALL_TOP_FRAMES = [7, 8, 9] as const;
export const FRLG_WALL_BODY_FRAMES = [10, 11, 12] as const;
export const FRLG_WALL_CROWN_FRAMES = [13, 14, 15] as const;
export const FRLG_WALL_MID_FRAMES = [16, 17, 18] as const;
export const FRLG_WALL_LOWER_FRAMES = [19, 20, 21] as const;
export const FRLG_WALL_BASE_FRAMES = [22, 23, 44] as const;

const WALL_PATTERN: WallPattern = {
  value: WALL,
  cols: 3,
  rows: [
    FRLG_WALL_TOP_FRAMES,
    FRLG_WALL_BODY_FRAMES,
    FRLG_WALL_CROWN_FRAMES,
    FRLG_WALL_MID_FRAMES,
    FRLG_WALL_LOWER_FRAMES,
    FRLG_WALL_BASE_FRAMES,
  ],
};

/**
 * The field's ground is uniform: the lighter floor frames (`FLOOR_ALT_*`) are a
 * second, paler grass on the source sheet, and laid beside a wall they read as a
 * route path rather than a shadow. FRLG keeps only the clean frame and drops the
 * PMD-style wall-edge decal (`wallAdjacentVariants`) until a real path is drawn.
 */
const FLOOR_CLEAN = [FRAME_FLOOR];

/**
 * The FRLG route fields (grass, forest, cave) share one atlas layout: floor
 * variants, the wall motif (a three-wide tree/rock run, `wallPattern`) and the
 * rocky-banked pond. Only the art per biome differs, which is why one config
 * serves all three sheets.
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
    [WALL]: FRLG_WALL_BODY_FRAMES[1],
    [EXIT]: FRAME_FLOOR,
    [TRAP]: FRAME_FLOOR,
    [CHEST]: FRAME_FLOOR,
    [ITEM]: FRAME_FLOOR,
    [CARPET]: FRAME_FLOOR,
    [WATER]: WATER_SHAPES.interior,
    // Tall grass has no dedicated FRLG frame yet (the route draws the tall-grass
    // tuft as an overlay, `docs/tileset-spec.md` §6); the ledge draws its own
    // rocky lip so a one-way drop reads as one.
    [TALL_GRASS]: FRAME_FLOOR,
    [LEDGE]: FRAME_LEDGE,
  },
  autotile: [{ value: WATER, openValue: FLOOR, variants: WATER_SHAPES }],
  wallPattern: WALL_PATTERN,
  variants: {
    [FLOOR]: FLOOR_CLEAN,
    [TRAP]: FLOOR_CLEAN,
    [CHEST]: FLOOR_CLEAN,
    [ITEM]: FLOOR_CLEAN,
    [TALL_GRASS]: FLOOR_CLEAN,
  },
  commonFrames: { [EXIT]: COMMON_FRAME_STAIRS, [CARPET]: COMMON_FRAME_CARPET },
};
