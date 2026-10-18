// Draws the game's UI chrome: the two nine-slice window skins and the
// modernised bitmap font, plus the JSON the runtime reads through
// `src/ui/frlg.ts` and `src/ui/frlgFont.ts`.
//
// Source: the committed FRLG set (`src/assets/frlg/window.png`,
// `src/assets/frlg/font.png` and `src/data/frlg/font.json`) — the frames whose
// outer shape and baked content insets the drawn set keeps, so no scene's
// layout moves. The pixels are drawn here with the repo's own codec (hard
// pixels, no antialiasing) as one dark translucent glass card: a `#10161f`
// surface under a 1px `rgba(255,255,255,0.16)` hairline, a 1px `#000000`
// shadow ring hugging the card's own edge, an inset top highlight and an 11px
// corner on both skins. The ring tones are written pre-composited over the
// surface, because the skin carries the surface as its field and
// `addFrlgWindow` applies the skin's alpha once. The light menu window and the
// battle box share the card; only the box is denser (0.8 against 0.72). It
// reads nothing outside the committed tree, so it needs no argument and no
// environment.
//
// Output: src/assets/ui/{window,textbox,font}.png, src/data/ui/chrome.json and
// src/data/ui/font.json. Exposed as `npm run data:ui`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 4

const TOKENS = {
  surface: '#10161f',
  ink: '#f8fafc',
  muted: '#94a3b8',
  accent: '#7dd3fc',
  badgeInk: '#10161f',
  positive: '#4ad15c',
  negative: '#f87171',
  hairline: { colour: '#ffffff', alpha: 0.16 },
  highlight: { colour: '#ffffff', alpha: 0.14 },
  shadow: { colour: '#000000', alpha: 0.35 },
  row: {
    fill: { colour: '#ffffff', alpha: 0.06 },
    stroke: { colour: '#ffffff', alpha: 0.1 },
  },
  selected: {
    fill: { colour: '#7dd3fc', alpha: 0.16 },
    stroke: { colour: '#7dd3fc', alpha: 1 },
  },
  track: { colour: '#ffffff', alpha: 0.12 },
}

const WINDOW = {
  width: 96,
  height: 96,
  corner: 11,
  padding: { x: 20, top: 16, bottom: 8 },
  alpha: 0.72,
}
const TEXTBOX = {
  width: 128,
  height: 128,
  corner: 11,
  padding: { x: 36, top: 28, bottom: 28 },
  alpha: 0.8,
}

const BASE_FONT_ATLAS = new URL('../../src/assets/frlg/font.png', import.meta.url)
const BASE_FONT_MANIFEST = new URL('../../src/data/frlg/font.json', import.meta.url)
const ASSETS = new URL('../../src/assets/ui/', import.meta.url)
const DATA = new URL('../../src/data/ui/', import.meta.url)

const FONT_INK = [255, 255, 255]
const FONT_SHADOW = [96, 96, 96]
const FONT_HALO_ALPHA = 128

function hexChannels(hex) {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

// A tone as the packer writes it: the tone's own colour composited over the
// surface it stands on, so a nine-slice's opaque pixels carry the composite at
// the alpha the tone stands for.
function over(tone, surface) {
  const fg = hexChannels(tone.colour)
  const alpha = tone.alpha
  return surface.map((channel, i) => Math.round(fg[i] * alpha + channel * (1 - alpha)))
}

const SURFACE = hexChannels(TOKENS.surface)
const HAIRLINE = over(TOKENS.hairline, SURFACE)
const HIGHLIGHT = over(TOKENS.highlight, SURFACE)
const SHADOW = over(TOKENS.shadow, SURFACE)

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
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
// message box is ~800px wide on a 128px texture). The band's top is where the
// card's inset highlight row lands: 11 on both skins.
function frameBand(spec) {
  return {
    x: Math.min(spec.padding.x, spec.corner),
    top: Math.min(spec.padding.top, spec.corner),
    bottom: Math.min(spec.padding.bottom, spec.corner),
  }
}

// The card, from the outside in: a 1px shadow ring on the rounded shape's own
// edge, a 1px hairline ring just inside it, the surface beyond, and the inset
// highlight row at the frame band's top.
function drawChrome(spec) {
  const { width, height, corner } = spec
  const band = frameBand(spec)
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inRounded(x, y, width, height, 0, corner)) continue
      let colour = SURFACE
      if (!inRounded(x, y, width, height, 1, corner - 1)) {
        colour = SHADOW
      } else if (!inRounded(x, y, width, height, 2, corner - 2)) {
        colour = HAIRLINE
      } else if (y === band.top) {
        colour = HIGHLIGHT
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

// The glyph shadow becomes a half-alpha black halo, so light ink reads over a
// busy route.
function moderniseFont(atlas) {
  const data = Buffer.from(atlas.data)
  let shadows = 0
  for (let i = 0; i < data.length; i += 4) {
    const colour = [data[i], data[i + 1], data[i + 2]]
    if (data[i + 3] === 255 && same(colour, FONT_SHADOW)) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = FONT_HALO_ALPHA
      shadows++
    }
  }
  if (shadows === 0) throw new Error('the base font atlas carries no shadow pixels')
  return data
}

mkdirSync(ASSETS, { recursive: true })
mkdirSync(DATA, { recursive: true })

const chrome = { size: SCALE, tokens: TOKENS }
for (const [name, spec] of [
  ['window', WINDOW],
  ['textbox', TEXTBOX],
]) {
  const data = drawChrome(spec)
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
