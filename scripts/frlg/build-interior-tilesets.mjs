// The three interior fields the region's laboratory, Pokémon Centre and houses
// draw, composed from the pret/pokefirered decomp's own metatiles rather than from
// a field sheet (docs/tileset-spec.md §2b): each field is a 4-column x 13-row atlas
// of 16px cells (64x208) plus a committed manifest of six kinds.
//
//   node scripts/frlg/build-interior-tilesets.mjs [decompRoot]
//
// decompRoot comes from argv[2], then PKM_FRLG_DECOMP, then the asset store's own
// `pokefirered/` checkout — never a path inside the worktree (AGENTS.md, "Asset
// trees"). The sparse checkout must carry:
//
//   data/tilesets/primary/building
//   data/tilesets/secondary/{lab,pokemon_center,generic_building_1}
//   data/layouts/{PalletTown_ProfessorOaksLab,PokemonCenter_1F,House1}
//
// The decode is the decomp's own: a metatile is 8 little-endian u16 — the bottom
// 2x2 layer first, then the top one — where `tile = e & 0x3ff` indexes the primary
// `tiles.png` below 640 and the secondary one at `index - 640`, `palette =
// (e >> 12) & 0xf` indexes the **metatile's own** set's `palettes/NN.pal` (a
// secondary metatile uses the secondary palette), and pixel index 0 is transparent.
// A layout's `map.bin` is `width * height` u16 whose low ten bits are the metatile
// id. Every kind is composited over the field's floor so no cell of map shows a
// hole, and frames 6-51 repeat that floor. The build is deterministic: the same
// checkout writes byte-identical PNGs and byte-identical JSON.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'
import { assetPath } from '../assets/root.mjs'

const PRIMARY_TILES = 640
const PRIMARY_METATILES = 640

const TILE_SIZE = 16
const COLS = 4
const ROWS = 13
const FRAMES = COLS * ROWS
const ATLAS_WIDTH = TILE_SIZE * COLS
const ATLAS_HEIGHT = TILE_SIZE * ROWS

const ATLAS_DIR = new URL('../../src/assets/frlg/', import.meta.url)
const DATA_DIR = new URL('../../src/data/frlg/', import.meta.url)

/** The atlas's frame order: the ground frame 0, then the five fixtures. */
export const KIND_ORDER = ['floor', 'wall', 'door', 'counter', 'heal', 'pc']

/**
 * One row per field: the layout the decomp draws it from (with its own width and
 * height), the secondary metatile set it composes against, and the pinned metatile
 * id of each kind. Those ids are verified against the rendered layouts
 * (`docs/tileset-spec.md` §2b) and are the manifest's `metatiles` pin.
 */
export const FIELDS = [
  {
    id: 'interior-lab',
    layout: 'PalletTown_ProfessorOaksLab',
    width: 13,
    height: 14,
    secondary: 'lab',
    kindIds: { floor: 649, wall: 105, door: 665, counter: 641, heal: 685, pc: 117 },
  },
  {
    id: 'interior-centre',
    layout: 'PokemonCenter_1F',
    width: 15,
    height: 10,
    secondary: 'pokemon_center',
    kindIds: { floor: 641, wall: 644, door: 27, counter: 692, heal: 685, pc: 672 },
  },
  {
    id: 'interior-house',
    layout: 'House1',
    width: 11,
    height: 9,
    secondary: 'generic_building_1',
    kindIds: { floor: 273, wall: 172, door: 27, counter: 327, heal: 335, pc: 341 },
  },
]

/**
 * Throws when a kind's pinned metatile id is one the layout's `map.bin` never
 * places, so a wrong id is caught here rather than drawn as a plausible crop.
 *
 * @param {Readonly<Record<string, number>>} kindIds
 * @param {ReadonlySet<number>} layoutIds
 * @param {string} label
 */
export function assertKindInLayout(kindIds, layoutIds, label) {
  for (const kind of KIND_ORDER) {
    const id = kindIds[kind]
    if (!layoutIds.has(id)) {
      throw new Error(`${label}: the ${kind} metatile ${id} is not in the layout's map.bin`)
    }
  }
}

/**
 * Throws when a composed cell still carries a transparent pixel, which is what a
 * kind that does not cover its floor would leave in a field.
 *
 * @param {Buffer | Uint8Array} cell
 * @param {string} label
 */
export function assertOpaque(cell, label) {
  for (let i = 3; i < cell.length; i += 4) {
    if (cell[i] !== 255) {
      throw new Error(`${label}: a transparent pixel survived the floor under it`)
    }
  }
}

/** A JASC-PAL file's `r g b` rows: line 2 is the count, line 3 the first colour. */
function parsePal(file) {
  const lines = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
  const count = Number(lines[2])
  const colours = []
  for (let i = 0; i < count; i++) {
    const [r, g, b] = lines[3 + i].split(/\s+/).map(Number)
    colours.push([r, g, b])
  }
  return colours
}

/** One metatile set: its 4bpp index sheet, its entries and its 16 palettes. */
function loadSet(dir, label) {
  const sheet = decodePng(readFileSync(join(dir, 'tiles.png')))
  if (sheet.indices === null) throw new Error(`${label}: tiles.png is not a palette PNG`)
  const metatiles = readFileSync(join(dir, 'metatiles.bin'))
  const palettes = []
  for (let i = 0; i < 16; i++) {
    palettes.push(parsePal(join(dir, 'palettes', `${String(i).padStart(2, '0')}.pal`)))
  }
  return { sheet, metatiles, palettes }
}

/**
 * One 8x8 tile of a metatile set as RGBA, its palette indexed from the set the
 * **metatile** belongs to and pixel index 0 left transparent.
 */
function tilePixels(sets, tile, palette, hflip, vflip) {
  const sheet = tile < PRIMARY_TILES ? sets.primary.sheet : sets.secondary.sheet
  const index = tile < PRIMARY_TILES ? tile : tile - PRIMARY_TILES
  const across = Math.floor(sheet.width / 8)
  const sx = (index % across) * 8
  const sy = Math.floor(index / across) * 8
  const out = Buffer.alloc(8 * 8 * 4)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const px = hflip ? 7 - x : x
      const py = vflip ? 7 - y : y
      const value = sheet.indices[(sy + py) * sheet.width + sx + px]
      if (value === 0) continue
      const colour = palette[value]
      if (colour === undefined) continue
      const at = (y * 8 + x) * 4
      out[at] = colour[0]
      out[at + 1] = colour[1]
      out[at + 2] = colour[2]
      out[at + 3] = 255
    }
  }
  return out
}

/** One 16x16 metatile: its bottom layer, then its top layer over it. */
function compose(sets, id) {
  const secondary = id >= PRIMARY_METATILES
  const metatiles = secondary ? sets.secondary.metatiles : sets.primary.metatiles
  const palettes = secondary ? sets.secondary.palettes : sets.primary.palettes
  const offset = (secondary ? id - PRIMARY_METATILES : id) * 16
  if (offset + 16 > metatiles.length) {
    throw new Error(`metatile ${id} is past the end of its set's metatiles.bin`)
  }
  const out = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4)
  for (let i = 0; i < 8; i++) {
    const entry = metatiles.readUInt16LE(offset + i * 2)
    const tile = tilePixels(
      sets,
      entry & 0x3ff,
      palettes[(entry >> 12) & 0xf],
      (entry & 0x400) !== 0,
      (entry & 0x800) !== 0,
    )
    const ox = (i % 2) * 8
    const oy = (Math.floor(i / 2) % 2) * 8
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const from = (y * 8 + x) * 4
        if (tile[from + 3] === 0) continue
        tile.copy(out, ((oy + y) * TILE_SIZE + ox + x) * 4, from, from + 4)
      }
    }
  }
  return out
}

/** `over` composited onto `ground`: the cell's opaque pixels win, the rest is ground. */
function over(over, ground) {
  const out = Buffer.from(ground)
  for (let i = 0; i < over.length; i += 4) {
    if (over[i + 3] === 0) continue
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

/** The metatile ids a layout's `map.bin` really places, collision bits dropped. */
function layoutMetatiles(root, field) {
  const file = join(root, 'data', 'layouts', field.layout, 'map.bin')
  if (!existsSync(file)) throw new Error(`${field.id}: the decomp has no ${file}`)
  const map = readFileSync(file)
  const cells = field.width * field.height
  if (map.length < cells * 2) {
    throw new Error(
      `${field.id}: ${field.layout}/map.bin holds ${map.length / 2} cells, not ${cells} (${field.width}x${field.height})`,
    )
  }
  const ids = new Set()
  for (let i = 0; i < cells; i++) ids.add(map.readUInt16LE(i * 2) & 0x3ff)
  return ids
}

/** One field's atlas and manifest: frames 0-5 the kinds, 6-51 its own floor. */
function buildField(root, field) {
  const sets = {
    primary: loadSet(join(root, 'data', 'tilesets', 'primary', 'building'), 'primary/building'),
    secondary: loadSet(join(root, 'data', 'tilesets', 'secondary', field.secondary), field.secondary),
  }

  assertKindInLayout(field.kindIds, layoutMetatiles(root, field), field.id)

  const floor = compose(sets, field.kindIds.floor)
  assertOpaque(floor, `${field.id}: floor`)

  const atlas = Buffer.alloc(ATLAS_WIDTH * ATLAS_HEIGHT * 4)
  for (let frame = 0; frame < FRAMES; frame++) stampTile(atlas, frame, floor)

  const cells = {}
  for (const [frame, kind] of KIND_ORDER.entries()) {
    const cell = kind === 'floor' ? floor : over(compose(sets, field.kindIds[kind]), floor)
    assertOpaque(cell, `${field.id}: ${kind}`)
    stampTile(atlas, frame, cell)
    cells[kind] = frame
  }

  return {
    atlas,
    manifest: {
      kind: 'pkmr-tileset',
      version: 1,
      id: field.id,
      atlas: {
        tileSize: TILE_SIZE,
        cols: COLS,
        rows: ROWS,
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
      },
      cells,
      metatiles: Object.fromEntries(KIND_ORDER.map((kind) => [kind, field.kindIds[kind]])),
    },
  }
}

function main() {
  const root = resolve(process.argv[2] ?? process.env.PKM_FRLG_DECOMP ?? assetPath('pokefirered'))
  const primary = join(root, 'data', 'tilesets', 'primary', 'building')
  if (!existsSync(primary)) {
    throw new Error(`the decomp root carries no data/tilesets/primary/building: ${root}`)
  }
  for (const field of FIELDS) {
    const secondary = join(root, 'data', 'tilesets', 'secondary', field.secondary)
    if (!existsSync(secondary)) {
      throw new Error(`${field.id}: the decomp carries no data/tilesets/secondary/${field.secondary}`)
    }
  }

  mkdirSync(ATLAS_DIR, { recursive: true })
  mkdirSync(DATA_DIR, { recursive: true })

  for (const field of FIELDS) {
    const { atlas, manifest } = buildField(root, field)
    const png = encodePng(ATLAS_WIDTH, ATLAS_HEIGHT, atlas)
    writeFileSync(new URL(`${field.id}.png`, ATLAS_DIR), png)
    console.log(
      `wrote src/assets/frlg/${field.id}.png ${ATLAS_WIDTH}x${ATLAS_HEIGHT} (${png.length} bytes)`,
    )
    console.log(`  ${KIND_ORDER.map((kind) => `${kind} ${field.kindIds[kind]}`).join(', ')}`)
    const template = JSON.stringify(manifest, null, 2) + '\n'
    writeFileSync(new URL(`${field.id}.json`, DATA_DIR), template)
    console.log(
      `wrote src/data/frlg/${field.id}.json ${COLS}x${ROWS} cells (${Buffer.byteLength(template)} bytes)`,
    )
  }
}

const entry = process.argv[1]
if (entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url) main()
