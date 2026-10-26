import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../../assets/art';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { PROP_SIGN_FRAME, PROP_SIGN_SIZE, PROP_SIGN_TEXTURE_KEY } from './props';

const SIGN_PATH = fileURLToPath(new URL('../../assets/frlg/sign.png', import.meta.url));
const PLACEHOLDER_PATH = fileURLToPath(
  new URL('../../assets/placeholders/frlg/sign.png', import.meta.url),
);

describe('the sign prop', () => {
  it('declares its own 16x16 texture and its single frame', () => {
    expect(PROP_SIGN_TEXTURE_KEY).toBe('frlg:sign');
    expect(PROP_SIGN_SIZE).toBe(16);
    expect(PROP_SIGN_FRAME).toBe(0);
  });
});

// A clean clone has no pack, so the placeholder is what the boss door draws;
// it must read as a signpost, never as the opaque square the generic fill makes.
describe('the sign placeholder', () => {
  it('is a 16x16 silhouette, not an opaque square', () => {
    const png = decodePng(readFileSync(PLACEHOLDER_PATH));
    expect(png.width).toBe(PROP_SIGN_SIZE);
    expect(png.height).toBe(PROP_SIGN_SIZE);
    const alphaAt = (x: number, y: number): number => png.data[(y * png.width + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(15, 0)).toBe(0);
    expect(alphaAt(0, 15)).toBe(0);
    expect(alphaAt(15, 15)).toBe(0);
    let opaque = 0;
    for (let i = 3; i < png.data.length; i += 4) if (png.data[i] !== 0) opaque += 1;
    expect(opaque).toBeGreaterThanOrEqual(40);
    expect(opaque).toBeLessThanOrEqual(200);
  });
});

// The prop is a committed crop of the FRLG field sheet, so its shape and the alpha
// the crop carries are measured here: a re-crop that shifts the source cell or
// flattens it onto a background fails this test instead of drawing a grey square.
describe.skipIf(!hasArt('frlg/sign.png'))('the packed sign', () => {
  it('is a 16x16 cell with its own alpha and all four corners transparent', () => {
    const png = decodePng(readFileSync(SIGN_PATH));
    expect(png.width).toBe(PROP_SIGN_SIZE);
    expect(png.height).toBe(PROP_SIGN_SIZE);

    const alphaAt = (x: number, y: number): number => png.data[(y * png.width + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(png.width - 1, 0)).toBe(0);
    expect(alphaAt(0, png.height - 1)).toBe(0);
    expect(alphaAt(png.width - 1, png.height - 1)).toBe(0);

    let transparent = 0;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        if (alphaAt(x, y) === 0) transparent += 1;
      }
    }
    expect(transparent).toBe(68);

    const colours = new Set<string>();
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] === 0) continue;
      colours.add(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });
});
