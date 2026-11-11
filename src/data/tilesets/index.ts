import commonAtlasUrl from '../../assets/common.png';
import cityPlaceholderUrl from '../../assets/placeholders/frlg/city.png';
import centrePlaceholderUrl from '../../assets/placeholders/frlg/interior-centre.png';
import housePlaceholderUrl from '../../assets/placeholders/frlg/interior-house.png';
import labPlaceholderUrl from '../../assets/placeholders/frlg/interior-lab.png';
import placeholderUrl from '../../assets/placeholders/frlg/forest.png';
import interiorPlaceholderUrl from '../../assets/placeholders/frlg/interior.png';
import { packedAtlasUrl } from '../../assets/optional';
import type { TilesetConfig } from '../../engine/tileset';
import { FRLG_CITY_TILESET } from './city';
import { FRLG_FOREST_TILESET } from './frlg';
import { TILESET_NAMES, type TilesetId } from './ids';
import {
  FRLG_CENTRE_TILESET,
  FRLG_HOUSE_TILESET,
  FRLG_INTERIOR_TILESET,
  FRLG_LAB_TILESET,
} from './interior';
import {
  FRLG_CENTRE_PALETTE,
  FRLG_CITY_PALETTE,
  FRLG_FOREST_PALETTE,
  FRLG_HOUSE_PALETTE,
  FRLG_INTERIOR_PALETTE,
  FRLG_LAB_PALETTE,
  type Palette,
} from './palettes';

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

const LAB_ATLASES = import.meta.glob('../../assets/frlg/interior-lab.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

const CENTRE_ATLASES = import.meta.glob('../../assets/frlg/interior-centre.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

const HOUSE_ATLASES = import.meta.glob('../../assets/frlg/interior-house.png', {
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
  'interior-lab': {
    id: 'interior-lab',
    name: TILESET_NAMES['interior-lab'],
    atlasUrl: packedAtlasUrl(LAB_ATLASES, '../../assets/frlg/interior-lab.png', labPlaceholderUrl),
    palette: FRLG_LAB_PALETTE,
    config: FRLG_LAB_TILESET,
  },
  'interior-centre': {
    id: 'interior-centre',
    name: TILESET_NAMES['interior-centre'],
    atlasUrl: packedAtlasUrl(
      CENTRE_ATLASES,
      '../../assets/frlg/interior-centre.png',
      centrePlaceholderUrl,
    ),
    palette: FRLG_CENTRE_PALETTE,
    config: FRLG_CENTRE_TILESET,
  },
  'interior-house': {
    id: 'interior-house',
    name: TILESET_NAMES['interior-house'],
    atlasUrl: packedAtlasUrl(HOUSE_ATLASES, '../../assets/frlg/interior-house.png', housePlaceholderUrl),
    palette: FRLG_HOUSE_PALETTE,
    config: FRLG_HOUSE_TILESET,
  },
};

export const TILESET_TEXTURE_KEY = 'tiles';
export const COMMON_TEXTURE_KEY = 'tiles:common';

export function tilesetTextureKey(id: TilesetId): string {
  return `${TILESET_TEXTURE_KEY}:${id}`;
}
