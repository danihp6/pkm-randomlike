import commonAtlasUrl from '../../assets/common.png';
import placeholderUrl from '../../assets/placeholders/frlg/forest.png';
import { packedAtlasUrl } from '../../assets/optional';
import type { TilesetConfig } from '../../engine/tileset';
import { FRLG_FOREST_TILESET } from './frlg';
import { TILESET_NAMES, type TilesetId } from './ids';
import { FRLG_FOREST_PALETTE, type Palette } from './palettes';

const FOREST_ATLASES = import.meta.glob('../../assets/frlg/forest.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

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
    atlasUrl: packedAtlasUrl(FOREST_ATLASES, '../../assets/frlg/forest.png', placeholderUrl),
    palette: FRLG_FOREST_PALETTE,
    config: FRLG_FOREST_TILESET,
  },
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
