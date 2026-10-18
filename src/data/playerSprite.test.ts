import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import manifest from './frlg/player.json';
import { PLAYER_FACINGS, playerSpriteFrame, playerWalkFrames, type PlayerFacing } from './playerSprite';

// The atlas is a committed crop of the FRLG decomp player sheet
// (`scripts/frlg/build-player-sprite.mjs`), so its shape and the fact every
// frame carries art are measured here: a re-crop that shifts the strip or
// leaves a blank frame fails this test instead of drawing an invisible player.
const WIDTH = manifest.size;
const HEIGHT = manifest.height;
const FRAME_NAMES: readonly string[] = manifest.frames;
const FACINGS: readonly PlayerFacing[] = PLAYER_FACINGS;

function atlas() {
  const url = new URL('../assets/frlg/player.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; height: number; data: Uint8Array }, frame: number): boolean {
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const alpha = png.data[(y * png.width + frame * WIDTH + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe('player overworld sprite atlas', () => {
  const png = atlas();

  it('is a one-row strip of 16x32 frames, one per named frame', () => {
    expect(png.height).toBe(HEIGHT);
    expect(png.width).toBe(WIDTH * FRAME_NAMES.length);
  });

  it('maps every resting and walk frame onto a non-empty frame', () => {
    for (const facing of FACINGS) {
      for (const frame of [playerSpriteFrame(facing), ...playerWalkFrames(facing)]) {
        expect(frameHasArt(png, frame), `${facing} #${frame}`).toBe(true);
      }
    }
  });

  it('gives every facing its own resting frame and a two-frame walk cycle', () => {
    const idle = FACINGS.map((facing) => playerSpriteFrame(facing));
    expect(new Set(idle).size).toBe(FACINGS.length);
    const walk = FACINGS.flatMap((facing) => [...playerWalkFrames(facing)]);
    expect(walk).toHaveLength(FACINGS.length * 2);
    // No frame is reused between the idles and the walk cycle.
    expect(new Set([...idle, ...walk]).size).toBe(FACINGS.length * 3);
  });
});
