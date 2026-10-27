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
// same frame grid the manifests describe. The size comes from the real file when
// the pack is present, and from the committed blank it is replacing otherwise, so
// the script runs and is idempotent on any clone.
//
// Each blank keeps one accent of its own, derived from its path by
// `placeholderAccent.mjs`, so no two atlases paint the same colour. Its output is
// committed and never regenerated in CI.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'
import { accentFor } from './placeholderAccent.mjs'

const ASSETS = fileURLToPath(new URL('../../src/assets/', import.meta.url))
const OUT = fileURLToPath(new URL('../../src/assets/placeholders/', import.meta.url))
const SIGN = 'frlg/sign.png'
const SIGN_SIZE = 16

/** Every ripped atlas a module imports or a scene loads by URL. */
export const ATLASES = [
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

function sourceSize(path) {
  if (existsSync(ASSETS + path)) {
    const { width, height } = decodePng(readFileSync(ASSETS + path))
    return { width, height, from: `src/assets/${path}` }
  }
  if (existsSync(OUT + path)) {
    const { width, height } = decodePng(readFileSync(OUT + path))
    return { width, height, from: `the committed blank src/assets/placeholders/${path}` }
  }
  throw new Error(
    `build-placeholders: no pixel size for "${path}" (neither the packed atlas nor a committed blank exists)`,
  )
}

function blankPng(path, width, height) {
  const { fill, border } = accentFor(path)
  const rgba = Buffer.alloc(width * height * 4)
  const put = (x, y, [r, g, b]) => {
    const i = (y * width + x) * 4
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1
      put(x, y, edge ? border : fill)
    }
  }
  return encodePng(width, height, rgba)
}

// The sign is art, not a swatch: its fallback is a transparent board-and-post
// silhouette, so a clone without the pack draws a signpost rather than a block.
function signPng(path) {
  const { fill, border } = accentFor(path)
  const rgba = Buffer.alloc(SIGN_SIZE * SIGN_SIZE * 4)
  const put = (x, y, [r, g, b]) => {
    const i = (y * SIGN_SIZE + x) * 4
    rgba[i] = r
    rgba[i + 1] = g
    rgba[i + 2] = b
    rgba[i + 3] = 255
  }
  for (let y = 3; y <= 8; y += 1) for (let x = 2; x <= 13; x += 1) put(x, y, border)
  for (let y = 9; y <= 13; y += 1) for (let x = 7; x <= 8; x += 1) put(x, y, fill)
  return encodePng(SIGN_SIZE, SIGN_SIZE, rgba)
}

function write(target, path, png, label) {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, png)
  console.log(`wrote src/assets/placeholders/${path} ${label} (${png.length} bytes)`)
}

function main() {
  const only = process.argv.slice(2)
  for (const path of only) {
    if (!ATLASES.includes(path)) {
      console.error(`build-placeholders: unknown atlas "${path}"`)
      process.exit(1)
    }
  }
  const targets = only.length > 0 ? ATLASES.filter((path) => only.includes(path)) : ATLASES

  for (const path of targets) {
    const target = OUT + path
    if (path === SIGN) {
      write(target, path, signPng(path), `${SIGN_SIZE}x${SIGN_SIZE}, sign silhouette`)
      continue
    }
    const { width, height, from } = sourceSize(path)
    write(target, path, blankPng(path, width, height), `${width}x${height}, size from ${from}`)
  }
}

const entry = process.argv[1]
if (entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url) main()
