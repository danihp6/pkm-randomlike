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

// A sign cell carries its own shading; a flat one means the grid shifted or the
// crop landed on a blank block, which would draw as an opaque square on the boss
// door. Refuse to write anything in that case.
const MIN_OPAQUE_COLOURS = 3
const MAX_NEAR_BLACK = 0.4
const nearBlack = (r, g, b) => r <= 16 && g <= 16 && b <= 16
const colours = new Set()
let nearBlackCount = 0
for (let i = 0; i < out.length; i += 4) {
  if (out[i + 3] === 0) continue
  colours.add(`${out[i]},${out[i + 1]},${out[i + 2]}`)
  if (nearBlack(out[i], out[i + 1], out[i + 2])) nearBlackCount += 1
}
const nearBlackShare = nearBlackCount / (SIZE * SIZE)
if (colours.size < MIN_OPAQUE_COLOURS || nearBlackShare > MAX_NEAR_BLACK) {
  console.error(
    `build-sign: flat crop at the source cell (${ORIGIN_X},${ORIGIN_Y}) = column ${COLUMN}, row ${ROW}: ` +
      `${colours.size} distinct opaque colours, ${Math.round(nearBlackShare * 100)} % near-black pixels ` +
      `— refusing to write src/assets/frlg/sign.png`,
  )
  process.exit(1)
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, encodePng(SIZE, SIZE, out))
console.log(`wrote src/assets/frlg/sign.png ${SIZE}x${SIZE}`)
