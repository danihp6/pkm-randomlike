// Packs the imported FireRed/LeafGreen audio into src/assets/audio/.
//
// Source: one PCM WAV per cue under sprite-sources/frlg-audio/, **named after
// the cue id** (`menu-music.wav`, `hit.wav`, ...) — the rip has to be renamed
// before it is dropped in. That folder is gitignored; only the derived
// src/assets/audio/<cue-id>.wav files are committed, exactly like the imported
// art. See src/audio/README.md.
//
// Every cue is written as 16-bit PCM WAV, mono, at the source's own sample rate
// (stereo is downmixed by averaging the channels) and trimmed to the cue's cap
// (high enough for a music bed to hold a whole loop, the cue's own bound for a
// one-shot so a fanfare is never cut mid-phrase). A source that is not a
// readable PCM WAV container is a hard error: a file that exists is never
// silently replaced by a placeholder.
//
// The rip itself is rendered by render-frlg-audio.mjs, which drives the m4a
// emulator over the pret/pokefirered MIDI and instrument bank; a cue whose
// source is missing falls back to its generated procedural placeholder: a plain
// sine with a 10 ms fade at both ends, mono, 22050 Hz, 1.5 s for a music bed and
// 0.2 s for an sfx. The placeholder is ours and safe to redistribute (the same
// status as src/assets/tileset.png); rendering the cue in and re-running this
// script replaces it without touching a call site.
//
// Run: node scripts/frlg/build-audio.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUTPUT = new URL('../../src/assets/audio/', import.meta.url);

const MUSIC_PLACEHOLDER_SECONDS = 1.5;
const SFX_PLACEHOLDER_SECONDS = 0.2;
const PLACEHOLDER_RATE = 22050;
// Peak amplitude of a placeholder, as a fraction of full scale: quiet enough
// that a stop-gap cue never jumps out of the mix.
const PLACEHOLDER_PEAK = 0.25;
const FADE_SECONDS = 0.01;

// Mirrors the cue table in src/audio/cues.ts, in its order: what each cue is,
// the source file the game must never know and the length its asset is capped
// to. `source` is the rip, named after the cue id. A music bed is capped high
// enough that a whole loop body fits, so the seam is never a cut.
const CUES = [
  { id: 'menu-music', kind: 'music', capSeconds: 120 },
  { id: 'route-music', kind: 'music', capSeconds: 120 },
  { id: 'battle-music', kind: 'music', capSeconds: 120 },
  { id: 'encounter', kind: 'sfx', capSeconds: 8 },
  { id: 'hit', kind: 'sfx', capSeconds: 4 },
  { id: 'faint', kind: 'sfx', capSeconds: 6 },
  { id: 'level-up', kind: 'sfx', capSeconds: 8 },
  { id: 'victory', kind: 'sfx', capSeconds: 20 },
].map((cue) => ({
  ...cue,
  source: new URL(`../../sprite-sources/frlg-audio/${cue.id}.wav`, import.meta.url),
}));

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
  return wavFile(source.sampleRate, pcm);
}

/**
 * The generated stand-in for a cue whose rip is missing: a plain sine, one
 * semitone per row down the table so the eight cues are not eight copies of one
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

// Every cue is packed before anything is written, so a bad source cannot leave
// half a build behind.
const files = CUES.map((cue, index) => {
  const path = `sprite-sources/frlg-audio/${cue.id}.wav`;
  if (!existsSync(cue.source)) return { cue, path, audio: placeholder(cue.kind, index), missing: true };
  return { cue, path, audio: transcode(readFileSync(cue.source), path, cue.capSeconds), missing: false };
});

mkdirSync(OUTPUT, { recursive: true });
for (const file of files) writeFileSync(new URL(`${file.cue.id}.wav`, OUTPUT), file.audio);

const missing = files.filter((file) => file.missing);
console.log(
  `wrote ${files.length} cues to src/assets/audio (${files.length - missing.length} ripped, ${missing.length} generated placeholders)`,
);
if (missing.length > 0) {
  console.warn(`missing sources, their cues are generated placeholders: ${missing.map((file) => file.path).join(', ')}`);
}
