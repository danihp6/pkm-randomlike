// Overlays real "Apple Woods" tileset art (Pokemon Mystery Dungeon:
// Explorers of Time/Darkness) onto the procedural dungeon atlas
// (src/assets/tileset.png layout), producing src/assets/apple-woods.png.
// Only FLOOR and WALL frames are replaced with real art; trap/chest/item
// keep the procedural look from generate-tileset.mjs, and stairs is left
// blank — it's drawn from the shared common atlas at render time instead
// (src/assets/common.png, see core/tileset.ts's commonFrames). Same
// approach as extract-desert-tileset.mjs.
//
// Source: sprite-sources/tilesets/apple_woods/apple_woods.png (gitignored —
// ripped by SilverDeoxys563, spriters-resource.com; kept local, never
// redistributed; only the cropped apple-woods.png atlas output is
// committed). Same "SilverDeoxys563" sheet template as desert.png (Legend /
// Walls / Wall Alt 1-2 / Ground / Ground Alt 1-2 / Unused Ground / Water /
// Water Sparkle banks, same 963x770 size, same row pitch/bank x-offsets) —
// confirmed by visually comparing bank headers/column count, so this reuses
// desert's exact bank coordinates and Walls/Water keypad layout verbatim.
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng, inpaint } from './png-codec.mjs'
import { ATLAS_WIDTH, ATLAS_HEIGHT, GRID_COLS, TILE_SIZE, buildAtlas } from './generate-tileset.mjs'

const isMagenta = (r, g, b, a) => r === 255 && g === 0 && b === 255 && a === 255

const SOURCE_TILE = 24
const GRID_Y0 = 162
const GRID_PITCH = 25
const WALLS_X0 = 83
const GROUND_X0 = 308
const GROUND_ALT1_X0 = 383
const GROUND_ALT2_X0 = 458
const WATER_X0 = 608

const sourceDir = new URL('../sprite-sources/tilesets/apple_woods/', import.meta.url)
const source = decodePng(readFileSync(new URL('apple_woods.png', sourceDir)))

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

const atlas = buildAtlas()

stampGround(atlas.data, FRAME_FLOOR, 1, 1)
stampGround(atlas.data, FRAME_FLOOR_ALT_1, 0, 3)
stampGround(atlas.data, FRAME_FLOOR_ALT_2, 1, 4)
stampGround(atlas.data, FRAME_FLOOR_ALT_3, 1, 1, GROUND_ALT1_X0)
stampGround(atlas.data, FRAME_FLOOR_ALT_4, 0, 7, GROUND_ALT2_X0)
stampGround(atlas.data, FRAME_FLOOR_ALT_5, 2, 7, GROUND_ALT2_X0)

stampWalls(atlas.data, FRAME_WALL_INTERIOR, 1, 1)
stampWalls(atlas.data, FRAME_WALL_EDGE_N, 1, 0)
stampWalls(atlas.data, FRAME_WALL_EDGE_E, 2, 1)
stampWalls(atlas.data, FRAME_WALL_EDGE_S, 1, 2)
stampWalls(atlas.data, FRAME_WALL_EDGE_W, 0, 1)
stampWalls(atlas.data, FRAME_WALL_CORNER_NW, 0, 0)
stampWalls(atlas.data, FRAME_WALL_CORNER_NE, 2, 0)
stampWalls(atlas.data, FRAME_WALL_CORNER_SW, 0, 2)
stampWalls(atlas.data, FRAME_WALL_CORNER_SE, 2, 2)

stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_NE, 2, 0)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_NW, 0, 0)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_SE, 2, 2)
stampWalls(atlas.data, FRAME_WALL_INNER_CORNER_SW, 0, 2)

stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SE, 0, 15)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_SW, 1, 15)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NE, 0, 16)
stampWalls(atlas.data, FRAME_WALL_DIAGONAL_CORNER_NW, 1, 16)

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
writeFileSync(new URL('apple-woods.png', outDir), png)
console.log(`wrote src/assets/apple-woods.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`)
