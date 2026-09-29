import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { encodePng } from './generate-tileset.mjs'

export const SPRITE_SIZE = 32
// Placeholders always emit exactly 2 frames per anim (idle/walk/attack/
// special/hurt) — they don't need per-species variable frame counts like
// real extracted sprites do (scripts/extract-real-sprites.mjs), since the
// art is procedural and direction-agnostic anyway. Species with a real
// PMDCollab pack get their placeholder files overwritten by that script.
const SPRITE_COLS = 10
// Down/DownRight/Up/UpRight/Left direction rows per pokedex id — keep in
// sync with the ROW_INDEX layout in src/entities/pokemon-sprite.ts and the
// row mapping in extract-real-sprites.mjs. Right/UpLeft/DownLeft aren't
// stored; they're Left/UpRight/DownRight flipped horizontally at render
// time. Placeholders don't need to look directionally distinct, so all 5
// rows reuse the same procedural art.
const DIRECTIONS = ['down', 'downright', 'up', 'upright', 'left']
const S = SPRITE_SIZE / 16

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
  if (x >= 0 && x < SPRITE_SIZE && y >= 0 && y < SPRITE_SIZE)
    tile[y * SPRITE_SIZE + x] = color
}

// `shiftX` leans/knocks the whole body sideways (in S-pixel units) for
// attack lunges and hurt recoil; `tint` mixes the body color toward white
// for special-move glow / hurt flinch. Direction-agnostic like the rest of
// this placeholder art (see DIRECTIONS comment above).
function bodyTile(bodyColor, { bob = 0, blink = false, step = 0, shiftX = 0, tint = 0 } = {}) {
  const color = tint > 0 ? mix(bodyColor, hex(0xff, 0xff, 0xff), tint) : bodyColor
  const tile = new Array(SPRITE_SIZE * SPRITE_SIZE).fill(hex(0, 0, 0, 0))
  const outline = mix(color, hex(0x20, 0x20, 0x20), 0.5)
  const belly = mix(color, hex(0xff, 0xff, 0xff), 0.35)
  const eye = hex(0x20, 0x1d, 0x1d)
  const eyeLight = hex(0xff, 0xff, 0xff)
  const shadow = hex(0x00, 0x00, 0x00, 70)
  const foot = mix(color, hex(0x00, 0x00, 0x00), 0.35)
  const bobPx = bob * S
  const ox = shiftX * S

  for (let x = 3 * S + ox; x <= 12 * S + ox; x++) put(tile, x, 14 * S, shadow)

  const cx = 8 * S + ox
  const cy = 9 * S + bobPx
  const rx = 5.2 * S
  const ry = 4.8 * S
  for (let y = 0; y < SPRITE_SIZE; y++)
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (d <= 1) put(tile, x, y, color)
      else if (d <= 1.4) put(tile, x, y, outline)
    }

  for (let y = 9 * S + bobPx; y < 14 * S; y++)
    for (let x = 5 * S + ox; x <= 10 * S + ox; x++) {
      const d = ((x - 7.5 * S - ox) / (3 * S)) ** 2 + ((y - 11 * S - bobPx) / (2.2 * S)) ** 2
      if (d <= 1) put(tile, x, y, belly)
    }

  const eyeY = 7 * S + bobPx
  if (blink) {
    for (let x = 4 * S + ox; x <= 6 * S + ox; x++) put(tile, x, eyeY, outline)
    for (let x = 9 * S + ox; x <= 11 * S + ox; x++) put(tile, x, eyeY, outline)
  } else {
    for (let dy = 0; dy < S; dy++)
      for (let dx = 0; dx < S; dx++) {
        put(tile, 5 * S + ox + dx, eyeY + dy, eyeLight)
        put(tile, 10 * S + ox + dx, eyeY + dy, eyeLight)
        put(tile, 5 * S + ox + dx, eyeY + S + dy, eye)
        put(tile, 10 * S + ox + dx, eyeY + S + dy, eye)
      }
  }

  const footY = 12 * S + bobPx
  const paw = (px, py) => {
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(tile, px + dx, py + dy, foot)
  }
  if (step === 0) {
    paw(5 * S + ox, footY)
    paw(6 * S + ox, footY)
    paw(9 * S + ox, footY - S)
    paw(10 * S + ox, footY - S)
  } else {
    paw(5 * S + ox, footY - S)
    paw(6 * S + ox, footY - S)
    paw(9 * S + ox, footY)
    paw(10 * S + ox, footY)
  }
  return tile
}

// Column layout for a placeholder species' 5-row strip — matches the
// manifest written alongside it. Keep in sync with the anim-key set in
// src/entities/pokemon-sprite-manifest.ts.
const ANIM_MANIFEST = {
  idle: { start: 0, count: 2 },
  walk: { start: 2, count: 2 },
  attack: { start: 4, count: 2 },
  special: { start: 6, count: 2 },
  hurt: { start: 8, count: 2 },
}

const pokedex = JSON.parse(
  readFileSync(new URL('../src/entities/pokedex.json', import.meta.url), 'utf8'),
)

const outDir = new URL('../src/assets/pokemon/', import.meta.url)
mkdirSync(outDir, { recursive: true })

const width = SPRITE_COLS * SPRITE_SIZE
const height = DIRECTIONS.length * SPRITE_SIZE

for (const entry of pokedex) {
  const [r, g, b] = TYPE_COLORS[entry.types[0]] ?? TYPE_COLORS.normal
  const bodyColor = hex(r, g, b)
  const strip = new Array(width * height).fill(hex(0, 0, 0, 0))

  DIRECTIONS.forEach((_dir, dirIndex) => {
    const frames = [
      bodyTile(bodyColor), // idle0
      bodyTile(bodyColor, { blink: true }), // idle1
      bodyTile(bodyColor, { bob: -1, step: 0 }), // walk0
      bodyTile(bodyColor, { bob: 1, step: 1 }), // walk1
      bodyTile(bodyColor, { shiftX: 1 }), // attack windup
      bodyTile(bodyColor, { shiftX: 3 }), // attack impact (lunge)
      bodyTile(bodyColor, { tint: 0.3 }), // special windup (charging glow)
      bodyTile(bodyColor, { tint: 0.6, shiftX: 1 }), // special impact
      bodyTile(bodyColor, { shiftX: -2 }), // hurt0 (knockback)
      bodyTile(bodyColor, { shiftX: -3, tint: 0.25 }), // hurt1 (flinch)
    ]
    frames.forEach((tile, col) => {
      for (let ty = 0; ty < SPRITE_SIZE; ty++)
        for (let tx = 0; tx < SPRITE_SIZE; tx++)
          strip[(dirIndex * SPRITE_SIZE + ty) * width + col * SPRITE_SIZE + tx] =
            tile[ty * SPRITE_SIZE + tx]
    })
  })

  const flat = Buffer.alloc(strip.length * 4)
  for (let i = 0; i < strip.length; i++) {
    flat[i * 4] = strip[i][0]
    flat[i * 4 + 1] = strip[i][1]
    flat[i * 4 + 2] = strip[i][2]
    flat[i * 4 + 3] = strip[i][3]
  }
  const png = encodePng(width, height, flat)
  writeFileSync(new URL(`${entry.id}.png`, outDir), png)
  writeFileSync(
    new URL(`${entry.id}.json`, outDir),
    JSON.stringify({ cols: SPRITE_COLS, anims: ANIM_MANIFEST }),
  )
}

console.log(`wrote ${pokedex.length} placeholder species to src/assets/pokemon/`)
