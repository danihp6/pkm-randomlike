import commonAtlasUrl from '../../assets/common.png';
import placeholderAtlasUrl from '../../assets/tileset.png';
import woodAtlasUrl from '../../assets/wood.png';
import type { TilesetConfig } from '../../engine/tileset';
import { DEFAULT_PALETTE, WOOD_PALETTE, type Palette } from './palettes';
import { PLACEHOLDER_TILESET } from './placeholder';
import { WOOD_TILESET } from './wood';

export type TilesetId = 'placeholder' | 'wood';

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
    name: 'Procedural placeholder',
    atlasUrl: placeholderAtlasUrl,
    palette: DEFAULT_PALETTE,
    config: PLACEHOLDER_TILESET,
  },
  wood: {
    id: 'wood',
    name: 'Woods',
    atlasUrl: woodAtlasUrl,
    palette: WOOD_PALETTE,
    config: WOOD_TILESET,
  },
};

export const TILESET_IDS = Object.keys(TILESETS) as TilesetId[];

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
