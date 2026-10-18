import { normalizeId } from '../dex/species';
import type { AudioCueId } from '../../audio/cues';
import criesData from './cries.json';
import moveSoundsData from './moveSounds.json';

/**
 * The typed accessor over the two generated audio tables (D22 addendum), the
 * `src/data/dex/**` convention: the JSON is imported and immediately wrapped, so
 * no caller sees an `any`. Both tables are written by
 * `node scripts/frlg/render-frlg-audio.mjs` from the decompilation and are never
 * edited by hand.
 *
 * The type import is type-only on purpose: `src/audio/cues.ts` is the table of
 * cue *rows*, and this folder only names one, so there is no runtime cycle
 * between them.
 */

const CRY_CUES = criesData as Readonly<Record<string, AudioCueId>>;
const MOVE_SOUND_CUES = moveSoundsData as Readonly<Record<string, AudioCueId>>;

/** Rows in `cries.json`: every species the decompilation carries a cry for. */
export const CRY_ROW_COUNT: number = Object.keys(CRY_CUES).length;

/** Rows in `moveSounds.json`: every move whose own animation plays a sound. */
export const MOVE_SOUND_ROW_COUNT: number = Object.keys(MOVE_SOUND_CUES).length;

/** The cry cue of a species, or null when the decompilation carries none. */
export function cryCueFor(speciesId: string): AudioCueId | null {
  return CRY_CUES[normalizeId(speciesId)] ?? null;
}

/** The move's own sound cue, or null when the move has none of its own. */
export function moveSoundCueFor(moveId: string): AudioCueId | null {
  return MOVE_SOUND_CUES[normalizeId(moveId)] ?? null;
}
