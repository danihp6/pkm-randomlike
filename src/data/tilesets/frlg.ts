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
  COMMON_FRAME_CARPET,
  FRAME_FLOOR,
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_LEDGE,
  TILESET_COLS,
  TILESET_ROWS,
  WATER_SHAPES,
  type TilesetConfig,
  type VariantFrames,
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

/**
 * The ledge run's end caps, stamped into the FRLG sheet's otherwise unused
 * stair/trap slots (frames 3 and 4; the field draws those from the common atlas).
 * The centre lip stays at `FRAME_LEDGE` (51), so a ledge run reads as a left cap,
 * repeated centres and a right cap. Must stay in step with
 * `scripts/frlg/build-tilesets.mjs`.
 */
export const FRLG_LEDGE_LEFT = 3;
export const FRLG_LEDGE_RIGHT = 4;

/**
 * The tall-grass ground tile, stamped into the sheet's unused chest slot (frame
 * 5; the field draws chest/item from the common atlas). Must stay in step with
 * `scripts/frlg/build-tilesets.mjs`.
 */
export const FRLG_TALL_GRASS = 5;

/**
 * The tall grass's own rustle, in rip order: cell 6 is the parked frame — the rip's
 * **settled** frame (its frame 4, which is the hit's own last frame, so the settle has
 * no jump) — and 45-48 the hit's four frames, all stamped with their alpha kept (45 is
 * the closing frame, opaque over the cell for its one beat). Raw, so the overlay never
 * paints a ground of its own. Must stay in step with `scripts/frlg/build-tilesets.mjs`.
 */
export const FRLG_GRASS_RUSTLE_FRAMES = [6, 45, 46, 47, 48] as const;

/** The forest's rustle tint: its tuft is the dark one (`tallGrass: [2,33]`), the art is not. */
export const FRLG_GRASS_RUSTLE_TINT_FOREST = 0xc1d7ef;

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
 * route path rather than a shadow. The outdoor and cave fields keep only the clean
 * frame and drop the PMD-style wall-edge decal (`wallAdjacentVariants`) until a
 * real path is drawn. The forest mixes its dark ground tiles instead (below).
 */
const FLOOR_CLEAN = [FRAME_FLOOR];

/**
 * The forest floor is a weighted mix of its own dark ground tiles (all `rgb(88,160,128)`):
 * the base ground dominates, three sibling grounds add variety and the flowered
 * ground is rare. The weights are relative, so adding a rare tile does not
 * meaningfully change how often the others show. The build script stamps each
 * frame from the matching source cell (`build-tilesets.mjs`).
 */
const FOREST_FLOOR_VARIANTS: VariantFrames = [
  { frame: FRAME_FLOOR, weight: 8 },
  { frame: FRAME_FLOOR_ALT_1, weight: 5 },
  { frame: FRAME_FLOOR_ALT_2, weight: 4 },
  { frame: FRAME_FLOOR_ALT_3, weight: 3 },
  { frame: FRAME_FLOOR_ALT_4, weight: 1 },
];

/**
 * The FRLG route fields (grass, forest, cave) share one atlas layout: floor
 * variants, the wall motif (a three-wide tree/rock run, `wallPattern`) and the
 * rocky-banked pond. Only the art per biome differs, so `FRLG_TILESET` serves the
 * outdoor and cave sheets; `FRLG_FOREST_TILESET` reuses it and only swaps the floor
 * variant mix for the forest's weighted dark ground.
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
    [TRAP]: FRAME_FLOOR,
    [CHEST]: FRAME_FLOOR,
    [ITEM]: FRAME_FLOOR,
    [CARPET]: FRAME_FLOOR,
    [WATER]: WATER_SHAPES.interior,
    // Tall grass and the ledge draw their own field tiles; the tall grass tuft is
    // no longer a procedural overlay on the FRLG fields. The rustle sequence is the
    // field effect the route cycles on the player's own cell.
    [TALL_GRASS]: FRLG_TALL_GRASS,
    [LEDGE]: FRAME_LEDGE,
  },
  grassRustle: FRLG_GRASS_RUSTLE_FRAMES,
  grassRustleTint: 0xffffff,
  autotile: [{ value: WATER, openValue: FLOOR, variants: WATER_SHAPES }],
  wallPattern: WALL_PATTERN,
  ledgeFrames: { left: FRLG_LEDGE_LEFT, center: FRAME_LEDGE, right: FRLG_LEDGE_RIGHT },
  variants: {
    [FLOOR]: FLOOR_CLEAN,
    [TRAP]: FLOOR_CLEAN,
    [CHEST]: FLOOR_CLEAN,
    [ITEM]: FLOOR_CLEAN,
  },
  commonFrames: { [CARPET]: COMMON_FRAME_CARPET },
};

/**
 * The forest field: the same layout as `FRLG_TILESET`, but the floor draws the
 * forest's weighted dark-ground mix (`FOREST_FLOOR_VARIANTS`) instead of the single
 * clean frame. The tall-grass tuft and the tree art already carry that dark ground.
 */
export const FRLG_FOREST_TILESET: TilesetConfig = {
  ...FRLG_TILESET,
  grassRustleTint: FRLG_GRASS_RUSTLE_TINT_FOREST,
  variants: { ...FRLG_TILESET.variants, [FLOOR]: FOREST_FLOOR_VARIANTS },
};
