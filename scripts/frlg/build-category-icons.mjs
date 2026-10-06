// Packs the official move-category badges (physical / special / status) into
// src/assets/frlg/move-categories.png.
//
// Source: the 32x14 category icons under sprite-sources/frlg-ui/category/ (the
// same badges the modern games' move lists use). sprite-sources/ is gitignored —
// only the processed atlas and its manifest are committed. Local-only art, see
// docs/art-direction.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_W = 32
const ICON_H = 14
const ORDER = ['Physical', 'Special', 'Status']

const SOURCES = new URL('../../sprite-sources/frlg-ui/category/', import.meta.url)
const ATLAS = new URL('../../src/assets/frlg/move-categories.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/move-categories.json', import.meta.url)

const frames = ORDER.map((name) => {
  const img = decodePng(readFileSync(new URL(`${name}.png`, SOURCES)))
  if (img.width !== ICON_W || img.height !== ICON_H) {
    throw new Error(`expected ${name}.png to be ${ICON_W}x${ICON_H}, got ${img.width}x${img.height}`)
  }
  return img
})

const atlasWidth = ICON_W * frames.length
const data = Buffer.alloc(atlasWidth * ICON_H * 4)

frames.forEach((frame, i) => {
  const dx = i * ICON_W
  for (let y = 0; y < ICON_H; y++) {
    for (let x = 0; x < ICON_W; x++) {
      const from = (y * ICON_W + x) * 4
      const to = (y * atlasWidth + dx + x) * 4
      data[to] = frame.data[from]
      data[to + 1] = frame.data[from + 1]
      data[to + 2] = frame.data[from + 2]
      data[to + 3] = frame.data[from + 3]
    }
  }
})

const categories = Object.fromEntries(ORDER.map((name, i) => [name, i]))

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(atlasWidth, ICON_H, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify({ width: ICON_W, height: ICON_H, frames: ORDER, categories }, null, 2)}\n`,
)
console.log(`wrote src/assets/frlg/move-categories.png ${atlasWidth}x${ICON_H} (${frames.length} icons)`)
