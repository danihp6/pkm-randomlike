// Builds the FireRed/LeafGreen trainer overworld atlas
// (`src/assets/frlg/overworld.png` + `src/data/frlg/overworld.json`).
//
// Source: the pret/pokefirered decomp's
// `graphics/object_events/pics/people/*.png` (github.com/pret/pokefirered,
// gitignored, never redistributed). Each file is a 160x32 sheet of ten 16x32
// walk frames, the first column being the down-facing idle. Copy the ten the
// archetypes use into `sprite-sources/frlg/overworld/` and run:
//
//   node scripts/frlg/build-overworld-sprites.mjs [source-dir]
//
// The mapping below is by class name, unlike the battle `trainers.png` whose
// grid the fan compilation orders arbitrarily. `psychic` has no decomp class of
// its own, so it borrows the Channeler (the medium in purple), and `ace` the
// male Cooltrainer.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRAME = 16
const HEIGHT = 32

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
const width = names.length * FRAME
const data = Buffer.alloc(width * HEIGHT * 4)

names.forEach((name, frame) => {
  const png = decodePng(readFileSync(`${sourceDir.replace(/[\\/]$/, '')}/${SPRITES[name]}`))
  if (png.height !== HEIGHT || png.width % FRAME !== 0) {
    throw new Error(`expected ${SPRITES[name]} to be Nx${HEIGHT} of ${FRAME}px frames, got ${png.width}x${png.height}`)
  }
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < FRAME; x++) {
      const from = (y * png.width + x) * 4
      if (png.data[from + 3] === 0) continue
      const to = (y * width + frame * FRAME + x) * 4
      data[to] = png.data[from]
      data[to + 1] = png.data[from + 1]
      data[to + 2] = png.data[from + 2]
      data[to + 3] = png.data[from + 3]
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
console.log(`wrote src/assets/frlg/overworld.png ${width}x${HEIGHT} (${names.length} trainers)`)
