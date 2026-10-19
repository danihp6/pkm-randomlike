// Builds the FireRed/LeafGreen overworld atlas
// (`src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json`): one row of
// nine 16x32 poses per sprite key — the ten trainer archetypes, the casino's
// `rocket` grunt and the ten special-NPC keys.
//
// Source: the pret/pokefirered decomp's
// `graphics/object_events/pics/people/*.png` (github.com/pret/pokefirered,
// gitignored, never redistributed). The trainer sheets are 160x32 strips of ten
// 16x32 frames; the first nine are the standard walk set, in the same order as
// the player's sheet, and the tenth is a field-move pose the route never draws:
//
//   0 down idle   1 up idle   2 side idle (faces left)
//   3 down walk   4 down walk 5 up walk   6 up walk
//   7 side walk   8 side walk 9 extra (ignored)
//
// Most sheets are 144x32 (nine columns) or 160x32 (ten); `nurse.png` is 64x32
// and `koga.png` 48x32, so their rows repeat the decomp's own pose table
// (`sPicTable_Nurse`, `sPicTable_Koga`) instead of borrowing another class.
//
// The source directory is never a default inside this checkout (AGENTS.md,
// Asset trees): pass it as an absolute path, or through the environment.
//
//   node scripts/frlg/build-overworld-sprites.mjs <absolute source dir>
//   PKM_FRLG_OVERWORLD_DIR=<absolute source dir> node scripts/frlg/build-overworld-sprites.mjs
//
// The atlas packs one key per row (`POSES` columns), so the manifest maps a
// `spriteKey` to its row's base frame and the scene picks a pose by offset; the
// right-facing side is the left-facing frame flipped by `RouteScene`. The mapping
// below is by class name, unlike the battle `trainers.png` whose grid the fan
// compilation orders arbitrarily. `psychic` has no decomp class of its own, so it
// borrows the Channeler (the medium in purple), and `ace` the male Cooltrainer;
// those two predate `fallbacks` and stay out of it. A special NPC the decomp has
// no class for borrows the closest shipped class and the manifest's `fallbacks`
// records which.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRAME = 16
const HEIGHT = 32

// The nine poses, in the order the decomp strip packs them (column = index).
const POSES = [
  'down',
  'up',
  'side',
  'walk-down-a',
  'walk-down-b',
  'walk-up-a',
  'walk-up-b',
  'walk-side-a',
  'walk-side-b',
]

// Atlas row -> the decomp strip it crops, in manifest order. `frames` is the pose
// map: entry i is the source column copied into atlas column i; omitting it means
// 0..8. `fallback` names the class an NPC borrows when the decomp has no class of
// its own.
const ROWS = {
  youngster: { file: 'youngster.png' },
  lass: { file: 'lass.png' },
  bugcatcher: { file: 'bug_catcher.png' },
  hiker: { file: 'hiker.png' },
  camper: { file: 'camper.png' },
  picnicker: { file: 'picnicker.png' },
  fisher: { file: 'fisher.png' },
  psychic: { file: 'channeler.png' },
  blackbelt: { file: 'black_belt.png' },
  ace: { file: 'cooltrainer_m.png' },
  rocket: { file: 'rocket_m.png' },
  merchant: { file: 'clerk.png' },
  chef: { file: 'chef.png' },
  magician: { file: 'gentleman.png', fallback: 'gentleman' },
  exorcist: { file: 'channeler.png', fallback: 'channeler' },
  'weather-man': { file: 'scientist.png', fallback: 'scientist' },
  sacrifice: { file: 'old_man_1.png', fallback: 'old_man_1' },
  medic: { file: 'nurse.png', frames: [0, 1, 2, 0, 0, 1, 1, 2, 2] },
  'iv-judge': { file: 'gym_guy.png', fallback: 'gym_guy' },
  'berry-tree': { file: 'hiker.png', fallback: 'hiker' },
  ninja: { file: 'koga.png', frames: [0, 1, 2, 0, 0, 1, 1, 2, 2] },
}

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const ATLAS = new URL('../../src/assets/frlg/overworld.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/overworld.json', import.meta.url)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function isWorktree(repo) {
  const dotGit = path.join(repo, '.git')
  return existsSync(dotGit) && statSync(dotGit).isFile()
}

function isInside(repo, directory) {
  const relative = path.relative(repo, directory)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveSourceDir() {
  const given = process.argv[2] || process.env.PKM_FRLG_OVERWORLD_DIR
  if (!given) {
    fail(
      'usage: node scripts/frlg/build-overworld-sprites.mjs <absolute source dir> (or set PKM_FRLG_OVERWORLD_DIR)',
    )
  }
  if (!path.isAbsolute(given)) {
    fail(`source directory must be absolute: ${given} (AGENTS.md, Asset trees)`)
  }
  const directory = path.resolve(given)
  if (isWorktree(REPO) && isInside(REPO, directory)) {
    fail(`source directory must be outside this worktree: ${directory} (AGENTS.md, Asset trees)`)
  }
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    fail(
      `missing source directory: ${directory} (pass it as argv[2] or PKM_FRLG_OVERWORLD_DIR)`,
    )
  }
  return directory
}

const sourceDir = resolveSourceDir()
const names = Object.keys(ROWS)
const columns = POSES.length
const width = columns * FRAME
const height = names.length * HEIGHT
const data = Buffer.alloc(width * height * 4)
const sources = {}
const fallbacks = {}

names.forEach((name, row) => {
  const spec = ROWS[name]
  const file = path.join(sourceDir, spec.file)
  if (!existsSync(file)) fail(`missing source strip ${spec.file} in ${sourceDir}`)
  const png = decodePng(readFileSync(file))
  if (png.height !== HEIGHT || png.width % FRAME !== 0) {
    fail(`expected ${spec.file} to be Nx${HEIGHT} of ${FRAME}px frames, got ${png.width}x${png.height}`)
  }
  const map = spec.frames ?? POSES.map((_pose, column) => column)
  const available = png.width / FRAME
  const needed = Math.max(...map) + 1
  if (needed > available) {
    fail(`expected ${spec.file} to have ${needed} frames for its pose map, got ${available}`)
  }
  POSES.forEach((_pose, column) => {
    const source = map[column]
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < FRAME; x++) {
        const from = (y * png.width + source * FRAME + x) * 4
        if (png.data[from + 3] === 0) continue
        const to = ((row * HEIGHT + y) * width + column * FRAME + x) * 4
        data[to] = png.data[from]
        data[to + 1] = png.data[from + 1]
        data[to + 2] = png.data[from + 2]
        data[to + 3] = png.data[from + 3]
      }
    }
  })
  sources[name] = spec.file
  if (spec.fallback) fallbacks[name] = spec.fallback
})

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(width, height, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      size: FRAME,
      height: HEIGHT,
      columns,
      poses: POSES,
      // Base frame of each key's row; a pose is `base + column`.
      sprites: Object.fromEntries(names.map((name, row) => [name, row * columns])),
      sources,
      fallbacks,
    },
    null,
    2,
  )}\n`,
)
console.log(`wrote src/assets/frlg/overworld.png ${width}x${height} (${names.length} rows x ${columns} poses)`)
