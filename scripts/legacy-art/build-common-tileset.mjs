// Packs the biome-agnostic dungeon tiles (stairs/trap/chest/item/carpet — same
// meaning in every tileset, not tied to a particular biome's floor/wall art)
// into one small source sheet, sprite-sources/tilesets/common.png, a grid of
// 24x24 cells in FRAME_STAIRS..FRAME_CARPET order (see src/core/tileset.ts).
//
// Reads one named crop per slot from sprite-sources/tilesets/ — stairs.png,
// trap.png, chest.png, item.png, carpet.png — and leaves a slot fully
// transparent when its source file doesn't exist yet, so extract-*-tileset.mjs
// scripts can fall back to the procedural drawer for that slot. The carpet is
// drawn procedurally here since no ripped sheet crop exists for it. Re-run
// after adding a missing source file:
//
//   node scripts/build-common-tileset.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'

const TILE_SIZE = 24
const SLOTS = ['stairs', 'trap', 'chest', 'item', 'carpet']

// Procedural shop carpet: deep-red rug with a gold fringe border and a
// diamond inlay, drawn so each 24x24 tile reads as a corner/edge of the rug.
function carpetTile() {
  const base = [0xb0, 0x2a, 0x2a, 255]
  const border = [0x8a, 0x1a, 0x1a, 255]
  const fringe = [0xe8, 0xc8, 0x6a, 255]
  const inlay = [0xd0, 0x5a, 0x5a, 255]
  const tile = new Array(TILE_SIZE * TILE_SIZE)
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let color = base
      if (x === 0 || y === 0 || x === TILE_SIZE - 1 || y === TILE_SIZE - 1) {
        color = border
      } else if (x === 1 || y === 1 || x === TILE_SIZE - 2 || y === TILE_SIZE - 2) {
        color = fringe
      } else if (
        x + y >= TILE_SIZE - 2 &&
        Math.abs(x - y) <= 2 &&
        (x + y) % 2 === 0
      ) {
        color = fringe
      } else if (Math.abs(x - y) <= 1 && (x + y) % 2 === 0) {
        color = inlay
      }
      tile[y * TILE_SIZE + x] = color
    }
  }
  return tile
}

const tilesetsDir = new URL('../sprite-sources/tilesets/', import.meta.url)
const atlas = Buffer.alloc(TILE_SIZE * SLOTS.length * TILE_SIZE * 4)

let found = 0
SLOTS.forEach((name, col) => {
  const src = new URL(`${name}.png`, tilesetsDir)
  let tile
  if (name === 'carpet') {
    tile = { width: TILE_SIZE, height: TILE_SIZE, data: Buffer.from(carpetTile().flatMap((c) => c)) }
  } else if (!existsSync(src)) {
    return
  } else {
    tile = decodePng(readFileSync(src))
  }
  if (tile.width !== TILE_SIZE || tile.height !== TILE_SIZE)
    throw new Error(`${name}.png must be ${TILE_SIZE}x${TILE_SIZE}, got ${tile.width}x${tile.height}`)
  for (let y = 0; y < TILE_SIZE; y++) {
    const so = y * TILE_SIZE * 4
    const do_ = (y * SLOTS.length * TILE_SIZE + col * TILE_SIZE) * 4
    tile.data.copy(atlas, do_, so, so + TILE_SIZE * 4)
  }
  found++
})

const png = encodePng(TILE_SIZE * SLOTS.length, TILE_SIZE, atlas)
writeFileSync(new URL('common.png', tilesetsDir), png)
console.log(`wrote sprite-sources/tilesets/common.png (${found}/${SLOTS.length} slots filled)`)
