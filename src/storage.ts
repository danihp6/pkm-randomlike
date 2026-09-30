import type { StorageLike } from './engine/save';

/**
 * The browser's storage, or null when the page has none. Reading
 * `window.localStorage` itself can throw (cookies blocked inside a sandboxed
 * frame), so the save helpers accept null and degrade to an empty save.
 */
export function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
