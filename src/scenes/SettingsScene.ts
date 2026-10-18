import Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import type { Settings } from '../engine/save';
import { t } from '../i18n';
import { applyVolume, loadSettings, saveSettings } from '../settings';
import { prefersTouchControls } from '../input/device';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import {
  changeSetting,
  cycleSetting,
  isStepRow,
  moveSettingIndex,
  rebindSetting,
  settingValue,
  settingsRow,
  settingsRowHint,
  settingsRowLabel,
  settingsRows,
  volumeFromFraction,
  type SettingsRow,
} from '../ui/settingsScreen';
import { keyNameOf, subscribeKeybinds } from '../input/input';
import type { RouteScene } from './RouteScene';

type Opener = 'Route' | 'Starter' | 'MainMenu';

/** The preferred panel width; a narrower screen shrinks it (the scene is RESIZE). */
const PANEL_W = 760;
/** Rows are tight (32px) so every step row and the panel keys still fit 800px. */
const ROW_H = 32;
const ROW_TOP = 78;
/** The band under the rows that holds the hint and the control legend. */
const PANEL_FOOT = 64;
/** Gap kept between the panel and the screen edges, so it never runs off. */
const PANEL_MARGIN = 12;
/** The volume slider: a track with a fill and a knob, clickable and draggable. */
const SLIDER_H = 10;
const SLIDER_KNOB = 14;
const SLIDER_MAX_W = 240;
const SLIDER_MIN_W = 48;
/** Room kept at the right of the volume row for the percentage readout. */
const SLIDER_VALUE_W = 52;
const SLIDER_TRACK = 0x2f2c4d;
const SLIDER_FILL = 0x60a5fa;
const SLIDER_KNOB_FILL = 0xf8fafc;

type RowView = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
};

/** True when a point falls inside a rect, for the row and slider hit tests. */
function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
  );
}

/**
 * The settings screen (Phase 7). Opened from the main menu, the starter screen
 * or the route HUD (`Tab`); the opener pauses itself and resumes behind it.
 * Up/down picks a row and left/right steps a step row's value; every change is
 * stored and applied at once, so there is nothing to confirm. A keybind row
 * instead captures whatever key is pressed next (`E` on it starts the capture,
 * `Q` leaves it alone). All input goes through the shared map in `src/input/`, so
 * a rebind reaches every scene on the very next press.
 *
 * Pointer and touch drive it too: a press picks a row, a press on a step row
 * advances it and the volume row is a slider that can be clicked or dragged. On
 * a touch screen the keybind rows are hidden (`settingsRows`).
 */
export class SettingsScene extends Phaser.Scene {
  private from: Opener = 'Starter';
  private settings!: Settings;
  private index = 0;
  /** While set, the next keydown outside the capture is bound to the row. */
  private capturing: KeybindAction | null = null;
  /** The press that opened the capture, so it cannot bind itself. */
  private captureSkip: KeyboardEvent | null = null;
  private rows: RowView[] = [];
  /** The rows this device shows (no keybinds on a touch screen). */
  private rowList: readonly SettingsRow[] = [];
  /** The laid-out panel geometry, so a pointer press can hit-test a row. */
  private layout = { x: 0, y: 0, panelW: 0, panelH: 0, rowH: 0 };
  /** The volume row's slider track, or null when the volume row is absent. */
  private volumeSlider: { x: number; y: number; w: number; h: number } | null = null;
  private volumeFill!: Phaser.GameObjects.Rectangle;
  private volumeKnob!: Phaser.GameObjects.Rectangle;
  /** True while the volume slider is being dragged. */
  private draggingVolume = false;
  private hint!: Phaser.GameObjects.BitmapText;
  private controls!: Phaser.GameObjects.BitmapText;
  /** The window title, re-resolved on every render so a language switch shows at once. */
  private title!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Settings');
  }

  init(data?: { from?: Opener }): void {
    this.from = data?.from ?? 'Starter';
    this.settings = loadSettings();
    this.index = 0;
    this.capturing = null;
    this.captureSkip = null;
    this.draggingVolume = false;
    // Without a keyboard the keybind rows are hidden (the touch pad drives this).
    this.rowList = settingsRows(prefersTouchControls());
  }

  create(): void {
    const { width, height } = this.scale;
    // Scale.RESIZE hands the scene the whole window, so the panel is clamped to
    // the screen and its rows squeezed to fit a short view — on a phone it stays
    // fully visible instead of running off the side.
    const panelW = Math.min(PANEL_W, width - PANEL_MARGIN * 2);
    const rowCount = this.rowList.length;
    const rowH = Math.max(18, Math.min(ROW_H, (height - PANEL_MARGIN * 2 - ROW_TOP - PANEL_FOOT) / rowCount));
    const panelH = ROW_TOP + rowCount * rowH + PANEL_FOOT;
    const x = (width - panelW) / 2;
    const y = Math.max(PANEL_MARGIN, (height - panelH) / 2);
    const textTop = Math.round((rowH - 16) / 2);
    this.layout = { x, y, panelW, panelH, rowH };

    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);
    addFrlgWindow(this, x, y, panelW, panelH);
    this.title = addFrlgText(this, x + 28, y + 22, t('settings.title'), { size: 32, tint: FRLG_INK });

    this.volumeSlider = null;
    this.rows = this.rowList.map((row, i) => {
      const rowY = y + ROW_TOP + i * rowH;
      const highlight = this.add
        .rectangle(x + 20, rowY, panelW - 40, rowH - 6, 0xf2c14e, 0.28)
        .setOrigin(0, 0);
      const label = addFrlgText(this, x + 40, rowY + textTop, settingsRowLabel(row), {
        size: 16,
        tint: FRLG_INK,
      });
      const value = addFrlgText(this, x + panelW - 40, rowY + textTop, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      if (row.id === 'volume') this.buildVolumeSlider(rowY, rowH);
      return { highlight, label, value };
    });

    this.hint = addFrlgText(this, x + 40, y + ROW_TOP + rowCount * rowH + 6, '', {
      size: 16,
      tint: 0x94a3b8,
    });
    this.hint.setMaxWidth(panelW - 80);
    this.controls = addFrlgText(this, x + 40, y + panelH - 36, '', {
      size: 16,
      tint: 0xa8b3c7,
    });
    this.controls.setMaxWidth(panelW - 80);

    this.bindInput();
    this.bindPointer();
    this.render();
  }

  /** The volume row's track, fill and knob, sized and placed inside its row. */
  private buildVolumeSlider(rowY: number, rowH: number): void {
    const { x, panelW } = this.layout;
    const right = x + panelW - 40 - SLIDER_VALUE_W;
    const available = right - (x + 100);
    const w = Math.max(SLIDER_MIN_W, Math.min(SLIDER_MAX_W, available));
    const trackX = right - w;
    const trackY = rowY + rowH / 2 - SLIDER_H / 2;
    this.add.rectangle(trackX, trackY, w, SLIDER_H, SLIDER_TRACK).setOrigin(0, 0);
    this.volumeFill = this.add.rectangle(trackX, trackY, 0, SLIDER_H, SLIDER_FILL).setOrigin(0, 0);
    this.volumeKnob = this.add
      .rectangle(trackX, trackY + SLIDER_H / 2, SLIDER_KNOB, SLIDER_KNOB, SLIDER_KNOB_FILL)
      .setOrigin(0.5, 0.5);
    this.volumeSlider = { x: trackX, y: trackY - SLIDER_KNOB, w, h: SLIDER_H + SLIDER_KNOB * 2 };
  }

  private bindInput(): void {
    subscribeKeybinds(
      this,
      ({ action, event }) => this.handleAction(action, event),
      () => this.settings.keybinds,
    );

    // A capture takes the raw key, bound or not, so any key can be chosen; this
    // listener runs after the map's, which has already stood aside.
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.capturing || event.repeat) return;
      if (event === this.captureSkip) {
        this.captureSkip = null;
        return;
      }
      const key = keyNameOf(event);
      if (!key) return;
      this.settings = rebindSetting(this.settings, this.capturing, key);
      saveSettings(this.settings);
      this.stopCapture();
    });
  }

  /**
   * Pointer / touch input, so the screen is usable without a keyboard: a press
   * picks a row, a press on a step row advances it, and the volume row's track is
   * a slider that can be clicked or dragged.
   */
  private bindPointer(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => {
      this.draggingVolume = false;
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.capturing) return;
    // A tap outside the panel closes it: on a touch screen there is no cancel key.
    const { x, y, panelW, panelH } = this.layout;
    if (
      pointer.x < x ||
      pointer.x > x + panelW ||
      pointer.y < y ||
      pointer.y > y + panelH
    ) {
      this.close();
      return;
    }
    const index = this.rowIndexAt(pointer);
    if (index < 0) return;
    this.index = index;
    const row = this.rowList[index]!;
    if (row.id === 'volume') {
      if (this.volumeSlider && pointInRect(pointer, this.volumeSlider)) {
        this.draggingVolume = true;
        this.setVolumeFromPointer(pointer);
      } else {
        this.render();
      }
      return;
    }
    if (isStepRow(row)) {
      this.cycle(row);
      return;
    }
    // A keybind row: arm the capture so the next key press binds it.
    this.capturing = row.id as KeybindAction;
    this.captureSkip = null;
    this.render();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.draggingVolume) {
      if (!pointer.isDown) {
        this.draggingVolume = false;
      } else {
        this.setVolumeFromPointer(pointer);
        return;
      }
    }
    // A clickable row reads as such; the volume track reads as draggable.
    const overSlider = this.volumeSlider !== null && pointInRect(pointer, this.volumeSlider);
    this.input.setDefaultCursor(overSlider ? 'grab' : this.rowIndexAt(pointer) >= 0 ? 'pointer' : 'default');
  }

  /** Sets the volume from the pointer's position along the slider track. */
  private setVolumeFromPointer(pointer: Phaser.Input.Pointer): void {
    const slider = this.volumeSlider;
    if (!slider) return;
    const volume = volumeFromFraction((pointer.x - slider.x) / slider.w);
    if (volume !== this.settings.volume) {
      this.settings = { ...this.settings, volume };
      saveSettings(this.settings);
      applyVolume(this.sound, this.settings);
    }
    this.render();
  }

  /** The row index under the pointer, or -1 outside every row. */
  private rowIndexAt(pointer: Phaser.Input.Pointer): number {
    const { x, y, panelW, rowH } = this.layout;
    for (let i = 0; i < this.rowList.length; i++) {
      const rowY = y + ROW_TOP + i * rowH;
      if (
        pointer.x >= x + 20 &&
        pointer.x <= x + panelW - 20 &&
        pointer.y >= rowY &&
        pointer.y <= rowY + rowH
      ) {
        return i;
      }
    }
    return -1;
  }

  /**
   * The player's intent behind one shared action, from a key or the touch pad /
   * A / B. `event` is the key press when there was one, so a touch press can ask
   * for a rebind without a key to bind.
   */
  private handleAction(action: KeybindAction, event: KeyboardEvent | null): void {
    if (this.capturing) {
      // The press that started the capture still reaches here; ignore it.
      if (event !== null && event === this.captureSkip) return;
      if (action === 'cancel') {
        this.stopCapture();
        return;
      }
      return;
    }
    switch (action) {
      case 'up':
        this.move(-1);
        return;
      case 'down':
        this.move(1);
        return;
      case 'left':
      case 'right':
        this.change(action === 'left' ? -1 : 1);
        return;
      case 'confirm':
        this.confirm(event);
        return;
      case 'cancel':
        this.close();
        return;
    }
  }

  private move(delta: number): void {
    if (this.capturing) return;
    this.index = moveSettingIndex(this.index, delta, this.rowList.length);
    this.render();
  }

  /** Steps the highlighted row and stores the result right away. */
  private change(delta: number): void {
    const row = settingsRow(this.index, this.rowList);
    if (!isStepRow(row)) return;
    const before = this.settings;
    this.settings = changeSetting(before, row.id, delta);
    if (this.settings === before) return;
    saveSettings(this.settings);
    applyVolume(this.sound, this.settings);
    this.render();
  }

  /**
   * Steps a row the click way: the ordered rows wrap, so a click alone can reach
   * every value (there is no left/right key on a touch screen).
   */
  private cycle(row: SettingsRow): void {
    const before = this.settings;
    this.settings = cycleSetting(before, row.id, 1);
    if (this.settings === before) return;
    saveSettings(this.settings);
    applyVolume(this.sound, this.settings);
    this.render();
  }

  /** On a keybind row this arms the capture; on a step row it just closes. */
  private confirm(event: KeyboardEvent | null): void {
    const row = settingsRow(this.index, this.rowList);
    if (isStepRow(row)) {
      this.close();
      return;
    }
    // A touch press has no key to bind, so it leaves the row alone.
    if (event === null) return;
    this.capturing = row.id as KeybindAction;
    // The press that opened the capture must not be the key it binds.
    this.captureSkip = event;
    this.render();
  }

  private stopCapture(): void {
    this.capturing = null;
    this.captureSkip = null;
    this.render();
  }

  private render(): void {
    // The language row is changed on this very screen, so every string is resolved
    // from the current locale here rather than once in `create`.
    this.title.setText(t('settings.title'));
    this.rows.forEach((view, i) => {
      const selected = i === this.index;
      const row = this.rowList[i]!;
      const listening = selected && this.capturing !== null;
      view.highlight.setVisible(selected);
      view.label.setText(settingsRowLabel(row)).setAlpha(selected ? 1 : 0.85);
      view.value
        .setText(listening ? t('settings.pressKey') : settingValue(this.settings, row.id))
        .setAlpha(selected ? 1 : 0.85);
    });
    this.refreshVolumeSlider();
    this.hint.setText(this.rowHint(settingsRow(this.index, this.rowList), this.capturing !== null));
    this.controls.setText(this.controlsLine());
  }

  /** Redraws the volume slider's fill and knob to the current volume. */
  private refreshVolumeSlider(): void {
    const slider = this.volumeSlider;
    if (!slider) return;
    const filled = slider.w * this.settings.volume;
    this.volumeFill.setSize(filled, SLIDER_H);
    this.volumeKnob.setX(slider.x + filled);
  }

  private rowHint(row: SettingsRow, listening: boolean): string {
    if (row.id === 'volume') return t('settings.hintVolume');
    if (isStepRow(row)) return settingsRowHint(row);
    const { confirm, cancel } = this.settings.keybinds;
    if (listening) {
      return t('settings.hintPressKey', { cancel: keyLabel(cancel) });
    }
    return t('settings.hintRebind', { confirm: keyLabel(confirm) });
  }

  private controlsLine(): string {
    if (prefersTouchControls()) return t('settings.controlsTouch');
    const { confirm, cancel, up, down, left, right } = this.settings.keybinds;
    return t('settings.controls', {
      up: keyLabel(up),
      down: keyLabel(down),
      left: keyLabel(left),
      right: keyLabel(right),
      confirm: keyLabel(confirm),
      cancel: keyLabel(cancel),
    });
  }

  /** Hands the opener back its screen; the route re-reads what changed. */
  private close(): void {
    if (this.from === 'Route') (this.scene.get('Route') as RouteScene).applySettings();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
