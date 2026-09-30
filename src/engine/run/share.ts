import type { RunMode, RunState } from './state';

/**
 * The run share string (D21): a compact token that reproduces a run. It carries
 * exactly what starts a run — the seed and the mode — and nothing else, because
 * the seed already determines the whole run (`D11`, same seed + same inputs =
 * same run). Round-tripping is total: `decodeRunShare(encodeRunShare(share))`
 * equals `share` for every seed, including spaces and non-ASCII.
 *
 * Shape: `PKRL-<version>-<mode>-<seed>`, e.g. `PKRL-1-f-daily-2026-09-30`. The
 * seed is percent-encoded (with `-` escaped, since it separates the fields), so
 * an alphanumeric seed stays readable while anything else survives untouched. A
 * bare string with no `PKRL` prefix is accepted as the seed itself, which is how
 * a player types a plain seed. The seed is case-sensitive, the prefix and the
 * mode letter are not.
 */

export const RUN_SHARE_PREFIX = 'PKRL';
export const RUN_SHARE_VERSION = 1;

/** The mode letters the share string carries, in both directions. */
const RUN_MODE_CODES: Readonly<Record<RunMode, string>> = { finite: 'f', infinite: 'i' };
const RUN_MODES_BY_CODE: ReadonlyMap<string, RunMode> = new Map([
  ['f', 'finite'],
  ['finite', 'finite'],
  ['i', 'infinite'],
  ['infinite', 'infinite'],
]);

/** What a share string reproduces: the run's seed and its mode. */
export type RunShare = Readonly<{
  seed: string;
  mode: RunMode;
}>;

function encodeSeed(seed: string): string {
  return encodeURIComponent(seed).replace(/-/g, '%2D');
}

/** A broken percent escape is not a seed: the whole string is then invalid. */
function decodeSeed(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/** Encodes a run into its share string. `ur`-safe: no spaces, no `-` in the seed. */
export function encodeRunShare(share: RunState | RunShare): string {
  return [
    RUN_SHARE_PREFIX,
    String(RUN_SHARE_VERSION),
    RUN_MODE_CODES[share.mode],
    encodeSeed(share.seed),
  ].join('-');
}

/**
 * Reads a share string, or a bare seed, back into the run it starts. `fallback`
 * is the mode a bare seed gets, so a typed seed keeps the player's choice; a
 * prefixed share string always wins with the mode it carries. Returns null for
 * an empty input and for a string that claims the prefix but is malformed (an
 * unknown version, an unknown mode, or a missing/broken seed).
 */
export function decodeRunShare(text: string, fallback: RunMode = 'finite'): RunShare | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;

  const parts = trimmed.split('-');
  if (parts[0].toUpperCase() !== RUN_SHARE_PREFIX) return { seed: trimmed, mode: fallback };
  if (parts.length < 4) return null;
  if (parts[1] !== String(RUN_SHARE_VERSION)) return null;

  const mode = RUN_MODES_BY_CODE.get(parts[2].toLowerCase());
  if (!mode) return null;

  // The encoded seed never holds a `-`, but joining the tail lets a hand-typed
  // share string keep a raw hyphen in the seed instead of failing outright.
  const seed = decodeSeed(parts.slice(3).join('-'));
  if (seed === null || seed === '') return null;
  return { seed, mode };
}
