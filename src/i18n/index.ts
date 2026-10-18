import { en, type TranslationKey } from './en';
import { es } from './es';

/**
 * The i18n module (`D43`). `en` is the source table and `es` overlays it by key;
 * `t(key, params)` resolves the current locale and interpolates the value's
 * `{token}` placeholders with the caller's params, throwing on a missing one.
 *
 * It is a leaf: no Phaser, no DOM, no storage, no RNG and no clock. The browser's
 * language tag is an argument to `detectLocale`, never read here, so the whole
 * module is testable headless.
 */
export type Locale = 'en' | 'es';
export type { TranslationKey } from './en';

export const LOCALES: readonly Locale[] = ['en', 'es'];
export const DEFAULT_LOCALE: Locale = 'en';
export { en, es };

const TABLES: Readonly<Record<Locale, Readonly<Record<TranslationKey, string>>>> = { en, es };
const TOKEN = /\{([A-Za-z0-9_]+)\}/g;

let locale: Locale = DEFAULT_LOCALE;

const localeListeners = new Set<(next: Locale) => void>();

/**
 * Registers a listener for locale changes and returns the unsubscribe. A change is
 * an event because a few surfaces bake `t(...)` at build time — the dev overlay
 * mounts its whole DOM once — so they have to remount rather than re-read.
 */
export function onLocaleChange(listener: (next: Locale) => void): () => void {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

/** True for the locales this build ships; total over `unknown`. */
export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * The locale a browser language tag means: its primary subtag, matched exactly.
 * `es` (any region) is Spanish; everything else is the source table.
 */
export function detectLocale(browserLanguage: string): Locale {
  const primary = browserLanguage.toLowerCase().split(/[-_]/)[0];
  return primary === 'es' ? 'es' : 'en';
}

export function getLocale(): Locale {
  return locale;
}

/** Sets the locale when the value is one this build ships, else leaves it alone. */
export function setLocale(next: Locale): void {
  if (!isLocale(next) || next === locale) return;
  locale = next;
  for (const listener of [...localeListeners]) listener(locale);
}

/** The `{token}` names a value declares, deduped, in order of first appearance. */
export function translationParams(value: string): readonly string[] {
  const names: string[] = [];
  for (const match of value.matchAll(TOKEN)) {
    const name = match[1];
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The current locale's text for a key, with every `{token}` replaced by its
 * param. A token with no param throws: a missing param is a programming error.
 */
export function t(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
  const value = TABLES[locale][key] ?? en[key];
  return value.replace(TOKEN, (_match, token: string) => {
    const param = params?.[token];
    if (param === undefined) {
      throw new Error(`i18n: missing param "${token}" for key "${key}"`);
    }
    return String(param);
  });
}
