import overworldUrl from '../assets/frlg/overworld.png';
import manifest from './frlg/overworld.json';

/**
 * The FireRed/LeafGreen trainer overworld atlas
 * (`src/assets/frlg/overworld.png`), packed by
 * `scripts/frlg/build-overworld-sprites.mjs` into 16x32 frames — one row per
 * archetype, nine poses each: the resting pose and the two-frame walk cycle of
 * the down, up and left-facing side directions. The manifest maps the `spriteKey`
 * every archetype in `src/data/trainers.ts` declares to its row's base frame, so
 * the route scene draws the right pose without knowing the sheet layout; the
 * right-facing side is the left-facing frame flipped by `RouteScene`. Local-only
 * art — see `docs/art-direction.md`.
 */
export const OVERWORLD_SPRITE_ATLAS_URL = overworldUrl;
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

/** The resting frame for a direction, or null when the sheet lacks the key. */
export function overworldSpriteFrame(name: string, facing: OverworldFacing = 'down'): number | null {
  const base = BASE[name];
  return base === undefined ? null : base + IDLE_OFFSET[facing];
}

/** The two frames of a direction's walk cycle, in playback order, or null. */
export function overworldWalkFrames(
  name: string,
  facing: OverworldFacing,
): readonly [number, number] | null {
  const base = BASE[name];
  if (base === undefined) return null;
  const [a, b] = WALK_OFFSET[facing];
  return [base + a, base + b];
}
