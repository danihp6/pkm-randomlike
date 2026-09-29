import { mkdirSync, writeFileSync } from 'node:fs'
import { encodePng, hex, put, mix, TILE_SIZE } from './generate-tileset.mjs'

export const HUD_COLS = 6
export const HUD_ROWS = 5
export const ATLAS_WIDTH = TILE_SIZE * HUD_COLS
export const ATLAS_HEIGHT = TILE_SIZE * HUD_ROWS

const transparent = hex(0, 0, 0, 0)
const borderLight = hex(0x9f, 0xb8, 0xda)
const borderDark = hex(0x54, 0x70, 0x97)
const panelFill = hex(0x16, 0x21, 0x30)

const lighten = (c, t = 0.35) => mix(c, hex(0xff, 0xff, 0xff), t)
const darken = (c, t = 0.35) => mix(c, hex(0x00, 0x00, 0x00), t)

function makeTile() {
  return new Array(TILE_SIZE * TILE_SIZE).fill(transparent)
}

function flipX(tile) {
  const out = makeTile()
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++)
      out[y * TILE_SIZE + x] = tile[y * TILE_SIZE + (TILE_SIZE - 1 - x)]
  return out
}

function flipY(tile) {
  const out = makeTile()
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++)
      out[y * TILE_SIZE + x] = tile[(TILE_SIZE - 1 - y) * TILE_SIZE + x]
  return out
}

function barBgTile() {
  const tile = new Array(TILE_SIZE * TILE_SIZE).fill(hex(0x11, 0x1a, 0x28))
  for (let x = 0; x < TILE_SIZE; x++) {
    put(tile, x, 0, hex(0x24, 0x31, 0x45))
    put(tile, x, 1, hex(0x1a, 0x25, 0x36))
    put(tile, x, TILE_SIZE - 2, hex(0x0c, 0x13, 0x1e))
    put(tile, x, TILE_SIZE - 1, hex(0x07, 0x0c, 0x14))
  }
  return tile
}

function barFillTile(color) {
  const tile = new Array(TILE_SIZE * TILE_SIZE).fill(color)
  for (let x = 0; x < TILE_SIZE; x++) {
    put(tile, x, 0, lighten(color, 0.45))
    put(tile, x, 1, lighten(color, 0.18))
    put(tile, x, TILE_SIZE - 2, darken(color, 0.25))
    put(tile, x, TILE_SIZE - 1, darken(color, 0.45))
  }
  return tile
}

function barCapLeft() {
  const tile = makeTile()
  for (let y = 0; y < TILE_SIZE; y++) {
    put(tile, 0, y, borderLight)
    put(tile, 1, y, borderDark)
  }
  for (let x = 2; x < TILE_SIZE; x++) {
    put(tile, x, 0, borderLight)
    put(tile, x, 1, borderDark)
    put(tile, x, TILE_SIZE - 2, borderDark)
    put(tile, x, TILE_SIZE - 1, darken(borderDark, 0.6))
  }
  return tile
}

const barCapRight = () => flipX(barCapLeft())

function panelCorner() {
  const tile = new Array(TILE_SIZE * TILE_SIZE).fill(panelFill)
  for (let x = 0; x < TILE_SIZE; x++) {
    put(tile, x, 0, borderLight)
    put(tile, x, 1, borderDark)
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    put(tile, 0, y, borderLight)
    put(tile, 1, y, borderDark)
  }
  return tile
}

function panelEdge(horizontal) {
  const tile = new Array(TILE_SIZE * TILE_SIZE).fill(panelFill)
  for (let i = 0; i < TILE_SIZE; i++) {
    if (horizontal) {
      put(tile, i, 0, borderLight)
      put(tile, i, 1, borderDark)
    } else {
      put(tile, 0, i, borderLight)
      put(tile, 1, i, borderDark)
    }
  }
  return tile
}

function panelCenter() {
  return new Array(TILE_SIZE * TILE_SIZE).fill(panelFill)
}

function heartTile() {
  const tile = makeTile()
  const base = hex(0xe5, 0x3a, 0x4a)
  const light = hex(0xf7, 0x9a, 0xa4)
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const d1 = Math.hypot(x - 5.5, y - 6.5)
      const d2 = Math.hypot(x - 10.5, y - 6.5)
      if (d1 <= 4.2 || d2 <= 4.2) put(tile, x, y, base)
    }
  }
  for (let y = 9; y < 14; y++) {
    const half = 4.4 * (1 - (y - 9) / 5) + 0.6
    for (let x = 0; x < TILE_SIZE; x++) {
      if (Math.abs(x - 8) <= half) put(tile, x, y, base)
    }
  }
  put(tile, 5, 4, light)
  put(tile, 6, 4, light)
  put(tile, 5, 5, light)
  return tile
}

function appleTile() {
  const tile = makeTile()
  const skin = hex(0x7b, 0xc0, 0x43)
  const outline = hex(0x3f, 0x6d, 0x1e)
  const light = hex(0xb8, 0xe3, 0x88)
  const stem = hex(0x8a, 0x5a, 0x2b)
  const cx = 8
  const cy = 9
  const r = 5.6
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r) put(tile, x, y, skin)
      else if (d <= r + 0.8) put(tile, x, y, outline)
    }
  }
  for (let y = 2; y < 5; y++) put(tile, 8, y, stem)
  put(tile, 7, 5, light)
  put(tile, 8, 5, light)
  put(tile, 6, 6, light)
  return tile
}

function coinTile() {
  const tile = makeTile()
  const gold = hex(0xf2, 0xc8, 0x4b)
  const outline = hex(0xb8, 0x86, 0x2b)
  const dark = hex(0xd9, 0xa9, 0x2f)
  const cx = 8
  const cy = 8
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= 6.4) put(tile, x, y, outline)
      if (d <= 5.6) put(tile, x, y, gold)
      if (d <= 3.2) put(tile, x, y, dark)
    }
  }
  put(tile, 6, 5, lighten(gold, 0.4))
  put(tile, 7, 5, lighten(gold, 0.4))
  return tile
}

function stairsTile() {
  const tile = makeTile()
  const step = hex(0x94, 0xa3, 0xb8)
  const light = hex(0xb8, 0xc4, 0xd4)
  const dark = hex(0x64, 0x74, 0x8b)
  for (let s = 0; s < 4; s++) {
    const y = 3 + s * 3
    for (let x = 3 + s * 3; x < TILE_SIZE - 1; x++) {
      for (let dy = 0; dy < 3 && y + dy < TILE_SIZE - 1; dy++) {
        const c = dy === 0 ? light : dy === 2 ? dark : step
        put(tile, x, y + dy, c)
      }
    }
  }
  return tile
}

function pokeballTile() {
  const tile = makeTile()
  const red = hex(0xe5, 0x3a, 0x4a)
  const white = hex(0xea, 0xea, 0xea)
  const black = hex(0x2a, 0x2a, 0x2a)
  const cx = 8
  const cy = 8
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d > 6.4) continue
      put(tile, x, y, d > 6 ? black : y < cy ? red : white)
    }
  }
  for (let x = 3; x <= 12; x++) {
    put(tile, x, 8, black)
    put(tile, x, 7, lighten(black, 0.3))
  }
  for (let y = 6; y <= 10; y++) put(tile, 8, y, black)
  put(tile, 8, 8, hex(0xea, 0xea, 0xea))
  return tile
}

const FONT_COLS = 16
const FONT_ROWS = 6
const GLYPH_SIZE = 8
const FONT_WIDTH = GLYPH_SIZE * FONT_COLS
const FONT_HEIGHT = GLYPH_SIZE * FONT_ROWS

const FONT_GLYPHS = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  $: ['..#..', '.###.', '#..#.', '.##..', '..#.#', '###..', '..#..'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#.##.', '#..##', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.##..', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '..#..', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '*': ['.....', '#.#.#', '..#..', '#####', '..#..', '#.#.#', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['....#', '...#.', '..#..', '..#..', '.#...', '.#...', '#....'],
  '0': ['.###.', '#..#.', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '?': ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  '\\': ['#....', '.#...', '.#...', '..#..', '..#..', '...#.', '....#'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '`': ['.#...', '..#..', '.....', '.....', '.....', '.....', '.....'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#...', '.#...', '####.', '.#...', '.#...', '.#...'],
  g: ['.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '##...'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#...', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '{': ['..##.', '..#..', '..#..', '.##..', '..#..', '..#..', '..##.'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '}': ['.##..', '..#..', '..#..', '..##.', '..#..', '..#..', '.##..'],
  '~': ['.#..#', '#.##.', '.....', '.....', '.....', '.....', '.....'],
}

function buildFontAtlas() {
  const atlas = new Array(FONT_WIDTH * FONT_HEIGHT).fill(transparent)
  const white = hex(0xff, 0xff, 0xff)
  const glyph = (index) => {
    const char = String.fromCharCode(index + 0x20)
    const rows = FONT_GLYPHS[char]
    const fillRows = rows ?? ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####']
    const gx = (index % FONT_COLS) * GLYPH_SIZE
    const gy = Math.floor(index / FONT_COLS) * GLYPH_SIZE
    for (let r = 0; r < 7; r++) {
      const row = fillRows[r]
      for (let c = 0; c < 5; c++) {
        if (row[c] !== '#') continue
        const x = gx + 1 + c
        const y = gy + r
        atlas[y * FONT_WIDTH + x] = white
      }
    }
  }
  for (let index = 0; index < FONT_COLS * FONT_ROWS; index++) glyph(index)
  return atlas
}

function buildHudAtlas() {
  const atlas = new Array(ATLAS_WIDTH * ATLAS_HEIGHT).fill(transparent)
  const place = (frame, tile) => {
    const col = frame % HUD_COLS
    const row = Math.floor(frame / HUD_COLS)
    for (let ty = 0; ty < TILE_SIZE; ty++)
      for (let tx = 0; tx < TILE_SIZE; tx++)
        atlas[(row * TILE_SIZE + ty) * ATLAS_WIDTH + col * TILE_SIZE + tx] =
          tile[ty * TILE_SIZE + tx]
  }

  const hpGreen = hex(0x3f, 0xca, 0x5e)
  const hpYellow = hex(0xf5, 0xc5, 0x42)
  const hpRed = hex(0xef, 0x44, 0x44)
  const bellyOrange = hex(0xf5, 0x9e, 0x0b)

  place(0, barCapLeft())
  place(1, barFillTile(hpGreen))
  place(2, barFillTile(hpYellow))
  place(3, barFillTile(hpRed))
  place(4, barCapRight())
  place(5, barBgTile())

  place(6, barCapLeft())
  place(7, barFillTile(bellyOrange))
  place(8, barFillTile(hpRed))
  place(9, barCapRight())
  place(10, barBgTile())

  place(12, panelCorner())
  place(13, panelEdge(true))
  place(14, flipX(panelCorner()))
  place(15, panelEdge(false))
  place(16, panelCenter())
  place(17, flipX(panelEdge(false)))

  place(18, flipY(panelCorner()))
  place(19, flipY(panelEdge(true)))
  place(20, flipX(flipY(panelCorner())))
  place(21, heartTile())
  place(22, appleTile())
  place(23, coinTile())

  place(24, stairsTile())
  place(25, pokeballTile())
  return atlas
}

function flatten(atlas, width, height) {
  const flat = Buffer.alloc(atlas.length * 4)
  for (let i = 0; i < atlas.length; i++) {
    const c = atlas[i]
    flat[i * 4] = c[0]
    flat[i * 4 + 1] = c[1]
    flat[i * 4 + 2] = c[2]
    flat[i * 4 + 3] = c[3]
  }
  return flat
}

const outDir = new URL('../src/assets/', import.meta.url)
mkdirSync(outDir, { recursive: true })

const hud = buildHudAtlas()
const hudPng = encodePng(ATLAS_WIDTH, ATLAS_HEIGHT, flatten(hud, ATLAS_WIDTH, ATLAS_HEIGHT))
writeFileSync(new URL('hud.png', outDir), hudPng)
console.log(`wrote src/assets/hud.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${hudPng.length} bytes)`)

const font = buildFontAtlas()
const fontPng = encodePng(FONT_WIDTH, FONT_HEIGHT, flatten(font, FONT_WIDTH, FONT_HEIGHT))
writeFileSync(new URL('font.png', outDir), fontPng)
console.log(`wrote src/assets/font.png ${FONT_WIDTH}x${FONT_HEIGHT} (${fontPng.length} bytes)`)
