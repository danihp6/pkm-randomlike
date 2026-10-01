// Builds the FireRed/LeafGreen player overworld atlas
// (`src/assets/frlg/player.png` + `src/data/frlg/player.json`).
//
// Source: the pret/pokefirered decomp's
// `graphics/object_events/pics/people/red_normal.png` (github.com/pret/pokefirered,
// gitignored, never redistributed), the same origin as the trainer overworld
// sheets. It is a 144x32 strip of nine 16x32 walk frames in this order:
//
//   0 down idle   1 up idle   2 side idle (faces left)
//   3 down walk   4 down walk 5 up walk   6 up walk
//   7 side walk   8 side walk
//
// All nine are packed and named, so the route can draw the resting pose and the
// two-frame walk cycle of each direction; the right-facing side is the
// left-facing frame flipped by `RouteScene`. Copy the sheet into
// `sprite-sources/frlg/overworld/` and run:
//
//   node scripts/frlg/build-player-sprite.mjs [source-file]
//
// `green_normal.png` (Leaf) has the same layout and slots in here once the run
// offers a player gender.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRAME = 16
const HEIGHT = 32

// Frame name in the manifest -> column on the decomp strip.
const FRAMES = {
  down: 0,
  up: 1,
  side: 2,
  'walk-down-a': 3,
  'walk-down-b': 4,
  'walk-up-a': 5,
  'walk-up-b': 6,
  'walk-side-a': 7,
  'walk-side-b': 8,
}

const DEFAULT_SOURCE = fileURLToPath(new URL('../../sprite-sources/frlg/overworld/red_normal.png', import.meta.url))
const source = process.argv[2] ?? DEFAULT_SOURCE
const ATLAS = new URL('../../src/assets/frlg/player.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/player.json', import.meta.url)

const sheet = decodePng(readFileSync(source))
if (sheet.height !== HEIGHT || sheet.width % FRAME !== 0) {
  throw new Error(`expected a Nx${HEIGHT} strip of ${FRAME}px frames, got ${sheet.width}x${sheet.height}`)
}

const names = Object.keys(FRAMES)
const width = names.length * FRAME
const data = Buffer.alloc(width * HEIGHT * 4)

names.forEach((name, frame) => {
  const column = FRAMES[name]
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < FRAME; x++) {
      const from = (y * sheet.width + column * FRAME + x) * 4
      if (sheet.data[from + 3] === 0) continue
      const to = (y * width + frame * FRAME + x) * 4
      data[to] = sheet.data[from]
      data[to + 1] = sheet.data[from + 1]
      data[to + 2] = sheet.data[from + 2]
      data[to + 3] = sheet.data[from + 3]
    }
  }
})

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(width, HEIGHT, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    { size: FRAME, height: HEIGHT, frames: names, sprites: Object.fromEntries(names.map((n, i) => [n, i])) },
    null,
    2,
  )}\n`,
)
console.log(`wrote src/assets/frlg/player.png ${width}x${HEIGHT} (${names.length} frames)`)
