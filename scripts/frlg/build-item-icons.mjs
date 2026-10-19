// Packs the FireRed/LeafGreen item icons into src/assets/frlg/item-icons.png.
//
// Source: the raw 24x24 icons under the FRLG item icon art tree, named per the
// pret/pokefirered decomp so the id mapping is authoritative; see
// src/data/itemIcons.ts. The tree is gitignored — only the processed atlas and
// its manifest are committed — and its directory arrives through argv[2] or
// ITEM_ICON_SOURCE (AGENTS.md's Asset trees rule), never a path inside the
// worktree.
//
// The manifest (src/data/frlg/item-icons.json) maps each run item id in
// src/data/items.ts to its atlas frame; several items share one icon (Super and
// Hyper Potion, the status heals), so only unique icons are packed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ICON_SIZE = 24
const COLS = 8

const sourceArg = process.argv[2] ?? process.env.ITEM_ICON_SOURCE
if (!sourceArg) {
  console.error(
    'usage: node scripts/frlg/build-item-icons.mjs <source-dir>  (or set ITEM_ICON_SOURCE)',
  )
  process.exit(1)
}

// src/data/items.ts id -> FRLG icon file. Icon file per item from the decomp's
// item icon table (src/data/item_icon_table.h).
const ITEM_ICONS = {
  pokeball: 'poke_ball',
  greatball: 'great_ball',
  ultraball: 'ultra_ball',
  masterball: 'master_ball',
  // Gen 3 has the Premier Ball but ships no distinct icon; the Poke Ball stands in.
  premierball: 'poke_ball',
  potion: 'potion',
  superpotion: 'potion',
  hyperpotion: 'potion',
  fullrestore: 'large_potion',
  antidote: 'antidote',
  paralyzeheal: 'status_heal',
  awakening: 'status_heal',
  burnheal: 'status_heal',
  iceheal: 'status_heal',
  fullheal: 'full_heal',
  leftovers: 'leftovers',
  sitrusberry: 'sitrus_berry',
  oranberry: 'oran_berry',
  lumberry: 'lum_berry',
  silkscarf: 'silk_scarf',
  charcoal: 'charcoal',
  mysticwater: 'mystic_water',
  miracleseed: 'miracle_seed',
  magnet: 'magnet',
  nevermeltice: 'never_melt_ice',
  blackbelt: 'black_belt',
  poisonbarb: 'poison_barb',
  softsand: 'soft_sand',
  sharpbeak: 'sharp_beak',
  twistedspoon: 'twisted_spoon',
  silverpowder: 'silver_powder',
  hardstone: 'hard_stone',
  spelltag: 'spell_tag',
  dragonfang: 'dragon_fang',
  blackglasses: 'black_glasses',
  metalcoat: 'metal_coat',
  // No FRLG icon exists (Fairy is post-Gen 3); the decomp's fallback stands in.
  fairyfeather: 'question_mark',
}

const SOURCES = resolve(sourceArg)
const ATLAS = new URL('../../src/assets/frlg/item-icons.png', import.meta.url)
const MANIFEST = new URL('../../src/data/frlg/item-icons.json', import.meta.url)

const files = [...new Set(Object.values(ITEM_ICONS))]
const frames = files.map((file) => {
  const img = decodePng(readFileSync(join(SOURCES, `${file}.png`)))
  if (img.width !== ICON_SIZE || img.height !== ICON_SIZE) {
    throw new Error(`expected ${file}.png to be ${ICON_SIZE}x${ICON_SIZE}, got ${img.width}x${img.height}`)
  }
  return img
})

const rows = Math.ceil(frames.length / COLS)
const atlasWidth = COLS * ICON_SIZE
const atlasHeight = rows * ICON_SIZE
const data = Buffer.alloc(atlasWidth * atlasHeight * 4)

frames.forEach((frame, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const dx = col * ICON_SIZE
  const dy = row * ICON_SIZE
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const from = (y * ICON_SIZE + x) * 4
      const to = ((dy + y) * atlasWidth + dx + x) * 4
      data[to] = frame.data[from]
      data[to + 1] = frame.data[from + 1]
      data[to + 2] = frame.data[from + 2]
      data[to + 3] = frame.data[from + 3]
    }
  }
})

const index = Object.fromEntries(files.map((file, i) => [file, i]))
const items = Object.fromEntries(Object.entries(ITEM_ICONS).map(([id, file]) => [id, index[file]]))

mkdirSync(new URL('../../src/assets/frlg/', import.meta.url), { recursive: true })
mkdirSync(new URL('../../src/data/frlg/', import.meta.url), { recursive: true })
writeFileSync(ATLAS, encodePng(atlasWidth, atlasHeight, data))
writeFileSync(
  MANIFEST,
  `${JSON.stringify({ size: ICON_SIZE, cols: COLS, frames: files, items }, null, 2)}\n`,
)
console.log(
  `wrote src/assets/frlg/item-icons.png ${atlasWidth}x${atlasHeight} (${files.length} icons, ${Object.keys(items).length} items)`,
)
