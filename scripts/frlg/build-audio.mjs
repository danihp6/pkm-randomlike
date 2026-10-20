// Packs the imported FireRed/LeafGreen audio into src/assets/audio/.
//
// Source: one PCM WAV per cue under the rip directory — the intermediates
// `render-frlg-audio.mjs` writes, **named after the cue id** (`menu-music.wav`,
// `hit.wav`, `move-absorb.wav`, `cry-pikachu.wav`, ...): the cue set is that
// directory's own file list plus the six hand rows' metadata. That folder is
// gitignored; only the derived src/assets/audio/<cue-id>.wav files are
// committed, exactly like the imported art. See src/audio/README.md.
//
// Every cue is written as 16-bit PCM WAV, mono, at the source's own sample rate
// (stereo is downmixed by averaging the channels) and trimmed to the cue's cap
// (high enough for a music bed to hold a whole loop, the cue's own bound for a
// one-shot so a fanfare is never cut mid-phrase). A source that is not a
// readable PCM WAV container is a hard error: a file that exists is never
// silently replaced by a placeholder.
//
// The two new families (D22 addendum) are then normalized **together, once per
// family**, on the packed 16-bit mono PCM: the 131 MIDI-rendered move cues
// (`hit` included) to one gain, the 388 cries to another, so each family's
// loudest cue sits at the same 0.85 of full scale. The six hand rows keep the
// gain `render-frlg-audio.mjs` already applied over their own six files, so
// their bytes never move.
//
// The rip itself is rendered by render-frlg-audio.mjs, which drives the m4a
// emulator over the pret/pokefirered MIDI and instrument bank; a cue whose
// source is missing falls back to its generated procedural placeholder: a plain
// sine with a 10 ms fade at both ends, mono, 22050 Hz, 1.5 s for a music bed and
// 0.2 s for an sfx. The placeholder is ours and safe to redistribute (the same
// status as src/assets/tileset.png); rendering the cue in and re-running this
// script replaces it without touching a call site. That fallback is for the six
// hand rows only: a missing cue of a ripped family is a hard error, because the
// whole point of ripping it is that the file is real.
//
// The rip directory comes in as absolute argv/env (the Asset trees rule — a
// packer never reads an asset tree inside a worktree):
//
//   --rendered <abs> / FRLG_AUDIO_OUT  the intermediate directory
//
// Run: node scripts/frlg/build-audio.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { assetPath } from '../assets/root.mjs'
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = new URL('../../src/assets/audio/', import.meta.url);
const DEFAULT_RENDERED = assetPath('frlg-audio');

const MUSIC_PLACEHOLDER_SECONDS = 1.5;
const SFX_PLACEHOLDER_SECONDS = 0.2;
const PLACEHOLDER_RATE = 22050;
// Peak amplitude of a placeholder, as a fraction of full scale: quiet enough
// that a stop-gap cue never jumps out of the mix.
const PLACEHOLDER_PEAK = 0.25;
const FADE_SECONDS = 0.01;

const MUSIC_CAP_SECONDS = 120;
const LEVEL_UP_CAP_SECONDS = 8;
const VICTORY_CAP_SECONDS = 20;
// Long enough for the longest rendered move sound (5.18 s) and for a cry, which
// never runs near a second.
const SFX_CAP_SECONDS = 6;
// Peak each ripped family's loudest cue is normalized to: the same 0.85 of full
// scale `render-frlg-audio.mjs` lifts the six hand rows to.
const TARGET_PEAK = 0.85;

const MOVE_CUE_PREFIX = 'move-';
const CRY_CUE_PREFIX = 'cry-';
const HIT_CUE_ID = 'hit';
const AUDIO_EXTENSION = '.wav';

// The six hand-authored rows, in their shipped order: what each cue is (which
// decides its placeholder shape) and, with `capSeconds`, how long its asset may
// be. Every other cue is a one-shot of a ripped family: `sfx`, capped by its id.
const HAND_ROWS = [
  { id: 'menu-music', kind: 'music' },
  { id: 'route-music', kind: 'music' },
  { id: 'battle-music', kind: 'music' },
  { id: 'faint', kind: 'sfx' },
  { id: 'level-up', kind: 'sfx' },
  { id: 'victory', kind: 'sfx' },
];

/** `--flag <path>` or its env fallback, resolved against the working directory. */
function optionValue(flag, env) {
  const at = process.argv.indexOf(flag);
  const value = at >= 0 ? process.argv[at + 1] : process.env[env];
  return value ? resolve(value) : null;
}

/** The length a cue's asset is capped to, from its id. */
function capSeconds(id) {
  if (id.endsWith('-music')) return MUSIC_CAP_SECONDS;
  if (id === 'level-up') return LEVEL_UP_CAP_SECONDS;
  if (id === 'victory') return VICTORY_CAP_SECONDS;
  return SFX_CAP_SECONDS;
}

/** Which single gain a cue shares with its family, or null for the six hand rows. */
function familyOf(id) {
  if (id.startsWith(CRY_CUE_PREFIX)) return 'cry';
  if (id === HIT_CUE_ID || id.startsWith(MOVE_CUE_PREFIX)) return 'move';
  return null;
}

/** The rip's cue ids: one `<cue-id>.wav` per cue, in id order. */
function ripCueIds(rendered) {
  return readdirSync(rendered)
    .filter((name) => name.endsWith(AUDIO_EXTENSION))
    .map((name) => name.slice(0, -AUDIO_EXTENSION.length))
    .sort();
}

/**
 * The packer's cue list: the rip directory's file list, with the six hand rows
 * first so their placeholders keep the shape they shipped with.
 */
function cueList(rendered) {
  const handIds = new Set(HAND_ROWS.map((row) => row.id));
  return [
    ...HAND_ROWS.map((row) => ({ ...row, capSeconds: capSeconds(row.id) })),
    ...ripCueIds(rendered)
      .filter((id) => !handIds.has(id))
      .map((id) => ({ id, kind: 'sfx', capSeconds: capSeconds(id) })),
  ];
}

/** A 44-byte canonical header followed by 16-bit mono PCM. */
function wavFile(sampleRate, pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Reads the `fmt ` and `data` chunks of a RIFF/WAVE file. Anything that is not
 * a readable PCM WAV container is an error, never a placeholder: the file is
 * there, so somebody meant it.
 */
function parseWav(buffer, path) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16) throw new Error(`${path}: truncated fmt chunk`);
      fmt = {
        format: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      data = buffer.subarray(body, Math.min(body + size, buffer.length));
    }
    // RIFF chunks are word-aligned: an odd size carries one padding byte.
    offset = body + size + (size % 2);
  }
  if (!fmt) throw new Error(`${path}: no fmt chunk`);
  if (!data) throw new Error(`${path}: no data chunk`);
  if (fmt.format !== 1) throw new Error(`${path}: not PCM (format ${fmt.format})`);
  if (fmt.channels < 1) throw new Error(`${path}: ${fmt.channels} channels`);
  if (fmt.bitsPerSample !== 8 && fmt.bitsPerSample !== 16) {
    throw new Error(`${path}: unsupported ${fmt.bitsPerSample}-bit PCM (8 or 16 only)`);
  }
  return { ...fmt, data };
}

/** Downmixes a parsed source to mono 16-bit PCM, trimmed to `capSeconds`. */
function transcode(buffer, path, capSeconds) {
  const source = parseWav(buffer, path);
  const bytesPerSample = source.bitsPerSample / 8;
  const frameBytes = source.channels * bytesPerSample;
  const frames = Math.max(0, Math.floor(source.data.length / frameBytes));
  const capFrames = Math.floor(capSeconds * source.sampleRate);
  const kept = Math.min(frames, capFrames);
  const pcm = Buffer.alloc(kept * 2);
  for (let frame = 0; frame < kept; frame++) {
    let sum = 0;
    for (let channel = 0; channel < source.channels; channel++) {
      const at = frame * frameBytes + channel * bytesPerSample;
      // 8-bit PCM is unsigned, 16-bit signed; both are read into the same range.
      sum += source.bitsPerSample === 8 ? (source.data[at] - 128) * 256 : source.data.readInt16LE(at);
    }
    const value = Math.round(sum / source.channels);
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, value)), frame * 2);
  }
  return { sampleRate: source.sampleRate, pcm };
}

/** Peak sample magnitude of 16-bit mono PCM. */
function peakOf(pcm) {
  let peak = 0;
  for (let at = 0; at + 1 < pcm.length; at += 2) {
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(at)));
  }
  return peak;
}

/**
 * Lifts a family's cues by one gain so its loudest sits at `TARGET_PEAK`, the
 * same rounding `render-frlg-audio.mjs`'s `normalizeCues` uses, so the two
 * halves of the pipeline land on the same peak. A silent family is left alone.
 */
function normalizeFamily(entries) {
  if (entries.length === 0) return 0;
  let peak = 0;
  for (const entry of entries) peak = Math.max(peak, peakOf(entry.pcm));
  if (peak === 0) return 0;
  const gain = (TARGET_PEAK * 32767) / peak;
  for (const { pcm } of entries) {
    for (let at = 0; at + 1 < pcm.length; at += 2) {
      const value = Math.round(pcm.readInt16LE(at) * gain);
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, value)), at);
    }
  }
  return gain;
}

/**
 * The generated stand-in for a cue whose rip is missing: a plain sine, one
 * semitone per row down the table so the six hand rows are not six copies of one
 * file, eased in and out so it never clicks.
 */
function placeholder(kind, index) {
  const seconds = kind === 'music' ? MUSIC_PLACEHOLDER_SECONDS : SFX_PLACEHOLDER_SECONDS;
  const frames = Math.round(PLACEHOLDER_RATE * seconds);
  const fadeFrames = Math.round(PLACEHOLDER_RATE * FADE_SECONDS);
  const hz = 220 * Math.pow(2, index / 12);
  const peak = Math.floor(PLACEHOLDER_PEAK * 32767);
  const pcm = Buffer.alloc(frames * 2);
  for (let frame = 0; frame < frames; frame++) {
    let amplitude = peak;
    if (frame < fadeFrames) amplitude *= frame / fadeFrames;
    const remaining = frames - 1 - frame;
    if (remaining < fadeFrames) amplitude *= remaining / fadeFrames;
    const value = Math.round(amplitude * Math.sin((2 * Math.PI * hz * frame) / PLACEHOLDER_RATE));
    pcm.writeInt16LE(value, frame * 2);
  }
  return wavFile(PLACEHOLDER_RATE, pcm);
}

const rendered = optionValue('--rendered', 'FRLG_AUDIO_OUT') ?? DEFAULT_RENDERED;
if (!existsSync(rendered)) {
  throw new Error(`no rip directory at ${rendered}: run render-frlg-audio.mjs first`);
}
const cues = cueList(rendered);

// Every cue is packed before anything is written, so a bad source cannot leave
// half a build behind.
const files = cues.map((cue, index) => {
  const path = join(rendered, `${cue.id}${AUDIO_EXTENSION}`);
  if (!existsSync(path)) {
    // A hand row keeps its generated placeholder; a ripped family may not.
    if (familyOf(cue.id) !== null) {
      throw new Error(`${cue.id}: no rip at ${path} (a ripped cue is never a placeholder)`);
    }
    return { cue, path, audio: placeholder(cue.kind, index), pcm: null, missing: true };
  }
  const { sampleRate, pcm } = transcode(readFileSync(path), path, cue.capSeconds);
  return { cue, path, audio: null, pcm, sampleRate, missing: false };
});

const families = { move: [], cry: [] };
for (const file of files) {
  const family = familyOf(file.cue.id);
  if (file.pcm && family) families[family].push(file);
}
const moveGain = normalizeFamily(families.move);
const cryGain = normalizeFamily(families.cry);

mkdirSync(OUTPUT, { recursive: true });
for (const file of files) {
  const audio = file.pcm ? wavFile(file.sampleRate, file.pcm) : file.audio;
  writeFileSync(new URL(`${file.cue.id}${AUDIO_EXTENSION}`, OUTPUT), audio);
}

const missing = files.filter((file) => file.missing);
console.log(
  `wrote ${files.length} cues to src/assets/audio (${files.length - missing.length} packed, ${missing.length} generated placeholders)`,
);
console.log(
  `normalized ${families.move.length} move cues at gain ${moveGain.toFixed(3)} and ${families.cry.length} cries at gain ${cryGain.toFixed(3)}`,
);
if (missing.length > 0) {
  console.warn(`missing sources, their cues are generated placeholders: ${missing.map((file) => file.path).join(', ')}`);
}
