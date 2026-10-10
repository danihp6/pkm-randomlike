import atlasUrl from '../assets/frlg/type-icons.png';
import manifest from './frlg/type-icons.json';

/**
 * The FRLG type badges (the 18 types plus the "???" unknown badge), packed into
 * `src/assets/frlg/type-icons.png` by `scripts/frlg/build-type-icons.mjs` at
 * 32x14 frames. The starter cards draw one per type. The FRLG sheet predates
 * Fairy, so `typeIconFrame` returns null for it and the UI falls back to a text
 * chip. Local-only art — see `docs/art-direction.md`.
 */
export const TYPE_ICON_ATLAS_URL = atlasUrl;
export const TYPE_ICON_TEXTURE_KEY = 'frlg:type-icons';
export const TYPE_ICON_W = manifest.width;
export const TYPE_ICON_H = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.types;

/** The atlas frame of a type's badge, or null when the sheet has none (Fairy). */
export function typeIconFrame(type: string): number | null {
  return FRAMES[type.toLowerCase()] ?? null;
}
