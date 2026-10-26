import placeholderUrl from '../../assets/placeholders/frlg/sign.png';
import { packedAtlasUrl } from '../../assets/optional';

const PROP_ATLASES = import.meta.glob('../../assets/frlg/sign.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The static prop a route draws on its own cell: the boss door's sign, a single
 * 16x16 crop of the FRLG field sheet (`scripts/frlg/build-sign.mjs`,
 * `docs/tileset-spec.md` §2). It is its **own** prop texture, not a row of the
 * biome atlas, so a route can draw it whatever sheet its biome uses. Local-only
 * art - see `docs/art-direction.md`.
 */
export const PROP_SIGN_TEXTURE_KEY = 'frlg:sign';
export const PROP_SIGN_URL = packedAtlasUrl(PROP_ATLASES, '../../assets/frlg/sign.png', placeholderUrl);
export const PROP_SIGN_SIZE = 16;
export const PROP_SIGN_FRAME = 0;
