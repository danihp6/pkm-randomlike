// Builds src/assets/moves.png, the move-effect animation atlas, from
// individually-sourced fx strips in sprite-sources/moves/ (gitignored,
// copyrighted Nintendo/GameFreak/Chunsoft art - local build input only, see
// sprite-sources/README.md). Each source file is a horizontal strip of
// FRAME_SIZE^2 frames (frame count = width / FRAME_SIZE); they're stacked
// one per row onto the atlas, in MOVE_FX_ROWS order below. Keep MOVE_FX_ROWS
// in sync with the MOVE_FX registry in src/render/move-fx.ts.
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'

const FRAME_SIZE = 32
const MOVE_FX_ROWS = [
  'ember',
  'cross_poison',
  'poison_gas',
  'fire_punch',
  'rock_slide',
  'ancient_power',
]

const movesDir = new URL('../sprite-sources/moves/', import.meta.url)
const sources = MOVE_FX_ROWS.map((name) =>
  decodePng(readFileSync(new URL(`${name}.png`, movesDir))),
)

const cols = Math.max(...sources.map((s) => s.width / FRAME_SIZE))
const width = cols * FRAME_SIZE
const height = sources.length * FRAME_SIZE
const data = Buffer.alloc(width * height * 4)

sources.forEach((src, row) => {
  for (let y = 0; y < FRAME_SIZE; y++) {
    const so = y * src.width * 4
    const doff = (row * FRAME_SIZE + y) * width * 4
    src.data.copy(data, doff, so, so + src.width * 4)
  }
})

const outDir = new URL('../src/assets/', import.meta.url)
const png = encodePng(width, height, data)
writeFileSync(new URL('moves.png', outDir), png)
console.log(`wrote src/assets/moves.png ${width}x${height} (${png.length} bytes)`)
