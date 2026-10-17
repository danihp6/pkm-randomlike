import commonAtlasUrl from '../../assets/common.png';
import forestAtlasUrl from '../../assets/frlg/forest.png';
import type { TilesetConfig } from '../../engine/tileset';
import { FRLG_FOREST_TILESET } from './frlg';
import { TILESET_NAMES, type TilesetId } from './ids';
import { FRLG_FOREST_PALETTE, type Palette } from './palettes';

export { TILESET_IDS, TILESET_NAMES, type TilesetId } from './ids';

export type BiomeTileset = Readonly<{
  id: TilesetId;
  name: string;
  atlasUrl: string;
  palette: Palette;
  config: TilesetConfig;
}>;

export const COMMON_ATLAS_URL = commonAtlasUrl;

export const TILESETS: Readonly<Record<TilesetId, BiomeTileset>> = {
  forest: {
    id: 'forest',
    name: TILESET_NAMES.forest,
    atlasUrl: forestAtlasUrl,
    palette: FRLG_FOREST_PALETTE,
    config: FRLG_FOREST_TILESET,
  },
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
