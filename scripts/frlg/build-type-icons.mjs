// Packs the Pokemon Anil type badges into src/assets/frlg/type-icons.png.
//
// Source: <anil>/Graphics/UI/types.png (gitignored, local-only; the fangame
// "Pokemon Anil" by EricLostie). The sheet is one column of 19 badges: the 18
// types in dex order with the "???" slot between Steel and Fire, then Fairy
// (Hada). Every badge is 64x24, its top 2px into a 28px pitch. Point the script
// at the checkout:
//
//   node scripts/frlg/build-type-icons.mjs <anil>/Graphics/UI/types.png
//
// Each badge is nearest-neighbour scaled into the frozen 32x14 frame and packed
// into the existing 4-column atlas (4 x ceil(n / 4) cells), so BootScene's
// spritesheet geometry and every consumer's scale are unchanged. Only the
// processed atlas and its manifest are committed; local development only, never
// redistributed - see docs/art-direction.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assetPath } from '../assets/root.mjs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_W = 32
const ICON_H = 14
const COLS = 4
/** Anil's own cell: one column of 64x24 badges, 2px into a 28px pitch. */
const CELL_W = 64
const CELL_H = 24
const CELL_PITCH = 28
const CELL_TOP = 2

/** The badges in atlas order (row-major). A name the sheet lacks pads the row. */
const FRAMES = [
  'normal', 'fighting', 'flying', 'poison',
  'ground', 'rock', 'bug', 'ghost',
  'steel', 'unknown', 'fire', 'water',
  'grass', 'electric', 'psychic', 'ice',
  'dragon', 'dark', 'fairy', '',
]

const sourcePath = process.argv[2] ?? assetPath('anil/Graphics/UI/types.png')
if (!existsSync(sourcePath)) {
  throw new Error(
    `usage: node scripts/frlg/build-type-icons.mjs <anil>/Graphics/UI/types.png (missing ${sourcePath})`,
  )
}
const buf = readFileSync(sourcePath)
if (buf[0] !== 0x89) throw new Error(`not a PNG: ${sourcePath}`)
// `decodePng` ignores IHDR's interlace byte and would decode interlaced art
// into garbage silently, so the interlace flag is checked here.
if (buf[28] !== 0) throw new Error(`interlaced PNG not supported: ${sourcePath}`)
const sheet = decodePng(buf)

const names = FRAMES.filter((name) => name)
if (new Set(names).size !== names.length) throw new Error('two type frames land on one name')
if (sheet.width < CELL_W) throw new Error(`too narrow: ${sheet.width}px (need ${CELL_W})`)
const needed = CELL_TOP + (names.length - 1) * CELL_PITCH + CELL_H
if (sheet.height < needed) {
  throw new Error(`too short: ${sheet.height}px for ${names.length} type rows (need ${needed})`)
}

const rows = Math.ceil(FRAMES.length / COLS)
const atlasW = ICON_W * COLS
const atlasH = ICON_H * rows
const atlas = Buffer.alloc(atlasW * atlasH * 4)

names.forEach((name, sourceRow) => {
  const index = FRAMES.indexOf(name)
  const col = index % COLS
  const row = Math.floor(index / COLS)
  const cellTop = CELL_TOP + sourceRow * CELL_PITCH
  let opaque = 0
  for (let y = 0; y < ICON_H; y++) {
    const sy = cellTop + Math.min(CELL_H - 1, Math.floor((y * CELL_H) / ICON_H))
    for (let x = 0; x < ICON_W; x++) {
      const sx = Math.min(CELL_W - 1, Math.floor((x * CELL_W) / ICON_W))
      const from = (sy * sheet.width + sx) * 4
      const to = ((row * ICON_H + y) * atlasW + col * ICON_W + x) * 4
      atlas[to] = sheet.data[from]
      atlas[to + 1] = sheet.data[from + 1]
      atlas[to + 2] = sheet.data[from + 2]
      atlas[to + 3] = sheet.data[from + 3]
      if (sheet.data[from + 3] > 8) opaque++
    }
  }
  if (opaque === 0) throw new Error(`empty source cell for "${name}" at row ${sourceRow}`)
})

const types = Object.fromEntries(names.map((name) => [name, FRAMES.indexOf(name)]))

mkdirSync(fileURLToPath(new URL('../../src/assets/frlg/', import.meta.url)), { recursive: true })
mkdirSync(fileURLToPath(new URL('../../src/data/frlg/', import.meta.url)), { recursive: true })
writeFileSync(
  fileURLToPath(new URL('../../src/assets/frlg/type-icons.png', import.meta.url)),
  encodePng(atlasW, atlasH, atlas),
)
writeFileSync(
  fileURLToPath(new URL('../../src/data/frlg/type-icons.json', import.meta.url)),
  `${JSON.stringify({ width: ICON_W, height: ICON_H, cols: COLS, rows, frames: FRAMES, types }, null, 2)}\n`,
)
console.log(
  `wrote src/assets/frlg/type-icons.png ${atlasW}x${atlasH} ` +
    `(${names.length} badges @ ${ICON_W}x${ICON_H}, ${COLS} cols, from ${sourcePath})`,
)
