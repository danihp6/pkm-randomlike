import { COUNTER, DOOR, FLOOR, HEAL, PC, WALL } from '../../engine/map';
import type { InteriorRoomKind } from '../../engine/region/interior/plan';
import { TILESET_COLS, TILESET_ROWS, type TilesetConfig } from '../../engine/tileset';
import centreManifest from '../frlg/interior-centre.json';
import houseManifest from '../frlg/interior-house.json';
import labManifest from '../frlg/interior-lab.json';
import manifest from '../frlg/interior.json';
import { FRLG_ATLAS_HEIGHT, FRLG_ATLAS_WIDTH, FRLG_TILE_SIZE } from './frlg';
import type { TilesetId } from './ids';

/** The tile kinds an interior is laid out against (`docs/tileset-spec.md` §1). */
export type InteriorKind = 'floor' | 'wall' | 'door' | 'counter' | 'heal' | 'pc';

/** The map value each interior kind is stamped as. Frozen for the generators. */
export const INTERIOR_KIND_VALUES: Readonly<Record<InteriorKind, number>> = {
  floor: FLOOR,
  wall: WALL,
  door: DOOR,
  counter: COUNTER,
  heal: HEAL,
  pc: PC,
};

/** What a field's committed manifest carries (`docs/tileset-spec.md` §2b). */
type InteriorManifest = Readonly<{
  cells: Readonly<Record<InteriorKind, number>>;
  /** The decomp metatile each cell was composed from; the provisional field has none. */
  metatiles?: Readonly<Record<InteriorKind, number>>;
}>;

/** One field's config: frame 0 is its floor, then the five fixtures in order. */
function fieldConfig(field: InteriorManifest): TilesetConfig {
  return {
    atlas: {
      tileSize: FRLG_TILE_SIZE,
      cols: TILESET_COLS,
      rows: TILESET_ROWS,
      width: FRLG_ATLAS_WIDTH,
      height: FRLG_ATLAS_HEIGHT,
    },
    frames: {
      [FLOOR]: 0,
      [INTERIOR_KIND_VALUES.floor]: field.cells.floor,
      [INTERIOR_KIND_VALUES.wall]: field.cells.wall,
      [INTERIOR_KIND_VALUES.door]: field.cells.door,
      [INTERIOR_KIND_VALUES.counter]: field.cells.counter,
      [INTERIOR_KIND_VALUES.heal]: field.cells.heal,
      [INTERIOR_KIND_VALUES.pc]: field.cells.pc,
    },
  };
}

/**
 * The provisional interior field: the gym and the casino still draw it
 * (`docs/tileset-spec.md` §6). It is composed from the two field sheets rather
 * than from the decomp's interior sets, and one plain frame per kind is its whole
 * contract, so a room reads as planks everywhere with its fixtures on them.
 */
export const FRLG_INTERIOR_TILESET: TilesetConfig = fieldConfig(manifest);

/**
 * The laboratory's own field: PalletTown_ProfessorOaksLab's grey diagonal floor, its
 * cream wall, the red door mat, the counter run, the healing machine and the PC,
 * each the decomp's own metatile (`docs/tileset-spec.md` §2b).
 */
export const FRLG_LAB_TILESET: TilesetConfig = fieldConfig(labManifest);

/** The Pokémon Centre's own field: its yellow checkered floor, red counter, green heal screen and blue PC. */
export const FRLG_CENTRE_TILESET: TilesetConfig = fieldConfig(centreManifest);

/** A house's own field: its wooden floor, white wall and wooden furniture. */
export const FRLG_HOUSE_TILESET: TilesetConfig = fieldConfig(houseManifest);

/** The field each room kind draws; `interior` is the provisional one, in use until the gym and the casino have their own. */
const TILESET_BY_KIND: Readonly<Record<InteriorRoomKind, TilesetId>> = {
  lab: 'interior-lab',
  centre: 'interior-centre',
  house: 'interior-house',
  gym: 'interior',
  casino: 'interior',
};

/** The tileset id a room kind draws. Total over `InteriorRoomKind`. */
export function interiorTilesetId(kind: InteriorRoomKind): TilesetId {
  return TILESET_BY_KIND[kind];
}
