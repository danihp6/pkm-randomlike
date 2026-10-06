import atlasUrl from '../assets/frlg/move-categories.png';
import manifest from './frlg/move-categories.json';

/**
 * The official move-category badges (physical / special / status), packed into
 * `src/assets/frlg/move-categories.png` by `scripts/frlg/build-category-icons.mjs`
 * at 32x14 frames. The battle move grid draws one beside each move. Local-only
 * art — see `docs/art-direction.md`.
 */
export const MOVE_CATEGORY_ATLAS_URL = atlasUrl;
export const MOVE_CATEGORY_TEXTURE_KEY = 'frlg:move-categories';
export const MOVE_CATEGORY_ICON_W = manifest.width;
export const MOVE_CATEGORY_ICON_H = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.categories;

/** The atlas frame of a move category, or null for an unknown category. */
export function categoryIconFrame(category: string): number | null {
  return FRAMES[category] ?? null;
}
