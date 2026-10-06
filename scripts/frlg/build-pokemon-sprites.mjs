// Packs FireRed/LeafGreen-style Pokémon battle sprites into the game's atlases
// (`src/assets/frlg/pokemon-{front,back,icon}.png` plus one manifest,
// `src/data/frlg/pokemon-sprites.json`).
//
// Source: the pokeemerald-expansion repo's `graphics/pokemon/<species>/`
// (github.com/rh-hideout/pokeemerald-expansion, gitignored, never
// redistributed), which carries GBA-sized front/back/icon art for every
// generation. Point the script at the checkout:
//
//   node scripts/frlg/build-pokemon-sprites.mjs <checkout>/graphics/pokemon
//
// Each species folder holds a paletted PNG (`front.png`/`anim_front.png` for the
// front, `back.png`, `icon.png`); the first palette entry is the flat background
// key, keyed out here. The back sheets are exported in the source with the shiny
// palette baked in, so they are recoloured by palette index with the folder's
// `normal.pal`. `anim_front` sheets are two 64x64 frames stacked, so the first
// frame is taken. The dex is Gen 9, so a forme without its own folder falls back
// to its base species' art.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRONT = 64
const BACK = 64
const ICON = 32
const COLS = 32

const SPECIES = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/dex/species.json', import.meta.url)), 'utf8'))

const sourceDir = process.argv[2] ?? process.env.POKEEMERALD_POKEMON
if (!sourceDir) {
  throw new Error('usage: node scripts/frlg/build-pokemon-sprites.mjs <pokeemerald-expansion>/graphics/pokemon')
}

const folders = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
const byNormalized = new Map()
for (const folder of folders) byNormalized.set(folder.replace(/_/g, ''), folder)

const byNum = new Map()
for (const species of SPECIES) {
  const current = byNum.get(species.num)
  if (!current || (current.forme && !species.forme)) byNum.set(species.num, species)
}

/** The expansion folder a dex species draws from: its own, else its base form. */
function folderFor(species) {
  const direct = byNormalized.get(species.id)
  if (direct) return direct
  const base = byNum.get(species.num)
  return base ? byNormalized.get(base.id) ?? null : null
}

/** The first palette entry the sheet keys its background with. */
function backgroundKey(buf) {
  let off = 8
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.subarray(off + 4, off + 8).toString('ascii')
    if (type === 'PLTE') return [buf[off + 8], buf[off + 9], buf[off + 10]]
    off += 12 + len
    if (type === 'IEND') break
  }
  return null
}

const tileCache = new Map()

/** JASC-PAL text ("JASC-PAL" / "0100" / count / "r g b" lines) as RGB triples. */
function parsePalette(buf) {
  const lines = buf
    .toString('ascii')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
  const count = Number.parseInt(lines[2], 10)
  const colors = []
  for (let i = 0; i < count; i++) {
    colors.push(lines[3 + i].trim().split(/\s+/).map(Number))
  }
  return colors
}

/**
 * A species folder's normal palette. Some back PNGs are exported with the shiny
 * palette baked in, so the sheet has to be recoloured by palette index.
 */
function loadNormalPalette(folder) {
  for (const name of ['normal.pal', 'normal_gba.pal']) {
    try {
      return parsePalette(readFileSync(`${sourceDir}/${folder}/${name}`))
    } catch {
      continue
    }
  }
  return null
}

/** Decodes one source sprite, keyed out or recoloured with its normal palette. */
function loadTile(folder, names, normalPalette = null) {
  const cacheKey = `${folder}/${names.join(',')}/${normalPalette ? 'normal' : 'raw'}`
  if (tileCache.has(cacheKey)) return tileCache.get(cacheKey)
  let tile = null
  for (const name of names) {
    const path = `${sourceDir}/${folder}/${name}`
    let buf
    try {
      buf = readFileSync(path)
    } catch {
      continue
    }
    const key = backgroundKey(buf)
    const png = decodePng(buf)
    if (normalPalette && png.indices) {
      const out = Buffer.alloc(png.width * png.height * 4)
      for (let p = 0; p < png.indices.length; p++) {
        const idx = png.indices[p]
        if (idx === 0) continue
        const [r, g, b] = normalPalette[idx] ?? [png.data[p * 4], png.data[p * 4 + 1], png.data[p * 4 + 2]]
        out[p * 4] = r
        out[p * 4 + 1] = g
        out[p * 4 + 2] = b
        out[p * 4 + 3] = 255
      }
      tile = { width: png.width, height: png.height, data: out }
    } else {
      if (key) {
        for (let i = 0; i < png.width * png.height; i++) {
          const o = i * 4
          if (png.data[o] === key[0] && png.data[o + 1] === key[1] && png.data[o + 2] === key[2]) {
            png.data[o + 3] = 0
          }
        }
      }
      tile = png
    }
    break
  }
  tileCache.set(cacheKey, tile)
  return tile
}

/** Copies the top-left `size`x`size` cell of a decoded sheet into an atlas cell. */
function blit(atlas, atlasCols, frame, size, sheet) {
  if (!sheet) return
  const col = frame % atlasCols
  const row = Math.floor(frame / atlasCols)
  for (let y = 0; y < size && y < sheet.height; y++) {
    for (let x = 0; x < size && x < sheet.width; x++) {
      const from = (y * sheet.width + x) * 4
      const to = (((row * size + y) * atlasCols * size) + col * size + x) * 4
      if (sheet.data[from + 3] === 0) continue
      atlas[to] = sheet.data[from]
      atlas[to + 1] = sheet.data[from + 1]
      atlas[to + 2] = sheet.data[from + 2]
      atlas[to + 3] = 255
    }
  }
}

const rows = Math.ceil(SPECIES.length / COLS)
const front = Buffer.alloc(COLS * FRONT * rows * FRONT * 4)
const back = Buffer.alloc(COLS * BACK * rows * BACK * 4)
const icon = Buffer.alloc(COLS * ICON * rows * ICON * 4)

const frames = {}
SPECIES.forEach((species, index) => {
  frames[species.id] = index
  const folder = folderFor(species)
  if (!folder) return
  blit(front, COLS, index, FRONT, loadTile(folder, ['front.png', 'anim_front.png', 'front_gba.png', 'anim_front_gba.png']))
  blit(back, COLS, index, BACK, loadTile(folder, ['back.png', 'back_gba.png'], loadNormalPalette(folder)))
  blit(icon, COLS, index, ICON, loadTile(folder, ['icon.png', 'icon_gba.png']))
})

const assetsDir = fileURLToPath(new URL('../../src/assets/frlg/', import.meta.url))
const dataDir = fileURLToPath(new URL('../../src/data/frlg/', import.meta.url))
mkdirSync(assetsDir, { recursive: true })
mkdirSync(dataDir, { recursive: true })
writeFileSync(`${assetsDir}pokemon-front.png`, encodePng(COLS * FRONT, rows * FRONT, front))
writeFileSync(`${assetsDir}pokemon-back.png`, encodePng(COLS * BACK, rows * BACK, back))
writeFileSync(`${assetsDir}pokemon-icon.png`, encodePng(COLS * ICON, rows * ICON, icon))
writeFileSync(
  `${dataDir}pokemon-sprites.json`,
  `${JSON.stringify(
    {
      front: { size: FRONT, cols: COLS, rows },
      back: { size: BACK, cols: COLS, rows },
      icon: { size: ICON, cols: COLS, rows },
      frames,
    },
    null,
    0,
  )}\n`,
)
console.log(`wrote src/assets/frlg/pokemon-{front,back,icon}.png and the manifest for ${SPECIES.length} species (${COLS}x${rows} grid)`)
