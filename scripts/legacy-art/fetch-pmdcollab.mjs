// Downloads one or more species' sprite packs from PMDCollab and unzips them
// into sprite-sources/pokemons/<NNNN>-pmdcollab/, ready for
// extract-real-sprites.mjs. Also fetches that species' portrait sheet
// (portrait-sheet.png) from PMDCollab's separate portrait endpoint, ready
// for extract-real-portraits.mjs.
//
// Usage:
//   node scripts/fetch-pmdcollab.mjs <ids> [name] [--anims=Idle,Walk]
//
//   ids   - one PMDCollab/National-Dex id ("4"), a comma list ("1,4,10"),
//           a range ("1-9"), or any mix ("1,4,10-15"). Ids are zero-padded
//           to 4 digits for the download URL and the destination folder
//           name (sprite-sources/pokemons/0004-pmdcollab/).
//   name  - optional, human-readable folder name instead of the zero-padded
//           id (sprite-sources/pokemons/<name>-pmdcollab/). Only valid when
//           `ids` resolves to a single id.
//   --anims=A,B  - optional: only keep files for these animations (matches
//           "<Anim>-Anim.png", "<Anim>-Offsets.png", "<Anim>-Shadow.png").
//           AnimData.xml is always kept. Omit to keep every file in the zip
//           (idle, walk, attack, sleep, hurt, ...).
//
// Examples:
//   node scripts/fetch-pmdcollab.mjs 4 charmander
//   node scripts/fetch-pmdcollab.mjs 1,4,10 --anims=Idle,Walk
//   node scripts/fetch-pmdcollab.mjs 1-9 --anims=Idle,Walk
import { mkdirSync, writeFileSync } from 'node:fs'
import { get } from 'node:https'
import { readZip } from './zip-codec.mjs'

const SOURCES = new URL('../sprite-sources/pokemons/', import.meta.url)

function parseIds(spec) {
  const ids = new Set()
  for (const part of spec.split(',')) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const [, a, b] = range
      for (let i = Number(a); i <= Number(b); i++) ids.add(i)
    } else if (/^\d+$/.test(part)) {
      ids.add(Number(part))
    } else {
      throw new Error(`bad id/range: "${part}"`)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

const rawArgs = process.argv.slice(2)
const animsArg = rawArgs.find((a) => a.startsWith('--anims='))
const anims = animsArg ? animsArg.slice('--anims='.length).split(',').filter(Boolean) : null
const positional = rawArgs.filter((a) => !a.startsWith('--'))
const [idSpec, name] = positional

if (!idSpec) {
  console.error('Usage: node scripts/fetch-pmdcollab.mjs <ids> [name] [--anims=Idle,Walk]')
  console.error('Examples:')
  console.error('  node scripts/fetch-pmdcollab.mjs 4 charmander')
  console.error('  node scripts/fetch-pmdcollab.mjs 1,4,10 --anims=Idle,Walk')
  console.error('  node scripts/fetch-pmdcollab.mjs 1-9 --anims=Idle,Walk')
  process.exit(1)
}

const ids = parseIds(idSpec)
if (name && ids.length > 1) {
  console.error(
    `a custom name ("${name}") only makes sense for a single id, got ${ids.length}: ${idSpec}`,
  )
  process.exit(1)
}

function fetchBuffer(fetchUrl, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    get(fetchUrl, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        res.resume()
        resolve(fetchBuffer(new URL(res.headers.location, fetchUrl).href, redirectsLeft - 1))
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GET ${fetchUrl} -> HTTP ${res.statusCode}`))
        res.resume()
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
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

for (const id of ids) {
  const padded = String(id).padStart(4, '0')
  const url = `https://spriteserver.pmdcollab.org/assets/${padded}/sprites.zip`
  const slug = name ?? padded

  console.log(`[${padded}] fetching ${url}`)
  let zipBuf
  try {
    zipBuf = await fetchBuffer(url)
  } catch (err) {
    console.error(`[${padded}] failed: ${err.message}`)
    continue
  }

  const allEntries = readZip(zipBuf)
  let resolvedAnims = null
  if (anims) {
    const animDataXml =
      allEntries.find((e) => e.name === 'AnimData.xml')?.data.toString('utf8') ?? ''
    resolvedAnims = resolveAnims(anims, animDataXml)
  }
  const entries = allEntries.filter((e) => keepEntry(e.name, resolvedAnims))
  if (anims && entries.length <= 1) {
    console.error(
      `[${padded}] no files matched --anims=${anims.join(',')} (check the anim names against AnimData.xml)`,
    )
    continue
  }

  const destDir = new URL(`${slug}-pmdcollab/`, SOURCES)
  mkdirSync(destDir, { recursive: true })
  for (const { name: entryName, data } of entries) {
    writeFileSync(new URL(entryName, destDir), data)
  }
  console.log(
    `[${padded}] wrote ${entries.length} files to sprite-sources/pokemons/${slug}-pmdcollab/`,
  )

  // Portrait sheet: a separate endpoint from sprites.zip, one 200x320 PNG of
  // 40x40 emotion cells (Normal is the top-left cell; see
  // extract-real-portraits.mjs). Best-effort - some ids have no portrait art
  // yet on PMDCollab, so a 404 here shouldn't fail the whole species fetch.
  const portraitUrl = `https://spriteserver.pmdcollab.org/assets/portrait/${padded}.png`
  try {
    const portraitBuf = await fetchBuffer(portraitUrl)
    writeFileSync(new URL('portrait-sheet.png', destDir), portraitBuf)
    console.log(`[${padded}] wrote portrait-sheet.png`)
  } catch (err) {
    console.error(`[${padded}] no portrait: ${err.message}`)
  }
}

console.log(
  `Add a { id, slug, row, ... } entry to PMDCOLLAB_SPECIES in scripts/pmdcollab-species.mjs for each new species, then run:`,
)
console.log(`  node scripts/generate-pokemon.mjs && node scripts/extract-real-sprites.mjs`)
console.log(`  node scripts/generate-portraits.mjs && node scripts/extract-real-portraits.mjs`)
