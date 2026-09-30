import { loadSave, storeSettings, type Settings, type StorageLike } from './engine/save';
import { browserStorage } from './storage';

/**
 * The browser-facing settings shim (Phase 7). Scenes read and write the player's
 * preferences through `src/engine/save.ts` (the tests never touch a browser) and
 * this is the one place that knows they live in the save slot; the settings
 * screen stores through it and every consumer reads through it.
 */

/** The one thing applying the master volume needs; structural, so a fake works. */
export type VolumeTarget = Readonly<{ setVolume(volume: number): unknown }>;

/** The player's settings, or the defaults when there is no save or no storage. */
export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  return loadSave(storage).settings;
}

/** Writes the settings back, keeping the run in progress. Returns them. */
export function saveSettings(
  settings: Settings,
  storage: StorageLike | null = browserStorage(),
): Settings {
  storeSettings(storage, settings);
  return settings;
}

/** Pushes the master volume into a sound manager (Phaser's, or a fake in tests). */
export function applyVolume(target: VolumeTarget, settings: Settings): void {
  target.setVolume(settings.volume);
}
