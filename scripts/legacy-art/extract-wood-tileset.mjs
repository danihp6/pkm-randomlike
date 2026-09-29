// Overlays real "Howling Forest" tileset art (Pokemon Mystery Dungeon:
// Explorers of Time/Darkness) onto the procedural dungeon atlas
// (src/assets/tileset.png layout), producing src/assets/wood.png. Only the
// FLOOR and WALL frames are replaced with real art (the sheet has no
// stairs/trap/chest/item tiles); trap/chest/item keep the procedural look
// from generate-tileset.mjs, and stairs is left blank — it's drawn from the
// shared common atlas at render time instead (src/assets/common.png, see
// core/tileset.ts's commonFrames).
//
// Source: sprite-sources/tilesets/wood/*.png (gitignored — copyrighted
// Nintendo/GameFreak/Chunsoft/Spike Chunsoft art ripped by SilverDeoxys563,
// spriters-resource.com; kept local, never redistributed; only the cropped
// wood.png atlas output is committed). wood/ holds the full legend sheet
// (wood.png) plus pre-cropped 24x24 named tiles, hand-picked from it, one
// per autotile slot — see the stampNamed/stampCell calls below for which
// crop maps to which shape.
//
// Orientation rule for every wall crop (confirmed in-game): the flat
// saturated grass-green in a tile is the "outside" — the closed side, away
// from the room. Canopy/dirt is the open, floor-facing side. So a tile
// maps to whichever engine direction is *opposite* its green: e.g. a
// top/N-looking tile with green pooled at its own top edge is actually
// EDGE_S (floor to its south, green outside to the north), not EDGE_N.
//
// The Walls bank's first 3 rows x 3 cols (in wood.png) form one complete
// room-corner autotile block, laid out like a phone keypad read in
// reading order:
//   1 2 3      NW  N  NE
//   4 5 6  =   W   .   E     (. = interior, all sides walled)
//   7 8 9      SW  S  SE
// i.e. (col,row) (0,0)=NW (1,0)=N (2,0)=NE / (0,1)=W (1,1)=interior
// (2,1)=E / (0,2)=SW (1,2)=S (2,2)=SE. Only EDGE_N still uses it (see
// below) — the block's own corner slots turned out too uniform (generic
// dense canopy, no real single-diagonal notch) to read as a proper corner
// at any orientation, so FRAME_WALL_CORNER_* use dedicated crops instead.
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng, inpaint } from './png-codec.mjs'
import { ATLAS_WIDTH, ATLAS_HEIGHT, GRID_COLS, TILE_SIZE, buildAtlas } from './generate-tileset.mjs'

// Palette-cycling magenta placeholder used by the source sheet's Water bank
// (see png-codec.mjs's inpaint doc comment) - not a real color, just a
// runtime-animation marker baked into the static crop.
const isMagenta = (r, g, b, a) => r === 255 && g === 0 && b === 255 && a === 255

const SOURCE_TILE = 24
const GRID_X0 = 83
const GRID_Y0 = 162
const GRID_PITCH = 25
// wood.png is the same "SilverDeoxys563" sheet template as
// sprite-sources/tilesets/desert/desert.png (Legend / Walls / Wall Alt 1-2 /
// Ground / Ground Alt 1-2 / Water / Water Sparkle banks, same row pitch),
// just missing desert's extra "Unused Ground" bank between Ground Alt 2 and
// Water - confirmed by comparing bank header labels, hence WATER_X0 sitting
// exactly one 3-col bank (75px) earlier than desert's.
const GROUND_X0 = 308
const WATER_X0 = 533

const woodDir = new URL('../sprite-sources/tilesets/wood/', import.meta.url)
const source = decodePng(readFileSync(new URL('wood.png', woodDir)))

function cropCell(col, row) {
  return cropCellAt(GRID_X0 + col * GRID_PITCH, row)
}

function cropCellAt(x0, row) {
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

// Named tiles are already 24x24 crops (no grid border to strip), so they
// skip cropCell/centerCrop entirely.
function loadNamedTile(name) {
  const img = decodePng(readFileSync(new URL(`${name}.png`, woodDir)))
  const out = new Array(TILE_SIZE * TILE_SIZE)
  for (let ty = 0; ty < TILE_SIZE; ty++) {
    for (let tx = 0; tx < TILE_SIZE; tx++) {
      const o = (ty * img.width + tx) * 4
      out[ty * TILE_SIZE + tx] = [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]]
    }
  }
  return out
}

// Crops the centered TILE_SIZE^2 window out of a SOURCE_TILE^2 source tile —
// a straight pixel copy, not a resample, so the source's dithering stays
// crisp instead of blurring into mush (box-averaging was tried first and
// looked muddy). Now that the game atlas also uses 24px tiles (TILE_SIZE ===
// SOURCE_TILE), this is a lossless full-tile copy with no cropped margin.
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

function stampCell(atlasData, frame, col, row) {
  stampTile(atlasData, frame, centerCrop(cropCell(col, row)))
}

function stampNamed(atlasData, frame, name) {
  stampTile(atlasData, frame, loadNamedTile(name))
}

function stampGround(atlasData, frame, col, row) {
  stampTile(atlasData, frame, centerCrop(cropCellAt(GROUND_X0 + col * GRID_PITCH, row)))
}

function stampWater(atlasData, frame, col, row) {
  const cell = cropCellAt(WATER_X0 + col * GRID_PITCH, row)
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

const atlas = buildAtlas()

stampNamed(atlas.data, FRAME_FLOOR, 'floor')
stampCell(atlas.data, FRAME_FLOOR_ALT_1, 11, 0)
stampCell(atlas.data, FRAME_FLOOR_ALT_2, 10, 6)
// 3 more sprout/flower-flecked Ground bank cells for extra border variety
// (verified non-blank by sampling - the bank is otherwise sparse, many
// cells are unused/blank).
stampGround(atlas.data, FRAME_FLOOR_ALT_3, 0, 0)
stampGround(atlas.data, FRAME_FLOOR_ALT_4, 2, 2)
stampGround(atlas.data, FRAME_FLOOR_ALT_5, 1, 3)

// One named 24x24 crop per autotile slot (see file header). inner-wall is
// the tile used when a wall has no open side at all (the bulk of
// unexplored wall behind the visible ring) — flat clearing-green, not
// canopy, so that area reads as open ground instead of the near-black
// canopy tile tried before.
stampNamed(atlas.data, FRAME_WALL_INTERIOR, 'inner-wall')
// left-wall.png/right-wall.png read as the opposite engine side in-game
// (same diagonal-flip quirk as the corners) — swapped here.
stampNamed(atlas.data, FRAME_WALL_EDGE_W, 'right-wall')
stampNamed(atlas.data, FRAME_WALL_EDGE_E, 'left-wall')
// top-wall.png has its green (the "outside", away from the room) along its
// own top edge and dirt/canopy along its bottom — i.e. the open (floor)
// side is its SOUTH edge, so despite the filename it's the tile for a
// room's *top* boundary row (floor below it) which in bitmask terms is
// EDGE_S, not EDGE_N. Using it for EDGE_N put the green facing into the
// room instead of away from it.
stampNamed(atlas.data, FRAME_WALL_EDGE_S, 'top-wall')
// bottom-wall.png is a mis-saved full-sheet copy (not a 24x24 crop), so
// EDGE_N falls back to the full-sheet keypad-block crop (verified in-game
// by an earlier session, before named tiles existed).
stampCell(atlas.data, FRAME_WALL_EDGE_N, 1, 0)
// CORNER_* (convex, two cardinal neighbors AND the diagonal between them
// all open — a rare "straight double-edge stub") keeps the full-sheet
// keypad crop, direct mapping: (0,0) is the block's own NW slot -> NW.
stampCell(atlas.data, FRAME_WALL_CORNER_NW, 0, 0)
stampCell(atlas.data, FRAME_WALL_CORNER_NE, 2, 0)
stampCell(atlas.data, FRAME_WALL_CORNER_SW, 0, 2)
stampCell(atlas.data, FRAME_WALL_CORNER_SE, 2, 2)

// DIAGONAL_CORNER_* (no cardinal neighbor open, just one diagonal — a
// plain rectangular room's outer ring corner) needs a different shape:
// mostly wall, opening only at the one diagonal point. The keypad crops
// are too uniform (generic dense canopy, no real single-corner notch) for
// that, so these are dedicated crops instead, confirmed in-game as a
// direct (not opposite-diagonal) mapping: outer-corner-left-top's canopy
// sits in its own NW quadrant and it reads as open on that same side.
stampNamed(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NW, 'outer-corner-left-top')
stampNamed(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NE, 'outer-corner-right-top-wall')
stampNamed(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SW, 'outer-corner-left-bottom')
stampNamed(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SE, 'outer-corner-right-bottom')

// Inner (concave) corners — the inside hinge where a corridor meets a room
// at an L-junction. Unlike the full-sheet keypad crops above, these were
// cropped and named directly per corner. Confirmed in-game: NE/SW read
// straight off their name (inner-corner-right-top-wall -> innerCornerNE),
// but NW/SE read as each other — inner-corner-left-top-wall (named for
// NW) is actually the SE shape, and right-bottom-wall (named for SE) is
// actually the NW shape.
stampNamed(atlas.data, FRAME_WALL_INNER_CORNER_SE, 'inner-corner-left-top-wall')
stampNamed(atlas.data, FRAME_WALL_INNER_CORNER_NE, 'inner-corner-right-top-wall')
stampNamed(atlas.data, FRAME_WALL_INNER_CORNER_SW, 'inner-corner-left-bottom-wall')
stampNamed(atlas.data, FRAME_WALL_INNER_CORNER_NW, 'inner-corner-right-bottom-wall')

// Water bank uses the same (row,col) legend-driven coordinates as the Walls
// bank's own keypad block - same approach as extract-desert-tileset.mjs,
// this sheet shares the exact same legend/bank layout. No concave (inner-
// corner) water art either, so those fall back to the matching convex
// corner just like the walls above.
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
writeFileSync(new URL('wood.png', outDir), png)
console.log(`wrote src/assets/wood.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`)
