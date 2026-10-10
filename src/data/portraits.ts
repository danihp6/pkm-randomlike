import manifest from './anil/pokemon-sprites.json';
import { megaFormOf } from './dex/megas';

/**
 * The party/HUD portrait atlases (`public/anil/portraits.png` and
 * `portraits-shiny.png`): one 64x64 cell per dex entry, in dex order, packed
 * from Pokémon Añil's icon sheets by `scripts/anil/build-pokemon-sprites.mjs`.
 * Local-only art — see `docs/art-direction.md`.
 */
export const PORTRAIT_SIZE = manifest.portraits.size;
export const PORTRAIT_COLS = manifest.portraits.cols;
export const PORTRAIT_TEXTURE_KEY = 'portrait';
export const PORTRAIT_SHINY_TEXTURE_KEY = 'portrait-shiny';
export const PORTRAIT_ATLAS_URL = `${import.meta.env.BASE_URL}anil/portraits.png`;
export const PORTRAIT_SHINY_ATLAS_URL = `${import.meta.env.BASE_URL}anil/portraits-shiny.png`;

const NORMAL = manifest.portraits.normal as unknown as Readonly<Record<string, number>>;
const SHINY = manifest.portraits.shiny as unknown as Readonly<Record<string, number>>;

/** The texture and frame a portrait draws with. */
export type Portrait = Readonly<{ key: string; frame: number }>;

/**
 * The portrait for a species, or null when the atlas has no cell for it. A shiny
 * whose cell is missing falls back to the plain portrait; a Mega without a cell
 * of its own falls back to its base species (D34).
 */
export function portraitFor(speciesId: string, shiny = false): Portrait | null {
  const frame = (shiny ? SHINY : NORMAL)[speciesId] ?? NORMAL[speciesId];
  if (frame !== undefined) {
    const key = shiny && SHINY[speciesId] !== undefined ? PORTRAIT_SHINY_TEXTURE_KEY : PORTRAIT_TEXTURE_KEY;
    return { key, frame };
  }
  const base = megaFormOf(speciesId)?.baseSpeciesId;
  return base ? portraitFor(base, shiny) : null;
}
