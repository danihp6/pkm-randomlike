import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

export const TILE_SIZE = 24
export const GRID_COLS = 4
export const GRID_ROWS = 13
export const ATLAS_WIDTH = TILE_SIZE * GRID_COLS
export const ATLAS_HEIGHT = TILE_SIZE * GRID_ROWS

// Frame order — must match FRAME_* constants in src/core/tileset.ts.
export const TILE_ORDER = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => i)

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export const hex = (r, g, b, a = 255) => [r, g, b, a]

export function fill(tile, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) tile[y * TILE_SIZE + x] = color
}

export function put(tile, x, y, color) {
  if (x >= 0 && x < TILE_SIZE && y >= 0 && y < TILE_SIZE) tile[y * TILE_SIZE + x] = color
}

export function mix(a, b, t) {
  const aAlpha = a[3] ?? 255
  const bAlpha = b[3] ?? 255
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(aAlpha + (bAlpha - aAlpha) * t),
  ]
}

function baseFloor(rand) {
  const tile = new Array(TILE_SIZE * TILE_SIZE)
  const floor = hex(0x6f, 0x6b, 0x5e)
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = (rand() - 0.5) * 18
      tile[y * TILE_SIZE + x] = mix(floor, [255, 255, 255], n / 255).map(Math.round)
    }
  return tile
}

function border(tile) {
  for (let x = 0; x < TILE_SIZE; x++) {
    put(tile, x, 0, hex(0x1f, 0x21, 0x26))
    put(tile, x, TILE_SIZE - 1, hex(0x1f, 0x21, 0x26))
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    put(tile, 0, y, hex(0x1f, 0x21, 0x26))
    put(tile, TILE_SIZE - 1, y, hex(0x1f, 0x21, 0x26))
  }
}

function floorTile(rand) {
  const tile = baseFloor(rand)
  for (let y = 2; y < TILE_SIZE - 2; y++)
    for (let x = 2; x < TILE_SIZE - 2; x++)
      if (rand() < 0.04) tile[y * TILE_SIZE + x] = hex(0x52, 0x4f, 0x45)
  border(tile)
  return tile
}

function floorTileAlt1(rand) {
  const tile = baseFloor(rand)
  const pebble = hex(0x86, 0x81, 0x70)
  const pebbleDark = hex(0x45, 0x42, 0x39)
  for (let cluster = 0; cluster < 3; cluster++) {
    const cx = 3 + Math.floor(rand() * (TILE_SIZE - 6))
    const cy = 3 + Math.floor(rand() * (TILE_SIZE - 6))
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (rand() < 0.6) put(tile, cx + dx, cy + dy, rand() < 0.5 ? pebble : pebbleDark)
  }
  border(tile)
  return tile
}

function floorTileAlt2(rand) {
  const tile = baseFloor(rand)
  const crack = hex(0x3d, 0x3a, 0x32)
  for (let i = 0; i < 2; i++) {
    let x = 3 + Math.floor(rand() * (TILE_SIZE - 6))
    let y = 3 + Math.floor(rand() * (TILE_SIZE - 6))
    const steps = 5 + Math.floor(rand() * 4)
    for (let s = 0; s < steps; s++) {
      put(tile, x, y, crack)
      x += Math.round(rand() * 2 - 1)
      y += Math.round(rand() * 2 - 1)
    }
  }
  border(tile)
  return tile
}

function wallTile(rand) {
  const tile = baseFloor(rand)
  const brick = hex(0x6b, 0x72, 0x80)
  const brickLight = hex(0x8a, 0x93, 0xa5)
  const brickDark = hex(0x4b, 0x55, 0x63)
  const mortar = hex(0x3a, 0x3f, 0x4b)
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const row = Math.floor(y / 6)
      const offset = row % 2 ? 4 : 0
      const inMortar = y % 6 >= 5 || (x + offset) % 8 >= 7
      if (inMortar) {
        tile[y * TILE_SIZE + x] = mortar
      } else {
        const relY = y % 6
        const shade = relY === 0 ? brickLight : relY === 4 ? brickDark : brick
        tile[y * TILE_SIZE + x] = shade
      }
    }
  border(tile)
  return tile
}

// Draws the base wall brick, then brightens whichever sides face open floor
// so the wall reads as an edge/corner from that direction. `sides` picks
// which of {n,e,s,w} get the highlight — 0 sides = plain interior wall.
function wallEdgeTile(rand, sides) {
  const tile = wallTile(rand)
  const glow = hex(0xc7, 0xd2, 0xe0)
  if (sides.n) for (let x = 1; x < TILE_SIZE - 1; x++) put(tile, x, 1, glow)
  if (sides.s) for (let x = 1; x < TILE_SIZE - 1; x++) put(tile, x, TILE_SIZE - 2, glow)
  if (sides.w) for (let y = 1; y < TILE_SIZE - 1; y++) put(tile, 1, y, glow)
  if (sides.e) for (let y = 1; y < TILE_SIZE - 1; y++) put(tile, TILE_SIZE - 2, y, glow)
  return tile
}

// Inner (concave) corner: both cardinal neighbors on that side are open
// floor, but the diagonal between them is still wall — the "inside" hinge
// of an L-shaped room/corridor junction. Drawn as plain wall brick with a
// small glow notch at the diagonal pixel, distinct from wallEdgeTile's
// full-side highlight (see the shared comment there).
function wallInnerCornerTile(rand, corner) {
  const tile = wallTile(rand)
  const glow = hex(0xc7, 0xd2, 0xe0)
  const x = corner.includes('w') ? 1 : TILE_SIZE - 2
  const y = corner.includes('n') ? 1 : TILE_SIZE - 2
  put(tile, x, y, glow)
  put(tile, x + (corner.includes('w') ? 1 : -1), y, glow)
  put(tile, x, y + (corner.includes('n') ? 1 : -1), glow)
  return tile
}

// Diagonal-only corner: no cardinal neighbor is open, just one diagonal —
// a plain rectangular room's outer ring corner. Same wall brick as
// wallInnerCornerTile but with just a single glow pixel at the corner
// point, since only that one diagonal pixel is actually open.
function wallDiagonalCornerTile(rand, corner) {
  const tile = wallTile(rand)
  const glow = hex(0xc7, 0xd2, 0xe0)
  const x = corner.includes('w') ? 0 : TILE_SIZE - 1
  const y = corner.includes('n') ? 0 : TILE_SIZE - 1
  put(tile, x, y, glow)
  return tile
}

// Stairs are drawn from the shared common atlas at render time (see
// core/tileset.ts's commonFrames / TileMapRenderer.draw) instead of being
// baked into each biome atlas, so this frame is left fully transparent.
function blankTile() {
  return new Array(TILE_SIZE * TILE_SIZE).fill(hex(0x00, 0x00, 0x00, 0))
}

function waterTile(rand) {
  const tile = new Array(TILE_SIZE * TILE_SIZE)
  const water = hex(0x1d, 0x6f, 0x8e)
  for (let y = 0; y < TILE_SIZE; y++)
    for (let x = 0; x < TILE_SIZE; x++) {
      const n = (rand() - 0.5) * 24
      tile[y * TILE_SIZE + x] = mix(water, [255, 255, 255], n / 255).map(Math.round)
    }
  border(tile)
  return tile
}

// Same edge/corner-highlight approach as wallEdgeTile, but a bright foam
// line on the sides facing open floor instead of a wall's mortar glow —
// see the shared comment on wallEdgeTile.
function waterEdgeTile(rand, sides) {
  const tile = waterTile(rand)
  const foam = hex(0xd6, 0xf3, 0xf9)
  if (sides.n) for (let x = 1; x < TILE_SIZE - 1; x++) put(tile, x, 1, foam)
  if (sides.s) for (let x = 1; x < TILE_SIZE - 1; x++) put(tile, x, TILE_SIZE - 2, foam)
  if (sides.w) for (let y = 1; y < TILE_SIZE - 1; y++) put(tile, 1, y, foam)
  if (sides.e) for (let y = 1; y < TILE_SIZE - 1; y++) put(tile, TILE_SIZE - 2, y, foam)
  return tile
}

function waterInnerCornerTile(rand, corner) {
  const tile = waterTile(rand)
  const foam = hex(0xd6, 0xf3, 0xf9)
  const x = corner.includes('w') ? 1 : TILE_SIZE - 2
  const y = corner.includes('n') ? 1 : TILE_SIZE - 2
  put(tile, x, y, foam)
  put(tile, x + (corner.includes('w') ? 1 : -1), y, foam)
  put(tile, x, y + (corner.includes('n') ? 1 : -1), foam)
  return tile
}

function waterDiagonalCornerTile(rand, corner) {
  const tile = waterTile(rand)
  const foam = hex(0xd6, 0xf3, 0xf9)
  const x = corner.includes('w') ? 0 : TILE_SIZE - 1
  const y = corner.includes('n') ? 0 : TILE_SIZE - 1
  put(tile, x, y, foam)
  return tile
}

const DRAWERS = [
  floorTile,
  floorTileAlt1,
  floorTileAlt2,
  blankTile,
  blankTile,
  blankTile,
  blankTile,
  (rand) => wallEdgeTile(rand, {}),
  (rand) => wallEdgeTile(rand, { n: true }),
  (rand) => wallEdgeTile(rand, { e: true }),
  (rand) => wallEdgeTile(rand, { s: true }),
  (rand) => wallEdgeTile(rand, { w: true }),
  (rand) => wallEdgeTile(rand, { n: true, e: true }),
  (rand) => wallEdgeTile(rand, { n: true, w: true }),
  (rand) => wallEdgeTile(rand, { s: true, e: true }),
  (rand) => wallEdgeTile(rand, { s: true, w: true }),
  (rand) => wallInnerCornerTile(rand, 'ne'),
  (rand) => wallInnerCornerTile(rand, 'nw'),
  (rand) => wallInnerCornerTile(rand, 'se'),
  (rand) => wallInnerCornerTile(rand, 'sw'),
  (rand) => wallDiagonalCornerTile(rand, 'ne'),
  (rand) => wallDiagonalCornerTile(rand, 'nw'),
  (rand) => wallDiagonalCornerTile(rand, 'se'),
  (rand) => wallDiagonalCornerTile(rand, 'sw'),
  (rand) => waterEdgeTile(rand, {}),
  (rand) => waterEdgeTile(rand, { n: true }),
  (rand) => waterEdgeTile(rand, { e: true }),
  (rand) => waterEdgeTile(rand, { s: true }),
  (rand) => waterEdgeTile(rand, { w: true }),
  (rand) => waterEdgeTile(rand, { n: true, e: true }),
  (rand) => waterEdgeTile(rand, { n: true, w: true }),
  (rand) => waterEdgeTile(rand, { s: true, e: true }),
  (rand) => waterEdgeTile(rand, { s: true, w: true }),
  (rand) => waterInnerCornerTile(rand, 'ne'),
  (rand) => waterInnerCornerTile(rand, 'nw'),
  (rand) => waterInnerCornerTile(rand, 'se'),
  (rand) => waterInnerCornerTile(rand, 'sw'),
  (rand) => waterDiagonalCornerTile(rand, 'ne'),
  (rand) => waterDiagonalCornerTile(rand, 'nw'),
  (rand) => waterDiagonalCornerTile(rand, 'se'),
  (rand) => waterDiagonalCornerTile(rand, 'sw'),
  floorTileAlt1,
  floorTileAlt2,
  floorTile,
  (rand) => wallEdgeTile(rand, { n: true, s: true }),
  (rand) => wallEdgeTile(rand, { e: true, w: true }),
  (rand) => wallEdgeTile(rand, { e: true, s: true, w: true }),
  (rand) => wallEdgeTile(rand, { n: true, s: true, w: true }),
  (rand) => wallEdgeTile(rand, { n: true, e: true, w: true }),
  (rand) => wallEdgeTile(rand, { n: true, e: true, s: true }),
  (rand) => wallEdgeTile(rand, { n: true, e: true, s: true, w: true }),
  blankTile,
]

export function buildAtlas(seed = 42) {
  const rand = mulberry32(seed)
  const atlas = new Array(ATLAS_WIDTH * ATLAS_HEIGHT)
  for (let frame = 0; frame < TILE_ORDER.length; frame++) {
    const col = frame % GRID_COLS
    const row = Math.floor(frame / GRID_COLS)
    const tile = DRAWERS[TILE_ORDER[frame]](rand)
    for (let ty = 0; ty < TILE_SIZE; ty++)
      for (let tx = 0; tx < TILE_SIZE; tx++)
        atlas[(row * TILE_SIZE + ty) * ATLAS_WIDTH + col * TILE_SIZE + tx] =
          tile[ty * TILE_SIZE + tx]
  }
  for (let frame = TILE_ORDER.length; frame < GRID_COLS * GRID_ROWS; frame++) {
    const col = frame % GRID_COLS
    const row = Math.floor(frame / GRID_COLS)
    for (let ty = 0; ty < TILE_SIZE; ty++)
      for (let tx = 0; tx < TILE_SIZE; tx++)
        atlas[(row * TILE_SIZE + ty) * ATLAS_WIDTH + col * TILE_SIZE + tx] = hex(0x00, 0x00, 0x00, 0)
  }
  const flat = Buffer.alloc(atlas.length * 4)
  for (let i = 0; i < atlas.length; i++) {
    const c = atlas[i]
    flat[i * 4] = c[0]
    flat[i * 4 + 1] = c[1]
    flat[i * 4 + 2] = c[2]
    flat[i * 4 + 3] = c[3]
  }
  return { width: ATLAS_WIDTH, height: ATLAS_HEIGHT, data: flat }
}

function verify(png) {
  const sig = png.subarray(0, 8)
  if (!sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    throw new Error('bad signature')
  const idat = []
  let off = 8
  let width = 0
  let height = 0
  while (off < png.length) {
    const len = png.readUInt32BE(off)
    const type = png.subarray(off + 4, off + 8).toString('ascii')
    const data = png.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  if (raw.length !== (width * 4 + 1) * height) throw new Error('bad raw length')
}

const outDir = new URL('../src/assets/', import.meta.url)
mkdirSync(outDir, { recursive: true })
const { width, height, data } = buildAtlas()
const png = encodePng(width, height, data)
verify(png)
writeFileSync(new URL('tileset.png', outDir), png)
console.log(`wrote src/assets/tileset.png ${width}x${height} (${png.length} bytes)`)
