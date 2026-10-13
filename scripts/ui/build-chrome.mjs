// Draws the game's UI chrome: the two nine-slice window skins and the
// modernised bitmap font, plus the JSON the runtime reads through
// `src/ui/frlg.ts` and `src/ui/frlgFont.ts`.
//
// Source: the committed FRLG set (`src/assets/frlg/window.png`,
// `src/assets/frlg/font.png` and `src/data/frlg/font.json`) — the frames whose
// outer shape and baked content insets the drawn set keeps, so no scene's
// layout moves. The pixels are drawn here with the repo's own codec (hard
// pixels, no antialiasing) in the deep-black palette that replaces the FRLG
// navy; the light menu window keeps the FRLG field's own tone because every
// text draw site inks it with the dark `FRLG_INK`, and the battle box keeps a
// deep-black field under its white message text. It reads nothing outside the
// committed tree, so it needs no argument and no environment.
//
// Output: src/assets/ui/{window,textbox,font}.png, src/data/ui/chrome.json and
// src/data/ui/font.json. Exposed as `npm run data:ui`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 4
const KEYLINE_WIDTH = 2

const BEZEL = [0x0b, 0x0b, 0x10]
const KEYLINE = [0x3a, 0x3d, 0x52]
const FIELD_DARK = [0x11, 0x12, 0x1a]
const HIGHLIGHT = [0xff, 0xff, 0xff]
const FRAME_SHADOW = [0x00, 0x00, 0x00]

const WINDOW = {
  width: 96,
  height: 96,
  corner: 20,
  padding: { x: 20, top: 16, bottom: 8 },
  alpha: 0.88,
}
const TEXTBOX = {
  width: 128,
  height: 128,
  corner: 24,
  padding: { x: 36, top: 28, bottom: 28 },
  alpha: 0.94,
}

const BASE_WINDOW = new URL('../../src/assets/frlg/window.png', import.meta.url)
const BASE_FONT_ATLAS = new URL('../../src/assets/frlg/font.png', import.meta.url)
const BASE_FONT_MANIFEST = new URL('../../src/data/frlg/font.json', import.meta.url)
const ASSETS = new URL('../../src/assets/ui/', import.meta.url)
const DATA = new URL('../../src/data/ui/', import.meta.url)

const FONT_INK = [255, 255, 255]
const FONT_SHADOW = [96, 96, 96]

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// The most frequent fully-opaque colour: the frame's own field, which the drawn
// light window keeps.
function dominantColour(image) {
  const counts = new Map()
  for (let i = 0; i < image.width * image.height; i++) {
    const o = i * 4
    if (image.data[o + 3] !== 255) continue
    const key = `${image.data[o]},${image.data[o + 1]},${image.data[o + 2]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = null
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = key.split(',').map(Number)
    }
  }
  if (!best) throw new Error('the base window has no opaque pixels')
  return best
}

// A hard-edged rounded rectangle: the pixel centre is inside when it lies
// within `radius` of the rectangle inset by `inset`.
function inRounded(x, y, width, height, inset, radius) {
  const x0 = inset
  const y0 = inset
  const x1 = width - inset
  const y1 = height - inset
  const cx = x + 0.5
  const cy = y + 0.5
  if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return false
  const nearX = Math.min(Math.max(cx, x0 + radius), x1 - radius)
  const nearY = Math.min(Math.max(cy, y0 + radius), y1 - radius)
  const dx = cx - nearX
  const dy = cy - nearY
  return dx * dx + dy * dy <= radius * radius
}

// A nine-slice only keeps its frame band fixed when the band fits inside the
// slice corner; anything beyond the corner stretches with the panel (the battle
// message box is ~800px wide on a 128px texture). The window's insets already
// fit its corner; the battle box's 36/28/28 do not, so its drawn band is clamped
// to the corner and the frozen content padding stays an inset inside the field.
function frameBand(spec) {
  return {
    x: Math.min(spec.padding.x, spec.corner),
    top: Math.min(spec.padding.top, spec.corner),
    bottom: Math.min(spec.padding.bottom, spec.corner),
  }
}

function drawChrome(spec, field, highlight) {
  const { width, height, corner } = spec
  const band = frameBand(spec)
  const data = Buffer.alloc(width * height * 4)
  const x0 = band.x
  const x1 = width - 1 - band.x
  const y0 = band.top
  const y1 = height - 1 - band.bottom
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRounded(x, y, width, height, 0, corner)) continue
      let colour = BEZEL
      if (!inRounded(x, y, width, height, 1, corner - 1)) {
        colour = FRAME_SHADOW
      } else if (
        x >= x0 - KEYLINE_WIDTH &&
        x <= x1 + KEYLINE_WIDTH &&
        y >= y0 - KEYLINE_WIDTH &&
        y <= y1 + KEYLINE_WIDTH
      ) {
        colour = KEYLINE
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
          colour = highlight !== null && y === y0 ? highlight : field
        }
      }
      const o = (y * width + x) * 4
      data[o] = colour[0]
      data[o + 1] = colour[1]
      data[o + 2] = colour[2]
      data[o + 3] = 255
    }
  }
  return data
}

function moderniseFont(atlas) {
  const data = Buffer.from(atlas.data)
  let shadows = 0
  for (let i = 0; i < data.length; i += 4) {
    const colour = [data[i], data[i + 1], data[i + 2]]
    if (data[i + 3] === 255 && same(colour, FONT_SHADOW)) {
      data[i + 3] = 128
      shadows++
    }
  }
  if (shadows === 0) throw new Error('the base font atlas carries no shadow pixels')
  return data
}

mkdirSync(ASSETS, { recursive: true })
mkdirSync(DATA, { recursive: true })

const lightField = dominantColour(decodePng(readFileSync(BASE_WINDOW)))
const chrome = { size: SCALE }
for (const [name, spec, field, highlight] of [
  ['window', WINDOW, lightField, HIGHLIGHT],
  ['textbox', TEXTBOX, FIELD_DARK, null],
]) {
  const data = drawChrome(spec, field, highlight)
  writeFileSync(new URL(`${name}.png`, ASSETS), encodePng(spec.width, spec.height, data))
  chrome[name] = {
    corner: spec.corner,
    padding: { ...spec.padding },
    alpha: spec.alpha,
    texture: { width: spec.width, height: spec.height },
  }
  console.log(`wrote src/assets/ui/${name}.png ${spec.width}x${spec.height}`)
}
writeFileSync(new URL('chrome.json', DATA), `${JSON.stringify(chrome, null, 2)}\n`)
console.log('wrote src/data/ui/chrome.json')

const baseAtlas = decodePng(readFileSync(BASE_FONT_ATLAS))
const baseManifest = JSON.parse(readFileSync(BASE_FONT_MANIFEST, 'utf8'))
if (baseAtlas.width !== baseManifest.atlas.width || baseAtlas.height !== baseManifest.atlas.height) {
  throw new Error(`the base font atlas ${baseAtlas.width}x${baseAtlas.height} and its manifest disagree`)
}
writeFileSync(
  new URL('font.png', ASSETS),
  encodePng(baseAtlas.width, baseAtlas.height, moderniseFont(baseAtlas)),
)
const fontManifest = {
  name: 'UI',
  scale: baseManifest.scale,
  size: baseManifest.size,
  lineHeight: baseManifest.lineHeight,
  base: baseManifest.base,
  atlas: { width: baseAtlas.width, height: baseAtlas.height },
  glyphs: baseManifest.glyphs,
}
writeFileSync(new URL('font.json', DATA), `${JSON.stringify(fontManifest, null, 2)}\n`)
console.log(`wrote src/assets/ui/font.png ${baseAtlas.width}x${baseAtlas.height}`)
console.log(`wrote src/data/ui/font.json (${fontManifest.glyphs.length} glyphs)`)
