// Renders one FireRed/LeafGreen cue per row of the audio table in
// src/audio/cues.ts, into sprite-sources/frlg-audio/<cue-id>.wav — the exact
// input build-audio.mjs expects. Run that packer afterwards to write the
// committed src/assets/audio/*.wav.
//
// Why a renderer: pret/pokefirered ships the soundtrack as **MIDI** plus the
// instrument bank (sound/voice_groups.inc) and the DirectSound samples
// (sound/direct_sound_samples/*.wav); there is no ready-made per-song WAV. The
// songs only become audio through the game's m4a mixer, so we drive
// huderlem/poryaaaa's standalone renderer — an m4a emulator that reads the
// decompilation's own voicegroups and samples — and get the GBA-accurate mix.
//
// A music bed is left as its **loop body**: a looping song's MIDI marks its
// intro/loop split as '[' / ']' text events, the renderer prints that split, and
// we cut the intro off the WAV, so the file Phaser loops is the song's own loop
// instead of a run back into a one-time intro. A one-shot is kept whole.
//
// Both inputs are fetched into the gitignored sprite-sources/ when missing:
//
//   sprite-sources/pokefirered/   sparse checkout (sound/ only) of the decomp
//   sprite-sources/poryaaaa/      the renderer binary, from its GitHub release
//
// Neither is redistributed: only the WAVs the packer derives land in the repo,
// like every other imported-art source. A renderer the antivirus refuses to run
// (it is an unsigned binary) has to be allowed by hand.
//
// Run: node scripts/frlg/render-frlg-audio.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { get } from 'node:https'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readZip } from '../legacy-art/zip-codec.mjs'

const SOURCES = fileURLToPath(new URL('../../sprite-sources/', import.meta.url))
const PROJECT = join(SOURCES, 'pokefirered')
const TOOLS = join(SOURCES, 'poryaaaa')
const OUTPUT = join(SOURCES, 'frlg-audio')
const PROJECT_URL = 'https://github.com/pret/pokefirered.git'

// The release the committed cues were rendered with — a newer one changes the
// bytes of every asset, so it is bumped deliberately, like the dex.
const RENDERER_RELEASE = '1.5.0'
const RENDERER_ASSET = {
  win32: `poryaaaa_${RENDERER_RELEASE}-windows.zip`,
  linux: `poryaaaa_${RENDERER_RELEASE}-linux.zip`,
}[process.platform]
const RENDERER_NAME = process.platform === 'win32' ? 'poryaaaa_render.exe' : 'poryaaaa_render'

// Output rate: above the GBA's own 13379 Hz mix rate the renderer emulates, and
// the rate build-audio.mjs keeps after downmixing to mono.
const SAMPLE_RATE = 22050
// The decomp's midi.cfg, in cue order: the song, its voicegroup (the -G of the
// mid2agb line) and its master volume (the -V), with the -R every line shares.
// Changing a cue's song is a line here.
const REVERB = 50
const CUES = [
  { id: 'menu-music', kind: 'music', song: 'mus_title', voicegroup: 'voicegroup137', volume: 90 },
  { id: 'route-music', kind: 'music', song: 'mus_route1', voicegroup: 'voicegroup150', volume: 79 },
  // Kanto's trainer battle theme: the battle scene serves both a trainer who saw
  // you and a wild roll, and this is the one the encounter is built around.
  {
    id: 'battle-music',
    kind: 'music',
    song: 'mus_vs_trainer',
    voicegroup: 'voicegroup156',
    volume: 90,
  },
  // A wild roll and a trainer's sight share the cue, and the original plays no
  // sound for either (a trainer's "!" is silent and the battle music follows), so
  // the cue is the Poké Ball opening: the game's own "a Pokémon appears".
  { id: 'encounter', kind: 'sfx', song: 'se_ball_open', voicegroup: 'voicegroup127', volume: 100 },
  // A hit has no single sound in the original — each move carries its own — but
  // the game does play SE_EFFECTIVE when a hit lands (Cmd_effectivenesssound).
  { id: 'hit', kind: 'sfx', song: 'se_effective', voicegroup: 'voicegroup127', volume: 110 },
  { id: 'faint', kind: 'sfx', song: 'se_faint', voicegroup: 'voicegroup127', volume: 110 },
  { id: 'level-up', kind: 'sfx', song: 'mus_level_up', voicegroup: 'voicegroup008', volume: 90 },
  {
    id: 'victory',
    kind: 'sfx',
    song: 'mus_victory_trainer',
    voicegroup: 'voicegroup169',
    volume: 89,
  },
]
// Every cue is rendered as one pass with no fade (the pack loop is the song's
// own loop, or nothing), plus a short ring-out so a one-shot does not end on a
// hard cut.
const TAIL_SECONDS = 0.4
// Peak the loudest cue is lifted to; see normalizeCues.
const TARGET_PEAK = 0.85

function fetchBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume()
        resolve(fetchBuffer(new URL(res.headers.location, url).href, redirectsLeft - 1))
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

/** Sparse-clones the decompilation's sound data if it is not there yet. */
function ensureProject() {
  if (existsSync(join(PROJECT, 'sound', 'voice_groups.inc'))) return
  console.log('cloning pret/pokefirered (sound data only)...')
  execFileSync(
    'git',
    ['clone', '--depth', '1', '--filter=blob:none', '--sparse', PROJECT_URL, PROJECT],
    { stdio: 'inherit' },
  )
  execFileSync('git', ['-C', PROJECT, 'sparse-checkout', 'set', 'sound'], { stdio: 'inherit' })
}

/**
 * Downloads the renderer release and unpacks just the CLI (the CLAP plugin and
 * the GUI are ~7 MB we would never run).
 */
async function ensureRenderer() {
  const renderer = join(TOOLS, RENDERER_NAME)
  if (existsSync(renderer)) return renderer
  if (!RENDERER_ASSET) {
    throw new Error(`poryaaaa ships no renderer for ${process.platform}: place one at ${renderer}`)
  }
  console.log(`downloading poryaaaa ${RENDERER_RELEASE}...`)
  const zip = await fetchBuffer(
    `https://github.com/huderlem/poryaaaa/releases/download/${RENDERER_RELEASE}/${RENDERER_ASSET}`,
  )
  const entry = readZip(zip).find((e) => e.name === RENDERER_NAME)
  if (!entry) throw new Error(`${RENDERER_ASSET} carries no ${RENDERER_NAME}`)
  mkdirSync(TOOLS, { recursive: true })
  writeFileSync(renderer, entry.data, { mode: 0o755 })
  return renderer
}

/** Byte offset of a RIFF `data` chunk, or -1. */
function dataChunkOffset(buffer) {
  let offset = 12
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32LE(offset + 4)
    if (buffer.toString('ascii', offset, offset + 4) === 'data') return offset
    offset += 8 + size + (size % 2)
  }
  return -1
}

/** Drops everything before `startSeconds`, keeping the canonical header valid. */
function trimToSeconds(buffer, startSeconds) {
  const header = dataChunkOffset(buffer)
  if (header < 0) throw new Error('rendered WAV has no data chunk')
  const channels = buffer.readUInt16LE(22)
  const startByte = header + 8 + Math.floor(startSeconds * buffer.readUInt32LE(24)) * channels * 2
  if (startByte <= header + 8) return buffer
  const pcm = buffer.subarray(startByte)
  const out = Buffer.from(buffer.subarray(0, header + 8))
  out.writeUInt32LE(36 + pcm.length, 4)
  out.writeUInt32LE(pcm.length, header + 4)
  return Buffer.concat([out, pcm])
}

/** The renderer's "Loop region: [13.187 s, 44.835 s]" line, or null. */
function loopStartSeconds(output) {
  const match = output.match(/Loop region: \[([\d.]+) s, [\d.]+ s\]/)
  return match ? Number(match[1]) : null
}

/**
 * Applies one gain to every rendered cue so the loudest sits just under full
 * scale. The m4a master volume the decomp's midi.cfg asks for (`-V`, 79-110) is
 * a share of a mixer that expects the game's own output stage, and on its own it
 * lands the beds around a tenth of full scale; a single gain keeps the balance
 * between cues that those volumes set and only lifts the lot into range.
 */
function normalizeCues(files) {
  let peak = 0
  const pcm = files.map((file) => {
    const buffer = readFileSync(file)
    const data = dataChunkOffset(buffer)
    if (data < 0) throw new Error(`${file}: rendered WAV has no data chunk`)
    return { file, buffer, start: data + 8 }
  })
  for (const { buffer, start } of pcm) {
    for (let at = start; at + 1 < buffer.length; at += 2) {
      peak = Math.max(peak, Math.abs(buffer.readInt16LE(at)))
    }
  }
  if (peak === 0) return
  const gain = (TARGET_PEAK * 32767) / peak
  for (const { file, buffer, start } of pcm) {
    for (let at = start; at + 1 < buffer.length; at += 2) {
      const value = Math.round(buffer.readInt16LE(at) * gain)
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, value)), at)
    }
    writeFileSync(file, buffer)
  }
  console.log(`applied a master gain of ${gain.toFixed(2)} (peak was ${(peak / 32767).toFixed(3)})`)
}

ensureProject()
const renderer = await ensureRenderer()
mkdirSync(OUTPUT, { recursive: true })

for (const cue of CUES) {
  const midi = join(PROJECT, 'sound', 'songs', 'midi', `${cue.song}.mid`)
  if (!existsSync(midi)) throw new Error(`${cue.id}: ${cue.song}.mid is not in the decompilation`)
  const file = join(OUTPUT, `${cue.id}.wav`)
  console.log(`rendering ${cue.id} <- ${cue.song} (${cue.voicegroup})`)
  const output = execFileSync(
    renderer,
    [
      PROJECT,
      cue.voicegroup,
      '--midi',
      midi,
      '--output',
      file,
      '--sample-rate',
      String(SAMPLE_RATE),
      '--reverb',
      String(REVERB),
      '--song-volume',
      String(cue.volume),
      '--loop-count',
      '1',
      '--fadeout',
      '0',
      '--tail',
      String(TAIL_SECONDS),
    ],
    { encoding: 'utf8' },
  )
  process.stdout.write(output)
  const loopStart = loopStartSeconds(output)
  if (cue.kind !== 'music' || loopStart === null) continue
  writeFileSync(file, trimToSeconds(readFileSync(file), loopStart))
  console.log(`  trimmed ${cue.id} to its loop body from ${loopStart} s`)
}

normalizeCues(CUES.map((cue) => join(OUTPUT, `${cue.id}.wav`)))

console.log(`wrote ${CUES.length} cues to ${OUTPUT}; now run: node scripts/frlg/build-audio.mjs`)
