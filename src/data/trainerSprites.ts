import placeholderUrl from '../assets/placeholders/frlg/trainers.png';
import { packedAtlasUrl } from '../assets/optional';
import manifest from './frlg/trainers.json';

const TRAINER_ATLASES = import.meta.glob('../assets/frlg/trainers.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The FireRed/LeafGreen battle trainer atlas (`src/assets/frlg/trainers.png`),
 * packed by `scripts/frlg/build-trainer-sprites.mjs` into 64px frames. The
 * manifest maps the `battleSprite` name each archetype in `src/data/trainers.ts`
 * declares to its frame, so the battle scene shows the right trainer on the
 * enemy platform without knowing the sheet layout. Local-only art — see
 * `docs/art-direction.md`.
 */
export const TRAINER_SPRITE_ATLAS_URL = packedAtlasUrl(
  TRAINER_ATLASES,
  '../assets/frlg/trainers.png',
  placeholderUrl,
);
export const TRAINER_SPRITE_TEXTURE_KEY = 'frlg:trainers';
export const TRAINER_SPRITE_SIZE = manifest.size;

const FRAMES: Readonly<Record<string, number>> = manifest.sprites;

/** The atlas frame for a battle sprite name, or null when the sheet lacks it. */
export function trainerSpriteFrame(name: string): number | null {
  return FRAMES[name] ?? null;
}
