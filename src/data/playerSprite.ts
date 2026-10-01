import playerSpriteUrl from '../assets/frlg/player.png';
import manifest from './frlg/player.json';

/**
 * The FireRed/LeafGreen player overworld atlas
 * (`src/assets/frlg/player.png`), packed by
 * `scripts/frlg/build-player-sprite.mjs` from the pret/pokefirered decomp into
 * 16x32 frames: the down, up and left-facing side idles. The route draws the
 * frame matching the direction walked, flipping the side frame to face right,
 * so the player is no longer the PMD placeholder sprite. Local-only art — see
 * `docs/art-direction.md`.
 */
export const PLAYER_SPRITE_ATLAS_URL = playerSpriteUrl;
export const PLAYER_SPRITE_TEXTURE_KEY = 'frlg:player';
export const PLAYER_SPRITE_WIDTH = manifest.size;
export const PLAYER_SPRITE_HEIGHT = manifest.height;

/** The three resting directions the strip carries; right is `side` flipped. */
export type PlayerFacing = 'down' | 'up' | 'side';

const FRAMES: Readonly<Record<PlayerFacing, number>> = manifest.sprites;

/** The atlas frame for a resting direction. */
export function playerSpriteFrame(facing: PlayerFacing): number {
  return FRAMES[facing];
}
