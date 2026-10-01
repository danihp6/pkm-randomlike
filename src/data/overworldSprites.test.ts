import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import { TRAINER_ARCHETYPES } from './trainers';
import manifest from './frlg/overworld.json';

// The atlas is a committed crop of the FRLG decomp sheets
// (`scripts/frlg/build-overworld-sprites.mjs`), so its shape and the fact every
// frame carries art are measured here: a re-crop that shifts the frame origin or
// loses a trainer fails this test instead of drawing an empty tile.
const WIDTH = manifest.size;
const HEIGHT = manifest.height;

function atlas() {
  const url = new URL('../assets/frlg/overworld.png', import.meta.url);
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

describe('trainer overworld sprite atlas', () => {
  const png = atlas();

  it('is a one-row strip of 16x32 frames, one per archetype', () => {
    expect(png.height).toBe(HEIGHT);
    expect(png.width).toBe(WIDTH * TRAINER_ARCHETYPES.length);
  });

  it('names a unique overworld sprite for every archetype', () => {
    const names = new Set<string>();
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.spriteKey, archetype.id).toBeTruthy();
      names.add(archetype.spriteKey!);
    }
    expect(names.size).toBe(TRAINER_ARCHETYPES.length);
  });

  it('maps each archetype onto a non-empty frame', () => {
    const frames: Record<string, number> = manifest.sprites;
    for (const archetype of TRAINER_ARCHETYPES) {
      const frame = frames[archetype.spriteKey!];
      expect(frame, `${archetype.id} (${archetype.spriteKey})`).toBeTypeOf('number');
      expect(frameHasArt(png, frame), `${archetype.id} (${archetype.spriteKey})`).toBe(true);
    }
  });
});
