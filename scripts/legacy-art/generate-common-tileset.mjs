// Publishes sprite-sources/tilesets/common.png (built by
// build-common-tileset.mjs) as the committed src/assets/common.png, the
// shared atlas TileMapRenderer draws stairs/trap/chest/item from — see
// core/tileset.ts's commonFrames and sprite-sources/README.md's "Common
// overlay" section. Decodes and re-encodes rather than copying the file
// verbatim, so this also validates the source is a well-formed 8-bit PNG.
// Regenerate with:
//
//   node scripts/generate-common-tileset.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng, encodePng } from './png-codec.mjs'

const source = new URL('../sprite-sources/tilesets/common.png', import.meta.url)
const { width, height, data } = decodePng(readFileSync(source))

const outDir = new URL('../src/assets/', import.meta.url)
const png = encodePng(width, height, data)
writeFileSync(new URL('common.png', outDir), png)
console.log(`wrote src/assets/common.png ${width}x${height} (${png.length} bytes)`)
