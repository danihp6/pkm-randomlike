// Slices the FireRed/LeafGreen party-menu chrome used by the route HUD's PARTY
// window out of sprite-sources/frlg-ui/pokemon-menu.png (gitignored, never
// redistributed). The sheet holds two 240x160 party-menu screens plus a widget
// library; we take the teal scanline fill (the panel background tile) and one
// empty party slot frame (border + interior, no baked text), and record the
// measured geometry in src/data/frlg/party-menu.json so the scene never
// hardcodes pixel maths.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 4

// [x, y, w, h] in pokemon-menu.png source pixels.
const REGIONS = {
  // A clean run of the panel interior: the alternating teal scanlines.
  panel: [40, 30, 16, 16],
  // The first empty slot of the right-hand screen: cyan top, navy sides, no text.
  slot: [347, 16, 139, 20],
}

const SOURCE = new URL('../../sprite-sources/frlg-ui/pokemon-menu.png', import.meta.url)
const ASSETS = new URL('../../src/assets/frlg/', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/party-menu.json', import.meta.url)

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

// The panel's outer border colour, read from the screen margin so the scene
// strokes the window with the exact teal-navy the sheet uses.
function sample(img, x, y) {
  const o = (y * img.width + x) * 4
  return (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2]
}

mkdirSync(ASSETS, { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })

const panelTile = scale(crop(sheet, ...REGIONS.panel), SCALE)
writeFileSync(new URL('party-panel.png', ASSETS), encodePng(panelTile.width, panelTile.height, panelTile.data))

const slot = crop(sheet, ...REGIONS.slot)
writeFileSync(new URL('party-slot.png', ASSETS), encodePng(slot.width, slot.height, slot.data))

const border = sample(sheet, 6, 85)
const manifest = {
  scale: SCALE,
  panel: { tile: { width: panelTile.width, height: panelTile.height }, border, radius: 10 },
  slot: { width: slot.width, height: slot.height },
}
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote src/assets/frlg/party-panel.png ${panelTile.width}x${panelTile.height}`)
console.log(`wrote src/assets/frlg/party-slot.png ${slot.width}x${slot.height}`)
console.log(`border #${border.toString(16)}`)
