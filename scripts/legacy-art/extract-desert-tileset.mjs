// Overlays real "Desert Region" tileset art onto the procedural dungeon
// atlas (src/assets/tileset.png layout), producing src/assets/desert.png.
// Only FLOOR and WALL frames are replaced with real art; trap/chest/item
// keep the procedural look from generate-tileset.mjs, and stairs is left
// blank — it's drawn from the shared common atlas at render time instead
// (src/assets/common.png, see core/tileset.ts's commonFrames). Same
// approach as extract-wood-tileset.mjs.
//
// Source: sprite-sources/tilesets/desert/desert.png (gitignored — ripped by
// SilverDeoxys563, spriters-resource.com; kept local, never redistributed;
// only the cropped desert.png atlas output is committed).
//
// Unlike the wood source (loose named crops, orientation confirmed by trial
// and error in-game), this sheet ships its own legend: a black/white 3x3
// icon per Walls-bank cell showing which of its 8 neighbors are open floor
// (blank/teal) vs wall (black). That's read here to derive each cell's
// open-neighbor bitmask programmatically and match it directly against this
// engine's own wallFrame() bit convention (see render/tilemap-renderer.ts),
// instead of hand-picking crops per shape.
//
// The sheet's Walls bank has no dedicated concave (inner-corner) art — only
// the classic 3x3 "keypad" interior/edges/convex-corners block plus 4
// separate diagonal-corner cells. Inner corners fall back to reusing the
// matching convex corner crop (see stampCell calls below), same spirit as
// wood's TRAP/CHEST/ITEM falling back to FRAME_FLOOR when dedicated art is
// missing.
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng, inpaint } from './png-codec.mjs'
import { ATLAS_WIDTH, ATLAS_HEIGHT, GRID_COLS, TILE_SIZE, buildAtlas } from './generate-tileset.mjs'

// Palette-cycling magenta placeholder used by the source sheet's Water bank
// (see png-codec.mjs's inpaint doc comment) - not a real color, just a
// runtime-animation marker baked into the static crop.
const isMagenta = (r, g, b, a) => r === 255 && g === 0 && b === 255 && a === 255

const SOURCE_TILE = 24
// Sheet grid: a 1px cyan gridline every 25px, content is the 24x24 area
// just after each line. Legend bank starts at x=8 (3 cols), Walls bank at
// x=83 (3 cols, keypad-ordered NW N NE / W int E / SW S SE for rows 0-2,
// then 2 more diagonal-corner-only rows further down), Ground bank at
// x=308 (3 cols). All banks share the same row pitch/origin.
const GRID_Y0 = 162
const GRID_PITCH = 25
const LEGEND_X0 = 8
const WALLS_X0 = 83
const GROUND_X0 = 308
const GROUND_ALT1_X0 = 383
const GROUND_ALT2_X0 = 458
const WATER_X0 = 608

const desertDir = new URL('../sprite-sources/tilesets/desert/', import.meta.url)
const source = decodePng(readFileSync(new URL('desert.png', desertDir)))

function cropCell(x0, row) {
  const px = x0 + 1
  const py = GRID_Y0 + row * GRID_PITCH + 1
  const out = Buffer.alloc(SOURCE_TILE * SOURCE_TILE * 4)
  for (let y = 0; y < SOURCE_TILE; y++) {
    const so = ((py + y) * source.width + px) * 4
    const doff = y * SOURCE_TILE * 4
    source.data.copy(out, doff, so, so + SOURCE_TILE * 4)
  }
  return { width: SOURCE_TILE, height: SOURCE_TILE, data: out }
}

function centerCrop(src) {
  const offset = Math.floor((SOURCE_TILE - TILE_SIZE) / 2)
  const out = new Array(TILE_SIZE * TILE_SIZE)
  for (let ty = 0; ty < TILE_SIZE; ty++) {
    for (let tx = 0; tx < TILE_SIZE; tx++) {
      const o = ((ty + offset) * src.width + (tx + offset)) * 4
      out[ty * TILE_SIZE + tx] = [src.data[o], src.data[o + 1], src.data[o + 2], src.data[o + 3]]
    }
  }
  return out
}

function stampTile(atlasData, frame, tile) {
  const col = frame % GRID_COLS
  const row = Math.floor(frame / GRID_COLS)
  for (let ty = 0; ty < TILE_SIZE; ty++) {
    for (let tx = 0; tx < TILE_SIZE; tx++) {
      const c = tile[ty * TILE_SIZE + tx]
      const dx = col * TILE_SIZE + tx
      const dy = row * TILE_SIZE + ty
      const o = (dy * ATLAS_WIDTH + dx) * 4
      atlasData[o] = c[0]
      atlasData[o + 1] = c[1]
      atlasData[o + 2] = c[2]
      atlasData[o + 3] = c[3]
    }
  }
}

function stampWalls(atlasData, frame, col, row) {
  stampTile(atlasData, frame, centerCrop(cropCell(WALLS_X0 + col * GRID_PITCH, row)))
}

function stampGround(atlasData, frame, col, row, bankX0 = GROUND_X0) {
  stampTile(atlasData, frame, centerCrop(cropCell(bankX0 + col * GRID_PITCH, row)))
}

function stampWater(atlasData, frame, col, row) {
  const cell = cropCell(WATER_X0 + col * GRID_PITCH, row)
  inpaint(cell, isMagenta)
  stampTile(atlasData, frame, centerCrop(cell))
}

// Frame indices — must match FRAME_* constants in src/core/tileset.ts.
const FRAME_FLOOR = 0
const FRAME_FLOOR_ALT_1 = 1
const FRAME_FLOOR_ALT_2 = 2
const FRAME_WALL_INTERIOR = 7
const FRAME_WALL_EDGE_N = 8
const FRAME_WALL_EDGE_E = 9
const FRAME_WALL_EDGE_S = 10
const FRAME_WALL_EDGE_W = 11
const FRAME_WALL_CORNER_NE = 12
const FRAME_WALL_CORNER_NW = 13
const FRAME_WALL_CORNER_SE = 14
const FRAME_WALL_CORNER_SW = 15
const FRAME_WALL_INNER_CORNER_NE = 16
const FRAME_WALL_INNER_CORNER_NW = 17
const FRAME_WALL_INNER_CORNER_SE = 18
const FRAME_WALL_INNER_CORNER_SW = 19
const FRAME_WALL_DIAGONAL_CORNER_NE = 20
const FRAME_WALL_DIAGONAL_CORNER_NW = 21
const FRAME_WALL_DIAGONAL_CORNER_SE = 22
const FRAME_WALL_DIAGONAL_CORNER_SW = 23
const FRAME_WATER_INTERIOR = 24
const FRAME_WATER_EDGE_N = 25
const FRAME_WATER_EDGE_E = 26
const FRAME_WATER_EDGE_S = 27
const FRAME_WATER_EDGE_W = 28
const FRAME_WATER_CORNER_NE = 29
const FRAME_WATER_CORNER_NW = 30
const FRAME_WATER_CORNER_SE = 31
const FRAME_WATER_CORNER_SW = 32
const FRAME_WATER_INNER_CORNER_NE = 33
const FRAME_WATER_INNER_CORNER_NW = 34
const FRAME_WATER_INNER_CORNER_SE = 35
const FRAME_WATER_INNER_CORNER_SW = 36
const FRAME_WATER_DIAGONAL_CORNER_NE = 37
const FRAME_WATER_DIAGONAL_CORNER_NW = 38
const FRAME_WATER_DIAGONAL_CORNER_SE = 39
const FRAME_WATER_DIAGONAL_CORNER_SW = 40
const FRAME_FLOOR_ALT_3 = 41
const FRAME_FLOOR_ALT_4 = 42
const FRAME_FLOOR_ALT_5 = 43
// 44-50 (FRAME_WALL_STRAIGHT_NS/EW, TEE_N/E/S/W, CROSS) are left blank -
// see the comment further down where they'd otherwise be stamped.

const atlas = buildAtlas()

// Ground bank's first 3x3 block (rows 0-2, cols 0-2): the center cell (1,1)
// is the cleanest of the 9, with almost no visible speckle, so it's the
// default "open room center" floor (see wallAdjacentVariants in
// desert-tileset.ts) - the corner/edge cells all carry small dot clusters
// meant to read as a border decal. Row 3/4 add pebble clusters for the two
// original alt frames.
stampGround(atlas.data, FRAME_FLOOR, 1, 1)
stampGround(atlas.data, FRAME_FLOOR_ALT_1, 0, 3)
stampGround(atlas.data, FRAME_FLOOR_ALT_2, 1, 4)
// Ground Alt 1/2 banks add more sand variety for the 3 extra floor slots
// (verified by cropping the banks - most of Alt 1/2 is empty, only these
// spots have real pebble-cluster art).
stampGround(atlas.data, FRAME_FLOOR_ALT_3, 1, 1, GROUND_ALT1_X0)
stampGround(atlas.data, FRAME_FLOOR_ALT_4, 0, 7, GROUND_ALT2_X0)
stampGround(atlas.data, FRAME_FLOOR_ALT_5, 2, 7, GROUND_ALT2_X0)

// Walls bank rows 0-2 form the classic 3x3 keypad block (see file header):
//   (0,0) NW   (1,0) N   (2,0) NE
//   (0,1) W    (1,1) int (2,1) E
//   (0,2) SW   (1,2) S   (2,2) SE
stampWalls(atlas.data, FRAME_WALL_INTERIOR, 1, 1)
stampWalls(atlas.data, FRAME_WALL_EDGE_N, 1, 0)
stampWalls(atlas.data, FRAME_WALL_EDGE_E, 2, 1)
stampWalls(atlas.data, FRAME_WALL_EDGE_S, 1, 2)
stampWalls(atlas.data, FRAME_WALL_EDGE_W, 0, 1)
stampWalls(atlas.data, FRAME_WALL_CORNER_NW, 0, 0)
stampWalls(atlas.data, FRAME_WALL_CORNER_NE, 2, 0)
stampWalls(atlas.data, FRAME_WALL_CORNER_SW, 0, 2)
stampWalls(atlas.data, FRAME_WALL_CORNER_SE, 2, 2)

// No concave (inner-corner) art in this sheet — fall back to the matching
// convex corner, same shape family, closest available (see file header).
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_NE, 2, 0)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_NW, 0, 0)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_SE, 2, 2)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_SW, 0, 2)

// Diagonal-only corners (rows 15-16, verified against the legend: a single
// open diagonal, all 4 cardinals closed).
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SE, 0, 15)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SW, 1, 15)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NE, 0, 16)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NW, 1, 16)

// Rows 3+ of the Walls bank looked like they might hold straight/T-
// junction/pillar autotile pieces, and the legend's own black/white
// pattern per cell even seemed to confirm bit patterns for them - but
// several of those legend cells turn out to be blank (no icon at all),
// which a naive "no black pixel = every side open" reading misclassifies
// as a valid all-open (cross) shape. The art itself is actually a
// free-standing pillar/boulder decoration sprite (confirmed in-game: a
// wrong edge tile rendered at these junctions), not neighbor-aware wall
// art, so there's nothing to stamp here - see FRAME_WALL_STRAIGHT_NS and
// friends falling back to FRAME_WALL_INTERIOR in desert-tileset.ts.

// Water bank uses the exact same (row,col) coordinates as the Walls bank -
// the Legend column's open/closed pattern is shared across every autotile
// bank in the sheet, only the pixel art underneath differs (verified by
// cropping this bank at these coordinates before wiring the stamps below).
stampWater(atlas.data, FRAME_WATER_INTERIOR, 1, 1)
stampWater(atlas.data, FRAME_WATER_EDGE_N, 1, 0)
stampWater(atlas.data, FRAME_WATER_EDGE_E, 2, 1)
stampWater(atlas.data, FRAME_WATER_EDGE_S, 1, 2)
stampWater(atlas.data, FRAME_WATER_EDGE_W, 0, 1)
stampWater(atlas.data, FRAME_WATER_CORNER_NW, 0, 0)
stampWater(atlas.data, FRAME_WATER_CORNER_NE, 2, 0)
stampWater(atlas.data, FRAME_WATER_CORNER_SW, 0, 2)
stampWater(atlas.data, FRAME_WATER_CORNER_SE, 2, 2)
stampWater(atlas.data, FRAME_WATER_INNER_CORNER_NE, 2, 0)
stampWater(atlas.data, FRAME_WATER_INNER_CORNER_NW, 0, 0)
stampWater(atlas.data, FRAME_WATER_INNER_CORNER_SE, 2, 2)
stampWater(atlas.data, FRAME_WATER_INNER_CORNER_SW, 0, 2)
stampWater(atlas.data, FRAME_WATER_DIAGONAL_CORNER_SE, 0, 15)
stampWater(atlas.data, FRAME_WATER_DIAGONAL_CORNER_SW, 1, 15)
stampWater(atlas.data, FRAME_WATER_DIAGONAL_CORNER_NE, 0, 16)
stampWater(atlas.data, FRAME_WATER_DIAGONAL_CORNER_NW, 1, 16)

const outDir = new URL('../src/assets/', import.meta.url)
const png = encodePng(ATLAS_WIDTH, ATLAS_HEIGHT, atlas.data)
writeFileSync(new URL('desert.png', outDir), png)
console.log(`wrote src/assets/desert.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`)
