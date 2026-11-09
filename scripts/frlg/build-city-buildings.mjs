// Composes the settlement buildings atlas from the buildings compendium
// `frlg/tileset-1.png` (1096x1090, ripped by fabnt, local only): one whole-house
// sprite per `BuildingKind`, so a city's building draws its own house instead of
// repeating one WALL frame and one ROOF frame (`docs/tileset-spec.md` §2b).
//
//   node scripts/frlg/build-city-buildings.mjs [buildings.png]
//
// argv[2] defaults through `assetPath`, so a dev passes an absolute path and
// nothing under the store is ever linked into the checkout (AGENTS.md, "Asset
// trees").
//
// The sheet is alpha-keyed (no magenta key needed) but it is not seamless: it
// was assembled on a 17px pitch with a 1px transparent separator between cells,
// and every cell also carries a 1px transparent row of its own. A house's rect
// crosses both, so the crop repairs them - a transparent pixel whose two
// vertical (then horizontal) neighbours are opaque takes one of them - before it
// is scaled, otherwise every house would draw with a striped roof.
//
// The build is deterministic: the same input writes a byte-identical PNG and a
// byte-identical JSON.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'
import { assetPath } from '../assets/root.mjs'

const SRC = process.argv[2] ?? assetPath('frlg/tileset-1.png')
const OUT = new URL('../../src/assets/frlg/city-buildings.png', import.meta.url)
const OUT_PATH = fileURLToPath(OUT)
const MANIFEST = new URL('../../src/data/frlg/city-buildings.json', import.meta.url)

const FRAME_W = 80
const FRAME_H = 96
const COLS = 4
const ROWS = 1

/**
 * The four houses, in frame order: the source rect in the compendium, and the
 * door's tile column inside the 5-tile-wide frame. Each rect is 80 px wide (the
 * frame's own width at the sheet's 16 px scale), centred on the house's door, and
 * its top and bottom are the house's own roof top and front-wall foot - so the
 * sprite's last row is the walkable front row the plan emits and its door art
 * lands on `door`. A new kind is one row here plus its frame in the manifest.
 */
const HOUSES = [
  { kind: 'centre', rect: [104, 17, 80, 74], door: 2 },
  { kind: 'gym', rect: [324, 32, 80, 76], door: 2 },
  { kind: 'lab', rect: [580, 134, 80, 76], door: 2 },
  { kind: 'house', rect: [18, 26, 80, 65], door: 2 },
]

const MIN_OPAQUE_COLOURS = 3
const MAX_NEAR_BLACK = 0.4

const sheet = decodePng(readFileSync(SRC))

/** One house's rect, its seams repaired and its alpha kept as the sheet has it. */
function crop([x0, y0, w, h]) {
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = ((y0 + y) * sheet.width + x0 + x) * 4
      if (from < 0 || from + 3 >= sheet.data.length) continue
      sheet.data.copy(out, (y * w + x) * 4, from, from + 4)
    }
  }
  const opaque = (index) => out[index + 3] >= 8
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      const to = (y * w + x) * 4
      if (opaque(to)) continue
      const up = ((y - 1) * w + x) * 4
      if (opaque(up) && opaque(((y + 1) * w + x) * 4)) out.copy(out, to, up, up + 4)
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      const to = (y * w + x) * 4
      if (opaque(to)) continue
      const left = (y * w + x - 1) * 4
      if (opaque(left) && opaque((y * w + x + 1) * 4)) out.copy(out, to, left, left + 4)
    }
  }
  return out
}

/** Nearest-neighbour, so the 16px art keeps its hard edges at the frame's scale. */
function scaleNearest(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw))
      const from = (sy * sw + sx) * 4
      src.copy(out, (y * dw + x) * 4, from, from + 4)
    }
  }
  return out
}

/** A flat crop means the rect slid off its house: refuse to write it (build-sign.mjs). */
function assertNotFlat(house, pixels) {
  const nearBlack = (r, g, b) => r <= 16 && g <= 16 && b <= 16
  const colours = new Set()
  let nearBlackCount = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 8) continue
    colours.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
    if (nearBlack(pixels[i], pixels[i + 1], pixels[i + 2])) nearBlackCount += 1
  }
  const share = nearBlackCount / (pixels.length / 4)
  if (colours.size < MIN_OPAQUE_COLOURS || share > MAX_NEAR_BLACK) {
    console.error(
      `build-city-buildings: flat crop for ${house.kind} at [${house.rect.join(',')}]: ` +
        `${colours.size} distinct opaque colours, ${Math.round(share * 100)} % near-black pixels ` +
        `- refusing to write src/assets/frlg/city-buildings.png`,
    )
    process.exit(1)
  }
}

const atlas = Buffer.alloc(FRAME_W * COLS * FRAME_H * ROWS * 4)
const frames = []
for (const [column, house] of HOUSES.entries()) {
  const [, , w, h] = house.rect
  const cropPixels = crop(house.rect)
  assertNotFlat(house, cropPixels)
  const frame = scaleNearest(cropPixels, w, h, FRAME_W, FRAME_H)
  for (let y = 0; y < FRAME_H; y++) {
    const from = y * FRAME_W * 4
    const to = (y * FRAME_W * COLS + column * FRAME_W) * 4
    frame.copy(atlas, to, from, from + FRAME_W * 4)
  }
  frames.push({ kind: house.kind, door: house.door })
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
mkdirSync(dirname(fileURLToPath(MANIFEST)), { recursive: true })
const png = encodePng(FRAME_W * COLS, FRAME_H * ROWS, atlas)
writeFileSync(OUT_PATH, png)
console.log(
  `wrote src/assets/frlg/city-buildings.png ${FRAME_W * COLS}x${FRAME_H * ROWS} (${png.length} bytes)`,
)

const manifest = { width: FRAME_W, height: FRAME_H, cols: COLS, rows: ROWS, frames }
const template = JSON.stringify(manifest, null, 2) + '\n'
writeFileSync(MANIFEST, template)
console.log(
  `wrote src/data/frlg/city-buildings.json ${COLS}x${ROWS} frames, ${frames.length} houses (${Buffer.byteLength(template)} bytes)`,
)
