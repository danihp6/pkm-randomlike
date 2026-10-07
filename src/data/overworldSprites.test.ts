import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import { TRAINER_ARCHETYPES } from './trainers';
import { OVERWORLD_FACINGS, overworldSpriteFrame, overworldWalkFrames } from './overworldSprites';
import manifest from './frlg/overworld.json';

// The atlas is a committed crop of the FRLG decomp sheets
// (`scripts/frlg/build-overworld-sprites.mjs`), so its shape and the fact every
// pose frame carries art are measured here: a re-crop that shifts the frame
// origin or loses a pose fails this test instead of drawing an empty tile.
const WIDTH = manifest.size;
const HEIGHT = manifest.height;
const COLUMNS = manifest.columns;

function atlas() {
  const url = new URL('../assets/frlg/overworld.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; height: number; data: Uint8Array }, frame: number): boolean {
  const row = Math.floor(frame / COLUMNS);
  const column = frame % COLUMNS;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const alpha = png.data[((row * HEIGHT + y) * png.width + column * WIDTH + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe('trainer overworld sprite atlas', () => {
  const png = atlas();

  it('is a grid of 16x32 frames, one row per archetype', () => {
    expect(png.width).toBe(WIDTH * COLUMNS);
    expect(png.height).toBe(HEIGHT * TRAINER_ARCHETYPES.length);
    expect(COLUMNS).toBe(manifest.poses.length);
  });

  it('names a unique overworld sprite for every archetype', () => {
    const names = new Set<string>();
    for (const archetype of TRAINER_ARCHETYPES) {
      expect(archetype.spriteKey, archetype.id).toBeTruthy();
      names.add(archetype.spriteKey!);
    }
    expect(names.size).toBe(TRAINER_ARCHETYPES.length);
  });

  it('maps every archetype pose onto a non-empty frame', () => {
    for (const archetype of TRAINER_ARCHETYPES) {
      const spriteKey = archetype.spriteKey!;
      for (const facing of OVERWORLD_FACINGS) {
        const idle = overworldSpriteFrame(spriteKey, facing);
        expect(idle, `${archetype.id} ${facing} idle`).toBeTypeOf('number');
        expect(frameHasArt(png, idle!), `${archetype.id} ${facing} idle art`).toBe(true);
        for (const frame of overworldWalkFrames(spriteKey, facing)!) {
          expect(frameHasArt(png, frame), `${archetype.id} ${facing} walk art`).toBe(true);
        }
      }
    }
  });

  it('returns null for a key the sheet lacks', () => {
    expect(overworldSpriteFrame('nobody')).toBeNull();
    expect(overworldWalkFrames('nobody', 'down')).toBeNull();
  });
});
