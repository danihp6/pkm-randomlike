// Composes FireRed/LeafGreen 16x16 terrain into the biome atlas contract
// (docs/tileset-spec.md): a 4-column x 13-row sheet whose frame indices match the
// constants in src/engine/tileset.ts, declared with `tileSize: 16` (D18).
//
// Source: sprite-sources/frlg/tileset-2.png (gitignored, ripped by fabnt from
// PokemonFireRed/LeafGreen, spriters-resource; never redistributed). The sheet is
// laid out on a 17px pitch: a 1px gutter, then a 16x16 tile, so tile (col,row)
// starts at (1 + col*17, 1 + row*17). Every tile the atlas uses is picked by hand
// from a named bank of the compilation; the comments below record which is which.
//
// Only FLOOR/WALL/WATER/LEDGE are real art: stairs/trap/chest/item/carpet come
// from the shared common atlas at render time (commonFrames) or fall back to the
// floor, the same split the PMD biome atlases use.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const SRC = new URL('../../sprite-sources/frlg/tileset-2.png', import.meta.url)
const OUT_DIR = new URL('../../src/assets/frlg/', import.meta.url)

const SRC_TILE = 16
const PITCH = 17
const ORIGIN = 1

const TILE_SIZE = 16
const COLS = 4
const ROWS = 13
const ATLAS_WIDTH = TILE_SIZE * COLS
const ATLAS_HEIGHT = TILE_SIZE * ROWS

// Frame indices — must match the constants in src/engine/tileset.ts and the
// pattern frames exported by src/data/tilesets/frlg.ts.
const FRAME_FLOOR = 0
const FRAME_FLOOR_ALT_1 = 1
const FRAME_FLOOR_ALT_2 = 2
const FRAME_WALL_TOP = [7, 8, 9]
const FRAME_WALL_BODY = [10, 11, 12]
const FRAME_WALL_CROWN = [13, 14, 15]
const FRAME_WALL_MID = [16, 17, 18]
const FRAME_WALL_LOWER = [19, 20, 21]
const FRAME_WALL_BASE = [22, 23, 44]
const FRAME_WATER_INTERIOR = 24
const FRAME_WATER_EDGE_N = 25
const FRAME_WATER_EDGE_E = 26
const FRAME_WATER_EDGE_S = 27
const FRAME_WATER_EDGE_W = 28
const FRAME_WATER_CORNER_NE = 29
const FRAME_WATER_CORNER_NW = 30
const FRAME_WATER_CORNER_SE = 31
const FRAME_WATER_CORNER_SW = 32
const FRAME_FLOOR_ALT_3 = 41
const FRAME_FLOOR_ALT_4 = 42
const FRAME_FLOOR_ALT_5 = 43
// The tall-grass ground tile, into an otherwise unused shared slot (the field
// draws chest/item from the common atlas). Source is the tufted grass blades
// (`tallGrass`) drawn whole, with their own ground baked in.
const FRAME_TALL_GRASS = 5
// The last cell of the 4x13 sheet, the rocky ledge lip the route walks off.
const FRAME_LEDGE = 51
// The ledge run's end caps: the sheet leaves the stair/trap slots (3 and 4)
// unused - the field draws those from the common atlas - so the caps live there.
const FRAME_LEDGE_LEFT = 3
const FRAME_LEDGE_RIGHT = 4

const WATER_TUPLE = [
  FRAME_WATER_INTERIOR,
  FRAME_WATER_EDGE_N,
  FRAME_WATER_EDGE_E,
  FRAME_WATER_EDGE_S,
  FRAME_WATER_EDGE_W,
  FRAME_WATER_CORNER_NE,
  FRAME_WATER_CORNER_NW,
  FRAME_WATER_CORNER_SE,
  FRAME_WATER_CORNER_SW,
]

/** The frame each floor variant stamps to. `3`-`6` are the shared common slots. */
const FLOOR_ALT_FRAMES = [
  FRAME_FLOOR_ALT_1,
  FRAME_FLOOR_ALT_2,
  FRAME_FLOOR_ALT_3,
  FRAME_FLOOR_ALT_4,
  FRAME_FLOOR_ALT_5,
]

const source = decodePng(readFileSync(SRC))

/** The 16x16 tile at (col,row) of the 17px-pitch source grid. */
function sourceTile(col, row) {
  const x0 = ORIGIN + col * PITCH
  const y0 = ORIGIN + row * PITCH
  const out = Buffer.alloc(SRC_TILE * SRC_TILE * 4)
  for (let y = 0; y < SRC_TILE; y++) {
    const from = ((y0 + y) * source.width + x0) * 4
    source.data.copy(out, y * SRC_TILE * 4, from, from + SRC_TILE * 4)
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

function stamp(atlas, frame, col, row) {
  stampTile(atlas, frame, sourceTile(col, row))
}

/**
 * One whole 3x3 autotile block (the keypad layout NW N NE / W interior E /
 * SW S SE) stamped onto a shape family's frames; used for the pond, whose art is
 * a bordered block. The concave and diagonal corners have no art of their own and
 * reuse the nearest convex corner.
 */
function stampBlock(atlas, frames, blockCol, blockRow) {
  const [interior, edgeN, edgeE, edgeS, edgeW, cornerNE, cornerNW, cornerSE, cornerSW] = frames
  const source = {
    [interior]: [blockCol + 1, blockRow + 1],
    [edgeN]: [blockCol + 1, blockRow],
    [edgeE]: [blockCol + 2, blockRow + 1],
    [edgeS]: [blockCol + 1, blockRow + 2],
    [edgeW]: [blockCol, blockRow + 1],
    [cornerNE]: [blockCol + 2, blockRow],
    [cornerNW]: [blockCol, blockRow],
    [cornerSE]: [blockCol + 2, blockRow + 2],
    [cornerSW]: [blockCol, blockRow + 2],
  }
  const target = {
    [interior]: interior,
    [edgeN]: edgeN,
    [edgeE]: edgeE,
    [edgeS]: edgeS,
    [edgeW]: edgeW,
    [cornerNE]: cornerNE,
    [cornerNW]: cornerNW,
    [cornerSE]: cornerSE,
    [cornerSW]: cornerSW,
    [interior + 9]: cornerNE,
    [interior + 10]: cornerNW,
    [interior + 11]: cornerSE,
    [interior + 12]: cornerSW,
    [interior + 13]: cornerNE,
    [interior + 14]: cornerNW,
    [interior + 15]: cornerSE,
    [interior + 16]: cornerSW,
  }
  for (const [frame, shape] of Object.entries(target)) {
    const at = source[shape]
    if (at) stamp(atlas, Number(frame), at[0], at[1])
  }
}

/**
 * Paints a tile over a floor cell: the atlas is RGBA, so transparent pixels must
 * fall back to the floor art underneath instead of reading as a hole in the map.
 */
function compositeOver(over, floor) {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const o = (y * TILE_SIZE + x) * 4
      if (over[o + 3] < 8) floor.copy(over, o, o, o + 4)
    }
  }
  return over
}

/**
 * Whether a pixel is part of the flat ground the wall bank is drawn on. The tree
 * bank shades its grass (`88,160,128` and the `48,136,104` shadow) with the same
 * teal hue, while the leaves stay yellow-green (`hue ~100`) and the trunk brown
 * (`hue ~30`), so a hue window separates ground from tree without a long list of
 * exact colours. `bg` is the crown's own ground colour, for the tiles (cave rock)
 * whose ground is not that teal.
 */
function isGround(r, g, b, bg) {
  if (Math.abs(r - bg[0]) < 24 && Math.abs(g - bg[1]) < 24 && Math.abs(b - bg[2]) < 24) return true
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0 || max <= 60) return false
  let hue
  if (max === g) hue = 60 * ((b - r) / d + 2)
  else if (max === b) hue = 60 * ((r - g) / d + 4)
  else hue = 60 * (((g - b) / d) % 6)
  if (hue < 0) hue += 360
  return hue >= 130 && hue <= 195
}

/**
 * Replaces a tile's flat ground colour with another tile's pixels, so a tree drawn
 * on grass can sit on the floor, stack without showing ground between the tops, or
 * (over the trunk) let the trunk show through.
 */
function keyBackground(over, fill, bg) {
  const out = Buffer.from(over)
  for (let i = 0; i < out.length; i += 4) {
    if (isGround(out[i], out[i + 1], out[i + 2], bg)) fill.copy(out, i, i, i + 4)
  }
  return out
}

/**
 * A route's field: the walkable ground, its floor variants, the three-wide wall
 * motif (six rows, each three columns, drawn over the floor), the sheet's shared
 * rocky-banked pond and the ledge lip. `wall` is `[top, body, lower, base]`, each a
 * three-entry list of source `[col, row]` cells: `top` is the crown, `body` its
 * upper leaves, `lower` its lower leaves and `base` the trunk platform. Two stacked
 * trees read `top, body, crown+lower, body+base, ...`, so the crown of the tree
 * below lands on the lower leaves of the tree above and its body hides that tree's
 * trunk; only the mass's foot shows the trunk platform. `ledge` is `{ left,
 * center, right }`, the three-source-cell run the ledge draws. `tallGrass` is the
 * tufted grass ground tile the walkable patches stamp, drawn whole (each field
 * picks the tuft drawn on its own ground). The ledge lip is re-grounded onto the
 * field's floor (`overFill`), so a dark-ground field draws it on that ground.
 */
function fieldFrames(atlas, { floor, floorAlts, wall, ledge, tallGrass, water = [10, 0] }) {
  stamp(atlas, FRAME_FLOOR, floor[0], floor[1])
  FLOOR_ALT_FRAMES.forEach((frame, index) => {
    const [col, row] = floorAlts[index]
    stamp(atlas, frame, col, row)
  })

  const [top, body, lower, base] = wall
  const floorTile = sourceTile(floor[0], floor[1])
  // The whole wall bank is drawn on one flat ground colour; sample it from the
  // crown, not per tile (a body row's corner pixel is a leaf, not the ground).
  const crown = sourceTile(top[0][0], top[0][1])
  const bg = [crown[0], crown[1], crown[2]]
  const blank = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)
  // The rows of a mass that sit against the floor — the top, its body row and its
  // trunk foot — leave their ground transparent so the floor the scene picks per
  // tile (its wall-edge variant) shows through instead of a baked flat colour. The
  // stacked rows (crown, mid, lower) fill against the row above so the canopy
  // stays dense where two trees overlap.
  const overNone = (source) => keyBackground(sourceTile(source[0], source[1]), blank, bg)
  const overFill = (source, fill) =>
    compositeOver(keyBackground(sourceTile(source[0], source[1]), sourceTile(fill[0], fill[1]), bg), floorTile)

  FRAME_WALL_TOP.forEach((frame, i) => stampTile(atlas, frame, overNone(top[i])))
  FRAME_WALL_BODY.forEach((frame, i) => stampTile(atlas, frame, overNone(body[i])))
  // The crown of the tree below is laid over the lower leaves of the tree above
  // (`CROWN`); the row under it is the tree's upper leaves laid over the trunk of
  // the tree above (`MID`), so the trunk stays hidden instead of the lower leaves
  // showing through the body.
  FRAME_WALL_CROWN.forEach((frame, i) => stampTile(atlas, frame, overFill(top[i], lower[i])))
  FRAME_WALL_MID.forEach((frame, i) => stampTile(atlas, frame, overFill(body[i], base[i])))
  FRAME_WALL_LOWER.forEach((frame, i) => stampTile(atlas, frame, overFill(lower[i], base[i])))
  FRAME_WALL_BASE.forEach((frame, i) => stampTile(atlas, frame, overNone(base[i])))

  stampBlock(atlas, WATER_TUPLE, water[0], water[1])
  // The grass tuft is stamped whole: the sheet has one tuft per ground palette
  // (the forest's `2,33` is drawn on the forest ground), so each field picks the
  // tuft that already sits on its own floor. The ledge lip has no dark-ground
  // variant, so it keeps the field's own ground (its sheet background is keyed off
  // and filled with the floor).
  if (tallGrass) stamp(atlas, FRAME_TALL_GRASS, tallGrass[0], tallGrass[1])
  stampTile(atlas, FRAME_LEDGE_LEFT, overFill(ledge.left, floor))
  stampTile(atlas, FRAME_LEDGE, overFill(ledge.center, floor))
  stampTile(atlas, FRAME_LEDGE_RIGHT, overFill(ledge.right, floor))
}

/**
 * The shared tree bank: the real FireRed tree, a 3x4 block drawn in the bottom
 * left of the sheet above the pond. Four rows (crown, body, lower leaves, trunk
 * platform) of three columns (left, centre, right), repeated by the wall pattern.
 */
const TREE = [
  [
    [3, 34],
    [4, 34],
    [5, 34],
  ],
  [
    [3, 35],
    [4, 35],
    [5, 35],
  ],
  [
    [3, 36],
    [4, 36],
    [5, 36],
  ],
  [
    [3, 37],
    [4, 37],
    [5, 37],
  ],
]

/** Grass route: mint grass, a tree border and a rocky-banked pond. */
function outdoorFrames(atlas) {
  fieldFrames(atlas, {
    floor: [6, 1],
    floorAlts: [
      [6, 0],
      [1, 3],
      [2, 3],
      [1, 4],
      [2, 4],
    ],
    wall: TREE,
    ledge: { left: [6, 4], center: [7, 4], right: [8, 4] },
    tallGrass: [7, 0],
  })
}

/**
 * Forest: Viridian Forest's darker ground under the same dense tree border. The
 * floor is a weighted mix of the forest ground tiles (all `0,34`-family,
 * `rgb(88,160,128)`) that `FRLG_FOREST_TILESET` renders: `0,34` base, `2,34`,
 * `3,34`, `5,34` as variety and the flowered `0,38` rare. The tuft `2,33` is the
 * dark-palette tall grass drawn on that ground.
 */
function forestFrames(atlas) {
  fieldFrames(atlas, {
    floor: [0, 34],
    floorAlts: [
      [2, 34],
      [3, 34],
      [5, 34],
      [0, 38],
      [3, 34],
    ],
    wall: TREE,
    ledge: { left: [6, 4], center: [7, 4], right: [8, 4] },
    tallGrass: [2, 33],
  })
}

/** Cave: Mt. Moon grey rock under a boulder border. */
function caveFrames(atlas) {
  const rockTop = [3, 42]
  const rockBody = [1, 44]
  const rockBase = [2, 44]
  fieldFrames(atlas, {
    floor: [2, 24],
    floorAlts: [
      [1, 24],
      [3, 24],
      [4, 24],
      [2, 25],
      [3, 25],
    ],
    wall: [
      [rockTop, rockTop, rockTop],
      [rockBody, rockBody, rockBody],
      [rockBody, rockBody, rockBody],
      [rockBase, rockBase, rockBase],
    ],
    ledge: { left: [6, 4], center: [7, 4], right: [8, 4] },
    tallGrass: [7, 0],
  })
}

const ATLASES = {
  outdoor: outdoorFrames,
  forest: forestFrames,
  cave: caveFrames,
}

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, compose] of Object.entries(ATLASES)) {
  const atlas = Buffer.alloc(ATLAS_WIDTH * ATLAS_HEIGHT * 4)
  compose(atlas)
  const png = encodePng(ATLAS_WIDTH, ATLAS_HEIGHT, atlas)
  writeFileSync(new URL(`${name}.png`, OUT_DIR), png)
  console.log(`wrote src/assets/frlg/${name}.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`)
}
