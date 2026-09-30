import commonAtlasUrl from '../../assets/common.png';
import placeholderAtlasUrl from '../../assets/tileset.png';
import woodAtlasUrl from '../../assets/wood.png';
import type { TilesetConfig } from '../../engine/tileset';
import { TILESET_NAMES, type TilesetId } from './ids';
import { DEFAULT_PALETTE, WOOD_PALETTE, type Palette } from './palettes';
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
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
