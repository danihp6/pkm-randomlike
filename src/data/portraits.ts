import portraitAtlasUrl from '../assets/portraits.png';
import { getSpecies } from './dex';

/**
 * The PMDCollab portrait atlas (`src/assets/portraits.png`): one 40x40 face per
 * National Dex number, in dex order, so row = `num - 1`. Rows whose species had
 * no portrait pack keep a procedural placeholder face. Local-only art — see
 * `docs/art-direction.md`.
 */
export const PORTRAIT_ATLAS_URL = portraitAtlasUrl;
export const PORTRAIT_TEXTURE_KEY = 'portrait';
export const PORTRAIT_SIZE = 40;
export const PORTRAIT_FRAMES = 649;

/** The atlas frame for a species, or null when the dex number is out of range. */
export function portraitFrameFor(speciesId: string): number | null {
  const species = getSpecies(speciesId);
  if (!species || species.num < 1 || species.num > PORTRAIT_FRAMES) return null;
  return species.num - 1;
}
