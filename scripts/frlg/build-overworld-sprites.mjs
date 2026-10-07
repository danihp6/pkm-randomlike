// Builds the FireRed/LeafGreen trainer overworld atlas
// (`src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json`).
//
// Source: the pret/pokefirered decomp's
// `graphics/object_events/pics/people/*.png` (github.com/pret/pokefirered,
// gitignored, never redistributed). Each file is a 160x32 sheet of ten 16x32
// frames; the first nine are the standard walk set, in the same order as the
// player's sheet, and the tenth is a field-move pose the route never draws:
//
//   0 down idle   1 up idle   2 side idle (faces left)
//   3 down walk   4 down walk 5 up walk   6 up walk
//   7 side walk   8 side walk 9 extra (ignored)
//
// Copy the ten the archetypes use into `sprite-sources/frlg/overworld/` and run:
//
//   node scripts/frlg/build-overworld-sprites.mjs [source-dir]
//
// The atlas packs one archetype per row (`POSES` columns), so the manifest maps
// a `spriteKey` to its row's base frame and the scene picks a pose by offset; the
// right-facing side is the left-facing frame flipped by `RouteScene`. The mapping
// below is by class name, unlike the battle `trainers.png` whose grid the fan
// compilation orders arbitrarily. `psychic` has no decomp class of its own, so it
// borrows the Channeler (the medium in purple), and `ace` the male Cooltrainer.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

// Trainer archetype id in src/data/trainers.ts -> decomp file name.
const SPRITES = {
  youngster: 'youngster.png',
  lass: 'lass.png',
  bugcatcher: 'bug_catcher.png',
  hiker: 'hiker.png',
  camper: 'camper.png',
  picnicker: 'picnicker.png',
  fisher: 'fisher.png',
  psychic: 'channeler.png',
  blackbelt: 'black_belt.png',
  ace: 'cooltrainer_m.png',
}

const DEFAULT_DIR = fileURLToPath(new URL('../../sprite-sources/frlg/overworld/', import.meta.url))
const sourceDir = process.argv[2] ?? DEFAULT_DIR
const ATLAS = new URL('../../src/assets/frlg/overworld.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/overworld.json', import.meta.url)

const names = Object.keys(SPRITES)
const columns = POSES.length
const width = columns * FRAME
const height = names.length * HEIGHT
const data = Buffer.alloc(width * height * 4)

names.forEach((name, row) => {
  const png = decodePng(readFileSync(`${sourceDir.replace(/[\\/]$/, '')}/${SPRITES[name]}`))
  if (png.height !== HEIGHT || png.width % FRAME !== 0) {
    throw new Error(`expected ${SPRITES[name]} to be Nx${HEIGHT} of ${FRAME}px frames, got ${png.width}x${png.height}`)
  }
  POSES.forEach((_pose, column) => {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < FRAME; x++) {
        const from = (y * png.width + column * FRAME + x) * 4
        if (png.data[from + 3] === 0) continue
        const to = ((row * HEIGHT + y) * width + column * FRAME + x) * 4
        data[to] = png.data[from]
        data[to + 1] = png.data[from + 1]
        data[to + 2] = png.data[from + 2]
        data[to + 3] = png.data[from + 3]
      }
    }
  })
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
      // Base frame of each archetype's row; a pose is `base + column`.
      sprites: Object.fromEntries(names.map((n, row) => [n, row * columns])),
    },
    null,
    2,
  )}\n`,
)
console.log(`wrote src/assets/frlg/overworld.png ${width}x${height} (${names.length} trainers x ${columns} poses)`)
