// Re-lays src/assets/portraits.png from a single 40px-wide column (649 x 40 =
// 25960px tall) into a 40-column grid (1600x680). Phaser uploads the atlas as
// one WebGL texture, and 25960 exceeds the usual 16384px MAX_TEXTURE_SIZE, so
// the column rendered black. Frame order is unchanged (row-major either way),
// so `portraitFrameFor` still keys off `num - 1`.
//
// Run once (idempotent: a file that is already wider than one cell is skipped):
//   node scripts/legacy-art/relayout-portraits.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'

const SIZE = 40
const COLS = 40
const ASSETS = new URL('../../src/assets/', import.meta.url)

const src = decodePng(readFileSync(new URL('portraits.png', ASSETS)))
if (src.width !== SIZE || src.height % SIZE !== 0) {
  console.log(`portraits.png is ${src.width}x${src.height}; already re-laid out or not the expected column`)
  process.exit(0)
}

const frames = src.height / SIZE
const rows = Math.ceil(frames / COLS)
const outW = COLS * SIZE
const outH = rows * SIZE
const out = Buffer.alloc(outW * outH * 4)

for (let i = 0; i < frames; i++) {
  const dx = (i % COLS) * SIZE
  const dy = Math.floor(i / COLS) * SIZE
  for (let y = 0; y < SIZE; y++) {
    const so = (i * SIZE + y) * src.width * 4
    out.set(src.data.subarray(so, so + SIZE * 4), ((dy + y) * outW + dx) * 4)
  }
}

writeFileSync(new URL('portraits.png', ASSETS), encodePng(outW, outH, out))
console.log(`wrote src/assets/portraits.png ${outW}x${outH} (${frames} frames in a ${COLS}-column grid)`)
