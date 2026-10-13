import type Phaser from 'phaser';
import { addFrlgWindow, FRLG_WINDOW_PADDING } from './frlg';
import { addFrlgText, FRLG_FONT_SIZE, FRLG_INK } from './frlgFont';
import { TYPE_ICON_W } from '../data/typeIcons';

/**
 * The floating description window the move cells and the ability rows share: an
 * FRLG window whose height comes from its wrapped text, an optional left column
 * of stacked badges or one coloured chip, and a text that hides the whole thing
 * when it is empty. Extracted from `moveGrid.ts` so both read identically.
 *
 * The component owns its visuals but not its input: it builds every game object
 * once and only repositions them on `show`, so no per-frame allocation happens
 * and the owning scene stays the only thing that listens to the pointer.
 */

/** A badge drawn in the popup's left column, at `y` from the popup's inner top. */
export type InfoPopupBadge = Readonly<{ textureKey: string; frame: number; y: number }>;

/** The coloured label chip that stands in for a missing badge. */
export type InfoPopupChip = Readonly<{ label: string; color: number; y: number }>;

export type InfoPopupContent = Readonly<{
  /** The wrapped description; an empty string hides the popup. */
  text: string;
  badges?: readonly InfoPopupBadge[];
  chip?: InfoPopupChip | null;
}>;

export type InfoPopupSpot = Readonly<{
  x: number;
  /** The window's width; its height is measured from the wrapped text. */
  width: number;
  /** The y the window prefers to sit above (its bottom edge). */
  above: number;
  /** The y the window falls back to when there is no room above. */
  below: number;
}>;

/** The shortest window drawn, whatever the description wraps to. */
const POPUP_MIN_H = 56;
/** The left column: a type badge and, under it, a status badge. */
const POPUP_ICON_COL = 44;
/** The badge slots the left column has room for; extra badges are ignored. */
const POPUP_BADGES = 2;
/** The chip stands in for the type badge, so it takes the badge's width. */
const POPUP_CHIP_W = TYPE_ICON_W;
const POPUP_CHIP_H = 14;
/** At this width and wider the description takes the full font size. */
const POPUP_WIDE = 500;
const POPUP_SMALL_SIZE = 16;
/** The badge images start on the engine's blank texture; `show` swaps it. */
const BLANK_TEXTURE_KEY = '__DEFAULT';

export class InfoPopup {
  private window: Phaser.GameObjects.NineSlice;
  private badges: Phaser.GameObjects.Image[] = [];
  private chip: Phaser.GameObjects.Rectangle;
  private chipText: Phaser.GameObjects.BitmapText;
  private text: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene, container?: Phaser.GameObjects.Container) {
    this.window = addFrlgWindow(scene, 0, 0, 300, POPUP_MIN_H).setVisible(false);
    this.badges = Array.from({ length: POPUP_BADGES }, () =>
      scene.add.image(0, 0, BLANK_TEXTURE_KEY).setOrigin(0, 0).setVisible(false),
    );
    this.chip = scene.add
      .rectangle(0, 0, POPUP_CHIP_W, POPUP_CHIP_H, 0x9aa0b4)
      .setOrigin(0, 0)
      .setVisible(false);
    this.chipText = addFrlgText(scene, 0, 0, '', {
      size: 16,
      tint: 0xf8fafc,
      origin: [0.5, 0],
    }).setVisible(false);
    this.text = addFrlgText(scene, 0, 0, '', { tint: FRLG_INK, lineSpacing: 4 }).setVisible(false);

    const objects: Phaser.GameObjects.GameObject[] = [
      this.window,
      ...this.badges,
      this.chip,
      this.chipText,
      this.text,
    ];
    if (container) container.add(objects);
  }

  /** Measures the text, floats the window at `spot` and shows it. */
  show(spot: InfoPopupSpot, content: InfoPopupContent): void {
    if (content.text.length === 0) {
      this.hide();
      return;
    }
    const pad = FRLG_WINDOW_PADDING;
    const size = this.fontSize(spot.width);
    this.text
      .setFontSize(size)
      .setText(content.text)
      .setMaxWidth(spot.width - pad.x * 2 - POPUP_ICON_COL - 12);
    const height = Math.max(POPUP_MIN_H, pad.top + Math.max(24, this.text.height) + pad.bottom);
    const x = spot.x;
    const y = spot.above - height >= 0 ? spot.above - height : spot.below;
    const iconY = y + pad.top;
    this.window.setSlices(spot.width, height).setPosition(x, y).setVisible(true);

    const badges = content.badges ?? [];
    this.badges.forEach((badge, i) => {
      const data = badges[i];
      if (!data) {
        badge.setVisible(false);
        return;
      }
      badge
        .setTexture(data.textureKey, data.frame)
        .setPosition(x + pad.x, iconY + data.y)
        .setVisible(true);
    });

    if (content.chip) {
      const chip = content.chip;
      this.chip
        .setPosition(x + pad.x, iconY + chip.y)
        .setSize(POPUP_CHIP_W, POPUP_CHIP_H)
        .setFillStyle(chip.color)
        .setVisible(true);
      this.chipText
        .setText(chip.label)
        .setPosition(x + pad.x + POPUP_CHIP_W / 2, iconY + chip.y + 2)
        .setVisible(true);
    } else {
      this.chip.setVisible(false);
      this.chipText.setVisible(false);
    }

    this.text
      .setPosition(x + pad.x + POPUP_ICON_COL, iconY + Math.max(0, (24 - size) / 2))
      .setVisible(true);
  }

  /** Hides the window and every piece of it. */
  hide(): void {
    this.window.setVisible(false);
    this.text.setVisible(false);
    this.chip.setVisible(false);
    this.chipText.setVisible(false);
    for (const badge of this.badges) badge.setVisible(false);
  }

  /** True while the window is on screen. */
  get visible(): boolean {
    return this.window.visible;
  }

  /** The description's size: the full font on a wide window, smaller on a phone. */
  private fontSize(width: number): number {
    return width >= POPUP_WIDE ? FRLG_FONT_SIZE : POPUP_SMALL_SIZE;
  }
}
