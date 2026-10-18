import { detectLocale, setLocale } from './i18n';
import {
  loadSave,
  storeSettings,
  storedSettingsLanguage,
  type Settings,
  type StorageLike,
} from './engine/save';
import { browserStorage } from './storage';

/**
 * The browser-facing settings shim (Phase 7). Scenes read and write the player's
 * preferences through `src/engine/save.ts` (the tests never touch a browser) and
 * this is the one place that knows they live in the save slot; the settings
 * screen stores through it and every consumer reads through it.
 *
 * It is also the one place that knows the browser's language: the pure
 * `detectLocale` (`src/i18n/`) takes a tag as an argument, and this shim is what
 * reads `navigator.language` and passes it in (`D43`). Both `loadSettings` and
 * `saveSettings` apply the locale, so a language change takes effect with no
 * restart and no scene-level boot hook.
 */

/** The one thing applying the master volume needs; structural, so a fake works. */
export type VolumeTarget = Readonly<{ setVolume(volume: number): unknown }>;

/**
 * The browser's language tag, or `''` when there is none: no browser at all (a
 * headless test), no `navigator`, no tag, or a blocked read. `''` detects as the
 * source table, so a headless load reads English.
 */
export function browserLanguageTag(): string {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return '';
    return typeof navigator.language === 'string' ? navigator.language : '';
  } catch {
    return '';
  }
}

/**
 * The player's settings, with the locale applied. A save that carries no
 * language is defaulted from the browser's tag **and stored**, so the first run
 * write cannot freeze the source table into a Spanish player's save.
 */
export function loadSettings(
  storage: StorageLike | null = browserStorage(),
  browserLanguage: string = browserLanguageTag(),
): Settings {
  const settings = loadSave(storage).settings;
  const stored = storedSettingsLanguage(storage);
  const language = stored ?? detectLocale(browserLanguage);
  const applied: Settings = { ...settings, language };
  if (stored === null) storeSettings(storage, applied);
  setLocale(language);
  return applied;
}

/** Writes the settings back (keeping the run) and applies the locale at once. */
export function saveSettings(
  settings: Settings,
  storage: StorageLike | null = browserStorage(),
): Settings {
  setLocale(settings.language);
  storeSettings(storage, settings);
  return settings;
}

/** Pushes the master volume into a sound manager (Phaser's, or a fake in tests). */
export function applyVolume(target: VolumeTarget, settings: Settings): void {
  target.setVolume(settings.volume);
}
