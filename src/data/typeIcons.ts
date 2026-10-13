import atlasUrl from '../assets/frlg/type-icons.png';
import manifest from './frlg/type-icons.json';

/**
 * The Añil type badges (the 18 types in dex order, the "???" slot and Fairy),
 * packed into `src/assets/frlg/type-icons.png` by
 * `scripts/frlg/build-type-icons.mjs` from the fangame Pokémon Añil's own
 * `Graphics/UI/types.png`, at 32x14 frames. The starter cards draw one per type.
 * Añil ships a Fairy badge, so every type the dex lists resolves; only a name the
 * atlas lacks returns null and the UI falls back to a text chip. Local-only art —
 * see `docs/art-direction.md`.
 */
export const TYPE_ICON_ATLAS_URL = atlasUrl;
export const TYPE_ICON_TEXTURE_KEY = 'frlg:type-icons';
export const TYPE_ICON_W = manifest.width;
export const TYPE_ICON_H = manifest.height;

const FRAMES: Readonly<Record<string, number>> = manifest.types;

/** The atlas frame of a type's badge, or null when the atlas has none. */
export function typeIconFrame(type: string): number | null {
  return FRAMES[type.toLowerCase()] ?? null;
}
