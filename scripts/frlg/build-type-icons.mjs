// Packs the Pokemon Anil type glyphs into src/assets/frlg/type-icons.png.
//
// Source: <anil>/Graphics/UI/types_mini.png (gitignored, local-only; the fangame
// "Pokemon Anil" by EricLostie). The sheet is one horizontal strip of 19 24x24
// glyphs: the 18 types in dex order with the "???" slot between Steel and Fire,
// then Fairy (Hada). Point the script at the checkout:
//
//   node scripts/frlg/build-type-icons.mjs <anil>/Graphics/UI/types_mini.png
//
// Every cell is copied 1:1 into the same 19 x 1 atlas, so a consumer's 24 px box
// is the glyph's own pixels and no scaling can soften it. Only the processed
// atlas and its manifest are committed; local development only, never
// redistributed - see docs/art-direction.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assetPath } from '../assets/root.mjs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_W = 24
const ICON_H = 24
const COLS = 19
const ROWS = 1

/** The glyphs in atlas order (row-major). */
const FRAMES = [
  'normal', 'fighting', 'flying', 'poison',
  'ground', 'rock', 'bug', 'ghost',
  'steel', 'unknown', 'fire', 'water',
  'grass', 'electric', 'psychic', 'ice',
  'dragon', 'dark', 'fairy',
]

const sourcePath = process.argv[2] ?? assetPath('anil/Graphics/UI/types_mini.png')
if (!existsSync(sourcePath)) {
  throw new Error(
    `usage: node scripts/frlg/build-type-icons.mjs <anil>/Graphics/UI/types_mini.png (missing ${sourcePath})`,
  )
}
const buf = readFileSync(sourcePath)
if (buf[0] !== 0x89) throw new Error(`not a PNG: ${sourcePath}`)
// `decodePng` ignores IHDR's interlace byte and would decode interlaced art
// into garbage silently, so the interlace flag is checked here.
if (buf[28] !== 0) throw new Error(`interlaced PNG not supported: ${sourcePath}`)
const sheet = decodePng(buf)

if (new Set(FRAMES).size !== FRAMES.length) throw new Error('two type frames land on one name')
const neededW = COLS * ICON_W
const neededH = ROWS * ICON_H
if (sheet.width < neededW) throw new Error(`too narrow: ${sheet.width}px (need ${neededW})`)
if (sheet.height < neededH) throw new Error(`too short: ${sheet.height}px (need ${neededH})`)

const atlasW = ICON_W * COLS
const atlasH = ICON_H * ROWS
const atlas = Buffer.alloc(atlasW * atlasH * 4)

FRAMES.forEach((name, index) => {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  const cellX = col * ICON_W
  const cellY = row * ICON_H
  let opaque = 0
  for (let y = 0; y < ICON_H; y++) {
    for (let x = 0; x < ICON_W; x++) {
      const from = ((cellY + y) * sheet.width + cellX + x) * 4
      const to = ((row * ICON_H + y) * atlasW + col * ICON_W + x) * 4
      atlas[to] = sheet.data[from]
      atlas[to + 1] = sheet.data[from + 1]
      atlas[to + 2] = sheet.data[from + 2]
      atlas[to + 3] = sheet.data[from + 3]
      if (sheet.data[from + 3] > 8) opaque++
    }
  }
  if (opaque === 0) throw new Error(`empty source cell for "${name}" at ${cellX},${cellY}`)
})

const types = Object.fromEntries(FRAMES.map((name, index) => [name, index]))

mkdirSync(fileURLToPath(new URL('../../src/assets/frlg/', import.meta.url)), { recursive: true })
mkdirSync(fileURLToPath(new URL('../../src/data/frlg/', import.meta.url)), { recursive: true })
writeFileSync(
  fileURLToPath(new URL('../../src/assets/frlg/type-icons.png', import.meta.url)),
  encodePng(atlasW, atlasH, atlas),
)
writeFileSync(
  fileURLToPath(new URL('../../src/data/frlg/type-icons.json', import.meta.url)),
  `${JSON.stringify({ width: ICON_W, height: ICON_H, cols: COLS, rows: ROWS, frames: FRAMES, types }, null, 2)}\n`,
)
console.log(
  `wrote src/assets/frlg/type-icons.png ${atlasW}x${atlasH} ` +
    `(${FRAMES.length} glyphs @ ${ICON_W}x${ICON_H}, ${COLS} cols, from ${sourcePath})`,
)
