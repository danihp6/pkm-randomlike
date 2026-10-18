import type Phaser from 'phaser';
import { t } from '../i18n';
import { addFrlgText, FRLG_INK } from './frlgFont';
import type { InfoPopup, InfoPopupContent } from './infoPopup';

/**
 * The ability row's ⓘ control: the same 22x22 button a move cell draws, plus the
 * popup that floats the ability's own description. Like `MoveGrid` it owns its
 * visuals and not its input — each scene hit-tests `contains` and drives
 * `layout`, so the route HUD, the battle's SWITCH window and the capture screen
 * all read the same way.
 */

/** The same ⓘ button the move cells draw. */
export const ABILITY_INFO_SIZE = 22;

/** How wide the floating description is unless the caller clamps it. */
export const ABILITY_INFO_POPUP_W = 320;

/** The gap between the row's text and the button, and between button and window. */
const ABILITY_ROW_GAP = 8;
const ABILITY_POPUP_GAP = 8;

/** Where the ⓘ button sits, in the coordinates of the container that owns the row. */
export type AbilityInfoSpot = Readonly<{ x: number; y: number; width: number; height: number }>;

/** The ⓘ button for an ability row whose text ends at `textRight`, on row `rowY`. */
export function abilityInfoSpot(textRight: number, rowY: number): AbilityInfoSpot {
  return {
    x: textRight + ABILITY_ROW_GAP,
    y: rowY,
    width: ABILITY_INFO_SIZE,
    height: ABILITY_INFO_SIZE,
  };
}

/** What a row's ⓘ floats: the description, or a stand-in when there is none. */
export function abilityInfoContent(name: string, desc: string | null): InfoPopupContent {
  return { text: desc !== null && desc.length > 0 ? desc : t('ability.noDescription', { name }) };
}

export class AbilityInfoButton {
  private button: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.BitmapText;
  private popup: InfoPopup;
  /** The frame the last `layout` used, for hit testing; null when hidden. */
  private spot: AbilityInfoSpot | null = null;

  constructor(scene: Phaser.Scene, popup: InfoPopup, container?: Phaser.GameObjects.Container) {
    this.popup = popup;
    this.button = scene.add
      .rectangle(0, 0, ABILITY_INFO_SIZE, ABILITY_INFO_SIZE, 0xcfcce2)
      .setStrokeStyle(2, 0x9a94b8)
      .setVisible(false);
    this.label = addFrlgText(scene, 0, 0, 'i', { size: 16, tint: FRLG_INK, origin: 0.5 }).setVisible(
      false,
    );
    if (container) container.add([this.button, this.label]);
  }

  /**
   * Places and paints the button and floats (or hides) the popup. A null `spot`
   * hides both; `active` moves the popup in and out while the button stays.
   */
  layout(
    spot: AbilityInfoSpot | null,
    active: boolean,
    content: InfoPopupContent,
    width?: number,
  ): void {
    if (!spot) {
      this.hide();
      return;
    }
    this.spot = spot;
    const centerX = spot.x + spot.width / 2;
    const centerY = spot.y + spot.height / 2;
    this.button
      .setPosition(centerX, centerY)
      .setSize(spot.width, spot.height)
      .setFillStyle(active ? 0xf7e0a6 : 0xcfcce2)
      .setStrokeStyle(2, active ? 0x2f2c4d : 0x9a94b8)
      .setVisible(true);
    this.label.setPosition(centerX, centerY).setVisible(true);
    if (!active) {
      this.popup.hide();
      return;
    }
    this.popup.show(
      {
        x: spot.x,
        width: width ?? ABILITY_INFO_POPUP_W,
        above: spot.y - ABILITY_POPUP_GAP,
        below: spot.y + spot.height + ABILITY_POPUP_GAP,
      },
      content,
    );
  }

  /** Hides the button and the popup. */
  hide(): void {
    this.spot = null;
    this.button.setVisible(false);
    this.label.setVisible(false);
    this.popup.hide();
  }

  /**
   * True when a point in the button's **parent-container** coordinates is inside
   * it — a `layout` spot's own frame, which is what the route HUD passes.
   */
  contains(x: number, y: number): boolean {
    const spot = this.spot;
    if (!spot) return false;
    return x >= spot.x && x <= spot.x + spot.width && y >= spot.y && y <= spot.y + spot.height;
  }
}
