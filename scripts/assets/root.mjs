import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The default store: `sprite-sources/` at the repo root (gitignored). */
const DEFAULT_ROOT = fileURLToPath(new URL('../../sprite-sources/', import.meta.url))

/**
 * The absolute asset store root: `ASSETS_ROOT` when set (CI mounts the private
 * `pkrl-assets` clone there, and `npm run assets:pack <dir>` points it at a
 * checkout), `sprite-sources/` otherwise.
 *
 * `AGENTS.md` (Asset trees) forbids junctions and symlinks inside a worktree, so
 * every packer resolves its source through this absolute path instead of
 * defaulting to a path inside the checkout.
 */
export const ASSETS_ROOT = resolve(process.env.ASSETS_ROOT ?? DEFAULT_ROOT)

/** An absolute path inside the asset store. */
export function assetPath(relative) {
  return resolve(ASSETS_ROOT, relative)
}
