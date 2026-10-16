// Writes the committed coverage manifest src/assets/pokemon/index.json: the
// species id -> file id map the overworld reader resolves a follower through,
// plus the ids the server has no art for.
//
// Usage:
//   node scripts/legacy-art/build-pokemon-index.mjs [--out=<abs>]
//
//   --out - output directory, default src/assets/pokemon (committed output, so
//           a relative default is correct here). The manifest is derived from
//           that directory's own pairs plus the dex, so the tool needs no
//           sprite sources and is safe to re-run.
//
// A species is *covered* when both <fileId>.png and <fileId>.json exist and the
// manifest carries `durationsMs`; a pair without it is a
// generate-pokemon.mjs placeholder and counts as uncovered. The file id is
// `num` for a base species and `num * 100 + formIndex` for a forme, with
// SpriteCollab's own 4-digit form index (pmdcollab-species.mjs). Everything
// playable that is not covered lands in `missing`, sorted, and may be empty.
//
// The output is deterministic: two runs produce a byte-identical file.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PMDCOLLAB_SPECIES } from './pmdcollab-species.mjs'

const SPRITE = 32
const DIR_ROWS = ['down', 'downright', 'up', 'upright', 'left']

const rawArgs = process.argv.slice(2)
const outArg = rawArgs.find((a) => a.startsWith('--out='))
const OUT_DIR = resolve(
  outArg
    ? outArg.slice('--out='.length)
    : fileURLToPath(new URL('../../src/assets/pokemon/', import.meta.url)),
)
if (outArg && !isAbsolute(outArg.slice('--out='.length))) {
  console.error(`error: --out must be an absolute path, got "${outArg.slice('--out='.length)}"`)
  process.exit(1)
}

const species = JSON.parse(
  readFileSync(new URL('../../src/data/dex/species.json', import.meta.url), 'utf8'),
)

const FILE_ID_BY_SPECIES = new Map(
  PMDCOLLAB_SPECIES.map((row) => [
    row.speciesId,
    row.formIndex ? row.num * 100 + row.formIndex : row.num,
  ]),
)

function isCovered(fileId) {
  if (!existsSync(join(OUT_DIR, `${fileId}.png`))) return false
  const manifestPath = join(OUT_DIR, `${fileId}.json`)
  if (!existsSync(manifestPath)) return false
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return Object.values(manifest.anims ?? {}).every((anim) => Array.isArray(anim.durationsMs))
}

const files = {}
const missing = []
for (const entry of species) {
  const fileId = FILE_ID_BY_SPECIES.get(entry.id)
  if (fileId !== undefined && isCovered(fileId)) files[entry.id] = fileId
  else missing.push(entry.id)
}

const sortedFiles = {}
for (const id of Object.keys(files).sort()) sortedFiles[id] = files[id]
missing.sort()

const index = {
  sprite: SPRITE,
  rows: DIR_ROWS.length,
  dirRows: DIR_ROWS,
  files: sortedFiles,
  missing,
}

writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(
  `wrote ${Object.keys(sortedFiles).length} covered species and ${missing.length} missing to ${join(OUT_DIR, 'index.json')}`,
)
