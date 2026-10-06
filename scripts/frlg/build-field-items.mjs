// Builds the FRLG ground-item sprite (the Poke Ball the field shows on a route)
// from the gitignored rip sprite-sources/frlg/tileset.png (the Hoeloo
// compilation). The ball is the standalone Poke Ball that sits above the right
// corner of the Pokemon Center; it is cropped to 16x16 and its flat background
// is keyed to transparent.
//
//   node scripts/frlg/build-field-items.mjs
//
// Writes src/assets/frlg/ground-item.png, loaded by src/scenes/BootScene.ts and
// read through src/data/groundItemSprite.ts. Local-only art: never
// redistribute (docs/art-direction.md).
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SRC = new URL('../../sprite-sources/frlg/tileset.png', import.meta.url)
const OUT = new URL('../../src/assets/frlg/ground-item.png', import.meta.url)

const SIZE = 16
/** Top-left of the ball's 16x16 crop on the source sheet. */
const ORIGIN_X = 74
const ORIGIN_Y = 140

const source = decodePng(readFileSync(SRC))
const pixel = (x, y) => {
  const i = (y * source.width + x) * 4
  return [source.data[i], source.data[i + 1], source.data[i + 2]]
}

const [br, bg, bb] = pixel(0, 0)
const isBackground = (r, g, b) =>
  Math.abs(r - br) < 34 && Math.abs(g - bg) < 34 && Math.abs(b - bb) < 34

const out = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(ORIGIN_X + x, ORIGIN_Y + y)
    const o = (y * SIZE + x) * 4
    if (isBackground(r, g, b)) continue
    out[o] = r
    out[o + 1] = g
    out[o + 2] = b
    out[o + 3] = 255
  }
}

writeFileSync(OUT, encodePng(SIZE, SIZE, out))
console.log(`wrote src/assets/frlg/ground-item.png ${SIZE}x${SIZE}`)
