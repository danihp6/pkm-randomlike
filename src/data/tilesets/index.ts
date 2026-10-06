import commonAtlasUrl from '../../assets/common.png';
import caveAtlasUrl from '../../assets/frlg/cave.png';
import forestAtlasUrl from '../../assets/frlg/forest.png';
import outdoorAtlasUrl from '../../assets/frlg/outdoor.png';
import placeholderAtlasUrl from '../../assets/tileset.png';
import woodAtlasUrl from '../../assets/wood.png';
import type { TilesetConfig } from '../../engine/tileset';
import { FRLG_FOREST_TILESET, FRLG_TILESET } from './frlg';
import { TILESET_NAMES, type TilesetId } from './ids';
import {
  DEFAULT_PALETTE,
  FRLG_CAVE_PALETTE,
  FRLG_FOREST_PALETTE,
  FRLG_OUTDOOR_PALETTE,
  WOOD_PALETTE,
  type Palette,
} from './palettes';
import { PLACEHOLDER_TILESET } from './placeholder';
import { WOOD_TILESET } from './wood';

export {
  TILESET_IDS,
  TILESET_NAMES,
  TILESET_PREFERENCES,
  isTilesetPreference,
  resolveTileset,
  tilesetLabel,
  type TilesetId,
  type TilesetPreference,
} from './ids';

export type BiomeTileset = Readonly<{
  id: TilesetId;
  name: string;
  atlasUrl: string;
  palette: Palette;
  config: TilesetConfig;
}>;

export const COMMON_ATLAS_URL = commonAtlasUrl;

export const TILESETS: Readonly<Record<TilesetId, BiomeTileset>> = {
  placeholder: {
    id: 'placeholder',
    name: TILESET_NAMES.placeholder,
    atlasUrl: placeholderAtlasUrl,
    palette: DEFAULT_PALETTE,
    config: PLACEHOLDER_TILESET,
  },
  wood: {
    id: 'wood',
    name: TILESET_NAMES.wood,
    atlasUrl: woodAtlasUrl,
    palette: WOOD_PALETTE,
    config: WOOD_TILESET,
  },
  outdoor: {
    id: 'outdoor',
    name: TILESET_NAMES.outdoor,
    atlasUrl: outdoorAtlasUrl,
    palette: FRLG_OUTDOOR_PALETTE,
    config: FRLG_TILESET,
  },
  forest: {
    id: 'forest',
    name: TILESET_NAMES.forest,
    atlasUrl: forestAtlasUrl,
    palette: FRLG_FOREST_PALETTE,
    config: FRLG_FOREST_TILESET,
  },
  cave: {
    id: 'cave',
    name: TILESET_NAMES.cave,
    atlasUrl: caveAtlasUrl,
    palette: FRLG_CAVE_PALETTE,
    config: FRLG_TILESET,
  },
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
