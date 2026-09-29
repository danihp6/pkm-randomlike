// Overlays real PMDCollab portrait art onto the procedural placeholder
// atlas (src/assets/portraits.png). Run `node scripts/generate-portraits.mjs`
// first to (re)build the placeholder, then this script to stamp real art
// over the species it covers.
//
// Each PMDCollab portrait sheet (sprite-sources/pokemons/<slug>-pmdcollab/
// portrait-sheet.png, fetched by scripts/fetch-pmdcollab.mjs) is a 200x320
// grid of 40x40 emotion cells (5 cols x 8 rows: Normal, Happy, Pain, Angry,
// Worried, ... - confirmed by cropping and eyeballing, PMDCollab doesn't
// ship an index for these). Only the "Normal" cell (top-left, [0,0]) is
// used here - see DomStartMenu, which shows it next to each roster entry's
// name.
//
// Species list (id/slug) is shared with extract-real-sprites.mjs - see
// scripts/pmdcollab-species.mjs. Species whose folder has no
// portrait-sheet.png (not every PMDCollab pack includes one) are silently
// skipped and keep their procedural placeholder face.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'
import { PMDCOLLAB_SPECIES } from './pmdcollab-species.mjs'
import { PORTRAIT_SIZE } from './generate-portraits.mjs'

const ASSETS = new URL('../src/assets/', import.meta.url)
const SOURCES = new URL('../sprite-sources/pokemons/', import.meta.url)
const SHEET_COLS = 5

const atlas = decodePng(readFileSync(new URL('portraits.png', ASSETS)))

function trimBBox(img, x0, y0, x1, y1) {
  const { width, data } = img
  let minX = x1,
    maxX = x0,
    minY = y1,
    maxY = y0,
    found = false
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (data[(y * width + x) * 4 + 3] > 20) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (!found) return null
  return { minX, maxX, minY, maxY }
}

let stamped = 0
let skipped = 0
for (const { slug, row } of PMDCOLLAB_SPECIES) {
  const sheetUrl = new URL(`${slug}-pmdcollab/portrait-sheet.png`, SOURCES)
  if (!existsSync(sheetUrl)) {
    skipped++
    continue
  }
  const sheet = decodePng(readFileSync(sheetUrl))
  if (sheet.width !== PORTRAIT_SIZE * SHEET_COLS) {
    console.error(`[${slug}] unexpected portrait-sheet.png width ${sheet.width}, skipping`)
    skipped++
    continue
  }

  const bbox = trimBBox(sheet, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE)
  if (!bbox) {
    console.error(`[${slug}] empty Normal portrait cell, skipping`)
    skipped++
    continue
  }
  const w = bbox.maxX - bbox.minX + 1
  const h = bbox.maxY - bbox.minY + 1
  const destX0 = Math.floor((PORTRAIT_SIZE - w) / 2)
  const destY0 = Math.max(0, PORTRAIT_SIZE - h)

  const rowY = row * PORTRAIT_SIZE
  for (let y = 0; y < PORTRAIT_SIZE; y++)
    for (let x = 0; x < PORTRAIT_SIZE; x++) {
      const o = ((rowY + y) * atlas.width + x) * 4
      atlas.data.fill(0, o, o + 4)
    }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = destX0 + x
      const dy = destY0 + y
      if (dx < 0 || dx >= PORTRAIT_SIZE || dy < 0 || dy >= PORTRAIT_SIZE) continue
      const so = ((bbox.minY + y) * sheet.width + (bbox.minX + x)) * 4
      const doff = ((rowY + dy) * atlas.width + dx) * 4
      atlas.data.set(sheet.data.subarray(so, so + 4), doff)
    }
  }
  stamped++
}

const flat = Buffer.alloc(atlas.width * atlas.height * 4)
atlas.data.copy(flat)
const png = encodePng(atlas.width, atlas.height, flat)
writeFileSync(new URL('portraits.png', ASSETS), png)
console.log(
  `wrote src/assets/portraits.png ${atlas.width}x${atlas.height} (stamped ${stamped}, skipped ${skipped})`,
)
