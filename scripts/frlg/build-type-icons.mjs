// Packs the FRLG type badges into src/assets/frlg/type-icons.png.
//
// Source: sprite-sources/frlg-ui/type-status-icons.png (gitignored, local-only).
// The sheet is a 4-column grid of 32x16 cells; each badge is 32x14, inset 2px
// from the cell top. The 18 types plus the "???" (unknown) badge occupy the first
// five rows; the status badges below them are not packed. The FRLG sheet predates
// Fairy, so there is no Fairy badge — the UI falls back to a text chip for it.
// Only the processed atlas and its manifest are committed; see
// docs/art-direction.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_W = 32
const ICON_H = 14
const COLS = 4
const ROWS = 5
/** The cell pitch and the badge's top inset inside a cell. */
const CELL_H = 16
const CELL_TOP = 2

/** The badges in sheet order (row-major). Empty cells pad the last row. */
const FRAMES = [
  'normal', 'fighting', 'flying', 'poison',
  'ground', 'rock', 'bug', 'ghost',
  'steel', 'unknown', 'fire', 'water',
  'grass', 'electric', 'psychic', 'ice',
  'dragon', 'dark', '', '',
]

const SOURCE = new URL('../../sprite-sources/frlg-ui/type-status-icons.png', import.meta.url)
const ATLAS = new URL('../../src/assets/frlg/type-icons.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/type-icons.json', import.meta.url)

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
      const from = ((row * CELL_H + CELL_TOP + y) * sheet.width + col * ICON_W + x) * 4
      const to = ((row * ICON_H + y) * atlasW + col * ICON_W + x) * 4
      data[to] = sheet.data[from]
      data[to + 1] = sheet.data[from + 1]
      data[to + 2] = sheet.data[from + 2]
      data[to + 3] = sheet.data[from + 3]
    }
  }
})

const types = Object.fromEntries(FRAMES.map((name, i) => [name, i]).filter(([name]) => name))

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(atlasW, atlasH, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify({ width: ICON_W, height: ICON_H, cols: COLS, rows: ROWS, frames: FRAMES, types }, null, 2)}\n`,
)
console.log(`wrote src/assets/frlg/type-icons.png ${atlasW}x${atlasH} (${Object.keys(types).length} badges)`)
