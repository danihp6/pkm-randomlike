import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import { TYPE_NAMES } from './dex/types';
import manifest from './frlg/type-icons.json';
import { TYPE_ICON_H, TYPE_ICON_W, typeIconFrame } from './typeIcons';

// The atlas is a committed crop of Añil's own `Graphics/UI/types.png`
// (`scripts/frlg/build-type-icons.mjs`), so its frozen geometry and the fact
// every frame carries art are measured here rather than trusted: a repack that
// shifts the grid or drops a badge fails instead of drawing an invisible one.
const COLS = manifest.cols;
const ROWS = manifest.rows;

function atlas() {
  if (!hasArt('frlg/type-icons.png')) return { width: 0, height: 0, data: new Uint8Array() };
  const url = new URL('../assets/frlg/type-icons.png', import.meta.url);
  return decodePng(readFileSync(fileURLToPath(url)));
}

function frameHasArt(png: { width: number; data: Uint8Array }, frame: number): boolean {
  const col = frame % COLS;
  const row = Math.floor(frame / COLS);
  for (let y = 0; y < TYPE_ICON_H; y++) {
    for (let x = 0; x < TYPE_ICON_W; x++) {
      const alpha = png.data[((row * TYPE_ICON_H + y) * png.width + col * TYPE_ICON_W + x) * 4 + 3];
      if (alpha > 0) return true;
    }
  }
  return false;
}

describe.skipIf(!hasArt('frlg/type-icons.png'))('Añil type badges', () => {
  const png = atlas();

  it('keeps the 32x14 frames and 4-column atlas, so every draw site keeps its geometry', () => {
    expect(TYPE_ICON_W).toBe(32);
    expect(TYPE_ICON_H).toBe(14);
    expect(COLS).toBe(4);
    expect(png.width).toBe(TYPE_ICON_W * COLS);
    expect(png.height).toBe(TYPE_ICON_H * ROWS);
  });

  it('has a non-empty badge for every type in the dex, Fairy included', () => {
    for (const type of TYPE_NAMES) {
      const frame = typeIconFrame(type);
      expect(frame, type).not.toBeNull();
      if (frame === null) continue;
      expect(frame, type).toBeLessThan(COLS * ROWS);
      expect(frameHasArt(png, frame), type).toBe(true);
    }
    expect(typeIconFrame('Fairy')).not.toBeNull();
  });

  it('returns null for a type the atlas does not carry', () => {
    expect(typeIconFrame('not-a-type')).toBeNull();
  });
});
