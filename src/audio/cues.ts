/**
 * The audio vocabulary (D22 addendum): every sound the game can play is one row
 * here, and a cue id is the only name a scene may use — no scene names a file, a
 * texture key or a volume. `gain` is the per-cue share of the master volume, so
 * balancing a cue is a line in this table; `src/audio/audio.ts` is the half that
 * plays them.
 *
 * The rows are the **committed asset set**: one `src/assets/audio/<cue-id>.wav`
 * per cue, the six hand-authored rows plus one cue per move sound and per cry
 * the decompilation carries. Vite cannot bundle a computed asset path, so the
 * folder is resolved in one `import.meta.glob` — the alternative, 525 static
 * imports, is not a table. The assets are imported rips (local only), written by
 * `node scripts/frlg/build-audio.mjs` from the intermediates
 * `node scripts/frlg/render-frlg-audio.mjs` rips out of FireRed/LeafGreen's
 * `sound/`; a CC0 set means re-running those two scripts, never editing a scene.
 */

export type AudioCueKind = 'music' | 'sfx';

/** The hand-authored rows, unchanged. */
export type KnownCueId =
  'menu-music' | 'route-music' | 'battle-music' | 'faint' | 'level-up' | 'victory';

/**
 * The whole vocabulary: the hand rows, the shared hit cue, and one cue per move
 * sound and per cry the decompilation carries. The two generated families are
 * template-literal ids on purpose — the *values* are data (the committed assets
 * and the two generated tables), so the type must not become a 525-literal union.
 */
export type AudioCueId = KnownCueId | 'hit' | `move-${string}` | `cry-${string}`;

export type AudioCue = Readonly<{
  id: AudioCueId;
  kind: AudioCueKind;
  /** Music loops; an sfx never does. */
  loop: boolean;
  /** Per-cue gain in (0, 1], multiplied by the master volume (D22). */
  gain: number;
}>;

/** The committed extension of every cue asset under `src/assets/audio/`. */
export const AUDIO_EXTENSION = 'wav';

/** The shared fallback a move with no sound of its own plays (D22 addendum). */
export const HIT_CUE_ID = 'hit';

const CUE_DIRECTORY = '../assets/audio/';
const MOVE_CUE_PREFIX = 'move-';
const CRY_CUE_PREFIX = 'cry-';
/** The gain `hit` and every move cue plays at, and the one every cry plays at. */
const CUE_GAIN = 0.85;
const CRY_GAIN = 0.8;

/**
 * The bundled URL of each committed cue asset: Vite's own "every file in this
 * folder" mechanism, which is what makes a 525-row table possible — a computed
 * asset path is not bundlable, and a cue id is still the only name a scene uses.
 */
const AUDIO_URLS = import.meta.glob('../assets/audio/*.wav', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** The asset id behind one of the glob's paths: `../assets/audio/hit.wav` -> `hit`. */
function assetId(path: string): string {
  return path.slice(CUE_DIRECTORY.length, -AUDIO_EXTENSION.length - 1);
}

/** Every cue id the committed assets carry, in id order. */
const ASSET_CUE_IDS: readonly string[] = Object.keys(AUDIO_URLS).map(assetId).sort();

/** The hand rows, in their shipped order. */
const KNOWN_CUES: readonly AudioCue[] = [
  { id: 'menu-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'route-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'battle-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'faint', kind: 'sfx', loop: false, gain: 0.8 },
  { id: 'level-up', kind: 'sfx', loop: false, gain: 0.8 },
  { id: 'victory', kind: 'sfx', loop: false, gain: 0.9 },
];

const KNOWN_IDS = new Set<string>(KNOWN_CUES.map((cue) => cue.id));

/** The row the assets alone give an id: an sfx, at its family's gain. */
function assetCue(id: string): AudioCue {
  return {
    id: id as AudioCueId,
    kind: 'sfx',
    loop: false,
    gain: id.startsWith(CRY_CUE_PREFIX) ? CRY_GAIN : CUE_GAIN,
  };
}

/**
 * The table in its shipped order: the hand rows, then `hit`, then the move cues
 * and the cry cues in id order. The assets decide which rows exist at all, so a
 * file that was never packed can never be played.
 */
function buildCues(): AudioCue[] {
  const own = ASSET_CUE_IDS.filter((id) => !KNOWN_IDS.has(id));
  const hit = own.filter((id) => id === HIT_CUE_ID);
  const moves = own.filter((id) => id.startsWith(MOVE_CUE_PREFIX));
  const cries = own.filter((id) => id.startsWith(CRY_CUE_PREFIX));
  const others = own.filter(
    (id) => id !== HIT_CUE_ID && !id.startsWith(MOVE_CUE_PREFIX) && !id.startsWith(CRY_CUE_PREFIX),
  );
  return [...KNOWN_CUES, ...[...hit, ...moves, ...cries, ...others].map(assetCue)];
}

/** The whole cue table, in its shipped order. */
export const AUDIO_CUES: readonly AudioCue[] = buildCues();

const CUE_BY_ID = new Map<AudioCueId, AudioCue>(AUDIO_CUES.map((cue) => [cue.id, cue]));

/** Every cue id, in the table's order. */
export const AUDIO_CUE_IDS: readonly AudioCueId[] = AUDIO_CUES.map((cue) => cue.id);

/** The row for a cue id. */
export function audioCue(id: AudioCueId): AudioCue {
  const cue = CUE_BY_ID.get(id);
  if (!cue) throw new Error(`unknown audio cue: ${id}`);
  return cue;
}

/** True for the three music beds, false for the one-shot cues. */
export function isMusic(id: AudioCueId): boolean {
  return audioCue(id).kind === 'music';
}

/** The bundled URL of a cue's asset (Vite's folder glob, one entry per cue). */
export function audioCueUrl(id: AudioCueId): string {
  const url = AUDIO_URLS[`${CUE_DIRECTORY}${id}.${AUDIO_EXTENSION}`];
  if (!url) throw new Error(`unknown audio cue: ${id}`);
  return url;
}
