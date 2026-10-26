// Builds the FRLG static-sign prop (the sign a route draws on the cell at the boss
// door) from the private asset store's frlg/tileset-2.png, the field sheet the
// FRLG tilesets are composed from. The sign is the 16x16 cell at column 23, row 3
// of the 17px-pitch block grid; the cell already carries its own alpha (68 of its
// 256 pixels are transparent, all four corners among them), so it is copied
// RGBA as-is: no colour key and no background sniffing.
//
//   node scripts/frlg/build-sign.mjs
//
// Writes src/assets/frlg/sign.png, loaded by src/scenes/BootScene.ts and read
// through src/data/tilesets/props.ts. Local-only art: never redistribute
// (docs/art-direction.md).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetPath } from '../assets/root.mjs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SRC = assetPath('frlg/tileset-2.png')
const OUT = new URL('../../src/assets/frlg/sign.png', import.meta.url)
const OUT_PATH = fileURLToPath(OUT)

const SIZE = 16
/** The block grid's 1px origin and 17px pitch: column 23, row 3. */
const ORIGIN = 1
const PITCH = 17
const COLUMN = 23
const ROW = 3
const ORIGIN_X = ORIGIN + COLUMN * PITCH
const ORIGIN_Y = ORIGIN + ROW * PITCH

const source = decodePng(readFileSync(SRC))
const out = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const from = ((ORIGIN_Y + y) * source.width + (ORIGIN_X + x)) * 4
    const to = (y * SIZE + x) * 4
    source.data.copy(out, to, from, from + 4)
  }
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, encodePng(SIZE, SIZE, out))
console.log(`wrote src/assets/frlg/sign.png ${SIZE}x${SIZE}`)
