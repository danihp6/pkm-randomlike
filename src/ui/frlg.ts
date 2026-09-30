import type Phaser from 'phaser';
import textboxUrl from '../assets/frlg/textbox.png';
import windowUrl from '../assets/frlg/window.png';

/**
 * The FireRed/LeafGreen window chrome. `window` is the light menu window (HP
 * panels, lists), `textbox` the navy battle message box; both are nine-slices
 * so a single texture draws any size. Extracted and 4x-upscaled by
 * `scripts/frlg/build-battle-ui.mjs` for the 1280x800 canvas.
 */
export const FRLG_WINDOW_URL = windowUrl;
export const FRLG_TEXTBOX_URL = textboxUrl;
export const FRLG_WINDOW_KEY = 'frlg:window';
export const FRLG_TEXTBOX_KEY = 'frlg:textbox';

/** Corner size in texture pixels (the 4x-upscaled border). */
export const FRLG_WINDOW_CORNER = 20;
export const FRLG_TEXTBOX_CORNER = 24;

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
