/**
 * The audio vocabulary (D22 addendum): every sound the game can play is one row
 * here, and a cue id is the only name a scene may use — no scene names a file, a
 * texture key or a volume. `gain` is the per-cue share of the master volume, so
 * balancing a cue is a line in this table; `src/audio/audio.ts` is the half that
 * plays them.
 *
 * The assets are imported rips (local only) under `src/assets/audio/`, replaced
 * by `node scripts/frlg/build-audio.mjs` from `sprite-sources/frlg-audio/`. A
 * CC0 set means re-running the packer, never editing a scene.
 */
import battleMusicUrl from '../assets/audio/battle-music.wav';
import faintUrl from '../assets/audio/faint.wav';
import levelUpUrl from '../assets/audio/level-up.wav';
import menuMusicUrl from '../assets/audio/menu-music.wav';
import routeMusicUrl from '../assets/audio/route-music.wav';
import victoryUrl from '../assets/audio/victory.wav';

export type AudioCueKind = 'music' | 'sfx';

export type AudioCueId =
  'menu-music' | 'route-music' | 'battle-music' | 'faint' | 'level-up' | 'victory';

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

/**
 * The bundled URL of each cue's asset. Vite cannot bundle a computed asset path,
 * so every cue has one static import here and a scene only ever asks for the id.
 */
const AUDIO_CUE_URLS: Readonly<Record<AudioCueId, string>> = {
  'menu-music': menuMusicUrl,
  'route-music': routeMusicUrl,
  'battle-music': battleMusicUrl,
  faint: faintUrl,
  'level-up': levelUpUrl,
  victory: victoryUrl,
};

/** The whole cue table, in its shipped order. */
export const AUDIO_CUES: readonly AudioCue[] = [
  { id: 'menu-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'route-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'battle-music', kind: 'music', loop: true, gain: 0.5 },
  { id: 'faint', kind: 'sfx', loop: false, gain: 0.8 },
  { id: 'level-up', kind: 'sfx', loop: false, gain: 0.8 },
  { id: 'victory', kind: 'sfx', loop: false, gain: 0.9 },
];

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

/** The bundled URL of a cue's asset (Vite asset import, one static import per cue). */
export function audioCueUrl(id: AudioCueId): string {
  return AUDIO_CUE_URLS[id];
}
