import type Phaser from 'phaser';
import fontAtlasUrl from '../assets/ui/font.png';
import manifest from '../data/ui/font.json';

/**
 * The game's bitmap font, the modernised twin of the FRLG face: the same glyph
 * shapes and metrics (`src/data/ui/font.json`, derived from the committed
 * `src/assets/frlg/font.png` + `src/data/frlg/font.json` by
 * `scripts/ui/build-chrome.mjs`, `npm run data:ui`), with the glyph shadow
 * half-alpha so a letter reads as a soft halo on a translucent panel instead of
 * a solid second tone. The atlas is white ink on purpose — one texture serves
 * both the dark battle box (left untinted) and the light windows (tinted
 * `FRLG_INK`), so a drawn chrome, not the rip, carries the public build's UI.
 */
export const FRLG_FONT_ATLAS_URL = fontAtlasUrl;
export const FRLG_FONT_TEXTURE_KEY = 'frlg:font';
export const FRLG_FONT_KEY = 'frlg-font';
/** Line height in canvas px at the default scale. */
export const FRLG_FONT_SIZE = manifest.size;
export const FRLG_LINE_HEIGHT = manifest.lineHeight;

type Glyph = Readonly<{
  code: number;
  x: number;
  y: number;
  width: number;
  height: number;
  xAdvance: number;
}>;

const GLYPHS = manifest.glyphs as readonly Glyph[];

// Phaser's public character typedef omits `xAdvance`, which the parser sets and
// the renderer needs, so the generated data carries it explicitly.
export type FrlgGlyphData =
  Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData & { xAdvance: number };

export type FrlgFontData = Omit<
  Phaser.Types.GameObjects.BitmapText.BitmapFontData,
  'chars'
> & { chars: Record<number, FrlgGlyphData> };

/** Turns the committed manifest into Phaser's `BitmapFontData` shape. */
export function frlgFontData(): FrlgFontData {
  const { width, height } = manifest.atlas;
  const chars: Record<number, FrlgGlyphData> = {};
  for (const glyph of GLYPHS) {
    chars[glyph.code] = {
      x: glyph.x,
      y: glyph.y,
      width: glyph.width,
      height: glyph.height,
      centerX: Math.floor(glyph.width / 2),
      centerY: Math.floor(glyph.height / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: glyph.xAdvance,
      u0: glyph.x / width,
      v0: glyph.y / height,
      u1: (glyph.x + glyph.width) / width,
      v1: (glyph.y + glyph.height) / height,
      data: {},
      kerning: {},
    };
  }
  return {
    font: manifest.name,
    size: manifest.size,
    lineHeight: manifest.lineHeight,
    retroFont: false,
    chars,
  };
}

/** Registers the packed font in a scene's bitmap-font cache (once). */
export function registerFrlgFont(cache: Phaser.Cache.BaseCache): void {
  if (cache.exists(FRLG_FONT_KEY)) return;
  cache.add(FRLG_FONT_KEY, {
    data: frlgFontData(),
    texture: FRLG_FONT_TEXTURE_KEY,
    frame: null,
  });
}

export type FrlgTextOptions = Readonly<{
  /** Canvas px; only multiples of 16 (the native cell) stay pixel-perfect. */
  size?: number;
  /** `0xRRGGBB`; text inside the light windows wants `FRLG_INK`. */
  tint?: number;
  align?: 'left' | 'center' | 'right';
  origin?: number | readonly [number, number];
  lineSpacing?: number;
}>;

/** Dark ink for text drawn on the light window: deep black, not the old navy. */
export const FRLG_INK = 0x0b0b10;

/** Adds the UI bitmap text with the shared defaults. */
export function addFrlgText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: FrlgTextOptions = {},
): Phaser.GameObjects.BitmapText {
  const object = scene.add.bitmapText(x, y, FRLG_FONT_KEY, text, options.size ?? FRLG_FONT_SIZE);
  if (options.tint !== undefined) object.setTint(options.tint);
  if (options.align !== undefined) {
    if (options.align === 'center') object.setCenterAlign();
    else if (options.align === 'right') object.setRightAlign();
  }
  if (options.origin !== undefined) {
    if (typeof options.origin === 'number') object.setOrigin(options.origin);
    else object.setOrigin(options.origin[0], options.origin[1]);
  }
  if (options.lineSpacing !== undefined) object.setLineSpacing(options.lineSpacing);
  return object;
}
