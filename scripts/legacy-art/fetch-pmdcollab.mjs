// Downloads species' overworld sprite packs from PMDCollab and unzips them
// into <dest>/<slug>-pmdcollab/, ready for extract-real-sprites.mjs.
//
// Usage:
//   node scripts/legacy-art/fetch-pmdcollab.mjs <assetId>[,<assetId>…] [--slug=<name>] \
//     [--anims=Idle,Walk,Attack,Shoot,Hurt] --dest=<abs>
//   node scripts/legacy-art/fetch-pmdcollab.mjs --table [--missing] --dest=<abs>
//
//   assetId  - a 4-digit base id ("0658") or "NNNN/FFFF" for a forme
//              ("0351/0001", Castform-Sunny). Digits are zero-padded, so
//              "658" and "351/1" are accepted too.
//   --slug   - the destination folder name; only valid for a single assetId.
//              Omit to use the id itself with the slash replaced by a dash.
//   --anims  - only keep the files for these animations (matches
//              "<Anim>-Anim.png", "<Anim>-Offsets.png", "<Anim>-Shadow.png").
//              AnimData.xml is always kept. Omit to keep every file in the zip.
//   --table  - fetch every row of PMDCOLLAB_SPECIES; with --missing, only the
//              rows whose <dest>/<slug>-pmdcollab/AnimData.xml is absent.
//   --dest   - absolute destination directory, required, with the
//              PMDCOLLAB_SOURCES environment variable as the fallback. No
//              default inside the repo: a source tree under sprite-sources/ is
//              never junctioned or symlinked into a worktree (see AGENTS.md's
//              "Asset trees" rule).
//
// A pack the server does not have (HTTP 404) is data, not a failure: it is
// logged and the run continues, and build-pokemon-index.mjs records the
// species in index.json's `missing` list.
//
// Examples:
//   node scripts/legacy-art/fetch-pmdcollab.mjs 0658 --dest=/abs/pokemons
//   node scripts/legacy-art/fetch-pmdcollab.mjs 0351/0001 --slug=0351-sunny --dest=/abs/pokemons
//   node scripts/legacy-art/fetch-pmdcollab.mjs --table --missing --dest=/abs/pokemons
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { get } from 'node:https'
import { isAbsolute, join, resolve } from 'node:path'
import { readZip } from './zip-codec.mjs'
import { PMDCOLLAB_SPECIES } from './pmdcollab-species.mjs'

const rawArgs = process.argv.slice(2)
if (rawArgs.length === 0) {
  console.error('Usage: node scripts/legacy-art/fetch-pmdcollab.mjs <assetId>[,<assetId>…] [--slug=<name>] [--anims=Idle,Walk] --dest=<abs>')
  console.error('       node scripts/legacy-art/fetch-pmdcollab.mjs --table [--missing] --dest=<abs>')
  console.error('Examples:')
  console.error('  node scripts/legacy-art/fetch-pmdcollab.mjs 0658 --dest=/abs/pokemons')
  console.error('  node scripts/legacy-art/fetch-pmdcollab.mjs 0351/0001 --slug=0351-sunny --dest=/abs/pokemons')
  process.exit(1)
}
const flag = (name) => rawArgs.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const value = (name) => {
  const arg = flag(name)
  return arg && arg.includes('=') ? arg.slice(name.length + 3) : null
}
const positional = rawArgs.filter((a) => !a.startsWith('--'))

function resolveDest() {
  const dest = value('dest') ?? process.env.PMDCOLLAB_SOURCES ?? null
  if (!dest) {
    console.error('error: --dest=<abs> is required (or set PMDCOLLAB_SOURCES)')
    console.error('       the source tree is never defaulted inside the repo (AGENTS.md "Asset trees")')
    process.exit(1)
  }
  if (!isAbsolute(dest)) {
    console.error(`error: --dest must be an absolute path, got "${dest}"`)
    process.exit(1)
  }
  return resolve(dest)
}

function padId(spec) {
  const parts = spec.split('/')
  if (parts.length === 1 && /^\d+$/.test(parts[0])) return parts[0].padStart(4, '0')
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    return `${parts[0].padStart(4, '0')}/${parts[1].padStart(4, '0')}`
  }
  throw new Error(`bad asset id: "${spec}" (expected "0658" or "0351/0001")`)
}

function parseIds(spec) {
  const seen = new Set()
  for (const part of spec.split(',')) {
    if (part) seen.add(padId(part))
  }
  if (!seen.size) throw new Error(`no asset id in "${spec}"`)
  return [...seen]
}

function defaultSlug(assetId) {
  return assetId.replace('/', '-')
}

const dest = resolveDest()
const animsArg = value('anims')
const anims = animsArg ? animsArg.split(',').filter(Boolean) : null
const slugArg = value('slug')
const byTable = flag('table') !== undefined
const onlyMissing = flag('missing') !== undefined

function fetchBuffer(fetchUrl, redirectsLeft = 5) {
  return new Promise((resolvePromise, reject) => {
    get(fetchUrl, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume()
        resolvePromise(fetchBuffer(new URL(res.headers.location, fetchUrl).href, redirectsLeft - 1))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`GET ${fetchUrl} -> HTTP ${res.statusCode}`))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolvePromise(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Some anims are aliases of another via PMDCollab's <CopyOf> — e.g.
// Charmander's "Shoot" is <CopyOf>Charge</CopyOf> with no frames or PNG of
// its own. Resolve one level of CopyOf against AnimData.xml so the aliased
// anim's files get fetched too (--anims=Shoot must still pull Charge-Anim.png).
function resolveAnims(requested, animDataXml) {
  const resolved = new Set()
  for (const name of requested) {
    resolved.add(name)
    const blockRe = new RegExp(`<Anim>\\s*<Name>${name}</Name>[\\s\\S]*?</Anim>`)
    const copyOf = animDataXml.match(blockRe)?.[0]?.match(/<CopyOf>([^<]+)<\/CopyOf>/)?.[1]
    if (copyOf) resolved.add(copyOf)
  }
  return resolved
}

function keepEntry(entryName, resolvedAnims) {
  if (entryName === 'AnimData.xml') return true
  if (!resolvedAnims) return true
  return [...resolvedAnims].some((a) => entryName.startsWith(`${a}-`))
}

async function fetchOne(assetId, slug) {
  const url = `https://spriteserver.pmdcollab.org/assets/${assetId}/sprites.zip`
  console.log(`[${slug}] fetching ${url}`)
  let zipBuf
  try {
    zipBuf = await fetchBuffer(url)
  } catch (err) {
    console.error(`[${slug}] no pack: ${err.message}`)
    return false
  }

  const allEntries = readZip(zipBuf)
  const animData = allEntries.find((e) => e.name === 'AnimData.xml')
  if (!animData) {
    // Some ids answer 200 with an empty archive instead of a 404/500 when the
    // sprite folder is missing upstream — an unusable pack all the same.
    console.error(`[${slug}] no pack: the bundle carries no AnimData.xml`)
    return false
  }
  let resolvedAnims = null
  if (anims) {
    resolvedAnims = resolveAnims(anims, animData.data.toString('utf8'))
  }
  const entries = allEntries.filter((e) => keepEntry(e.name, resolvedAnims))
  if (anims && entries.length <= 1) {
    console.error(
      `[${slug}] no files matched --anims=${anims.join(',')} (check the anim names against AnimData.xml)`,
    )
    return false
  }

  const destDir = join(dest, `${slug}-pmdcollab`)
  mkdirSync(destDir, { recursive: true })
  for (const { name: entryName, data } of entries) {
    writeFileSync(join(destDir, entryName), data)
  }
  console.log(`[${slug}] wrote ${entries.length} files to ${destDir}`)
  return true
}

if (byTable) {
  const rows = onlyMissing
    ? PMDCOLLAB_SPECIES.filter((row) => !existsSync(join(dest, `${row.slug}-pmdcollab`, 'AnimData.xml')))
    : PMDCOLLAB_SPECIES
  console.log(`[table] ${rows.length} of ${PMDCOLLAB_SPECIES.length} rows to fetch into ${dest}`)
  let ok = 0
  let failed = 0
  for (const row of rows) {
    if (await fetchOne(row.assetId, row.slug)) ok++
    else failed++
  }
  console.log(`[table] fetched ${ok}, unavailable ${failed}`)
} else {
  const [idSpec] = positional
  if (!idSpec) {
    console.error('Usage: node scripts/legacy-art/fetch-pmdcollab.mjs <assetId>[,<assetId>…] [--slug=<name>] [--anims=Idle,Walk] --dest=<abs>')
    console.error('       node scripts/legacy-art/fetch-pmdcollab.mjs --table [--missing] --dest=<abs>')
    console.error('Examples:')
    console.error('  node scripts/legacy-art/fetch-pmdcollab.mjs 0658 --dest=/abs/pokemons')
    console.error('  node scripts/legacy-art/fetch-pmdcollab.mjs 0351/0001 --slug=0351-sunny --dest=/abs/pokemons')
    process.exit(1)
  }
  let ids
  try {
    ids = parseIds(idSpec)
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exit(1)
  }
  if (slugArg && ids.length > 1) {
    console.error(`error: --slug only makes sense for a single assetId, got ${ids.length}`)
    process.exit(1)
  }
  for (const id of ids) await fetchOne(id, slugArg ?? defaultSlug(id))
}
