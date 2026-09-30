// Slices the FireRed/LeafGreen window frames used by the menus and HUD out of
// sprite-sources/frlg-ui/hpbars-menu.png and upscales them 4x (nearest) so the
// 240x160-era chrome fits the 1280x800 canvas. Outputs the committed
// src/assets/frlg/window.png (the light menu window) and textbox.png (the navy
// battle message box), drawn as Phaser nine-slices by src/ui/frlg.ts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 4

// [x, y, w, h] in hpbars-menu.png source pixels.
const REGIONS = {
  window: [298, 6, 158, 42],
  textbox: [296, 56, 242, 48],
}

const sheet = decodePng(readFileSync(new URL('../../sprite-sources/frlg-ui/hpbars-menu.png', import.meta.url)))
mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })

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

for (const [name, [x, y, w, h]] of Object.entries(REGIONS)) {
  const out = scale(crop(sheet, x, y, w, h), SCALE)
  writeFileSync(new URL(`../../src/assets/frlg/${name}.png`, import.meta.url), encodePng(out.width, out.height, out.data))
  console.log(`wrote src/assets/frlg/${name}.png ${out.width}x${out.height}`)
}
