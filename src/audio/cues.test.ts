import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_CUES,
  AUDIO_CUE_IDS,
  AUDIO_EXTENSION,
  audioCue,
  audioCueUrl,
  isMusic,
  type AudioCueId,
} from './cues';

// The cue assets are committed artifacts (`scripts/frlg/build-audio.mjs`), so the
// table is measured against the files that ship instead of trusted: a cue whose
// asset is missing, truncated or re-encoded fails here rather than at runtime.

const AUDIO_DIR = new URL('../assets/audio/', import.meta.url);

type WavInfo = Readonly<{
  magic: readonly string[];
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
}>;

/** Reads a cue's committed file down to the two chunks this contract cares about. */
function readCue(id: AudioCueId): WavInfo {
  const path = fileURLToPath(new URL(`${id}.${AUDIO_EXTENSION}`, AUDIO_DIR));
  const buffer = readFileSync(path);
  const magic = [buffer.toString('ascii', 0, 4), buffer.toString('ascii', 8, 12)];
  let format = -1;
  let channels = -1;
  let sampleRate = -1;
  let bitsPerSample = -1;
  let dataBytes = -1;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (chunk === 'fmt ' && size >= 16) {
      format = buffer.readUInt16LE(body);
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bitsPerSample = buffer.readUInt16LE(body + 14);
    } else if (chunk === 'data') {
      dataBytes = Math.min(size, buffer.length - body);
    }
    offset = body + size + (size % 2);
  }
  return { magic, format, channels, sampleRate, bitsPerSample, dataBytes };
}

describe('audio cue table', () => {
  it('names every cue once, in the table order', () => {
    expect(AUDIO_CUE_IDS).toEqual([
      'menu-music',
      'route-music',
      'battle-music',
      'encounter',
      'hit',
      'faint',
      'level-up',
      'victory',
    ]);
    expect(AUDIO_CUE_IDS).toEqual(AUDIO_CUES.map((cue) => cue.id));
    expect(new Set(AUDIO_CUE_IDS).size).toBe(AUDIO_CUES.length);
    expect(AUDIO_EXTENSION).toBe('wav');
  });

  it('loops every music bed, never an sfx, and keeps every gain in (0, 1]', () => {
    for (const cue of AUDIO_CUES) {
      expect(cue.loop, cue.id).toBe(cue.kind === 'music');
      expect(cue.gain, cue.id).toBeGreaterThan(0);
      expect(cue.gain, cue.id).toBeLessThanOrEqual(1);
    }
  });

  it('resolves a cue, its kind and its bundled url by id', () => {
    for (const cue of AUDIO_CUES) {
      expect(audioCue(cue.id)).toBe(cue);
      expect(isMusic(cue.id)).toBe(cue.kind === 'music');
      expect(audioCueUrl(cue.id).endsWith(`/assets/audio/${cue.id}.${AUDIO_EXTENSION}`)).toBe(true);
    }
  });
});

describe('audio cue assets', () => {
  it('holds exactly one committed file per cue and nothing else', () => {
    expect(readdirSync(fileURLToPath(AUDIO_DIR)).sort()).toEqual(
      AUDIO_CUE_IDS.map((id) => `${id}.${AUDIO_EXTENSION}`).sort(),
    );
  });

  it('ships a mono 16-bit PCM WAV per cue, longer than Vite inlines', () => {
    for (const cue of AUDIO_CUES) {
      const wav = readCue(cue.id);
      expect(wav.magic, cue.id).toEqual(['RIFF', 'WAVE']);
      expect(wav.format, cue.id).toBe(1);
      expect(wav.channels, cue.id).toBe(1);
      expect(wav.bitsPerSample, cue.id).toBe(16);
      expect(wav.sampleRate, cue.id).toBeGreaterThanOrEqual(8000);
      expect(wav.sampleRate, cue.id).toBeLessThanOrEqual(48000);
      expect(wav.dataBytes, cue.id).toBeGreaterThan(4096);
    }
  });

  it('caps an sfx at 5 s and a music bed at 60 s', () => {
    for (const cue of AUDIO_CUES) {
      const wav = readCue(cue.id);
      const seconds = wav.dataBytes / (wav.sampleRate * wav.channels * (wav.bitsPerSample / 8));
      expect(seconds, cue.id).toBeLessThanOrEqual(isMusic(cue.id) ? 60 : 5);
    }
  });
});
