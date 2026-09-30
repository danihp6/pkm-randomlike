import Phaser from 'phaser';
import type { Settings } from '../engine/save';
import { applyVolume, loadSettings, saveSettings } from '../settings';
import { addFrlgWindow } from '../ui/frlg';
import { FRLG_INK, addFrlgText } from '../ui/frlgFont';
import {
  changeSetting,
  moveSettingIndex,
  settingValue,
  settingsRow,
  SETTINGS_ROWS,
} from '../ui/settingsScreen';
import type { RouteScene } from './RouteScene';

type Opener = 'Route' | 'Starter';

const PANEL_W = 760;
const PANEL_H = 400;
const ROW_H = 62;
const ROW_TOP = 108;

type RowView = {
  highlight: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  value: Phaser.GameObjects.BitmapText;
};

/**
 * The settings screen (Phase 7). Opened from the starter screen or the route HUD
 * (`O`), which pause themselves and resume behind it. Up/down picks a row,
 * left/right steps its value and every change is stored at once, so there is
 * nothing to confirm: `Z` / `X` just close. Volume goes straight into the game's
 * sound manager; the route re-reads the tileset preference when it resumes.
 */
export class SettingsScene extends Phaser.Scene {
  private from: Opener = 'Starter';
  private settings!: Settings;
  private index = 0;
  private rows: RowView[] = [];
  private hint!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Settings');
  }

  init(data?: { from?: Opener }): void {
    this.from = data?.from ?? 'Starter';
    this.settings = loadSettings();
    this.index = 0;
  }

  create(): void {
    const { width, height } = this.scale;
    const x = (width - PANEL_W) / 2;
    const y = (height - PANEL_H) / 2 - 24;
    this.add.rectangle(0, 0, width, height, 0x10161f).setOrigin(0, 0);
    addFrlgWindow(this, x, y, PANEL_W, PANEL_H);
    addFrlgText(this, x + 28, y + 22, 'SETTINGS', { size: 32, tint: FRLG_INK });

    this.rows = SETTINGS_ROWS.map((row, i) => {
      const rowY = y + ROW_TOP + i * ROW_H;
      const highlight = this.add
        .rectangle(x + 20, rowY, PANEL_W - 40, ROW_H - 8, 0xf2c14e, 0.28)
        .setOrigin(0, 0);
      const label = addFrlgText(this, x + 40, rowY + 14, row.label, { size: 16, tint: FRLG_INK });
      const value = addFrlgText(this, x + PANEL_W - 40, rowY + 14, '', {
        size: 16,
        tint: 0x3a3956,
        origin: [1, 0],
      });
      return { highlight, label, value };
    });

    this.hint = addFrlgText(this, x + 40, y + ROW_TOP + SETTINGS_ROWS.length * ROW_H + 8, '', {
      size: 16,
      tint: 0x94a3b8,
    });
    this.hint.setMaxWidth(PANEL_W - 80);
    addFrlgText(this, x + 40, y + PANEL_H - 36, '← →  change      ↑ ↓  select      Z / X  close', {
      size: 16,
      tint: 0xa8b3c7,
    });

    this.bindInput();
    this.render();
  }

  private bindInput(): void {
    const keyboard = this.input.keyboard!;
    const on = (event: string, handler: () => void) => {
      keyboard.on(event, (keyEvent: KeyboardEvent) => {
        if (keyEvent.repeat) return;
        handler();
      });
    };
    on('keydown-UP', () => this.move(-1));
    on('keydown-DOWN', () => this.move(1));
    on('keydown-LEFT', () => this.change(-1));
    on('keydown-RIGHT', () => this.change(1));
    for (const key of ['Z', 'ENTER', 'SPACE', 'X', 'ESC']) on(`keydown-${key}`, () => this.close());
  }

  private move(delta: number): void {
    this.index = moveSettingIndex(this.index, delta);
    this.render();
  }

  /** Steps the highlighted row and stores the result right away. */
  private change(delta: number): void {
    const before = this.settings;
    this.settings = changeSetting(before, settingsRow(this.index).id, delta);
    if (this.settings === before) return;
    saveSettings(this.settings);
    applyVolume(this.sound, this.settings);
    this.render();
  }

  private render(): void {
    this.rows.forEach((view, i) => {
      view.highlight.setVisible(i === this.index);
      view.label.setAlpha(i === this.index ? 1 : 0.85);
      view.value
        .setText(settingValue(this.settings, SETTINGS_ROWS[i].id))
        .setAlpha(i === this.index ? 1 : 0.85);
    });
    this.hint.setText(settingsRow(this.index).hint);
  }

  /** Hands the opener back its screen; the route re-reads what changed. */
  private close(): void {
    if (this.from === 'Route') (this.scene.get('Route') as RouteScene).applySettings();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
