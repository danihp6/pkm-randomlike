import placeholderUrl from '../assets/placeholders/frlg/player.png';
import { packedAtlasUrl } from '../assets/optional';
import manifest from './frlg/player.json';

const PLAYER_ATLASES = import.meta.glob('../assets/frlg/player.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Readonly<Record<string, string>>;

/**
 * The FireRed/LeafGreen player overworld atlas
 * (`src/assets/frlg/player.png`), packed by
 * `scripts/frlg/build-player-sprite.mjs` from the pret/pokefirered decomp into
 * 16x32 frames: the resting pose and the two-frame walk cycle of the down, up
 * and left-facing side directions. The route draws the frame matching the
 * direction walked and flips the side frames to face right, so the player is no
 * longer the PMD placeholder sprite. Local-only art — see
 * `docs/art-direction.md`.
 */
export const PLAYER_SPRITE_ATLAS_URL = packedAtlasUrl(
  PLAYER_ATLASES,
  '../assets/frlg/player.png',
  placeholderUrl,
);
export const PLAYER_SPRITE_TEXTURE_KEY = 'frlg:player';
export const PLAYER_SPRITE_WIDTH = manifest.size;
export const PLAYER_SPRITE_HEIGHT = manifest.height;

/** The three directions the strip carries; right is `side` flipped. */
export type PlayerFacing = 'down' | 'up' | 'side';

/** Every facing, in the order the atlas packs them. */
export const PLAYER_FACINGS: readonly PlayerFacing[] = ['down', 'up', 'side'];

const FRAMES: Readonly<Record<string, number>> = manifest.sprites;

/** The resting frame for a direction. */
export function playerSpriteFrame(facing: PlayerFacing): number {
  return FRAMES[facing];
}

/** The two frames of a direction's walk cycle, in playback order. */
export function playerWalkFrames(facing: PlayerFacing): readonly [number, number] {
  return [FRAMES[`walk-${facing}-a`], FRAMES[`walk-${facing}-b`]];
}
