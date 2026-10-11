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
// Every battle sheet is a horizontal filmstrip: each frame is a square of the
// sheet's own height and the frame count is `width / height`, exactly how Anil's
// "Pokemon Animados para DBK" plugin reads them. The sheets are palette PNGs
// (~365 bytes per frame), so they are copied verbatim rather than repacked into
// RGBA atlases, which would inflate the same art to gigabytes.
//
// The party/HUD portraits are packed instead: one 64x64 cell per dex entry, in
// dex order, from the game's `Icons` folders (the icons are 64px, so a fixed
// atlas is small). A `_female` or shiny variant that is missing falls back a
// step at read time (`src/data/pokemonSprites.ts`).
//
// A dex species resolves to `<SPECIES>.png` by normalised name. A forme resolves
// to `<SPECIES>_<n>.png` when the Anil set lists exactly `1..n` for that species
// (see `FORM_OVERRIDE` for the ones that do not line up, e.g. the Vivillon
// patterns, or the Alcremie cream/sweet grid).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng } from '../legacy-art/png-codec.mjs'

/** Source folder -> output folder under `public/anil/`. */
const FOLDERS = [
  ['Front', 'front'],
  ['Back', 'back'],
  ['Front shiny', 'front-shiny'],
  ['Back shiny', 'back-shiny'],
  ['Icons', 'icons'],
  ['Icons shiny', 'icons-shiny'],
]

/** The portrait atlas: one cell per dex entry, in dex order. */
const PORTRAIT_SIZE = 64
const PORTRAIT_COLS = 32

/**
 * Dex formes whose Anil file is not simply `<base>_<position>`. A `null` means
 * "draw the base species"; a string is the Anil sheet name without extension.
 * Everything not listed here maps positionally, and only when the Anil set lists
 * `1..n` for that species — otherwise the forme falls back to its base species.
 */
const FORM_OVERRIDE = {
  // The Alcremie cream/sweet grid: our dex only keeps the plain "fresa" sweet.
  alcremierubycream: 'ALCREMIE_7',
  alcremiematchacream: 'ALCREMIE_14',
  alcremiemintcream: 'ALCREMIE_21',
  alcremielemoncream: 'ALCREMIE_28',
  alcremierubyswirl: 'ALCREMIE_42',
  alcremiecaramelswirl: 'ALCREMIE_49',
  alcremierainbowswirl: 'ALCREMIE_56',
  // Arceus is ordered by type in Anil, alphabetically in the dex.
  arceusfighting: 'ARCEUS_1',
  arceusflying: 'ARCEUS_2',
  arceuspoison: 'ARCEUS_3',
  arceusground: 'ARCEUS_4',
  arceusrock: 'ARCEUS_5',
  arceusbug: 'ARCEUS_6',
  arceusghost: 'ARCEUS_7',
  arceussteel: 'ARCEUS_8',
  arceusfire: 'ARCEUS_10',
  arceuswater: 'ARCEUS_11',
  arceusgrass: 'ARCEUS_12',
  arceuselectric: 'ARCEUS_13',
  arceuspsychic: 'ARCEUS_14',
  arceusice: 'ARCEUS_15',
  arceusdragon: 'ARCEUS_16',
  arceusdark: 'ARCEUS_17',
  arceusfairy: 'ARCEUS_18',
  // Anil's Basculin 1 is the Red-Striped base, 2 the Blue-Striped one; the dex
  // has no Red-Striped entry and no White-Striped art.
  basculinbluestriped: 'BASCULIN_2',
  basculinwhitestriped: null,
  greninjabond: 'GRENINJA_2',
  kyuremblack: 'KYUREM_2',
  kyuremwhite: 'KYUREM_1',
  magearnaoriginal: 'MAGEARNA_1',
  mausholdfour: null,
  // Anil names the Nidoran icons with its own typo (`fE`/`mA`).
  nidoranf: 'NIDORANfE',
  nidoranm: 'NIDORANmA',
  meowsticf: 'MEOWSTIC_1',
  miniororange: 'MINIOR_8',
  minioryellow: 'MINIOR_9',
  miniorgreen: 'MINIOR_10',
  miniorblue: 'MINIOR_11',
  miniorindigo: 'MINIOR_12',
  miniorviolet: 'MINIOR_13',
  miniormeteor: null,
  necrozmaduskmane: 'NECROZMA_1',
  necrozmadawnwings: 'NECROZMA_2',
  ogerponwellspring: 'OGERPON_1',
  ogerponhearthflame: 'OGERPON_2',
  ogerponcornerstone: 'OGERPON_3',
  ogerponwellspringtera: 'OGERPON_1',
  ogerponhearthflametera: 'OGERPON_2',
  ogerponcornerstonetera: 'OGERPON_3',
  ogerpontealtera: null,
  // The cap Pikachu are Anil 8..15 (2..7 are the contest costumes).
  pikachuoriginal: 'PIKACHU_8',
  pikachuhoenn: 'PIKACHU_9',
  pikachusinnoh: 'PIKACHU_10',
  pikachuunova: 'PIKACHU_11',
  pikachukalos: 'PIKACHU_12',
  pikachualola: 'PIKACHU_13',
  pikachupartner: 'PIKACHU_14',
  pikachuworld: 'PIKACHU_15',
  raichualola: 'RAICHU_1',
  rockruffdusk: null,
  slowbrogalar: 'SLOWBRO_1',
  toxtricitylowkey: 'TOXTRICITY_1',
  // The official Spanish pattern names (Icy Snow is "Polar", Polar is "Taiga",
  // High Plains is "Estepa", River is "Oasis", Savanna is "Pantano"...).
  vivillonicysnow: 'VIVILLON_6',
  vivillonpolar: 'VIVILLON_12',
  vivillontundra: 'VIVILLON_17',
  vivilloncontinental: 'VIVILLON_2',
  vivillongarden: 'VIVILLON_4',
  vivillonelegant: 'VIVILLON_3',
  vivillonmodern: 'VIVILLON_9',
  vivillonmarine: 'VIVILLON_8',
  vivillonarchipelago: 'VIVILLON_1',
  vivillonhighplains: 'VIVILLON_5',
  vivillonsandstorm: 'VIVILLON_14',
  vivillonriver: 'VIVILLON_13',
  vivillonmonsoon: 'VIVILLON_10',
  vivillonsavanna: 'VIVILLON_15',
  vivillonsun: 'VIVILLON_16',
  vivillonocean: 'VIVILLON_11',
  vivillonjungle: 'VIVILLON_7',
  vivillonfancy: 'VIVILLON_18',
  vivillonpokeball: 'VIVILLON_19',
}

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

// Our dex order per base species, so a forme can map to its Anil index.
const formPosition = new Map()
{
  const seen = new Map()
  for (const species of SPECIES) {
    if (!species.forme) continue
    const count = (seen.get(species.baseSpecies) ?? 0) + 1
    seen.set(species.baseSpecies, count)
    formPosition.set(species.id, count)
  }
}

/** True when the Anil set lists `1..count` for a base species, in order. */
function positionalForms(baseSpecies, count) {
  for (let i = 1; i <= count; i++) {
    if (!indexes.front.has(norm(`${baseSpecies}_${i}`))) return false
  }
  return !indexes.front.has(norm(`${baseSpecies}_${count + 1}`))
}

/** The Anil sheet name a dex species draws from (without extension). */
function anilName(species) {
  const override = FORM_OVERRIDE[species.id]
  if (override === null) return species.baseSpecies
  if (override !== undefined) return override
  if (!species.forme) return species.id
  const position = formPosition.get(species.id)
  return positionalForms(species.baseSpecies, position) ? `${species.baseSpecies}_${position}` : species.id
}

// Battle-only Mega formes (`src/data/dex/megas.json`, D34). They are not in the
// dex, so they need their own sheet mapping. Anil names them `<BASE>_<n>`; the
// index comes from its `PBS/pokemon_forms.txt`, where the `FormName` says which
// is Mega X and which is Mega Y.
const MEGAS = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../src/data/dex/megas.json', import.meta.url)), 'utf8'),
)

/** Anil's `pokemon_forms.txt`: base species name -> its form sections. */
function parseAnilForms(path) {
  const forms = new Map()
  let current = null
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const header = line.match(/^\[([^,\]]+),(\d+)\]/)
    if (header) {
      current = { index: Number(header[2]), formName: '' }
      const base = header[1].toUpperCase()
      const list = forms.get(base) ?? []
      list.push(current)
      forms.set(base, list)
      continue
    }
    if (!current) continue
    const field = line.match(/^FormName\s*=\s*(.+)$/)
    if (field) current.formName = field[1].trim()
  }
  return forms
}

const ANIL_FORMS = parseAnilForms(resolve(sourceDir, '..', '..', 'PBS', 'pokemon_forms.txt'))

/** The Anil sheet name (no extension) a Mega draws from, or its base species. */
function megaAnilName(mega) {
  const base = mega.baseSpeciesId.toUpperCase()
  const candidates = (ANIL_FORMS.get(base) ?? []).filter((form) => /^Mega\b/i.test(form.formName))
  let pick
  if (/megay$/.test(mega.id)) pick = candidates.find((form) => / Y$/i.test(form.formName))
  else if (/megax$/.test(mega.id)) pick = candidates.find((form) => / X$/i.test(form.formName))
  else pick = candidates.find((form) => !/ [XY]$/i.test(form.formName)) ?? candidates[0]
  return pick ? `${base}_${pick.index}` : mega.baseSpeciesId
}

/** The manifest entry for one sheet name, falling back to a base species. */
function sheetEntry(name, fallbackBase) {
  if (!name) return null
  const base = indexes.front.has(norm(name)) ? name : fallbackBase
  if (!indexes.front.has(norm(base))) return null
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
  for (const [kind, out] of Object.entries({
    frontFemale: 'front',
    backFemale: 'back',
    iconFemale: 'icons',
    frontShinyFemale: 'front-shiny',
    backShinyFemale: 'back-shiny',
    iconShinyFemale: 'icons-shiny',
  })) {
    const value = sheet(out, `${base}_female`)
    if (value) entry[kind] = value
  }
  return entry
}

const frames = {}
const portraitNormal = {}
const portraitShiny = {}
let resolved = 0
let formes = 0
for (const species of SPECIES) {
  const entry = sheetEntry(anilName(species), species.baseSpecies)
  if (!entry) continue
  frames[species.id] = entry
  resolved++
  if (species.forme) formes++
}

// The Mega formes ride along so the battle can swap the sprite when a stone is
// spent. They get no portrait cell (the atlas is dex-only); `portraits.ts` falls
// back to the base species.
let megasResolved = 0
for (const mega of MEGAS) {
  const entry = sheetEntry(megaAnilName(mega), mega.baseSpeciesId)
  if (!entry) continue
  frames[mega.id] = entry
  megasResolved++
}

/** Scales a sheet's first `src`x`src` frame into a `size`x`size` atlas cell. */
function blitFrame(atlas, index, sheet, src, size) {
  const col = index % PORTRAIT_COLS
  const row = Math.floor(index / PORTRAIT_COLS)
  for (let y = 0; y < size; y++) {
    const sy = Math.min(sheet.height - 1, Math.floor((y * src) / size))
    for (let x = 0; x < size; x++) {
      const sx = Math.min(sheet.width - 1, Math.floor((x * src) / size))
      const from = (sy * sheet.width + sx) * 4
      if (sheet.data[from + 3] === 0) continue
      const to = (((row * size + y) * PORTRAIT_COLS * size) + col * size + x) * 4
      atlas[to] = sheet.data[from]
      atlas[to + 1] = sheet.data[from + 1]
      atlas[to + 2] = sheet.data[from + 2]
      atlas[to + 3] = 255
    }
  }
}

/** Packs one portrait atlas off the icon folder; returns the id -> frame map. */
function buildPortraits(out, file) {
  // Species first (their indices are stable), then the Mega formes so the switch
  // grid can draw the Mega's own face (D34).
  const entries = [
    ...SPECIES.map((species) => ({ id: species.id, name: anilName(species), fallback: species.baseSpecies })),
    ...MEGAS.map((mega) => ({ id: mega.id, name: megaAnilName(mega), fallback: mega.baseSpeciesId })),
  ]
  const rows = Math.ceil(entries.length / PORTRAIT_COLS)
  const atlas = Buffer.alloc(PORTRAIT_COLS * PORTRAIT_SIZE * rows * PORTRAIT_SIZE * 4)
  const map = {}
  entries.forEach((entry, index) => {
    if (!entry.name) return
    const base = indexes[out].has(norm(entry.name)) ? entry.name : entry.fallback
    const source = indexes[out].get(norm(base))
    if (!source) return
    const sheet = decodePng(readFileSync(`${assetsDir}${out}/${source}`))
    blitFrame(atlas, index, sheet, sheet.height, PORTRAIT_SIZE)
    map[entry.id] = index
  })
  writeFileSync(`${assetsDir}${file}`, encodePng(PORTRAIT_COLS * PORTRAIT_SIZE, rows * PORTRAIT_SIZE, atlas))
  return map
}

const normal = buildPortraits('icons', 'portraits.png')
const shiny = buildPortraits('icons-shiny', 'portraits-shiny.png')

writeFileSync(
  `${dataDir}pokemon-sprites.json`,
  `${JSON.stringify({
    frames,
    portraits: { size: PORTRAIT_SIZE, cols: PORTRAIT_COLS, normal, shiny },
  })}\n`,
)

const files = FOLDERS.reduce((total, [, out]) => total + indexes[out].size, 0)
console.log(
  `copied ${files} sheets into public/anil/ and wrote the manifest for ${resolved} species ` +
    `(${formes} formes, ${megasResolved} megas) with ${Object.keys(normal).length} portraits and ${Object.keys(shiny).length} shiny portraits`,
)
