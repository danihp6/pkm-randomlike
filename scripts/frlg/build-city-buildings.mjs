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
// The frame is a decal drawn over the plan's 5x6 footprint, so it must cover
// every pixel of its 80x96: a fully transparent column or row would let the
// flat `roof` tile underneath show through as a band beside the house. Each rect
// below is therefore a generous window around one house, and the frame is the
// house's own opaque bounding box inside it (scaled to 80x96), never a
// hand-centred 80px crop - the bbox is what makes every edge row and column
// carry art. The door's tile column follows from the same bbox: it is measured
// and written to the manifest, so the plan's walkable `DOOR` cell sits under the
// drawn door (`docs/region-spec.md` §7.1).
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
const TILE = 16

/**
 * The four houses, in frame order: a generous source rect around one house (the
 * frame is that house's opaque bbox inside it) and the source x of its door's
 * centre. A new kind is one row here plus its frame in the manifest; the door
 * column is never declared, it is measured off the bbox.
 */
const HOUSES = [
  { kind: 'centre', rect: [98, 13, 92, 82], doorCentre: 143.5 },
  { kind: 'gym', rect: [659, 13, 126, 104], doorCentre: 721.5 },
  { kind: 'lab', rect: [574, 130, 92, 84], doorCentre: 619.5 },
  { kind: 'house', rect: [115, 819, 92, 75], doorCentre: 159.5 },
]

const MIN_OPAQUE_COLOURS = 3
const MAX_NEAR_BLACK = 0.4

const sheet = decodePng(readFileSync(SRC))

/** One house's window, its seams repaired and its alpha kept as the sheet has it. */
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

/** The house's own bounds inside its window: no transparent margin reaches the frame. */
function opaqueBox(pixels, w, h) {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] < 8) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** The bbox's pixels as their own buffer, so the scale and the flat check read it. */
function boxPixels(pixels, srcW, box) {
  const out = Buffer.alloc(box.w * box.h * 4)
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * srcW + box.x) * 4
    pixels.copy(out, y * box.w * 4, from, from + box.w * 4)
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

/**
 * The frame is a decal over a 5x6 block of `ROOF`, so a transparent column or row
 * is a hole the tile shows through. The bbox makes this hold; the check keeps a
 * future rect from quietly reintroducing the band QA caught.
 */
function assertCovered(house, frame) {
  const bare = []
  for (let x = 0; x < FRAME_W; x++) {
    let any = false
    for (let y = 0; y < FRAME_H && !any; y++) any = frame[(y * FRAME_W + x) * 4 + 3] >= 8
    if (!any) bare.push(`column ${x}`)
  }
  for (let y = 0; y < FRAME_H; y++) {
    let any = false
    for (let x = 0; x < FRAME_W && !any; x++) any = frame[(y * FRAME_W + x) * 4 + 3] >= 8
    if (!any) bare.push(`row ${y}`)
  }
  if (bare.length > 0) {
    console.error(
      `build-city-buildings: ${house.kind} at [${house.rect.join(',')}] leaves ${bare.length} ` +
        `transparent ${bare.length === 1 ? 'line' : 'lines'} (${bare.slice(0, 4).join(', ')}) ` +
        `- the roof tile would show through the footprint, refusing to write`,
    )
    process.exit(1)
  }
}

/** The door's tile column inside the frame, measured off the bbox, never declared. */
function doorColumn(house, box, offsetX) {
  const centre = (house.doorCentre - offsetX - box.x) / box.w
  if (centre < 0 || centre > 1) {
    console.error(
      `build-city-buildings: ${house.kind} door ${house.doorCentre} is outside its bbox ` +
        `[${offsetX + box.x}, ${offsetX + box.x + box.w - 1}]`,
    )
    process.exit(1)
  }
  const column = Math.floor((centre * FRAME_W) / TILE)
  return Math.max(0, Math.min(FRAME_W / TILE - 1, column))
}

const atlas = Buffer.alloc(FRAME_W * COLS * FRAME_H * ROWS * 4)
const frames = []
for (const [column, house] of HOUSES.entries()) {
  const [x0, y0, w, h] = house.rect
  const pixels = crop(house.rect)
  const box = opaqueBox(pixels, w, h)
  if (box.w <= 0 || box.h <= 0) {
    console.error(
      `build-city-buildings: no art for ${house.kind} at [${house.rect.join(',')}] ` +
        `- refusing to write src/assets/frlg/city-buildings.png`,
    )
    process.exit(1)
  }
  const housePixels = boxPixels(pixels, w, box)
  assertNotFlat(house, housePixels)
  const frame = scaleNearest(housePixels, box.w, box.h, FRAME_W, FRAME_H)
  assertCovered(house, frame)
  for (let y = 0; y < FRAME_H; y++) {
    const from = y * FRAME_W * 4
    const to = (y * FRAME_W * COLS + column * FRAME_W) * 4
    frame.copy(atlas, to, from, from + FRAME_W * 4)
  }
  frames.push({ kind: house.kind, door: doorColumn(house, box, x0) })
  console.log(
    `  ${house.kind}: [${x0},${y0},${w},${h}] bbox ${box.x},${box.y} ${box.w}x${box.h} -> door ${frames.at(-1).door}`,
  )
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
