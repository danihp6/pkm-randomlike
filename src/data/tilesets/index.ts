import commonAtlasUrl from '../../assets/common.png';
import cityPlaceholderUrl from '../../assets/placeholders/frlg/city.png';
import placeholderUrl from '../../assets/placeholders/frlg/forest.png';
import interiorPlaceholderUrl from '../../assets/placeholders/frlg/interior.png';
import { packedAtlasUrl } from '../../assets/optional';
import type { TilesetConfig } from '../../engine/tileset';
import { FRLG_CITY_TILESET } from './city';
import { FRLG_FOREST_TILESET } from './frlg';
import { TILESET_NAMES, type TilesetId } from './ids';
import { FRLG_INTERIOR_TILESET } from './interior';
import { FRLG_CITY_PALETTE, FRLG_FOREST_PALETTE, FRLG_INTERIOR_PALETTE, type Palette } from './palettes';

const FOREST_ATLASES = import.meta.glob('../../assets/frlg/forest.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

const CITY_ATLASES = import.meta.glob('../../assets/frlg/city.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

const INTERIOR_ATLASES = import.meta.glob('../../assets/frlg/interior.png', {
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
  city: {
    id: 'city',
    name: TILESET_NAMES.city,
    atlasUrl: packedAtlasUrl(CITY_ATLASES, '../../assets/frlg/city.png', cityPlaceholderUrl),
    palette: FRLG_CITY_PALETTE,
    config: FRLG_CITY_TILESET,
  },
  interior: {
    id: 'interior',
    name: TILESET_NAMES.interior,
    atlasUrl: packedAtlasUrl(INTERIOR_ATLASES, '../../assets/frlg/interior.png', interiorPlaceholderUrl),
    palette: FRLG_INTERIOR_PALETTE,
    config: FRLG_INTERIOR_TILESET,
  },
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
