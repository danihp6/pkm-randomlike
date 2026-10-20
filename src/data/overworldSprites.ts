import placeholderUrl from '../assets/placeholders/frlg/overworld.png';
import { packedAtlasUrl } from '../assets/optional';
import manifest from './frlg/overworld.json';

const OVERWORLD_ATLASES = import.meta.glob('../assets/frlg/overworld.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The FireRed/LeafGreen overworld atlas (`src/assets/frlg/overworld.png`), packed
 * by `scripts/frlg/build-overworld-sprites.mjs` into 16x32 frames — one row per
 * sprite key, nine poses each: the resting pose and the two-frame walk cycle of
 * the down, up and left-facing side directions. A row exists for the ten trainer
 * archetypes, the casino's `rocket` grunt and the ten special-NPC keys
 * (`NPC_SPRITE_KEYS`); a key the decomp has no class for borrows the closest
 * shipped class, and `OVERWORLD_SPRITE_FALLBACKS` says which. The manifest maps
 * the `spriteKey` every archetype in `src/data/trainers.ts` declares to its row's
 * base frame, so the route scene draws the right pose without knowing the sheet
 * layout; the right-facing side is the left-facing frame flipped by
 * `RouteScene`. Local-only art — see `docs/art-direction.md`.
 */
export const OVERWORLD_SPRITE_ATLAS_URL = packedAtlasUrl(
  OVERWORLD_ATLASES,
  '../assets/frlg/overworld.png',
  placeholderUrl,
);
export const OVERWORLD_SPRITE_TEXTURE_KEY = 'frlg:overworld';
export const OVERWORLD_SPRITE_WIDTH = manifest.size;
export const OVERWORLD_SPRITE_HEIGHT = manifest.height;

/** The three directions the sheet carries; right is `side` flipped. */
export type OverworldFacing = 'down' | 'up' | 'side';

/** Every facing, in the order the sheet packs them. */
export const OVERWORLD_FACINGS: readonly OverworldFacing[] = ['down', 'up', 'side'];

const POSES: readonly string[] = manifest.poses;
const BASE: Readonly<Record<string, number>> = manifest.sprites;

const IDLE_OFFSET: Readonly<Record<OverworldFacing, number>> = {
  down: POSES.indexOf('down'),
  up: POSES.indexOf('up'),
  side: POSES.indexOf('side'),
};

const WALK_OFFSET: Readonly<Record<OverworldFacing, readonly [number, number]>> = {
  down: [POSES.indexOf('walk-down-a'), POSES.indexOf('walk-down-b')],
  up: [POSES.indexOf('walk-up-a'), POSES.indexOf('walk-up-b')],
  side: [POSES.indexOf('walk-side-a'), POSES.indexOf('walk-side-b')],
};

/** Every key the packed atlas carries, in row order: the ten trainer
 *  archetypes, `rocket`, then the ten NPC keys. */
export const OVERWORLD_SPRITE_KEYS: readonly string[] = Object.keys(manifest.sprites);

/** The ten special-NPC keys `[Task-91]`'s table names, in the order the packer
 *  appends their rows. */
export const NPC_SPRITE_KEYS: readonly string[] = [
  'merchant',
  'chef',
  'magician',
  'exorcist',
  'weather-man',
  'sacrifice',
  'medic',
  'iv-judge',
  'berry-tree',
  'ninja',
];

/** key -> the decomp class stem whose art the row borrows (no `.png`). Only the
 *  keys the decomp has no class for; a key with its own class is absent. */
export const OVERWORLD_SPRITE_FALLBACKS: Readonly<Record<string, string>> = manifest.fallbacks;

/** True when `manifest.sprites` carries `name`. */
export function overworldHasSprite(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BASE, name);
}

/** The resting frame for a direction, or null when the sheet lacks the key. */
export function overworldSpriteFrame(name: string, facing: OverworldFacing = 'down'): number | null {
  if (!overworldHasSprite(name)) return null;
  return BASE[name] + IDLE_OFFSET[facing];
}

/** The two frames of a direction's walk cycle, in playback order, or null. */
export function overworldWalkFrames(
  name: string,
  facing: OverworldFacing,
): readonly [number, number] | null {
  if (!overworldHasSprite(name)) return null;
  const [a, b] = WALK_OFFSET[facing];
  return [BASE[name] + a, BASE[name] + b];
}
