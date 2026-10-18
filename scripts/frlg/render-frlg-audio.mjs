// Rips one FireRed/LeafGreen cue per row of the audio vocabulary in
// src/audio/cues.ts, into sprite-sources/frlg-audio/<cue-id>.wav — the exact
// input build-audio.mjs expects — and writes the two generated tables that map
// a move and a species to the cue that plays (src/data/audio/). Run that packer
// afterwards to write the committed src/assets/audio/*.wav.
//
// Why a renderer: pret/pokefirered ships the soundtrack as **MIDI** plus the
// instrument bank (sound/voice_groups.inc) and the DirectSound samples
// (sound/direct_sound_samples/*.wav); there is no ready-made per-song WAV. The
// songs only become audio through the game's m4a mixer, so we drive
// huderlem/poryaaaa's standalone renderer — an m4a emulator that reads the
// decompilation's own voicegroups and samples — and get the GBA-accurate mix.
// The Pokémon cries need no renderer: they are already per-species WAV samples
// (8-bit PCM, 10512 Hz), copied in as they are.
//
// A music bed is left as its **loop body**: a looping song's MIDI marks its
// intro/loop split as '[' / ']' text events, the renderer prints that split, and
// we cut the intro off the WAV, so the file Phaser loops is the song's own loop
// instead of a run back into a one-time intro. A one-shot is kept whole; an sfx
// never carries a loop region.
//
// The families (D22 addendum): the six hand rows, one shared `hit` cue, one
// `move-*` cue per `se_m_*` sound the decompilation carries (130) and one
// `cry-*` cue per cry sample (388). The two generated tables are views over
// that family set: `<move id>` -> the move's own sound, `<species id>` -> the
// cry the decompilation has for it.
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
// Every input path is absolute argv/env (the Asset trees rule — a packer never
// reads an asset tree inside a worktree), with the local defaults below so the
// docs' command lines still work:
//
//   --source <abs> / FRLG_SOURCE       the pret/pokefirered checkout
//   --out <abs> / FRLG_AUDIO_OUT       where the intermediates go
//   --renderer <abs> / PORYAAAA_RENDER the poryaaaa CLI
//
// Run: node scripts/frlg/render-frlg-audio.mjs
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { get } from 'node:https'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readZip } from '../legacy-art/zip-codec.mjs'

const SOURCES = fileURLToPath(new URL('../../sprite-sources/', import.meta.url))
const PROJECT = join(SOURCES, 'pokefirered')
const TOOLS = join(SOURCES, 'poryaaaa')
const OUTPUT = join(SOURCES, 'frlg-audio')
const PROJECT_URL = 'https://github.com/pret/pokefirered.git'

// The repo's own generated tables and the dex they are keyed by, beside this
// script: the tables are the build's data, written here and committed.
const AUDIO_DATA = fileURLToPath(new URL('../../src/data/audio/', import.meta.url))
const SPECIES_FILE = fileURLToPath(new URL('../../src/data/dex/species.json', import.meta.url))
const MOVES_FILE = fileURLToPath(new URL('../../src/data/dex/moves.json', import.meta.url))

const HIT_CUE_ID = 'hit'
// The impact the cartridge gives TACKLE and SLAM: its plainest hit, and the cue
// a move with no sound of its own falls back to (D22 addendum).
const HIT_SONG = 'se_m_comet_punch'
const MOVE_SONG_PREFIX = 'se_m_'
const MOVE_CUE_PREFIX = 'move-'
const CRY_CUE_PREFIX = 'cry-'
// The cry samples the decompilation carries cover Gen 1-3 only (national dex
// 1..386); a species above that has no sample and gets no row.
const CRY_MAX_NUM = 386
// The decompilation's own default for a move sound whose midi.cfg line carries
// no -V; every other se_m_* line renders at exactly this too.
const DEFAULT_SONG_VOLUME = 100

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
// The cartridge's own names for a move, where its block label is not our id:
// `VICE_GRIP` is `visegrip` in the dex, `FAINT_ATTACK` is `feintattack` and
// `HI_JUMP_KICK` is `highjumpkick`.
const MOVE_RENAMES = new Map([
  ['vicegrip', 'visegrip'],
  ['faintattack', 'feintattack'],
  ['hijumpkick', 'highjumpkick'],
])
// The command names that play a move's own sound. `playsewithpan` and
// `waitplaysewithpan` both carry `playse`; `loopsewithpan` is the looping
// ambience several powder animations use, not the move's hit sound.
const PLAYSE_COMMAND = /^\s*\w*playse\w*\s+(SE_[A-Z0-9_]+)/m

/** `--flag <path>` or its env fallback, resolved against the working directory. */
function optionValue(flag, env) {
  const at = process.argv.indexOf(flag)
  const value = at >= 0 ? process.argv[at + 1] : process.env[env]
  return value ? resolve(value) : null
}

/** The decompilation's id normalization, as the dex's `normalizeId`. */
function normalizeId(id) {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fetchBuffer(url, redirectsLeft = 5) {
  return new Promise((resolvePromise, reject) => {
    get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume()
        resolvePromise(fetchBuffer(new URL(res.headers.location, url).href, redirectsLeft - 1))
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolvePromise(Buffer.concat(chunks)))
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
 *
 * The two new families are normalized by build-audio.mjs instead — together, on
 * their packed 16-bit mono PCM, which is where their peak is read (the cries
 * arrive as the decompilation's 8-bit samples, so a gain here could not land
 * exactly on the target).
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

/** The voicegroup (`-G`) and master volume (`-V`) each midi.cfg line asks for. */
function readMidiConfig(path) {
  const config = new Map()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const row = /^(\S+\.mid):\s*(.*)$/.exec(line.trim())
    if (!row) continue
    const voicegroup = /-G\s*(\d+)/.exec(row[2])
    if (!voicegroup) continue
    const volume = /-V\s*(\d+)/.exec(row[2])
    config.set(row[1].slice(0, -'.mid'.length), {
      voicegroup: `voicegroup${voicegroup[1].padStart(3, '0')}`,
      volume: volume ? Number(volume[1]) : DEFAULT_SONG_VOLUME,
    })
  }
  return config
}

/** Every `se_m_*` sound the decompilation carries, in id order. */
function moveSoundNames(midiDirectory) {
  return readdirSync(midiDirectory)
    .filter((name) => name.startsWith(MOVE_SONG_PREFIX) && name.endsWith('.mid'))
    .map((name) => name.slice(0, -'.mid'.length))
    .sort()
}

/** `se_m_absorb_2` -> `move-absorb-2`: the cue id of a move sound. */
function moveCueId(song) {
  return `${MOVE_CUE_PREFIX}${song.slice(MOVE_SONG_PREFIX.length).replace(/_/g, '-')}`
}

/** `nidoran_f` -> `cry-nidoran-f`: the cue id of a cry sample. */
function cryCueId(file) {
  return `${CRY_CUE_PREFIX}${file.replace(/_/g, '-')}`
}

/**
 * The decompilation's cry samples: `Cry_<Symbol>::` followed by an `.incbin` of
 * `sound/direct_sound_samples/cries/<file>.bin`, whose sibling `<file>.wav` is
 * the sample itself.
 */
function readCrySamples(path) {
  const text = readFileSync(path, 'utf8')
  const pattern = /^Cry_([A-Za-z0-9_]+)::\s*\n\s*\.incbin "sound\/direct_sound_samples\/cries\/([a-z0-9_]+)\.bin"/gm
  return [...text.matchAll(pattern)].map((match) => ({ symbol: match[1], file: match[2] }))
}

/**
 * The `Move_<NAME>:` blocks of `data/battle_anim_scripts.s`, in file order: the
 * block is the label plus every line up to the next `Move_` label, sub-labels
 * included (a two-turn or multi-hit move plays its sound from one of them).
 */
function moveAnimBlocks(path) {
  const blocks = []
  let current = null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const label = /^(Move_[A-Z0-9_]+):\s*$/.exec(line)
    if (label) {
      current = { name: label[1], body: [] }
      blocks.push(current)
      continue
    }
    if (current) current.body.push(line)
  }
  return blocks.map((block) => ({ name: block.name, body: block.body.join('\n') }))
}

/**
 * `cries.json`: every species in the dex with a national number up to 386, keyed
 * by its id and pointing at the cry the decompilation carries for it. A species
 * resolves through its own name, or through its raw `baseSpecies` for a forme
 * (`Raichu-Alola` -> `Cry_Raichu`), both normalized like the dex normalizes an
 * id. The decompilation's `cry_tables.inc` is **not** used: its rows are indexed
 * by the game's internal species number, which is not our national `num`.
 */
function buildCryTable(samples, species) {
  const byName = new Map()
  for (const sample of samples) {
    byName.set(normalizeId(sample.symbol), sample.file)
    byName.set(normalizeId(sample.file), sample.file)
  }
  const rows = {}
  const unresolved = []
  for (const entry of species) {
    if (entry.num < 1 || entry.num > CRY_MAX_NUM) continue
    const file =
      byName.get(normalizeId(entry.name)) ?? byName.get(normalizeId(entry.baseSpecies ?? ''))
    if (!file) {
      unresolved.push(`${entry.id} (${entry.name})`)
      continue
    }
    rows[entry.id] = cryCueId(file)
  }
  return { rows, unresolved }
}

/**
 * `moveSounds.json`: each `Move_<NAME>:` block's own hit sound, keyed by our
 * move id. `<NAME>` maps to that id by lowercasing it and dropping every
 * non-alphanumeric character, then through the cartridge's renames. A block
 * whose sound is outside the `SE_M_*` family, or whose id the dex does not
 * carry, is skipped and named.
 */
function buildMoveSoundTable(blocks, moveIds) {
  const rows = {}
  const skipped = []
  for (const block of blocks) {
    const sound = PLAYSE_COMMAND.exec(block.body)
    if (!sound) continue
    const name = block.name.slice('Move_'.length)
    const normalized = normalizeId(name)
    const moveId = MOVE_RENAMES.get(normalized) ?? normalized
    if (!sound[1].startsWith('SE_M_')) {
      skipped.push(`${name} (${sound[1]})`)
      continue
    }
    if (!moveIds.has(moveId)) {
      skipped.push(`${name} (${moveId} is not a move in the dex)`)
      continue
    }
    rows[moveId] = moveCueId(sound[1].toLowerCase())
  }
  return { rows, skipped }
}

/** Writes a generated table: two-space JSON, keys ascending, trailing newline. */
function writeTable(file, rows) {
  const sorted = Object.fromEntries(
    Object.entries(rows).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  )
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`)
  return Object.keys(sorted).length
}

/** A summary line's list, or `none` when there is nothing to name. */
function named(rows) {
  return rows.length === 0 ? 'none' : `${rows.length}: ${rows.join(', ')}`
}

const sourceOption = optionValue('--source', 'FRLG_SOURCE')
const outOption = optionValue('--out', 'FRLG_AUDIO_OUT')
const rendererOption = optionValue('--renderer', 'PORYAAAA_RENDER')
const project = sourceOption ?? PROJECT
const output = outOption ?? OUTPUT

if (!sourceOption) ensureProject()
mkdirSync(output, { recursive: true })

/** Renders one MIDI at its voicegroup and master volume; returns the renderer's log. */
function renderMidi(renderer, song, settings, file) {
  const midi = join(project, 'sound', 'songs', 'midi', `${song}.mid`)
  if (!existsSync(midi)) throw new Error(`${song}: ${song}.mid is not in the decompilation`)
  return execFileSync(
    renderer,
    [
      project,
      settings.voicegroup,
      '--midi',
      midi,
      '--output',
      file,
      '--sample-rate',
      String(SAMPLE_RATE),
      '--reverb',
      String(REVERB),
      '--song-volume',
      String(settings.volume),
      '--loop-count',
      '1',
      '--fadeout',
      '0',
      '--tail',
      String(TAIL_SECONDS),
    ],
    { encoding: 'utf8' },
  )
}

// --- the six hand rows ----------------------------------------------------
const renderer = rendererOption ?? (await ensureRenderer())
for (const cue of CUES) {
  const file = join(output, `${cue.id}.wav`)
  console.log(`rendering ${cue.id} <- ${cue.song} (${cue.voicegroup})`)
  const rendered = renderMidi(renderer, cue.song, cue, file)
  process.stdout.write(rendered)
  const loopStart = loopStartSeconds(rendered)
  if (cue.kind !== 'music' || loopStart === null) continue
  writeFileSync(file, trimToSeconds(readFileSync(file), loopStart))
  console.log(`  trimmed ${cue.id} to its loop body from ${loopStart} s`)
}

normalizeCues(CUES.map((cue) => join(output, `${cue.id}.wav`)))

// --- one cue per move sound, plus the shared hit ---------------------------
const midiDirectory = join(project, 'sound', 'songs', 'midi')
const midiConfig = readMidiConfig(join(midiDirectory, 'midi.cfg'))
const moveSongs = moveSoundNames(midiDirectory)
const moveRenders = [
  ...moveSongs.map((song) => ({ song, file: join(output, `${moveCueId(song)}.wav`) })),
  // The fallback cue is a second render of the same MIDI under its own id, so a
  // move's own mapping moving never moves `hit` (D22 addendum).
  { song: HIT_SONG, file: join(output, `${HIT_CUE_ID}.wav`) },
]
for (const { song, file } of moveRenders) {
  const settings = midiConfig.get(song)
  if (!settings) throw new Error(`${song}.mid has no line in midi.cfg`)
  renderMidi(renderer, song, settings, file)
}
console.log(`rendered ${moveSongs.length} move sounds + the shared hit cue`)

// --- one cue per cry sample ------------------------------------------------
const crySamples = readCrySamples(join(project, 'sound', 'direct_sound_data.inc'))
const cryDirectory = join(project, 'sound', 'direct_sound_samples', 'cries')
for (const sample of crySamples) {
  const sampleFile = join(cryDirectory, `${sample.file}.wav`)
  if (!existsSync(sampleFile)) throw new Error(`${sample.symbol}: ${sample.file}.wav is missing`)
  copyFileSync(sampleFile, join(output, `${cryCueId(sample.file)}.wav`))
}
console.log(`copied ${crySamples.length} cries`)

// --- the two generated tables ---------------------------------------------
const species = JSON.parse(readFileSync(SPECIES_FILE, 'utf8'))
const moveIds = new Set(JSON.parse(readFileSync(MOVES_FILE, 'utf8')).map((move) => move.id))
const cries = buildCryTable(crySamples, species)
const moves = buildMoveSoundTable(
  moveAnimBlocks(join(project, 'data', 'battle_anim_scripts.s')),
  moveIds,
)
mkdirSync(AUDIO_DATA, { recursive: true })
const cryRows = writeTable(join(AUDIO_DATA, 'cries.json'), cries.rows)
const moveRows = writeTable(join(AUDIO_DATA, 'moveSounds.json'), moves.rows)

console.log(`wrote ${cryRows} cry rows and ${moveRows} move-sound rows to src/data/audio/`)
console.log(`unresolved species (no cry sample): ${named(cries.unresolved)}`)
console.log(`move blocks skipped: ${named(moves.skipped)}`)
console.log(
  `wrote ${CUES.length + moveSongs.length + 1 + crySamples.length} cues to ${output}; now run: node scripts/frlg/build-audio.mjs`,
)
