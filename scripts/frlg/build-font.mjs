// Packs the FireRed/LeafGreen bitmap font for the 1280x800 canvas.
//
// Source: sprite-sources/frlg-ui/fonts/latin_normal.png (256x512, the pre-
// rendered glyph sheet: 16x16 cells, byte N at column N%16 / row N/16) and its
// companion charmap.txt, which maps each Latin character to its byte. The
// rip paints glyphs as a dark letter (56,56,56) with a one-pixel grey shadow
// (216,216,216) on a flat blue background; this script keys the blue and the
// sheet's white padding to transparent, keeps the letter white and the shadow
// mid-grey (so a BitmapText tint can recolour light-on-dark or dark-on-light),
// and upscales 2x with nearest so the strokes land on even canvas pixels.
//
// Output: src/assets/frlg/font.png (the atlas) and src/data/frlg/font.json
// (glyph metrics + atlas size), read at runtime by src/ui/frlgFont.ts.
// Local-only art — see docs/art-direction.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SCALE = 2
const CELL = 16
const COLS = 16
const LINE_HEIGHT = CELL
const SPACE_ADVANCE = 4
const MIN_ADVANCE = 3

const BLUE = [144, 200, 255]
const WHITE = [255, 255, 255]
const GREY = [216, 216, 216]
const DARK = [56, 56, 56]

const SOURCE = new URL('../../sprite-sources/frlg-ui/fonts/latin_normal.png', import.meta.url)
const CHARMAP = new URL('../../sprite-sources/frlg-ui/fonts/charmap.txt', import.meta.url)
const ATLAS = new URL('../../src/assets/frlg/font.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/font.json', import.meta.url)

function same(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

// charmap.txt: `'A' = BB`, one line per glyph, until the Japanese sections.
// Named macros (`PKMN = 53 54`) and the two-byte escapes (`'\n' = FE`) are
// dropped: the game only needs the single-byte Latin glyphs, plus the four
// arrow names the sheet spells out instead of quoting.
const NAMED_GLYPHS = {
  UP_ARROW: '↑',
  DOWN_ARROW: '↓',
  LEFT_ARROW: '←',
  RIGHT_ARROW: '→',
};

function parseCharmap(text) {
  const entries = new Map()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '@ Hiragana') break
    if (line.startsWith('@') || line === '') continue
    const named = /^([A-Z_0-9]+)\s*=\s*([0-9A-Fa-f]{2})$/.exec(line)
    if (named && NAMED_GLYPHS[named[1]]) {
      entries.set(NAMED_GLYPHS[named[1]].codePointAt(0), parseInt(named[2], 16))
      continue
    }
    const match = /^'(.*)'\s*=\s*([0-9A-Fa-f]{2})\s*(?:@.*)?$/.exec(line)
    if (!match) continue
    const char = match[1] === "\\'" ? "'" : match[1]
    if (char.length !== 1) continue
    entries.set(char.codePointAt(0), parseInt(match[2], 16))
  }
  return entries
}

const sheet = decodePng(readFileSync(SOURCE))
if (sheet.width !== COLS * CELL || sheet.height % CELL !== 0) {
  throw new Error(`unexpected font sheet ${sheet.width}x${sheet.height}`)
}

const pixelAt = (x, y) => {
  const o = (y * sheet.width + x) * 4
  return [sheet.data[o], sheet.data[o + 1], sheet.data[o + 2]]
}

// Recolour to a tint-friendly two-tone: letter white, shadow grey, everything
// else clear.
const mapped = Buffer.alloc(sheet.width * sheet.height * 4)
let unknown = 0
for (let i = 0; i < sheet.width * sheet.height; i++) {
  const colour = [sheet.data[i * 4], sheet.data[i * 4 + 1], sheet.data[i * 4 + 2]]
  const o = i * 4
  if (same(colour, BLUE) || same(colour, WHITE)) {
    mapped[o] = 0
    mapped[o + 1] = 0
    mapped[o + 2] = 0
    mapped[o + 3] = 0
  } else if (same(colour, GREY)) {
    mapped[o] = 96
    mapped[o + 1] = 96
    mapped[o + 2] = 96
    mapped[o + 3] = 255
  } else if (same(colour, DARK)) {
    mapped[o] = 255
    mapped[o + 1] = 255
    mapped[o + 2] = 255
    mapped[o + 3] = 255
  } else {
    unknown++
    mapped[o] = 255
    mapped[o + 1] = 255
    mapped[o + 2] = 255
    mapped[o + 3] = 255
  }
}
if (unknown > 0) console.warn(`${unknown} pixels with an unexpected colour were treated as letter ink`)

function scale2x(image) {
  const width = image.width * SCALE
  const height = image.height * SCALE
  const data = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (Math.floor(y / SCALE) * image.width + Math.floor(x / SCALE)) * 4
      const to = (y * width + x) * 4
      data[to] = image.data[from]
      data[to + 1] = image.data[from + 1]
      data[to + 2] = image.data[from + 2]
      data[to + 3] = image.data[from + 3]
    }
  }
  return { width, height, data }
}

const atlas = scale2x({ width: sheet.width, height: sheet.height, data: mapped })

function inkBounds(byte) {
  const cx = (byte % COLS) * CELL
  const cy = Math.floor(byte / COLS) * CELL
  let minX = CELL
  let maxX = -1
  let minY = CELL
  let maxY = -1
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (mapped[((cy + y) * sheet.width + cx + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY }
}

const entries = parseCharmap(readFileSync(CHARMAP, 'utf8'))
const glyphs = []
const missing = []
for (const [code, byte] of [...entries.entries()].sort((a, b) => a[0] - b[0])) {
  const bounds = inkBounds(byte)
  if (!bounds) {
    if (code === 32) {
      glyphs.push({ code, x: 0, y: 0, width: 0, height: 0, xAdvance: SPACE_ADVANCE * SCALE })
      continue
    }
    missing.push(code)
    continue
  }
  // Each glyph is cropped from its cell's top-left so the pen origin and the
  // glyph baseline stay put; the cell's trailing blank columns are dropped and
  // the ink width (plus a floor for the one-pixel letters) becomes the advance.
  const width = bounds.maxX + 1
  glyphs.push({
    code,
    x: (byte % COLS) * CELL * SCALE,
    y: Math.floor(byte / COLS) * CELL * SCALE,
    width: width * SCALE,
    height: CELL * SCALE,
    xAdvance: Math.max(width, MIN_ADVANCE) * SCALE,
  })
}
if (missing.length > 0) {
  console.warn(`${missing.length} mapped characters have no ink: ${missing.map((c) => String.fromCharCode(c)).join(' ')}`)
}

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(atlas.width, atlas.height, atlas.data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      name: 'FRLG',
      scale: SCALE,
      size: LINE_HEIGHT * SCALE,
      lineHeight: LINE_HEIGHT * SCALE,
      base: 14 * SCALE,
      atlas: { width: atlas.width, height: atlas.height },
      glyphs,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `wrote src/assets/frlg/font.png ${atlas.width}x${atlas.height} and src/data/frlg/font.json (${glyphs.length} glyphs)`,
)
