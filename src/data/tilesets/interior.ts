import { COUNTER, DOOR, FLOOR, HEAL, PC, WALL } from '../../engine/map';
import { TILESET_COLS, TILESET_ROWS, type TilesetConfig } from '../../engine/tileset';
import manifest from '../frlg/interior.json';
import { FRLG_ATLAS_HEIGHT, FRLG_ATLAS_WIDTH, FRLG_TILE_SIZE } from './frlg';

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

/**
 * The interior field: one plain frame per kind. The room's floor and the atlas's
 * frame 0 are the same tile, so a room draws its planks everywhere and the fixtures
 * sit on them. The art is **provisional** (`docs/tileset-spec.md` §6): the store has
 * no indoor rip, so it is composed from the two field sheets and a real indoor one
 * replaces `INTERIOR_CELLS` in `scripts/frlg/build-region-tilesets.mjs`.
 */
export const FRLG_INTERIOR_TILESET: TilesetConfig = {
  atlas: {
    tileSize: FRLG_TILE_SIZE,
    cols: TILESET_COLS,
    rows: TILESET_ROWS,
    width: FRLG_ATLAS_WIDTH,
    height: FRLG_ATLAS_HEIGHT,
  },
  frames: {
    [FLOOR]: 0,
    [INTERIOR_KIND_VALUES.floor]: manifest.cells.floor,
    [INTERIOR_KIND_VALUES.wall]: manifest.cells.wall,
    [INTERIOR_KIND_VALUES.door]: manifest.cells.door,
    [INTERIOR_KIND_VALUES.counter]: manifest.cells.counter,
    [INTERIOR_KIND_VALUES.heal]: manifest.cells.heal,
    [INTERIOR_KIND_VALUES.pc]: manifest.cells.pc,
  },
};
