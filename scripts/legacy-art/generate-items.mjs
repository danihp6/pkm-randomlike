// Builds src/assets/items.png from the real item sprites in
// sprite-sources/items/ (gitignored source — only the processed items.png
// output is committed). Atlas: 48x48 frames, 2 cols per row.
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'

export const ITEM_SIZE = 48
export const ITEM_COLS = 2

const SOURCES = new URL('../sprite-sources/items/', import.meta.url)
const ASSETS = new URL('../src/assets/', import.meta.url)

// Frame order must match ITEM_SPRITES in src/entities/items.ts.
const FRAMES = [
  'potion.png',
  'ether.png',
  'coin.png',
  'mt.png',
  'assault_vest.png',
  'eviolite.png',
  'charcoal.png',
  'focus_sash.png',
  'hard_stone.png',
  'miracle_seed.png',
  'mistic_water.png',
  'muscle_band.png',
  'rocky_helmet.png',
  'sitrus_berry.png',
  'soft_sand.png',
  'wide_lens.png',
  'rare_candy.png',
  'air_ballon.png',
  'choice_band.png',
  'choice_scarf.png',
  'choice_specs.png',
  'left_lovers.png',
  'shell_bell.png',
  'black_belt.png',
  'black_glasses.png',
  'magent.png',
  'never_meltice.png',
  'poison_barb.png',
  'sharp_beak.png',
  'silks_carf.png',
  'spell_tag.png',
  'twisted_spoon.png',
  'wise_glasses.png',
  'life_orb.png',
  'expert_belt.png',
  'scope_lens.png',
  'razor_claw.png',
  'quick_claw.png',
]

const frames = FRAMES.map((file) => {
  const img = decodePng(readFileSync(new URL(file, SOURCES)))
  if (img.width !== ITEM_SIZE || img.height !== ITEM_SIZE) {
    throw new Error(
      `expected ${file} to be ${ITEM_SIZE}x${ITEM_SIZE}, got ${img.width}x${img.height}`,
    )
  }
  return img
})

const rows = Math.ceil(frames.length / ITEM_COLS)
const atlasWidth = ITEM_COLS * ITEM_SIZE
const atlasHeight = rows * ITEM_SIZE
const data = Buffer.alloc(atlasWidth * atlasHeight * 4)

frames.forEach((frame, i) => {
  const col = i % ITEM_COLS
  const row = Math.floor(i / ITEM_COLS)
  const dx = col * ITEM_SIZE
  const dy = row * ITEM_SIZE
  for (let y = 0; y < ITEM_SIZE; y++) {
    for (let x = 0; x < ITEM_SIZE; x++) {
      const srcIdx = (y * ITEM_SIZE + x) * 4
      const dstIdx = ((dy + y) * atlasWidth + (dx + x)) * 4
      data[dstIdx] = frame.data[srcIdx]
      data[dstIdx + 1] = frame.data[srcIdx + 1]
      data[dstIdx + 2] = frame.data[srcIdx + 2]
      data[dstIdx + 3] = frame.data[srcIdx + 3]
    }
  }
})

const png = encodePng(atlasWidth, atlasHeight, data)
writeFileSync(new URL('items.png', ASSETS), png)
console.log(`wrote src/assets/items.png ${atlasWidth}x${atlasHeight} (${png.length} bytes)`)
