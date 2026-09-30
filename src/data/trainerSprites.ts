import trainerSpritesUrl from '../assets/frlg/trainers.png';
import manifest from './frlg/trainers.json';

/**
 * The FireRed/LeafGreen battle trainer atlas (`src/assets/frlg/trainers.png`),
 * packed by `scripts/frlg/build-trainer-sprites.mjs` into 64px frames. The
 * manifest maps the `battleSprite` name each archetype in `src/data/trainers.ts`
 * declares to its frame, so the battle scene shows the right trainer on the
 * enemy platform without knowing the sheet layout. Local-only art — see
 * `docs/art-direction.md`.
 */
export const TRAINER_SPRITE_ATLAS_URL = trainerSpritesUrl;
export const TRAINER_SPRITE_TEXTURE_KEY = 'frlg:trainers';
export const TRAINER_SPRITE_SIZE = manifest.size;

const FRAMES: Readonly<Record<string, number>> = manifest.sprites;

/** The atlas frame for a battle sprite name, or null when the sheet lacks it. */
export function trainerSpriteFrame(name: string): number | null {
  return FRAMES[name] ?? null;
}
