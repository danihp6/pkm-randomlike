// Copies the Pokemon battle sprites Pokemon Anil ships into the game's asset
// tree (`public/anil/`) and writes the frame manifest
// (`src/data/anil/pokemon-sprites.json`).
//
// Source: the RPG Maker XP / Pokemon Essentials fangame "Pokemon Anil" by
// EricLostie, `Graphics/Pokemon/` (gitignored, never redistributed). Point the
// script at the checkout:
//
//   node scripts/anil/build-pokemon-sprites.mjs <anil>/Graphics/Pokemon
//
// Every sheet is a horizontal filmstrip: each frame is a square of the sheet's
// own height and the frame count is `width / height`, exactly how Anil's
// "Pokemon Animados para DBK" plugin reads them. The sheets are palette PNGs
// (~365 bytes per frame), so they are copied verbatim rather than repacked into
// RGBA atlases, which would inflate the same art to gigabytes.
//
// A dex species resolves to `<SPECIES>.png` (and its `_female` variant) by
// normalised name; a forme without its own file falls back to its base species.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Source folder -> output folder under `src/assets/anil/`. */
const FOLDERS = [
  ['Front', 'front'],
  ['Back', 'back'],
  ['Front shiny', 'front-shiny'],
  ['Back shiny', 'back-shiny'],
  ['Icons', 'icons'],
  ['Icons shiny', 'icons-shiny'],
]

/** A sheet's frame count and size, read straight off the PNG header. */
function sheetInfo(path) {
  const buf = readFileSync(path)
  if (buf[0] !== 0x89) throw new Error(`not a PNG: ${path}`)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  return { size: height, frames: Math.max(1, Math.round(width / height)) }
}

const norm = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

const sourceDir = process.argv[2] ?? process.env.POKEANIL_POKEMON ?? 'sprite-sources/anil/Graphics/Pokemon'
if (!existsSync(sourceDir)) {
  throw new Error(`usage: node scripts/anil/build-pokemon-sprites.mjs <anil>/Graphics/Pokemon (missing ${sourceDir})`)
}

const assetsDir = fileURLToPath(new URL('../../public/anil/', import.meta.url))
const dataDir = fileURLToPath(new URL('../../src/data/anil/', import.meta.url))

// A clean tree, so a renamed or dropped sheet cannot linger from a past run.
for (const [, out] of FOLDERS) rmSync(`${assetsDir}${out}`, { recursive: true, force: true })
mkdirSync(dataDir, { recursive: true })

/** Per output folder: normalised base name -> the real file name. */
const indexes = {}
for (const [source, out] of FOLDERS) {
  mkdirSync(`${assetsDir}${out}`, { recursive: true })
  const files = readdirSync(`${sourceDir}/${source}`).filter((name) => /\.png$/i.test(name))
  const index = new Map()
  for (const file of files) {
    copyFileSync(`${sourceDir}/${source}/${file}`, `${assetsDir}${out}/${file}`)
    index.set(norm(file.replace(/\.png$/i, '')), file)
  }
  indexes[out] = index
}

/** The manifest entry for one sheet, or undefined when the file is absent. */
function sheet(out, baseName) {
  const file = indexes[out].get(norm(baseName))
  if (!file) return undefined
  const { size, frames } = sheetInfo(`${assetsDir}${out}/${file}`)
  return [file, size, frames]
}

const SPECIES = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/dex/species.json', import.meta.url)), 'utf8'))

const frames = {}
let resolved = 0
let forms = 0
for (const species of SPECIES) {
  // A forme the Anil set does not name falls back to its base species' art.
  const names = species.forme ? [species.id, species.baseSpecies] : [species.id]
  const base = names.find((name) => indexes.front.has(norm(name)))
  if (!base) continue
  const entry = {}
  for (const [kind, out] of [
    ['front', 'front'],
    ['back', 'back'],
    ['icon', 'icons'],
    ['frontShiny', 'front-shiny'],
    ['backShiny', 'back-shiny'],
    ['iconShiny', 'icons-shiny'],
  ]) {
    const value = sheet(out, base)
    if (value) entry[kind] = value
  }
  const female = { frontFemale: 'front', backFemale: 'back', iconFemale: 'icons', frontShinyFemale: 'front-shiny', backShinyFemale: 'back-shiny', iconShinyFemale: 'icons-shiny' }
  for (const [kind, out] of Object.entries(female)) {
    const value = sheet(out, `${base}_female`)
    if (value) entry[kind] = value
  }
  frames[species.id] = entry
  resolved++
  if (species.forme) forms++
}

writeFileSync(
  `${dataDir}pokemon-sprites.json`,
  `${JSON.stringify({ folder: 'anil', frames })}\n`,
)

const files = FOLDERS.reduce((total, [, out]) => total + indexes[out].size, 0)
console.log(
  `copied ${files} sheets into public/anil/ and wrote the manifest for ${resolved} species ` +
    `(${forms} formes resolved to their base species)`,
)
