// Writes the committed placeholder atlases that keep a clone without the ripped
// art building, booting and rendering something recognisable.
//
//   node scripts/assets/build-placeholders.mjs [atlas...]
//
// With no argument it writes every atlas; with one or more it writes only those
// (so a clone with no pack can regenerate the single placeholder it owns).
//
// The ripped atlases themselves are gitignored and packed locally from the
// private `pkrl-assets` store (`npm run assets:pack`). Every module that draws
// one resolves it through `import.meta.glob` and falls back to
// `src/assets/placeholders/<same path>` when the real file is absent, so the
// placeholder must carry the real file's pixel size: Phaser slices it into the
// same frame grid the manifests describe.
//
// Run this with the real art in place (it measures the files); its output is
// committed and never regenerated in CI.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

const ASSETS = fileURLToPath(new URL('../../src/assets/', import.meta.url))
const OUT = fileURLToPath(new URL('../../src/assets/placeholders/', import.meta.url))

/** Every ripped atlas a module imports or a scene loads by URL. */
const ATLASES = [
  'frlg/outdoor.png',
  'frlg/forest.png',
  'frlg/cave.png',
  'frlg/trainers.png',
  'frlg/overworld.png',
  'frlg/player.png',
  'frlg/type-icons.png',
  'frlg/status-icons.png',
  'frlg/hpbar.png',
  'frlg/cursor.png',
  'frlg/move-categories.png',
  'frlg/ground-item.png',
  'frlg/sign.png',
  'anil/item-icons.png',
  'moves.png',
  'wood.png',
  'desert.png',
  'apple-woods.png',
  'lush-prairie.png',
  'beach-cave.png',
]

/** Solid surface + one lighter border, so a placeholder reads as one at a glance. */
const FILL = [58, 66, 82]
const BORDER = [120, 136, 160]

const only = process.argv.slice(2)
for (const path of only) {
  if (!ATLASES.includes(path)) {
    console.error(`build-placeholders: unknown atlas "${path}"`)
    process.exit(1)
  }
}
const TARGETS = only.length > 0 ? ATLASES.filter((path) => only.includes(path)) : ATLASES

for (const path of TARGETS) {
  // The sign is art, not a swatch: its fallback is a transparent board-and-post
  // silhouette, so a clone without the pack draws a signpost rather than a block.
  if (path === 'frlg/sign.png') {
    const size = 16
    const rgba = Buffer.alloc(size * size * 4)
    const put = (x, y, [r, g, b]) => {
      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
    for (let y = 3; y <= 8; y++) for (let x = 2; x <= 13; x++) put(x, y, BORDER)
    for (let y = 9; y <= 13; y++) for (let x = 7; x <= 8; x++) put(x, y, FILL)
    const target = OUT + path
    mkdirSync(dirname(target), { recursive: true })
    const png = encodePng(size, size, rgba)
    writeFileSync(target, png)
    console.log(`wrote src/assets/placeholders/${path} ${size}x${size} (${png.length} bytes)`)
    continue
  }

  const source = decodePng(readFileSync(ASSETS + path))
  const { width, height } = source
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const [r, g, b] = edge ? BORDER : FILL
      const i = (y * width + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  }
  const target = OUT + path
  mkdirSync(dirname(target), { recursive: true })
  const png = encodePng(width, height, rgba)
  writeFileSync(target, png)
  console.log(`wrote src/assets/placeholders/${path} ${width}x${height} (${png.length} bytes)`)
}
