import backUrl from '../assets/frlg/pokemon-back.png';
import frontUrl from '../assets/frlg/pokemon-front.png';
import iconUrl from '../assets/frlg/pokemon-icon.png';
import manifest from './frlg/pokemon-sprites.json';

/**
 * The FireRed/LeafGreen-style Pokémon battle sprites
 * (`src/assets/frlg/pokemon-{front,back,icon}.png`), packed by
 * `scripts/frlg/build-pokemon-sprites.mjs` from the pokeemerald-expansion
 * check-out into one frame per playable species. The manifest maps a species id
 * to its frame, so a scene shows the right mon without knowing the sheet layout.
 * Covers every generation; a forme without its own art falls back to its base
 * species at pack time. Local-only art — see `docs/art-direction.md`.
 */
export type PokemonSpriteKind = 'front' | 'back' | 'icon';

export const POKEMON_SPRITE_SHEETS: Readonly<
  Record<PokemonSpriteKind, Readonly<{ key: string; url: string; size: number; cols: number }>>
> = {
  front: { key: 'frlg:pokemon:front', url: frontUrl, size: manifest.front.size, cols: manifest.front.cols },
  back: { key: 'frlg:pokemon:back', url: backUrl, size: manifest.back.size, cols: manifest.back.cols },
  icon: { key: 'frlg:pokemon:icon', url: iconUrl, size: manifest.icon.size, cols: manifest.icon.cols },
};

const FRAMES: Readonly<Record<string, number>> = manifest.frames;

/** The atlas frame for a species id, or null when the sheet lacks it. */
export function pokemonSpriteFrame(speciesId: string): number | null {
  return FRAMES[speciesId] ?? null;
}
