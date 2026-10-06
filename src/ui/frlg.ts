import type Phaser from 'phaser';
import textboxUrl from '../assets/frlg/textbox.png';
import windowUrl from '../assets/frlg/window.png';
import hpbarUrl from '../assets/frlg/hpbar.png';
import cursorUrl from '../assets/frlg/cursor.png';
import battleUi from '../data/frlg/battle-ui.json';

/**
 * The FireRed/LeafGreen window chrome. `window` is the light menu window (HP
 * panels, lists), `textbox` the navy battle message box; both are nine-slices
 * so a single texture draws any size. `hpbar` is the HP readout — the "HP"
 * chip plus an empty track — and `cursor` the ▶ command-menu arrow. Extracted
 * and 4x-upscaled by `scripts/frlg/build-battle-ui.mjs` for the 1280x800
 * canvas; the measured geometry lives in `src/data/frlg/battle-ui.json`.
 */
export const FRLG_WINDOW_URL = windowUrl;
export const FRLG_TEXTBOX_URL = textboxUrl;
export const FRLG_HPBAR_URL = hpbarUrl;
export const FRLG_CURSOR_URL = cursorUrl;
export const FRLG_WINDOW_KEY = 'frlg:window';
export const FRLG_TEXTBOX_KEY = 'frlg:textbox';
export const FRLG_HPBAR_KEY = 'frlg:hpbar';
export const FRLG_CURSOR_KEY = 'frlg:cursor';

/** Corner size in texture pixels (the 4x-upscaled border). */
export const FRLG_WINDOW_CORNER = 20;
export const FRLG_TEXTBOX_CORNER = 24;

/**
 * The light window's baked border, measured from `window.png`: content must sit
 * inside it or it rides over the frame. The nine-slice corner is 20; the frame
 * is 20px on the sides and 16/8 at the top and bottom.
 */
export const FRLG_WINDOW_PADDING = { x: 20, top: 16, bottom: 8 } as const;

/** The navy textbox's baked border, measured from `textbox.png` (36 sides, 28 top/bottom). */
export const FRLG_TEXTBOX_PADDING = { x: 36, top: 28, bottom: 28 } as const;

export type FrlgWindowVariant = 'window' | 'textbox';

/** Adds an FRLG nine-slice window at `(x, y)`, top-left origin. */
export function addFrlgWindow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  variant: FrlgWindowVariant = 'window',
): Phaser.GameObjects.NineSlice {
  const corner = variant === 'textbox' ? FRLG_TEXTBOX_CORNER : FRLG_WINDOW_CORNER;
  const key = variant === 'textbox' ? FRLG_TEXTBOX_KEY : FRLG_WINDOW_KEY;
  return scene.add
    .nineslice(x, y, key, undefined, width, height, corner, corner, corner, corner)
    .setOrigin(0, 0);
}

/** The HP bar texture size and the track rectangle inside it, in canvas px. */
export const FRLG_HPBAR = {
  width: battleUi.hpbar.width,
  height: battleUi.hpbar.height,
  fill: battleUi.hpbar.fill,
} as const;

/** Draws the current HP as a fill inside the baked bar and returns the overlay. */
export function addFrlgHpBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
): { fill: Phaser.GameObjects.Rectangle; bar: Phaser.GameObjects.Image } {
  const { fill } = FRLG_HPBAR;
  const rect = scene.add
    .rectangle(x + fill.x, y + fill.y, fill.width, fill.height, 0x58d080)
    .setOrigin(0, 0);
  const bar = scene.add.image(x, y, FRLG_HPBAR_KEY).setOrigin(0, 0);
  return { fill: rect, bar };
}
