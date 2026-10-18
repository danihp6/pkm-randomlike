import type Phaser from 'phaser';
import textboxUrl from '../assets/ui/textbox.png';
import windowUrl from '../assets/ui/window.png';
import hpbarUrl from '../assets/frlg/hpbar.png';
import cursorUrl from '../assets/frlg/cursor.png';
import battleUi from '../data/frlg/battle-ui.json';
import chrome from '../data/ui/chrome.json';

/**
 * The game's window chrome: one dark translucent glass card, drawn twice. The
 * two nine-slices are the set under `src/assets/ui`
 * (`scripts/ui/build-chrome.mjs`, `npm run data:ui`): the FRLG frames' outer
 * shape and baked content insets around a `#10161f` surface at 0.72 (the
 * battle's message box, and only it, at 0.80), a 1px hairline and a 1px shadow
 * ring, so no scene's layout moved. `addFrlgWindow` applies the skin's own
 * translucency. `hpbar` is the HP readout — the "HP" chip plus an empty track —
 * and `cursor` the ▶ command-menu arrow; both keep the FRLG art
 * (`scripts/frlg/build-battle-ui.mjs`) and its geometry in
 * `src/data/frlg/battle-ui.json`.
 *
 * The tones below are the whole vocabulary a panel draws with, and every one of
 * them comes from the `tokens` block in `src/data/ui/chrome.json`: no scene
 * types a chrome literal.
 */
export const FRLG_WINDOW_URL = windowUrl;
export const FRLG_TEXTBOX_URL = textboxUrl;
export const FRLG_HPBAR_URL = hpbarUrl;
export const FRLG_CURSOR_URL = cursorUrl;
export const FRLG_WINDOW_KEY = 'frlg:window';
export const FRLG_TEXTBOX_KEY = 'frlg:textbox';
export const FRLG_HPBAR_KEY = 'frlg:hpbar';
export const FRLG_CURSOR_KEY = 'frlg:cursor';

/** Corner size in texture pixels (the 4x canvas the chrome is authored at). */
export const FRLG_WINDOW_CORNER: number = chrome.window.corner;
export const FRLG_TEXTBOX_CORNER: number = chrome.textbox.corner;

/**
 * The window's baked border, measured from `window.png`: content must sit
 * inside it or it rides over the frame. The nine-slice corner is 11; the frame
 * is 20px on the sides and 16/8 at the top and bottom.
 */
export const FRLG_WINDOW_PADDING: Readonly<{ x: number; top: number; bottom: number }> =
  chrome.window.padding;

/** The message box's baked border, measured from `textbox.png` (36 sides, 28 top/bottom). */
export const FRLG_TEXTBOX_PADDING: Readonly<{ x: number; top: number; bottom: number }> =
  chrome.textbox.padding;

/**
 * The card's own translucency, so the route and the battle stay readable through
 * the panels even with the Transparent HUD preference off. Every panel is the
 * same card; the battle's message box is the denser one.
 */
export const FRLG_WINDOW_ALPHA: number = chrome.window.alpha;
export const FRLG_TEXTBOX_ALPHA: number = chrome.textbox.alpha;

/** A chrome tone as the packer writes it: a colour and the alpha it is drawn at. */
export type FrlgTone = Readonly<{ colour: number; alpha: number }>;

/** `#rrggbb` as the `0xRRGGBB` the scenes fill and tint with. */
export function frlgColour(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

const TOKENS = chrome.tokens;

/** The glass field's own tone. */
export const FRLG_SURFACE: number = frlgColour(TOKENS.surface);
/** The one accent: selection and controls only, never a border of its own. */
export const FRLG_ACCENT: number = frlgColour(TOKENS.accent);
/** The secondary tone: every hint, level, count and dimmed label. */
export const FRLG_MUTED: number = frlgColour(TOKENS.muted);
/** The ink on a full-colour type badge. */
export const FRLG_BADGE_INK: number = frlgColour(TOKENS.badgeInk);
/** A raised value (power, accuracy, a nature's plus). */
export const FRLG_POSITIVE: number = frlgColour(TOKENS.positive);
/** A lowered value (power, accuracy, a nature's minus). */
export const FRLG_NEGATIVE: number = frlgColour(TOKENS.negative);

function tone(value: Readonly<{ colour: string; alpha: number }>): FrlgTone {
  return { colour: frlgColour(value.colour), alpha: value.alpha };
}

/** The card's own 1px frame. */
export const FRLG_HAIRLINE: FrlgTone = tone(TOKENS.hairline);
/** The field's first row inside that frame. */
export const FRLG_HIGHLIGHT: FrlgTone = tone(TOKENS.highlight);
/** The 1px ring at the card's own edge, hugging it. */
export const FRLG_SHADOW: FrlgTone = tone(TOKENS.shadow);
/** An ordinary row or cell. */
export const FRLG_ROW_FILL: FrlgTone = tone(TOKENS.row.fill);
export const FRLG_ROW_STROKE: FrlgTone = tone(TOKENS.row.stroke);
/** A selected row, cell, tab or armed control (fill AND outline). */
export const FRLG_SELECTED_FILL: FrlgTone = tone(TOKENS.selected.fill);
export const FRLG_SELECTED_STROKE: FrlgTone = tone(TOKENS.selected.stroke);
/** An HP / XP track, and any bar background. */
export const FRLG_TRACK: FrlgTone = tone(TOKENS.track);

export type FrlgWindowVariant = 'window' | 'textbox';

/** Adds the nine-slice window at `(x, y)`, top-left origin, at the set's own alpha. */
export function addFrlgWindow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  variant: FrlgWindowVariant = 'window',
): Phaser.GameObjects.NineSlice {
  const skin = variant === 'textbox' ? chrome.textbox : chrome.window;
  const key = variant === 'textbox' ? FRLG_TEXTBOX_KEY : FRLG_WINDOW_KEY;
  const slice = scene.add
    .nineslice(x, y, key, undefined, width, height, skin.corner, skin.corner, skin.corner, skin.corner)
    .setOrigin(0, 0)
    .setAlpha(skin.alpha);
  // A bare `setSlices(width, height)` would reset Phaser's slices to 10/10/0/0
  // and smear the frame of every resized panel (the battle boxes and the info
  // popup resize theirs), so the variant's own corner stays the default.
  const setSlices = slice.setSlices.bind(slice);
  slice.setSlices = (w, h, leftWidth, rightWidth, topHeight, bottomHeight, skipScale9) =>
    setSlices(
      w,
      h,
      leftWidth ?? skin.corner,
      rightWidth ?? skin.corner,
      topHeight ?? skin.corner,
      bottomHeight ?? skin.corner,
      skipScale9,
    );
  return slice;
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
