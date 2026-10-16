// Writes real Pokemon Mystery Dungeon sprite frames as per-species files
// (src/assets/pokemon/<fileId>.png + <fileId>.json) for every species of
// PMDCOLLAB_SPECIES that has a local PMDCollab pack — overwriting whatever
// scripts/legacy-art/generate-pokemon.mjs wrote there (that script seeds
// procedural placeholders; this one replaces every species it can pack with
// real art). A species whose local pack is absent keeps its placeholder.
//
// Usage:
//   node scripts/legacy-art/extract-real-sprites.mjs --source=<abs> [--out=<abs>] [--only-missing]
//
//   --source  - absolute path to the sprite-sources/pokemons directory holding
//               <slug>-pmdcollab/ packs, required, with PMDCOLLAB_SOURCES as
//               the fallback. Never defaulted inside the repo (AGENTS.md's
//               "Asset trees" rule).
//   --out     - output directory, default src/assets/pokemon (committed output,
//               so a relative default is correct here).
//   --only-missing - skip a pair that already carries `durationsMs`, i.e. one
//               extract-real-sprites.mjs has already packed.
//
// All species here are sourced from PMDCollab (pmdcollab.org,
// sprites.pmdcollab.org): one PNG per animation plus an AnimData.xml giving
// exact FrameWidth/FrameHeight and per-frame Duration/frame count — no
// hand-eyeballed coordinates, and they already carry a real alpha channel
// (no chroma-keying needed). Each PMDCollab sheet has 8 compass-direction
// rows in fixed order (Down, DownRight, Right, UpRight, Up, UpLeft, Left,
// DownLeft; row 0 = Down), confirmed by cropping and eyeballing, since
// AnimData.xml doesn't spell the order out.
//
// The game only stores 5 of those 8 direction rows per species: Down,
// DownRight, Up, UpRight, Left (Right/UpLeft/DownLeft are Left/UpRight/
// DownRight flipped horizontally at render time). Every real frame from
// AnimData.xml is kept, so a species' Walk/Attack/etc. animates through as
// many poses as the source game actually used. Each species' PNG is a
// variable-width strip: 5 direction rows tall, animations (idle, walk,
// attack, special, hurt) concatenated in columns at the offsets recorded in
// that species' manifest. The frame at step `i` of an animation in direction
// row `r` is `r * cols + start + i`.
//
// The pair's file id is `num` for a base species and `num * 100 + formIndex`
// for a forme (SpriteCollab's own 4-digit form index) — see
// scripts/legacy-art/pmdcollab-species.mjs and src/assets/pokemon/index.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from './png-codec.mjs'
import { PMDCOLLAB_SPECIES } from './pmdcollab-species.mjs'

const rawArgs = process.argv.slice(2)
const flag = (name) => rawArgs.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const value = (name) => {
  const arg = flag(name)
  return arg && arg.includes('=') ? arg.slice(name.length + 3) : null
}

function resolveSource() {
  const source = value('source') ?? process.env.PMDCOLLAB_SOURCES ?? null
  if (!source) {
    console.error('error: --source=<abs> is required (or set PMDCOLLAB_SOURCES)')
    console.error('       the source tree is never defaulted inside the repo (AGENTS.md "Asset trees")')
    process.exit(1)
  }
  if (!isAbsolute(source)) {
    console.error(`error: --source must be an absolute path, got "${source}"`)
    process.exit(1)
  }
  if (!existsSync(source)) {
    console.error(`error: --source does not exist: ${source}`)
    process.exit(1)
  }
  return resolve(source)
}

const SOURCES = resolveSource()
const OUT_DIR = resolve(
  value('out') ?? fileURLToPath(new URL('../../src/assets/pokemon/', import.meta.url)),
)
const onlyMissing = flag('only-missing') !== undefined
const SPRITE = 32

// PMD games' AnimData.xml durations are in engine ticks; the underlying
// games run their animation timers at roughly 30 ticks/sec.
const MS_PER_TICK = 1000 / 30

const ATLAS_DIR_ROW = { down: 0, downright: 1, up: 2, upright: 3, left: 4 }
const SOURCE_DIR_ROW = { down: 0, downright: 1, up: 4, upright: 3, left: 6 }
const DIR_ROWS = Object.keys(ATLAS_DIR_ROW).length

mkdirSync(OUT_DIR, { recursive: true })

function trimBBox(img, x0, y0, x1, y1) {
  const { width, data } = img
  let minX = x1,
    maxX = x0,
    minY = y1,
    maxY = y0,
    found = false
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (data[(y * width + x) * 4 + 3] > 20) {
        found = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (!found) throw new Error(`empty region [${x0},${y0},${x1},${y1}]`)
  return { minX, maxX, minY, maxY }
}

// Crops `region` from `src`, trims it to its content bbox, downsamples it by
// `scale` (1 = no-op, exact pixel copy) and centers it (horizontally
// centered, bottom-anchored) into `dst` cell (col,row). `dst` is a plain
// {width, height, data} RGBA buffer sized for one species, freshly allocated
// and already transparent.
//
// `scale` is computed once per anim (see scaleFor below), not per frame, so
// every frame of e.g. a Walk cycle shrinks by the same factor — otherwise a
// pose that happens to trim tighter than its neighbors would visibly pop in
// size as the animation plays.
function blit(dst, src, region, col, row, scale) {
  const bbox = trimBBox(src, region.x0, region.y0, region.x1, region.y1)
  const w = bbox.maxX - bbox.minX + 1
  const h = bbox.maxY - bbox.minY + 1
  const destW = Math.max(1, Math.round(w * scale))
  const destH = Math.max(1, Math.round(h * scale))
  const destX0 = col * SPRITE + Math.floor((SPRITE - destW) / 2)
  const destY0 = Math.max(row * SPRITE, row * SPRITE + (SPRITE - destH) - 2)
  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const dx = destX0 + x
      const dy = destY0 + y
      if (dx < col * SPRITE || dx >= (col + 1) * SPRITE) continue
      if (dy < row * SPRITE || dy >= (row + 1) * SPRITE) continue
      const doff = (dy * dst.width + dx) * 4
      if (scale === 1) {
        const so = ((bbox.minY + y) * src.width + (bbox.minX + x)) * 4
        dst.data.set(src.data.subarray(so, so + 4), doff)
        continue
      }
      // Box-downsample the source pixels this dest pixel covers, weighting
      // by alpha so semi-transparent edge pixels don't drag in a dark/light
      // fringe from whatever's behind them.
      const sx0 = bbox.minX + Math.floor(x / scale)
      const sx1 = Math.min(bbox.maxX, bbox.minX + Math.ceil((x + 1) / scale) - 1)
      const sy0 = bbox.minY + Math.floor(y / scale)
      const sy1 = Math.min(bbox.maxY, bbox.minY + Math.ceil((y + 1) / scale) - 1)
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0,
        n = 0
      for (let sy = sy0; sy <= sy1; sy++) {
        for (let sx = sx0; sx <= sx1; sx++) {
          const so = (sy * src.width + sx) * 4
          const a = src.data[so + 3]
          rSum += src.data[so] * a
          gSum += src.data[so + 1] * a
          bSum += src.data[so + 2] * a
          aSum += a
          n++
        }
      }
      dst.data[doff] = aSum > 0 ? Math.round(rSum / aSum) : 0
      dst.data[doff + 1] = aSum > 0 ? Math.round(gSum / aSum) : 0
      dst.data[doff + 2] = aSum > 0 ? Math.round(bSum / aSum) : 0
      dst.data[doff + 3] = n > 0 ? Math.round(aSum / n) : 0
    }
  }
}

// The pixel box (before trimming) for frame `i` of `srcDirRow` in an anim
// described by `meta`. Same shape for every frame of a given anim (only x0
// shifts), which is what lets scaleFor derive one scale per anim.
function frameRegion(meta, srcDirRow, i) {
  return {
    x0: i * meta.frameWidth,
    x1: (i + 1) * meta.frameWidth,
    y0: srcDirRow * meta.frameHeight,
    y1: (srcDirRow + 1) * meta.frameHeight,
  }
}

// Largest trimmed-content bbox across all directions/frames actually used
// for this anim, turned into a single "shrink to fit the 32x32 cell" factor
// (capped at 1 — small species that already fit aren't scaled up). PMDCollab
// canvases vary wildly by species since the source games don't use a fixed
// sprite footprint.
function scaleFor(src, meta, frameIndices) {
  let maxW = 0,
    maxH = 0
  for (const srcDirRow of Object.values(SOURCE_DIR_ROW)) {
    for (const i of frameIndices) {
      const r = frameRegion(meta, srcDirRow, i)
      const bbox = trimBBox(src, r.x0, r.y0, r.x1, r.y1)
      maxW = Math.max(maxW, bbox.maxX - bbox.minX + 1)
      maxH = Math.max(maxH, bbox.maxY - bbox.minY + 1)
    }
  }
  return Math.min(1, SPRITE / maxW, SPRITE / maxH)
}

function loadSheetRGBA(name) {
  return decodePng(readFileSync(join(SOURCES, name)))
}

// Reads FrameWidth/FrameHeight/frame-count/per-frame Duration/HitFrame for a
// named <Anim> block out of a PMDCollab AnimData.xml. Regex-based rather
// than a real XML parser — fine here since <Anim> blocks don't nest and the
// schema is fixed.
//
// Some anims are aliases (e.g. Charmander's "Shoot" is <CopyOf>Charge</CopyOf>
// with no frame data or PNG of its own) — follow one level of CopyOf and
// report `sourceAnim` so callers load the right sprite sheet file.
function readAnimMeta(slug, animName) {
  const xml = readFileSync(join(SOURCES, `${slug}-pmdcollab`, 'AnimData.xml'), 'utf8')
  const blockRe = new RegExp(`<Anim>\\s*<Name>${animName}</Name>[\\s\\S]*?</Anim>`)
  const block = xml.match(blockRe)?.[0]
  if (!block)
    throw new Error(
      `no <Anim><Name>${animName}</Name>...</Anim> block in ${slug}-pmdcollab/AnimData.xml`,
    )
  const copyOf = block.match(/<CopyOf>([^<]+)<\/CopyOf>/)?.[1]
  if (copyOf) return { ...readAnimMeta(slug, copyOf), sourceAnim: copyOf }
  const frameWidth = Number(block.match(/<FrameWidth>(\d+)<\/FrameWidth>/)?.[1])
  const frameHeight = Number(block.match(/<FrameHeight>(\d+)<\/FrameHeight>/)?.[1])
  const durationTicks = [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]))
  const frameCount = durationTicks.length
  const hitFrame = Number(block.match(/<HitFrame>(\d+)<\/HitFrame>/)?.[1] ?? NaN)
  if (!frameWidth || !frameHeight || !frameCount)
    throw new Error(`couldn't parse ${animName} anim for ${slug}`)
  return { frameWidth, frameHeight, frameCount, durationTicks, hitFrame, sourceAnim: animName }
}

// Which manifest anim key each PMDCollab anim name maps to. A few species
// (Clefairy/Clefable) have no "Shoot" anim at all, not even as a <CopyOf>
// alias — set `shootAnim` in PMDCOLLAB_SPECIES to substitute a different
// anim name (e.g. "Charge") for the special-attack slot.
function animPlan(shootAnim) {
  return [
    { key: 'idle', animName: 'Idle' },
    { key: 'walk', animName: 'Walk' },
    { key: 'attack', animName: 'Attack' },
    { key: 'special', animName: shootAnim ?? 'Shoot' },
    { key: 'hurt', animName: 'Hurt' },
  ]
}

function fileIdOf(row) {
  return row.formIndex ? row.num * 100 + row.formIndex : row.num
}

function isCovered(fileId) {
  const manifestPath = join(OUT_DIR, `${fileId}.json`)
  if (!existsSync(manifestPath)) return false
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return Object.values(manifest.anims ?? {}).every((anim) => Array.isArray(anim.durationsMs))
}

let written = 0
let skipped = 0
for (const row of PMDCOLLAB_SPECIES) {
  const { slug, shootAnim } = row
  const fileId = fileIdOf(row)
  if (onlyMissing && isCovered(fileId)) {
    skipped++
    continue
  }
  if (!existsSync(join(SOURCES, `${slug}-pmdcollab`, 'AnimData.xml'))) {
    console.error(`[${slug}] no local sprite pack, skipping`)
    continue
  }

  let anims
  try {
    anims = animPlan(shootAnim).map(({ key, animName }) => {
      const meta = readAnimMeta(slug, animName)
      const src = loadSheetRGBA(join(`${slug}-pmdcollab`, `${meta.sourceAnim}-Anim.png`))
      const frames = Array.from({ length: meta.frameCount }, (_, i) => i)
      const scale = scaleFor(src, meta, frames)
      return { key, meta, src, frames, scale }
    })
  } catch (err) {
    console.error(`[${slug}] no usable pack: ${err.message}`)
    continue
  }

  let col = 0
  const manifestAnims = {}
  for (const anim of anims) {
    manifestAnims[anim.key] = {
      start: col,
      count: anim.meta.frameCount,
      ...(Number.isFinite(anim.meta.hitFrame) ? { hitFrame: anim.meta.hitFrame } : {}),
      durationsMs: anim.meta.durationTicks.map((t) => Math.round(t * MS_PER_TICK)),
    }
    anim.start = col
    col += anim.meta.frameCount
  }
  const totalCols = col

  const dst = {
    width: totalCols * SPRITE,
    height: DIR_ROWS * SPRITE,
    data: Buffer.alloc(totalCols * SPRITE * DIR_ROWS * SPRITE * 4),
  }

  for (const dir of Object.keys(ATLAS_DIR_ROW)) {
    const atlasRow = ATLAS_DIR_ROW[dir]
    const srcDirRow = SOURCE_DIR_ROW[dir]
    for (const anim of anims) {
      for (const i of anim.frames) {
        blit(dst, anim.src, frameRegion(anim.meta, srcDirRow, i), anim.start + i, atlasRow, anim.scale)
      }
    }
  }

  writeFileSync(join(OUT_DIR, `${fileId}.png`), encodePng(dst.width, dst.height, dst.data))
  writeFileSync(
    join(OUT_DIR, `${fileId}.json`),
    JSON.stringify({ cols: totalCols, anims: manifestAnims }),
  )
  written++
}

console.log(`wrote ${written} real species to ${OUT_DIR} (${skipped} already packed, skipped)`)
