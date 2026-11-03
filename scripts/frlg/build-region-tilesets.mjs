// Composes the city and interior atlases from the two FireRed/LeafGreen sheets the
// asset store carries (docs/tileset-spec.md §6): a 4-column x 13-row field of 16px
// cells (64x208), the same contract build-tilesets.mjs writes for the fields.
//
//   node scripts/frlg/build-region-tilesets.mjs [buildings.png] [terrain.png]
//
// argv[2] is the buildings compilation (`frlg/tileset.png`, 300x450, Hoeloo) and
// argv[3] the terrain sheet (`frlg/tileset-2.png`, 477x800, fabnt, 16px tiles on a
// 17px pitch with a 1px origin). Both default through `assetPath`, so a dev passes
// absolute paths and nothing under the store is ever linked into the checkout
// (AGENTS.md, "Asset trees").
//
// The buildings sheet is not on a uniform grid: its cells are pixel rects. Its
// background is a flat purple (`rgb(153,51,204)`) rather than the magenta the
// spriters-resource compilations usually use, so the key covers both: a magenta
// pixel (`r >= 240`, `g <= 15`, `b >= 240`) and the sheet's own purple become
// transparent. The terrain sheet is already alpha-keyed.
//
// Every cell of both atlases is a filled field, not a decal: each frame is primed
// with the atlas's own ground tile (frame 0) and the crop is composited over it, so
// a patch of map never shows a hole and a kind's transparent edges read as its own
// ground. The build is deterministic: the same two inputs write byte-identical PNGs
// and byte-identical JSON.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'
import { assetPath } from '../assets/root.mjs'

const buildingsSource = process.argv[2] ?? assetPath('frlg/tileset.png')
const terrainSource = process.argv[3] ?? assetPath('frlg/tileset-2.png')
const ATLAS_DIR = new URL('../../src/assets/frlg/', import.meta.url)
const DATA_DIR = new URL('../../src/data/frlg/', import.meta.url)

const TILE_SIZE = 16
const COLS = 4
const ROWS = 13
const FRAMES = COLS * ROWS
const ATLAS_WIDTH = TILE_SIZE * COLS
const ATLAS_HEIGHT = TILE_SIZE * ROWS

const PITCH = 17
const ORIGIN = 1

const SHEET_KEY = [153, 51, 204]
const KEY_TOLERANCE = 6

/**
 * The city's tile kinds, one row per kind: the terrain rows name their source
 * **cell** on the 17px pitch, the buildings rows an explicit pixel rect. The order
 * is the frame order, so `grass` stamps frame 1 and `sign` frame 8 (frame 0 is the
 * city's plain pavement, the ground every cell is laid on).
 */
const CITY_CELLS = [
  { kind: 'grass', source: 'terrain', at: [7, 0] },
  { kind: 'path', source: 'terrain', at: [0, 18] },
  { kind: 'plaza', source: 'terrain', at: [0, 15] },
  { kind: 'wall', source: 'buildings', at: [56, 212] },
  { kind: 'roof', source: 'buildings', at: [30, 168] },
  { kind: 'door', source: 'buildings', at: [40, 209] },
  { kind: 'water', source: 'terrain', at: [11, 1] },
  { kind: 'sign', source: 'buildings', at: [176, 4] },
]

/**
 * The interior's tile kinds. The floor **is** the ground, so it stamps frame 0 and
 * is also what every other cell is composited over. The art is provisional and
 * composed from the two sheets that exist (docs/tileset-spec.md §6): the terrain
 * sheet's wooden plank platform reads as the floor, the buildings sheet supplies the
 * plaster wall, a counter, a heal station and a PC from its props. A real indoor rip
 * replaces this table and nothing else.
 */
const INTERIOR_CELLS = [
  { kind: 'floor', source: 'terrain', at: [20, 12] },
  { kind: 'wall', source: 'buildings', at: [244, 132] },
  { kind: 'door', source: 'buildings', at: [171, 104] },
  { kind: 'counter', source: 'buildings', at: [112, 166] },
  { kind: 'heal', source: 'buildings', at: [180, 125] },
  { kind: 'pc', source: 'buildings', at: [159, 3] },
]

/** The city's plain pavement: the ground frame 0 draws and every cell is laid on. */
const CITY_GROUND = { source: 'terrain', at: [0, 24] }

const sheets = {
  buildings: decodePng(readFileSync(buildingsSource)),
  terrain: decodePng(readFileSync(terrainSource)),
}

function isKeyed(r, g, b) {
  if (r >= 240 && g <= 15 && b >= 240) return true
  return (
    Math.abs(r - SHEET_KEY[0]) <= KEY_TOLERANCE &&
    Math.abs(g - SHEET_KEY[1]) <= KEY_TOLERANCE &&
    Math.abs(b - SHEET_KEY[2]) <= KEY_TOLERANCE
  )
}

/** A terrain `[col, row]` (or a buildings `[x, y]`) as a source pixel origin. */
function sourceOrigin(cell) {
  if (cell.source === 'terrain') return [ORIGIN + cell.at[0] * PITCH, ORIGIN + cell.at[1] * PITCH]
  return [cell.at[0], cell.at[1]]
}

/** One 16x16 window off a sheet, its background keyed to transparent. */
function crop(cell) {
  const sheet = sheets[cell.source]
  const [x0, y0] = sourceOrigin(cell)
  const out = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const from = ((y0 + y) * sheet.width + x0 + x) * 4
      if (from < 0 || from + 3 >= sheet.data.length) continue
      if (sheet.data[from + 3] < 8) continue
      if (isKeyed(sheet.data[from], sheet.data[from + 1], sheet.data[from + 2])) continue
      sheet.data.copy(out, (y * TILE_SIZE + x) * 4, from, from + 4)
    }
  }
  return out
}

/** `over` composited onto `ground`: the crop's opaque pixels win, the rest is ground. */
function compositeOver(over, ground) {
  const out = Buffer.from(ground)
  for (let i = 0; i < over.length; i += 4) {
    if (over[i + 3] < 8) continue
    over.copy(out, i, i, i + 4)
  }
  return out
}

function stampTile(atlas, frame, tile) {
  const dx = (frame % COLS) * TILE_SIZE
  const dy = Math.floor(frame / COLS) * TILE_SIZE
  for (let y = 0; y < TILE_SIZE; y++) {
    const from = y * TILE_SIZE * 4
    const to = ((dy + y) * ATLAS_WIDTH + dx) * 4
    tile.copy(atlas, to, from, from + TILE_SIZE * 4)
  }
}

/** A cell table composed into its atlas and manifest: frame 0 is the ground. */
function build({ id, ground, cells }) {
  const groundTile = crop(ground)
  const atlas = Buffer.alloc(ATLAS_WIDTH * ATLAS_HEIGHT * 4)
  for (let frame = 0; frame < FRAMES; frame++) stampTile(atlas, frame, groundTile)
  const manifest = {}
  // A ground that is itself one of the kinds (the interior's floor) draws frame 0,
  // so the ground frame and the kind's frame are the same tile, not two copies.
  const groundIsKind = cells.includes(ground)
  let next = 1
  for (const cell of cells) {
    const frame = groundIsKind && cell === ground ? 0 : next++
    if (frame > 0) stampTile(atlas, frame, compositeOver(crop(cell), groundTile))
    manifest[cell.kind] = frame
  }
  return {
    id,
    atlas,
    manifest: {
      kind: 'pkmr-tileset',
      version: 1,
      id,
      atlas: {
        tileSize: TILE_SIZE,
        cols: COLS,
        rows: ROWS,
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
      },
      cells: manifest,
    },
  }
}

mkdirSync(ATLAS_DIR, { recursive: true })
mkdirSync(DATA_DIR, { recursive: true })

for (const built of [
  build({ id: 'city', ground: CITY_GROUND, cells: CITY_CELLS }),
  build({ id: 'interior', ground: INTERIOR_CELLS[0], cells: INTERIOR_CELLS }),
]) {
  const png = encodePng(ATLAS_WIDTH, ATLAS_HEIGHT, built.atlas)
  writeFileSync(new URL(`${built.id}.png`, ATLAS_DIR), png)
  console.log(
    `wrote src/assets/frlg/${built.id}.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`,
  )
  const template = JSON.stringify(built.manifest, null, 2) + '\n'
  writeFileSync(new URL(`${built.id}.json`, DATA_DIR), template)
  console.log(
    `wrote src/data/frlg/${built.id}.json ${COLS}x${ROWS} cells (${Buffer.byteLength(template)} bytes)`,
  )
}
