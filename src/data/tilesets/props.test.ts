import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../../assets/art';
import { decodePng } from '../../../scripts/legacy-art/png-codec.mjs';
import { PROP_SIGN_FRAME, PROP_SIGN_SIZE, PROP_SIGN_TEXTURE_KEY } from './props';

const SIGN_PATH = fileURLToPath(new URL('../../assets/frlg/sign.png', import.meta.url));

describe('the sign prop', () => {
  it('declares its own 16x16 texture and its single frame', () => {
    expect(PROP_SIGN_TEXTURE_KEY).toBe('frlg:sign');
    expect(PROP_SIGN_SIZE).toBe(16);
    expect(PROP_SIGN_FRAME).toBe(0);
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
  });
});
