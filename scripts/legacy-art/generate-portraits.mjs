// Builds the procedural placeholder portrait atlas (src/assets/portraits.png):
// one PORTRAIT_SIZE x PORTRAIT_SIZE "Normal" face per pokedex id, stacked in
// a single column (frame = pokedex id - 1, matching PMDCOLLAB_SPECIES' `row`
// in scripts/pmdcollab-species.mjs). Run this first, then
// scripts/extract-real-portraits.mjs to stamp real PMDCollab portrait art
// over the species it covers - same two-step pipeline as
// generate-pokemon.mjs / extract-real-sprites.mjs.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { encodePng } from './png-codec.mjs'

export const PORTRAIT_SIZE = 40

const TYPE_COLORS = {
  normal: [0xa8, 0xa8, 0x78],
  fire: [0xf0, 0x80, 0x30],
  water: [0x68, 0x90, 0xf0],
  grass: [0x78, 0xc8, 0x50],
  electric: [0xf8, 0xd0, 0x30],
  ice: [0x98, 0xd8, 0xd8],
  fighting: [0xc0, 0x30, 0x28],
  poison: [0xa0, 0x40, 0xa0],
  ground: [0xe0, 0xc0, 0x68],
  flying: [0xa8, 0x90, 0xf0],
  psychic: [0xf8, 0x58, 0x88],
  bug: [0xa8, 0xb8, 0x20],
  rock: [0xb8, 0xa0, 0x38],
  ghost: [0x70, 0x58, 0x98],
  dragon: [0x70, 0x38, 0xf8],
  dark: [0x70, 0x58, 0x48],
  steel: [0xb8, 0xb8, 0xd0],
  fairy: [0xee, 0x99, 0xac],
}

const hex = (r, g, b, a = 255) => [r, g, b, a]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ]
}

function put(tile, x, y, color) {
  if (x >= 0 && x < PORTRAIT_SIZE && y >= 0 && y < PORTRAIT_SIZE)
    tile[y * PORTRAIT_SIZE + x] = color
}

// A simple round face bust - no legs/belly, just enough to read as "this
// species' color" and not be a blank tile, same placeholder-only intent as
// generate-pokemon.mjs's bodyTile.
function faceTile(bodyColor) {
  const tile = new Array(PORTRAIT_SIZE * PORTRAIT_SIZE).fill(hex(0, 0, 0, 0))
  const outline = mix(bodyColor, hex(0x20, 0x20, 0x20), 0.5)
  const eye = hex(0x20, 0x1d, 0x1d)
  const eyeLight = hex(0xff, 0xff, 0xff)

  const cx = PORTRAIT_SIZE / 2
  const cy = PORTRAIT_SIZE / 2 + 2
  const rx = PORTRAIT_SIZE * 0.42
  const ry = PORTRAIT_SIZE * 0.4
  for (let y = 0; y < PORTRAIT_SIZE; y++)
    for (let x = 0; x < PORTRAIT_SIZE; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d <= 1) put(tile, x, y, bodyColor)
      else if (d <= 1.25) put(tile, x, y, outline)
    }

  const eyeY = cy - 4
  const eyeSize = 4
  for (const eyeX of [cx - 9, cx + 9 - eyeSize]) {
    for (let dy = 0; dy < eyeSize; dy++)
      for (let dx = 0; dx < eyeSize; dx++) {
        put(tile, eyeX + dx, eyeY + dy, dy < 2 ? eyeLight : eye)
      }
  }
  return tile
}

const pokedex = JSON.parse(
  readFileSync(new URL('../src/entities/pokedex.json', import.meta.url), 'utf8'),
)

const width = PORTRAIT_SIZE
const height = pokedex.length * PORTRAIT_SIZE
const atlas = new Array(width * height).fill(hex(0, 0, 0, 0))

pokedex.forEach((entry, index) => {
  const [r, g, b] = TYPE_COLORS[entry.types[0]] ?? TYPE_COLORS.normal
  const tile = faceTile(hex(r, g, b))
  for (let ty = 0; ty < PORTRAIT_SIZE; ty++)
    for (let tx = 0; tx < PORTRAIT_SIZE; tx++)
      atlas[(index * PORTRAIT_SIZE + ty) * width + tx] = tile[ty * PORTRAIT_SIZE + tx]
})

const flat = Buffer.alloc(atlas.length * 4)
for (let i = 0; i < atlas.length; i++) {
  flat[i * 4] = atlas[i][0]
  flat[i * 4 + 1] = atlas[i][1]
  flat[i * 4 + 2] = atlas[i][2]
  flat[i * 4 + 3] = atlas[i][3]
}

const outDir = new URL('../src/assets/', import.meta.url)
mkdirSync(outDir, { recursive: true })
const png = encodePng(width, height, flat)
writeFileSync(new URL('portraits.png', outDir), png)
console.log(`wrote src/assets/portraits.png ${width}x${height} (${png.length} bytes)`)
