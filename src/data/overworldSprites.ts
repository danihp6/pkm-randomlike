import overworldUrl from '../assets/frlg/overworld.png';
import manifest from './frlg/overworld.json';

/**
 * The FireRed/LeafGreen trainer overworld atlas
 * (`src/assets/frlg/overworld.png`), packed by
 * `scripts/frlg/build-overworld-sprites.mjs` into 16x32 frames — the
 * down-facing idle frame of each archetype's decomp sheet. The manifest maps
 * the `spriteKey` every archetype in `src/data/trainers.ts` declares to its
 * frame, so the route scene draws the right trainer on a tile without knowing
 * the sheet layout. Local-only art — see `docs/art-direction.md`.
 */
export const OVERWORLD_SPRITE_ATLAS_URL = overworldUrl;
export const OVERWORLD_SPRITE_TEXTURE_KEY = 'frlg:overworld';
export const OVERWORLD_SPRITE_WIDTH = manifest.size;
export const OVERWORLD_SPRITE_HEIGHT = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.sprites;

/** The atlas frame for an overworld sprite key, or null when the sheet lacks it. */
export function overworldSpriteFrame(name: string): number | null {
  return FRAMES[name] ?? null;
}
