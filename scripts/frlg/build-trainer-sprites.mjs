// Builds the FireRed/LeafGreen battle trainer sheet used on the enemy platform
// (`src/assets/frlg/trainers.png` + `src/data/frlg/trainers.json`).
//
// Source: sprite-sources/frlg/trainers.png (spriters-resource, gitignored, never
// redistributed), 536x1400. The right section is a "Regular Trainers" grid of
// 64x64 sprites, each drawn on a flat orange cell; the grid pitch is 65px (64px
// sprite + 1px gutter) at origin (8, 242) and 8 columns wide. This crops the ten
// sprites the run's archetypes use on that grid and keys the cell's flat orange
// to transparent. The mapping below is measured from the sheet (col, row), not
// guessed from the decomp's TRAINER_PIC order, which this fan compilation does
// not follow.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRAME = 64
// Grid geometry of the "Regular Trainers" block (measured from the sheet).
const GRID_X = 8
const GRID_Y = 242
const PITCH = 65
// The flat orange every cell is filled with, keyed out below.
const ORANGE = [255, 127, 39]
const ORANGE_TOLERANCE = 20

// Trainer archetype id in src/data/trainers.ts -> [column, row] on the grid.
const SPRITES = {
  youngster: [0, 0],
  bugcatcher: [1, 0],
  lass: [2, 0],
  camper: [4, 0],
  picnicker: [5, 0],
  hiker: [0, 1],
  fisher: [4, 1],
  psychic: [2, 2],
  blackbelt: [0, 3],
  ace: [5, 4],
}

const SOURCE = new URL('../../sprite-sources/frlg/trainers.png', import.meta.url)
const ATLAS = new URL('../../src/assets/frlg/trainers.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/trainers.json', import.meta.url)

const sheet = decodePng(readFileSync(SOURCE))
const expected = { width: 536, height: 1400 }
if (sheet.width !== expected.width || sheet.height !== expected.height) {
  throw new Error(
    `expected trainers.png to be ${expected.width}x${expected.height}, got ${sheet.width}x${sheet.height}`,
  )
}

const names = Object.keys(SPRITES)
const width = names.length * FRAME
const data = Buffer.alloc(width * FRAME * 4)

names.forEach((name, frame) => {
  const [column, row] = SPRITES[name]
  const originX = GRID_X + column * PITCH
  const originY = GRID_Y + row * PITCH
  for (let y = 0; y < FRAME; y++) {
    for (let x = 0; x < FRAME; x++) {
      const from = ((originY + y) * sheet.width + originX + x) * 4
      const to = (y * width + frame * FRAME + x) * 4
      if (sheet.data[from + 3] === 0) continue
      const orange =
        Math.abs(sheet.data[from] - ORANGE[0]) < ORANGE_TOLERANCE &&
        Math.abs(sheet.data[from + 1] - ORANGE[1]) < ORANGE_TOLERANCE &&
        Math.abs(sheet.data[from + 2] - ORANGE[2]) < ORANGE_TOLERANCE
      if (orange) continue
      data[to] = sheet.data[from]
      data[to + 1] = sheet.data[from + 1]
      data[to + 2] = sheet.data[from + 2]
      data[to + 3] = sheet.data[from + 3]
    }
  }
})

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(width, FRAME, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    { size: FRAME, frames: names, sprites: Object.fromEntries(names.map((n, i) => [n, i])) },
    null,
    2,
  )}\n`,
)
console.log(`wrote src/assets/frlg/trainers.png ${width}x${FRAME} (${names.length} trainers)`)
