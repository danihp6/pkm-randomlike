import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import { TRAINER_ARCHETYPES } from './trainers';
import manifest from './frlg/trainers.json';

// The atlas is a committed crop of the FRLG sheet
// (`scripts/frlg/build-trainer-sprites.mjs`), so its shape and the fact every
// frame carries art are measured here: a re-crop that shifts the grid or keys
// out the sprite fails this test instead of drawing an empty platform.
const FRAME = manifest.size;

function atlas() {
  if (!hasArt('frlg/trainers.png')) return { width: 0, height: 0, data: new Uint8Array() };
  const url = new URL('../assets/frlg/trainers.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; height: number; data: Uint8Array }, frame: number): boolean {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < FRAME; x++) {
      const alpha = png.data[(y * png.width + frame * FRAME + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe.skipIf(!hasArt('frlg/trainers.png'))('trainer battle sprite atlas', () => {
  const png = atlas();

  it('is a one-row strip of 64px frames, one per archetype', () => {
    expect(png.height).toBe(FRAME);
    expect(png.width).toBe(FRAME * TRAINER_ARCHETYPES.length);
  });

  it('maps each archetype onto a non-empty frame', () => {
    const frames: Record<string, number> = manifest.sprites;
    for (const archetype of TRAINER_ARCHETYPES) {
      const frame = frames[archetype.battleSprite!];
      expect(frameHasArt(png, frame), `${archetype.id} (${archetype.battleSprite})`).toBe(true);
    }
  });
});
