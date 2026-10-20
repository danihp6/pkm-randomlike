import placeholderUrl from '../assets/placeholders/frlg/ground-item.png';
import { packedAtlasUrl } from '../assets/optional';

const GROUND_ITEM_ATLASES = import.meta.glob('../assets/frlg/ground-item.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The FireRed/LeafGreen field sprite a visible ground item shows: the Poke Ball
 * that stands above the Pokemon Center on the source sheet, cropped to 16x16 by
 * `scripts/frlg/build-field-items.mjs`. Hidden items draw the faint sparkle
 * instead. Local-only art - see `docs/art-direction.md`.
 */
export const GROUND_ITEM_TEXTURE_KEY = 'frlg:ground-item';
export const GROUND_ITEM_URL = packedAtlasUrl(
  GROUND_ITEM_ATLASES,
  '../assets/frlg/ground-item.png',
  placeholderUrl,
);
export const GROUND_ITEM_SIZE = 16;
