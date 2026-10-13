import { describe, expect, it } from 'vitest';
import manifest from '../data/ui/font.json';
import { FRLG_LINE_HEIGHT, FRLG_FONT_SIZE, frlgFontData } from './frlgFont';

const data = frlgFontData();

describe('FRLG bitmap font', () => {
  it('keeps the atlas and line metrics coherent', () => {
    expect(manifest.atlas.width).toBeGreaterThan(0);
    expect(manifest.atlas.height).toBeGreaterThan(0);
    expect(FRLG_LINE_HEIGHT).toBe(FRLG_FONT_SIZE);
    expect(data.lineHeight).toBe(FRLG_LINE_HEIGHT);
  });

  it('covers the Latin set the game text uses', () => {
    const wanted = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;\'-()/%×♂♀é';
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
});
