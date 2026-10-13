// Packs the Pokemon Anil item icons into src/assets/anil/item-icons.png and
// writes the frame manifest (src/data/anil/item-icons.json).
//
// Source: the RPG Maker XP / Pokemon Essentials fangame "Pokemon Anil" by
// EricLostie, `Graphics/Items/` (gitignored, never redistributed). The `[ID]`
// headers of `PBS/items.txt` are the icon file names, so each frame is keyed by
// the normalised file name and `src/data/itemIcons.ts` resolves a catalogue id
// against it with no hand-kept table. Point the script at the checkout:
//
//   node scripts/anil/build-item-icons.mjs <anil>/Graphics/Items
//
// One 24x24 frame per file, 8 columns, nearest-neighbour (`sx = x * 2` for the
// 48x48 majority). Anil's folder is not uniform: 44 of the 893 icons are 50-60px
// (the Mints, the Exp Candies, the Seeds, the Galarica set), so a source is
// scaled to the frame per axis rather than rejected - a throw would make the
// packer unable to run at all. Alpha is copied as it is (no keying).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const FRAME_SIZE = 24
const COLS = 8

const norm = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

const sourceDir =
  process.argv[2] ?? process.env.POKEANIL_ITEMS ?? 'sprite-sources/anil/Graphics/Items'
if (!existsSync(sourceDir)) {
  throw new Error(
    `usage: node scripts/anil/build-item-icons.mjs <anil>/Graphics/Items (missing ${sourceDir})`,
  )
}

// `Key items/` is a subdirectory and holds key-item art, not held items.
const files = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort()
if (files.length === 0) throw new Error(`no .png files in ${sourceDir}`)

/** One decoded source per frame, in file-name order. */
const frames = []
const indexes = new Map()
let scaled = 0
for (const file of files) {
  const key = norm(file.replace(/\.png$/i, ''))
  if (indexes.has(key)) {
    throw new Error(`two sources normalise to "${key}": ${indexes.get(key)} and ${file}`)
  }
  indexes.set(key, file)
  const buf = readFileSync(`${sourceDir}/${file}`)
  if (buf[0] !== 0x89) throw new Error(`not a PNG: ${file}`)
  // `decodePng` ignores IHDR's interlace byte and would decode interlaced art
  // into garbage silently, so the interlace flag is checked here.
  if (buf[28] !== 0) throw new Error(`interlaced PNG not supported: ${file}`)
  const image = decodePng(buf)
  if (image.width === 0 || image.height === 0) throw new Error(`empty image: ${file}`)
  if (image.width !== 48 || image.height !== 48) scaled++
  frames.push({ index: frames.length, image })
}

const rows = Math.ceil(frames.length / COLS)
const atlasWidth = COLS * FRAME_SIZE
const atlasHeight = rows * FRAME_SIZE
const atlas = Buffer.alloc(atlasWidth * atlasHeight * 4)

for (const { index, image } of frames) {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  const dx = col * FRAME_SIZE
  const dy = row * FRAME_SIZE
  for (let y = 0; y < FRAME_SIZE; y++) {
    const sy = Math.min(image.height - 1, Math.floor((y * image.height) / FRAME_SIZE))
    for (let x = 0; x < FRAME_SIZE; x++) {
      const sx = Math.min(image.width - 1, Math.floor((x * image.width) / FRAME_SIZE))
      const from = (sy * image.width + sx) * 4
      const to = ((dy + y) * atlasWidth + dx + x) * 4
      atlas[to] = image.data[from]
      atlas[to + 1] = image.data[from + 1]
      atlas[to + 2] = image.data[from + 2]
      atlas[to + 3] = image.data[from + 3]
    }
  }
}

const map = {}
frames.forEach(({ index }, position) => {
  map[norm(files[position].replace(/\.png$/i, ''))] = index
})

mkdirSync(fileURLToPath(new URL('../../src/assets/anil/', import.meta.url)), { recursive: true })
mkdirSync(fileURLToPath(new URL('../../src/data/anil/', import.meta.url)), { recursive: true })
writeFileSync(
  fileURLToPath(new URL('../../src/assets/anil/item-icons.png', import.meta.url)),
  encodePng(atlasWidth, atlasHeight, atlas),
)
writeFileSync(
  fileURLToPath(new URL('../../src/data/anil/item-icons.json', import.meta.url)),
  `${JSON.stringify({ size: FRAME_SIZE, cols: COLS, count: frames.length, frames: map })}\n`,
)
console.log(
  `wrote src/assets/anil/item-icons.png ${atlasWidth}x${atlasHeight} ` +
    `(${frames.length} icons, ${scaled} scaled to ${FRAME_SIZE}px)`,
)
