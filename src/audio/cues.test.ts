import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasArt } from '../assets/art';
import {
  AUDIO_CUES,
  AUDIO_CUE_IDS,
  AUDIO_EXTENSION,
  HIT_CUE_ID,
  audioCue,
  audioCueUrl,
  isMusic,
  type AudioCueId,
} from './cues';

// The cue assets are committed artifacts (`scripts/frlg/build-audio.mjs`), so the
// table is measured against the files that ship instead of trusted: a cue whose
// asset is missing, truncated, silent or re-encoded fails here rather than at runtime.

const AUDIO_DIR = new URL('../assets/audio/', import.meta.url);

// The six hand-authored rows, in their shipped order: the vocabulary's fixed head.
const HAND_CUE_IDS: readonly AudioCueId[] = [
  'menu-music',
  'route-music',
  'battle-music',
  'faint',
  'level-up',
  'victory',
];

// The gains `build-audio.mjs` normalizes the two ripped families to: one gain per
// family, so each family's loudest cue sits at the same share of full scale.
const FAMILY_PEAK = Math.round(0.85 * 32767);
const MOVE_CUE_GAIN = 0.85;
const CRY_CUE_GAIN = 0.8;

// The rate each family's rip carries: the MIDI renders at 22050 Hz, the cries are
// the decompilation's own 10512 Hz samples.
const MOVE_SAMPLE_RATE = 22050;
const CRY_SAMPLE_RATE = 10512;

// What `build-audio.mjs` generates for a hand row whose rip is missing: a plain
// sine, 1.5 s for a music bed and 0.2 s for an sfx. A shipped hand row that short
// means the rip was never rendered and the placeholder leaked into the repo.
const PLACEHOLDER_SECONDS: Readonly<Record<string, number>> = { music: 1.5, sfx: 0.2 };

// The six that shipped before the families did: their bytes are frozen, because
// `render-frlg-audio.mjs` normalizes them over their own six files and nothing
// else. A re-render must leave every digest here untouched.
const SHIPPED_CUE_SHA256: Readonly<Record<string, string>> = {
  'menu-music': '81c3779586bb38edc75c828e235eb8823725b035c2cc7c9e30bb2e4ead0f965d',
  'route-music': 'b6c350509f29946a6158a77e19678fe61bae736308d22e80b127c205da25aad0',
  'battle-music': '20414f8e60c3c8e6b6ff53020493c4b5d1b66bb728a1839dadce3126dca6254d',
  faint: 'dc1a12f7cc2f67a7180946408f64f7eec93cde2a986e169726771b6684583dee',
  'level-up': '87d405444ea6491591ed333dd4b5c0772a5d4fef39bb81ab42ee2f58d8e9fadc',
  victory: '3df70debda96cbd33b275dc92826e89fbe5ed94fcfca40f44f463fa1303ceeed',
};

// The one cue the decompilation itself renders silent: `se_m_dizzy_punch.mid`
// plays voicegroup128's program 19, whose attack is the m4a engine's slowest,
// and the file's own note lasts a single tick — the GBA-accurate mix of that
// cue is digital silence (the same probe render in the run's `/tmp/out2` is
// silent). It is named here instead of loosening the check for the other 524
// files: a cue that goes silent in a future re-render still fails.
const SILENT_SOURCE_CUES: readonly AudioCueId[] = ['move-dizzy-punch'];

/** The length `build-audio.mjs` caps a cue's asset to, from the cue id. */
function cueSecondsCap(id: AudioCueId): number {
  if (id.endsWith('-music')) return 120;
  if (id === 'level-up') return 8;
  if (id === 'victory') return 20;
  return 6;
}

type WavInfo = Readonly<{
  magic: readonly string[];
  format: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataBytes: number;
  frames: number;
  peak: number;
}>;

/** Reads a cue's committed file down to the chunks this contract cares about. */
function readCue(id: AudioCueId): WavInfo {
  const path = fileURLToPath(new URL(`${id}.${AUDIO_EXTENSION}`, AUDIO_DIR));
  const buffer = readFileSync(path);
  const magic = [buffer.toString('ascii', 0, 4), buffer.toString('ascii', 8, 12)];
  let format = -1;
  let channels = -1;
  let sampleRate = -1;
  let bitsPerSample = -1;
  let dataBytes = -1;
  let dataOffset = -1;
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
      dataOffset = body;
    }
    offset = body + size + (size % 2);
  }
  let peak = 0;
  for (let at = dataOffset; dataOffset >= 0 && at + 1 < dataOffset + dataBytes; at += 2) {
    peak = Math.max(peak, Math.abs(buffer.readInt16LE(at)));
  }
  const bytesPerFrame = channels * (bitsPerSample / 8);
  return {
    magic,
    format,
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes,
    frames: Math.floor(dataBytes / bytesPerFrame),
    peak,
  };
}

/** The ids of one family, in the table's order. */
function familyIds(prefix: string): readonly AudioCueId[] {
  return AUDIO_CUE_IDS.filter((id) => id.startsWith(prefix));
}

/** `hit` and every move cue: the family `build-audio.mjs` normalizes together. */
function moveFamilyIds(): readonly AudioCueId[] {
  return [HIT_CUE_ID, ...familyIds('move-')];
}

describe.skipIf(!hasArt('audio'))('audio cue table', () => {
  it('names every cue once: the hand rows, then hit, then the move and cry families', () => {
    expect(AUDIO_CUE_IDS.slice(0, HAND_CUE_IDS.length)).toEqual(HAND_CUE_IDS);
    expect(AUDIO_CUE_IDS[HAND_CUE_IDS.length]).toBe(HIT_CUE_ID);
    const moves = familyIds('move-');
    const cries = familyIds('cry-');
    expect(AUDIO_CUE_IDS).toEqual([...HAND_CUE_IDS, HIT_CUE_ID, ...moves, ...cries]);
    expect([...moves]).toEqual([...moves].sort());
    expect([...cries]).toEqual([...cries].sort());
    expect(AUDIO_CUE_IDS.length).toBe(525);
    expect(moves.length).toBe(130);
    expect(cries.length).toBe(388);
    expect(AUDIO_CUE_IDS).toEqual(AUDIO_CUES.map((cue) => cue.id));
    expect(new Set(AUDIO_CUE_IDS).size).toBe(AUDIO_CUES.length);
    expect(AUDIO_EXTENSION).toBe('wav');
  });

  it('is the committed asset set: one row per file, one file per row', () => {
    const files = readdirSync(fileURLToPath(AUDIO_DIR)).sort();
    expect(files).toEqual(AUDIO_CUE_IDS.map((id) => `${id}.${AUDIO_EXTENSION}`).sort());
  });

  it('loops every music bed, never an sfx, and takes each family its own gain', () => {
    for (const cue of AUDIO_CUES) {
      expect(cue.loop, cue.id).toBe(cue.kind === 'music');
      expect(cue.gain, cue.id).toBeGreaterThan(0);
      expect(cue.gain, cue.id).toBeLessThanOrEqual(1);
      if (cue.id.startsWith('cry-')) expect(cue.gain, cue.id).toBe(CRY_CUE_GAIN);
      else if (!HAND_CUE_IDS.includes(cue.id)) {
        expect(cue.gain, cue.id).toBe(MOVE_CUE_GAIN);
      }
    }
    expect(AUDIO_CUES.filter((cue) => cue.kind === 'music').map((cue) => cue.id)).toEqual([
      'menu-music',
      'route-music',
      'battle-music',
    ]);
    expect(AUDIO_CUES.slice(0, HAND_CUE_IDS.length)).toEqual([
      { id: 'menu-music', kind: 'music', loop: true, gain: 0.5 },
      { id: 'route-music', kind: 'music', loop: true, gain: 0.5 },
      { id: 'battle-music', kind: 'music', loop: true, gain: 0.5 },
      { id: 'faint', kind: 'sfx', loop: false, gain: 0.8 },
      { id: 'level-up', kind: 'sfx', loop: false, gain: 0.8 },
      { id: 'victory', kind: 'sfx', loop: false, gain: 0.9 },
    ]);
  });

  it('resolves a cue, its kind and its bundled url by id', () => {
    for (const cue of AUDIO_CUES) {
      expect(audioCue(cue.id)).toBe(cue);
      expect(isMusic(cue.id)).toBe(cue.kind === 'music');
      expect(audioCueUrl(cue.id), cue.id).toContain(`/assets/audio/${cue.id}.${AUDIO_EXTENSION}`);
    }
  });

  it('throws for an id with no row instead of playing nothing', () => {
    expect(() => audioCue('move-not-a-sound' as AudioCueId)).toThrow(
      'unknown audio cue: move-not-a-sound',
    );
    expect(() => audioCueUrl('cry-not-a-cry' as AudioCueId)).toThrow('unknown audio cue: cry-not-a-cry');
  });
});

describe.skipIf(!hasArt('audio'))('audio cue assets', () => {
  it('ships a mono 16-bit PCM WAV with frames and audio in it, per cue', () => {
    for (const cue of AUDIO_CUES) {
      const wav = readCue(cue.id);
      expect(wav.magic, cue.id).toEqual(['RIFF', 'WAVE']);
      expect(wav.format, cue.id).toBe(1);
      expect(wav.channels, cue.id).toBe(1);
      expect(wav.bitsPerSample, cue.id).toBe(16);
      expect(wav.frames, cue.id).toBeGreaterThan(0);
      if (!SILENT_SOURCE_CUES.includes(cue.id)) {
        expect(wav.peak, cue.id).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the source rate of each family', () => {
    for (const id of moveFamilyIds()) {
      expect(readCue(id).sampleRate, id).toBe(MOVE_SAMPLE_RATE);
    }
    for (const id of familyIds('cry-')) {
      expect(readCue(id).sampleRate, id).toBe(CRY_SAMPLE_RATE);
    }
    for (const id of HAND_CUE_IDS) {
      expect(readCue(id).sampleRate, id).toBeGreaterThanOrEqual(8000);
      expect(readCue(id).sampleRate, id).toBeLessThanOrEqual(48000);
    }
  });

  it('caps every cue, and rejects a hand row that is still its placeholder sine', () => {
    for (const cue of AUDIO_CUES) {
      const wav = readCue(cue.id);
      const seconds = wav.frames / wav.sampleRate;
      expect(seconds, cue.id).toBeLessThanOrEqual(cueSecondsCap(cue.id));
      if (HAND_CUE_IDS.includes(cue.id)) {
        expect(seconds, cue.id).toBeGreaterThan(PLACEHOLDER_SECONDS[cue.kind]);
      }
    }
  });

  it('normalizes each ripped family, its loudest cue at 0.85 of full scale', () => {
    const moveFamily = moveFamilyIds();
    const cryFamily = familyIds('cry-');
    for (const family of [moveFamily, cryFamily]) {
      let loudest = 0;
      let loudestId: string = family[0];
      for (const id of family) {
        const peak = readCue(id).peak;
        expect(peak, id).toBeLessThanOrEqual(FAMILY_PEAK);
        if (peak > loudest) {
          loudest = peak;
          loudestId = id;
        }
      }
      expect(loudest, loudestId).toBe(FAMILY_PEAK);
    }
  });

  it('keeps the six cues that shipped byte-identical', () => {
    for (const id of HAND_CUE_IDS) {
      const path = fileURLToPath(new URL(`${id}.${AUDIO_EXTENSION}`, AUDIO_DIR));
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
      expect(digest, id).toBe(SHIPPED_CUE_SHA256[id]);
    }
  });
});
