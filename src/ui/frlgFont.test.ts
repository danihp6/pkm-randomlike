import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import { decodePng } from '../../scripts/legacy-art/png-codec.mjs';
import chrome from '../data/ui/chrome.json';
import manifest from '../data/ui/font.json';
import { frlgColour } from './frlg';
import { FRLG_INK, FRLG_LINE_HEIGHT, FRLG_FONT_SIZE, frlgFontData } from './frlgFont';

const data = frlgFontData();

const FONT_SHADOW = [96, 96, 96];
const FONT_HALO_ALPHA = 128;

function atlas(path: string) {
  return decodePng(readFileSync(fileURLToPath(new URL(path, import.meta.url))));
}

describe('FRLG bitmap font', () => {
  it('keeps the atlas and line metrics coherent', () => {
    expect(manifest.atlas.width).toBeGreaterThan(0);
    expect(manifest.atlas.height).toBeGreaterThan(0);
    expect(FRLG_LINE_HEIGHT).toBe(FRLG_FONT_SIZE);
    expect(data.lineHeight).toBe(FRLG_LINE_HEIGHT);
  });

  it('covers the Latin set the game text uses', () => {
    const wanted = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;'-()/%×♂♀é";
    for (const char of wanted) {
      const code = char.codePointAt(0)!;
      expect(data.chars[code], `U+${code.toString(16)}`).toBeDefined();
    }
  });

  it('keeps every glyph inside the atlas with a positive advance', () => {
    const { width, height } = manifest.atlas;
    for (const glyph of manifest.glyphs) {
      const char = data.chars[glyph.code]!;
      expect(char.x).toBeGreaterThanOrEqual(0);
      expect(char.y).toBeGreaterThanOrEqual(0);
      expect(char.x + char.width).toBeLessThanOrEqual(width);
      expect(char.y + char.height).toBeLessThanOrEqual(height);
      expect(char.xAdvance).toBeGreaterThan(0);
      if (char.width > 0 && char.height > 0) {
        expect(char.u1).toBeGreaterThan(char.u0);
        expect(char.v1).toBeGreaterThan(char.v0);
      }
    }
  });

  it('gives the letter glyphs the same ink height and a blank space', () => {
    expect(data.chars[32]!.width).toBe(0);
    expect(data.chars[65]!.width).toBeGreaterThan(0);
    expect(data.chars[65]!.height).toBe(FRLG_LINE_HEIGHT);
  });

  it('draws with the light body ink the chrome set carries', () => {
    expect(FRLG_INK).toBe(frlgColour(chrome.tokens.ink));
    expect(FRLG_INK).toBe(0xf8fafc);
  });

  it.skipIf(!hasArt('frlg/font.png'))(
    'keeps the glyph shapes and metrics while turning the shadow into a half-alpha halo',
    () => {
      const source = atlas('../assets/frlg/font.png');
      const packed = atlas('../assets/ui/font.png');
      expect(packed.width).toBe(source.width);
      expect(packed.height).toBe(source.height);
      expect(packed.width).toBe(manifest.atlas.width);
      expect(packed.height).toBe(manifest.atlas.height);
      const wrongHalo: number[] = [];
      const drifted: number[] = [];
      let halos = 0;
      for (let i = 0; i < source.data.length; i += 4) {
        const shadow =
          source.data[i + 3] === 255 &&
          source.data[i] === FONT_SHADOW[0] &&
          source.data[i + 1] === FONT_SHADOW[1] &&
          source.data[i + 2] === FONT_SHADOW[2];
        if (shadow) {
          halos++;
          if (
            packed.data[i] !== 0 ||
            packed.data[i + 1] !== 0 ||
            packed.data[i + 2] !== 0 ||
            packed.data[i + 3] !== FONT_HALO_ALPHA
          ) {
            wrongHalo.push(i);
          }
          continue;
        }
        if (
          packed.data[i] !== source.data[i] ||
          packed.data[i + 1] !== source.data[i + 1] ||
          packed.data[i + 2] !== source.data[i + 2] ||
          packed.data[i + 3] !== source.data[i + 3]
        ) {
          drifted.push(i);
        }
      }
      expect(wrongHalo).toEqual([]);
      expect(drifted).toEqual([]);
      expect(halos).toBeGreaterThan(0);
    },
  );
});
