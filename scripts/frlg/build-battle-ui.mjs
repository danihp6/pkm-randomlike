// Slices the FireRed/LeafGreen window frames and battle widgets used by the
// menus and HUD out of sprite-sources/frlg-ui/hpbars-menu.png and upscales them
// 4x (nearest) so the 240x160-era chrome fits the 1280x800 canvas.
//
// Outputs the committed src/assets/frlg/ files — window.png (the light menu
// window), textbox.png (the navy battle message box), hpbar.png (the HP bar:
// the "HP" chip plus an empty track, the coloured fill is drawn behind it) and
// cursor.png (the ▶ command-menu cursor, its white matte cleared to transparent)
// — drawn by src/ui/frlg.ts.
// src/data/frlg/battle-ui.json records the measured geometry (the atlas scale
// and the HP track's fill rectangle) so the scene never hardcodes pixel maths.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { assetPath } from '../assets/root.mjs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 4

// [x, y, w, h] in hpbars-menu.png source pixels.
const REGIONS = {
  window: [298, 6, 158, 42],
  textbox: [296, 56, 242, 48],
  hpbar: [27, 18, 67, 7],
  cursor: [269, 4, 8, 11],
}

const SOURCE = assetPath('frlg-ui/hpbars-menu.png')
const ASSETS = new URL('../../src/assets/frlg/', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/battle-ui.json', import.meta.url)

const sheet = decodePng(readFileSync(SOURCE))

function crop(img, x, y, w, h) {
  const data = Buffer.alloc(w * h * 4)
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * img.width + x) * 4
    img.data.copy(data, row * w * 4, from, from + w * 4)
  }
  return { width: w, height: h, data }
}

function scale(img, factor) {
  const width = img.width * factor
  const height = img.height * factor
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (Math.floor(y / factor) * img.width + Math.floor(x / factor)) * 4
      const dst = (y * width + x) * 4
      data[dst] = img.data[src]
      data[dst + 1] = img.data[src + 1]
      data[dst + 2] = img.data[src + 2]
      data[dst + 3] = img.data[src + 3]
    }
  }
  return { width, height, data }
}

// The HP bar in the sheet is drawn full; clear the green fill so the scene can
// paint the current HP colour behind the chip-and-track overlay. Returns the
// track rectangle (source pixels) that was cleared.
function clearHpFill(img) {
  let minX = img.width
  let maxX = -1
  let minY = img.height
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4
      const r = img.data[o]
      const g = img.data[o + 1]
      const b = img.data[o + 2]
      if (img.data[o + 3] === 0 || !(g > r + 30 && g > b + 30)) continue
      img.data[o + 3] = 0
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) throw new Error('hp bar: no green fill found to clear')
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

// The cursor is cropped with the sheet's white matte behind it. Clear the pure
// white so the ▶ blends over whatever window it sits on.
function clearWhiteMatte(img) {
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i] === 255 && img.data[i + 1] === 255 && img.data[i + 2] === 255) {
      img.data[i + 3] = 0
    }
  }
}

mkdirSync(ASSETS, { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })

const report = {}
for (const [name, [x, y, w, h]] of Object.entries(REGIONS)) {
  const region = crop(sheet, x, y, w, h)
  let fill = null
  if (name === 'hpbar') fill = clearHpFill(region)
  if (name === 'cursor') clearWhiteMatte(region)
  const out = scale(region, SCALE)
  writeFileSync(new URL(`${name}.png`, ASSETS), encodePng(out.width, out.height, out.data))
  report[name] = { width: out.width, height: out.height }
  if (fill) {
    report[name].fill = {
      x: fill.x * SCALE,
      y: fill.y * SCALE,
      width: fill.width * SCALE,
      height: fill.height * SCALE,
    }
  }
  console.log(`wrote src/assets/frlg/${name}.png ${out.width}x${out.height}`)
}

writeFileSync(MANIFEST, `${JSON.stringify({ scale: SCALE, ...report }, null, 2)}\n`)
console.log('wrote src/data/frlg/battle-ui.json')
