// Packs the FRLG status badges into src/assets/frlg/status-icons.png.
//
// Source: sprite-sources/frlg-ui/type-status-icons.png (gitignored, local-only).
// The sheet is a 4-column grid of 32x16 cells; the 18 types plus the "???"
// badge fill the first five rows, and the two status rows sit in the sixth:
// each 32x16 cell holds two stacked 32x8 badges. The order, read row-major over
// the 4x2 status grid, is PSN / PAR / SLP / FRZ on the top line and
// BRN / PKRS / FNT on the second. FNT (fainted) and PKRS (Pokérus) are packed
// too so the map is complete; the battle UI only reads the six conditions.
// Only the processed atlas and its manifest are committed; see
// docs/art-direction.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_W = 32
const ICON_H = 8
const COLS = 4
const ROWS = 2
/** The status cell's top in the source sheet (five rows of 16px type cells). */
const STATUS_TOP = 80

/** The badges in atlas order (row-major); empty cells pad the last row. */
const FRAMES = [
  'psn', 'par', 'slp', 'frz',
  'brn', 'pkrs', 'fnt', '',
]

const SOURCE = new URL('../../sprite-sources/frlg-ui/type-status-icons.png', import.meta.url)
const ATLAS = new URL('../../src/assets/frlg/status-icons.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/status-icons.json', import.meta.url)

const sheet = decodePng(readFileSync(SOURCE))
const atlasW = ICON_W * COLS
const atlasH = ICON_H * ROWS
const data = Buffer.alloc(atlasW * atlasH * 4)

FRAMES.forEach((name, i) => {
  if (!name) return
  const col = i % COLS
  const row = Math.floor(i / COLS)
  for (let y = 0; y < ICON_H; y++) {
    for (let x = 0; x < ICON_W; x++) {
      const from = ((STATUS_TOP + row * ICON_H + y) * sheet.width + col * ICON_W + x) * 4
      const to = ((row * ICON_H + y) * atlasW + col * ICON_W + x) * 4
      data[to] = sheet.data[from]
      data[to + 1] = sheet.data[from + 1]
      data[to + 2] = sheet.data[from + 2]
      data[to + 3] = sheet.data[from + 3]
    }
  }
})

const statuses = Object.fromEntries(FRAMES.map((name, i) => [name, i]).filter(([name]) => name))

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(atlasW, atlasH, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify({ width: ICON_W, height: ICON_H, cols: COLS, rows: ROWS, frames: FRAMES, statuses }, null, 2)}\n`,
)
console.log(`wrote src/assets/frlg/status-icons.png ${atlasW}x${atlasH} (${Object.keys(statuses).length} badges)`)
