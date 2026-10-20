import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Whether the ripped atlas at `path` (relative to `src/assets/`) is present in
 * this checkout. The ripped art is gitignored and packed locally by
 * `npm run assets:pack`; a clone without the private `pkrl-assets` store runs
 * the tests that only need the manifests, and skips the ones that measure art.
 */
export function hasArt(path: string): boolean {
  return existsSync(fileURLToPath(new URL(path, import.meta.url)));
}
