import Phaser from 'phaser';
import { cryCueFor, moveSoundCueFor } from '../data/audio';
import { applyVolume, loadSettings } from '../settings';
import { AUDIO_CUES, HIT_CUE_ID, audioCue, audioCueUrl, type AudioCue, type AudioCueId } from './cues';

/**
 * The Phaser half of the cue table (D22 addendum): it preloads every cue, plays
 * a one-shot by id, and owns the game's single music channel — one bed at a
 * time, switched by cue id. `Scene.sound` is the game's manager, so the channel
 * outlives any one scene: a scene takes the bed over by playing its own, and the
 * route does exactly that when a battle above it lets go.
 *
 * A cue the browser will not let us play yet (the autoplay gate) is skipped
 * silently: `play` answers `false` there, which is never an error and never a
 * console line.
 */
let current: Phaser.Sound.BaseSound | null = null;
let currentId: AudioCueId | null = null;

/**
 * Starts a cue and returns the sound it started, or null when the manager would
 * not (the autoplay gate, or a build with no audio): `play` only answers whether
 * it started, and appends a fresh instance to the manager — the last one
 * registered under that key is the one this call started. The key is the cue id.
 */
function startSound(scene: Phaser.Scene, cue: AudioCue): Phaser.Sound.BaseSound | null {
  if (!scene.sound.play(cue.id, { volume: cue.gain, loop: cue.loop })) return null;
  const sounds = scene.sound.getAll<Phaser.Sound.BaseSound>(cue.id);
  return sounds.length > 0 ? sounds[sounds.length - 1] : null;
}

/** Preloads every cue. Call once, from a scene's `preload()`. */
export function preloadAudio(scene: Phaser.Scene): void {
  for (const cue of AUDIO_CUES) scene.load.audio(cue.id, audioCueUrl(cue.id));
}

/** Plays a one-shot cue. A music cue is ignored — `playMusic` owns those. */
export function playCue(scene: Phaser.Scene, cueId: AudioCueId): void {
  const cue = audioCue(cueId);
  if (cue.kind === 'music') return;
  startSound(scene, cue);
}

/**
 * Plays the appearing species' cry. Answers false when it has none — the
 * decompilation carries no sample for it, and a stand-in would be a lie about an
 * id the rip never had, so that species stays silent. The autoplay gate is not
 * an answer here either: a refused cue played nothing.
 */
export function playCry(scene: Phaser.Scene, speciesId: string): boolean {
  const cueId = cryCueFor(speciesId);
  return cueId !== null && startSound(scene, audioCue(cueId)) !== null;
}

/**
 * Plays a move's own sound, or the shared `hit` when it has none — the cue is
 * what the fallback is for. Answers whether a sound started.
 */
export function playMoveSound(scene: Phaser.Scene, moveId: string): boolean {
  const cueId = moveSoundCueFor(moveId) ?? HIT_CUE_ID;
  return startSound(scene, audioCue(cueId)) !== null;
}

/** Switches the single music channel to `cueId`; a no-op while it is already playing. */
export function playMusic(scene: Phaser.Scene, cueId: AudioCueId): void {
  const cue = audioCue(cueId);
  if (cue.kind !== 'music') return;
  if (currentId === cueId && current?.isPlaying === true) return;
  stopMusic();
  const started = startSound(scene, cue);
  if (!started) return;
  current = started;
  currentId = cueId;
}

/** Stops the music channel (it is game-wide: `Scene.sound` is the game's manager). */
export function stopMusic(): void {
  current?.stop();
  current = null;
  currentId = null;
}

/** Re-applies the stored master volume (`Settings.volume`, D22). */
export function syncAudioVolume(scene: Phaser.Scene): void {
  applyVolume(scene.sound, loadSettings());
}

/** Mutes or unmutes the sound manager. */
export function setMuted(scene: Phaser.Scene, muted: boolean): void {
  scene.sound.mute = muted;
}

export function isMuted(scene: Phaser.Scene): boolean {
  return scene.sound.mute;
}
