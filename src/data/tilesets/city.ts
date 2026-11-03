import { DOOR, FLOOR, PATH, PLAZA, ROOF, SIGN, TALL_GRASS, WALL, WATER } from '../../engine/map';
import { TILESET_COLS, TILESET_ROWS, type TilesetConfig } from '../../engine/tileset';
import manifest from '../frlg/city.json';
import { FRLG_ATLAS_HEIGHT, FRLG_ATLAS_WIDTH, FRLG_TILE_SIZE } from './frlg';

/** The tile kinds a city is laid out against (`docs/tileset-spec.md` §1). */
export type CityKind = 'grass' | 'path' | 'plaza' | 'wall' | 'roof' | 'door' | 'water' | 'sign';

/** The map value each city kind is stamped as. Frozen for the generators. */
export const CITY_KIND_VALUES: Readonly<Record<CityKind, number>> = {
  grass: TALL_GRASS,
  path: PATH,
  plaza: PLAZA,
  wall: WALL,
  roof: ROOF,
  door: DOOR,
  water: WATER,
  sign: SIGN,
};

/**
 * The city field: a paved street grid of one plain frame per kind, plus the atlas's
 * frame 0 — the plain pavement `resolveGroundFrame` lays under every cell. No
 * autotile, no wall pattern and no variants: a building is a rectangular block of
 * `WALL`/`ROOF` cells with a `DOOR` cell on its street row, and shape-aware building
 * edges are a later batch (`docs/tileset-spec.md` §6).
 */
export const FRLG_CITY_TILESET: TilesetConfig = {
  atlas: {
    tileSize: FRLG_TILE_SIZE,
    cols: TILESET_COLS,
    rows: TILESET_ROWS,
    width: FRLG_ATLAS_WIDTH,
    height: FRLG_ATLAS_HEIGHT,
  },
  frames: {
    [FLOOR]: 0,
    [CITY_KIND_VALUES.grass]: manifest.cells.grass,
    [CITY_KIND_VALUES.path]: manifest.cells.path,
    [CITY_KIND_VALUES.plaza]: manifest.cells.plaza,
    [CITY_KIND_VALUES.wall]: manifest.cells.wall,
    [CITY_KIND_VALUES.roof]: manifest.cells.roof,
    [CITY_KIND_VALUES.door]: manifest.cells.door,
    [CITY_KIND_VALUES.water]: manifest.cells.water,
    [CITY_KIND_VALUES.sign]: manifest.cells.sign,
  },
};
