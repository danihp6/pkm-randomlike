import Phaser from 'phaser';
import { signal, type Signal } from '@preact/signals';
import type { KeybindAction } from '../data/keybinds';
import type { Settings } from '../engine/save';
import { applyVolume, loadSettings, saveSettings } from '../settings';
import { prefersTouchControls } from '../input/device';
import { reduceHudCommand, type HudCommand } from '../ui/hud/commands';
import {
  installOptionsPreview,
  liveOptionsView,
  mountOptionsPanel,
  type OptionsView,
} from '../ui/hud/panels/options';
import {
  changeSetting,
  isStepRow,
  moveSettingIndex,
  rebindSetting,
  settingsRow,
  settingsRows,
  type SettingsRow,
} from '../ui/settingsScreen';
import { keyNameOf, subscribeKeybinds } from '../input/input';
import type { RouteScene } from './RouteScene';

type Opener = 'Route' | 'Starter' | 'MainMenu';

/**
 * The fixture preview mounts on its own, even before the scene is ever opened, so
 * `?hudFixture=02-options` can be screenshotted without walking the menu.
 */
installOptionsPreview(typeof window === 'undefined' ? '' : window.location.search);

/**
 * The settings screen (Phase 7). Opened from the main menu, the starter screen
 * or the route HUD (`Tab`); the opener pauses itself and resumes behind it.
 * Up/down picks a row and left/right steps a step row's value; every change is
 * stored and applied at once, so there is nothing to confirm. A keybind row
 * instead captures whatever key is pressed next (`E` on it starts the capture,
 * `Q` leaves it alone). All input goes through the shared map in `src/input/`, so
 * a rebind reaches every scene on the very next press.
 *
 * The page itself is the `options` panel (`D49`): the scene owns the settings, the
 * cursor and the capture, and the panel paints them and answers with a command.
 */
export class SettingsScene extends Phaser.Scene {
  private from: Opener = 'Starter';
  private settings!: Settings;
  private index = 0;
  /** While set, the next keydown outside the capture is bound to the row. */
  private capturing: KeybindAction | null = null;
  /** The press that opened the capture, so it cannot bind itself. */
  private captureSkip: KeyboardEvent | null = null;
  /** The rows this device shows (no keybinds on a touch screen). */
  private rowList: readonly SettingsRow[] = [];
  /** The device's row set, read once in `init` so the DOM view and the list agree. */
  private touch = false;
  /** The mounted DOM panel: the view it paints and its disposer. */
  private view: Signal<OptionsView> | null = null;
  private panelDispose: (() => void) | null = null;

  constructor() {
    super('Settings');
  }

  init(data?: { from?: Opener }): void {
    this.from = data?.from ?? 'Starter';
    this.settings = loadSettings();
    this.index = 0;
    this.capturing = null;
    this.captureSkip = null;
    this.touch = prefersTouchControls();
    // Without a keyboard the keybind rows are hidden (the touch pad drives this).
    this.rowList = settingsRows(this.touch);
  }

  create(): void {
    this.view = signal(liveOptionsView(this.settings, this.touch, this.index, false));
    this.mountPanel();
    this.bindInput();
    this.render();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.disposePanel());
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
    this.pushView();
  }

  /** The one emit point of the DOM panel: the scene owns the settings, the panel paints them. */
  private pushView(): void {
    if (this.view === null) return;
    this.view.value = liveOptionsView(this.settings, this.touch, this.index, this.capturing !== null);
  }

  /** Mounts the panel in the HUD layer; a missing layer mounts nothing. */
  private mountPanel(): void {
    if (this.view === null || typeof document === 'undefined') return;
    const host = document.getElementById('hud');
    if (host === null) return;
    this.disposePanel();
    this.panelDispose = mountOptionsPanel(host, this.view, (command) => this.handleCommand(command));
  }

  private disposePanel(): void {
    if (this.panelDispose === null) return;
    this.panelDispose();
    this.panelDispose = null;
  }

  /** A panel control answers through the same action a key or pad press produces. */
  private handleCommand(command: HudCommand): void {
    const intent = reduceHudCommand(command);
    if (intent === null || intent.kind !== 'action') return;
    this.handleAction(intent.action, null);
  }

  /** Hands the opener back its screen; the route re-reads what changed. */
  private close(): void {
    this.disposePanel();
    if (this.from === 'Route') (this.scene.get('Route') as RouteScene).applySettings();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
