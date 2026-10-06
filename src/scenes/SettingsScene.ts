import Phaser from 'phaser';
import { keyLabel, type KeybindAction } from '../data/keybinds';
import type { Settings } from '../engine/save';
import { applyVolume, loadSettings, saveSettings } from '../settings';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import {
  changeSetting,
  isStepRow,
  moveSettingIndex,
  rebindSetting,
  settingValue,
  settingsRow,
  SETTINGS_ROWS,
  type SettingsRow,
} from '../ui/settingsScreen';
import { keyNameOf, subscribeKeybinds } from '../input/input';
import type { RouteScene } from './RouteScene';

type Opener = 'Route' | 'Starter';

const PANEL_W = 760;
const ROW_H = 40;
const ROW_TOP = 92;
const PANEL_H = ROW_TOP + SETTINGS_ROWS.length * ROW_H + 84;

type RowView = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
};

/**
 * The settings screen (Phase 7). Opened from the starter screen or the route HUD
 * (`O`), which pause themselves and resume behind it. Up/down picks a row and
 * left/right steps a step row's value; every change is stored and applied at
 * once, so there is nothing to confirm. A keybind row instead captures whatever
 * key is pressed next (`E` on it starts the capture, `Q` leaves it alone). All
 * input goes through the shared map in `src/input/`, so a rebind reaches every
 * scene on the very next press.
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
  private hint!: Phaser.GameObjects.BitmapText;
  private controls!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Settings');
  }

  init(data?: { from?: Opener }): void {
    this.from = data?.from ?? 'Starter';
    this.settings = loadSettings();
    this.index = 0;
    this.capturing = null;
    this.captureSkip = null;
  }

  create(): void {
    const { width, height } = this.scale;
    const x = (width - PANEL_W) / 2;
    const y = (height - PANEL_H) / 2 - 12;
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);
    addFrlgWindow(this, x, y, PANEL_W, PANEL_H);
    addFrlgText(this, x + 28, y + 22, 'SETTINGS', { size: 32, tint: FRLG_INK });

    this.rows = SETTINGS_ROWS.map((row, i) => {
      const rowY = y + ROW_TOP + i * ROW_H;
      const highlight = this.add
        .rectangle(x + 20, rowY, PANEL_W - 40, ROW_H - 6, 0xf2c14e, 0.28)
        .setOrigin(0, 0);
      const label = addFrlgText(this, x + 40, rowY + 12, row.label, { size: 16, tint: FRLG_INK });
      const value = addFrlgText(this, x + PANEL_W - 40, rowY + 12, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      return { highlight, label, value };
    });

    this.hint = addFrlgText(this, x + 40, y + ROW_TOP + SETTINGS_ROWS.length * ROW_H + 6, '', {
      size: 16,
      tint: 0x94a3b8,
    });
    this.hint.setMaxWidth(PANEL_W - 80);
    this.controls = addFrlgText(this, x + 40, y + PANEL_H - 36, '', {
      size: 16,
      tint: 0xa8b3c7,
    });

    this.bindInput();
    this.render();
  }

  private bindInput(): void {
    subscribeKeybinds(
      this,
      ({ action, event }) => {
        if (this.capturing) {
          // The press that started the capture still reaches here; ignore it.
          if (event === this.captureSkip) return;
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
      },
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

  private move(delta: number): void {
    if (this.capturing) return;
    this.index = moveSettingIndex(this.index, delta);
    this.render();
  }

  /** Steps the highlighted row and stores the result right away. */
  private change(delta: number): void {
    const row = settingsRow(this.index);
    if (!isStepRow(row)) return;
    const before = this.settings;
    this.settings = changeSetting(before, row.id, delta);
    if (this.settings === before) return;
    saveSettings(this.settings);
    applyVolume(this.sound, this.settings);
    this.render();
  }

  /** On a keybind row this arms the capture; on a step row it just closes. */
  private confirm(event: KeyboardEvent): void {
    const row = settingsRow(this.index);
    if (isStepRow(row)) {
      this.close();
      return;
    }
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
    this.rows.forEach((view, i) => {
      const selected = i === this.index;
      const row = SETTINGS_ROWS[i];
      const listening = selected && this.capturing !== null;
      view.highlight.setVisible(selected);
      view.label.setAlpha(selected ? 1 : 0.85);
      view.value
        .setText(listening ? 'Press a key…' : settingValue(this.settings, row.id))
        .setAlpha(selected ? 1 : 0.85);
    });
    this.hint.setText(this.rowHint(settingsRow(this.index), this.capturing !== null));
    this.controls.setText(this.controlsLine());
  }

  private rowHint(row: SettingsRow, listening: boolean): string {
    if (isStepRow(row)) return row.hint;
    const { confirm, cancel } = this.settings.keybinds;
    if (listening) return `Press any key to bind it, ${keyLabel(cancel)} to keep the old one.`;
    return `Press ${keyLabel(confirm)} to rebind this key.`;
  }

  private controlsLine(): string {
    const { confirm, cancel, up, down, left, right } = this.settings.keybinds;
    return `${keyLabel(up)} ${keyLabel(down)}  select      ${keyLabel(left)} ${keyLabel(right)}  change      ${keyLabel(confirm)}  confirm      ${keyLabel(cancel)}  close`;
  }

  /** Hands the opener back its screen; the route re-reads what changed. */
  private close(): void {
    if (this.from === 'Route') (this.scene.get('Route') as RouteScene).applySettings();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
