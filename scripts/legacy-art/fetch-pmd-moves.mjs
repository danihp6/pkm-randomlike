// Merges real Pokemon Mystery Dungeon: Super Mystery Dungeon (SMD) numbers
// into src/entities/moves.json. fetch-pokedex.mjs seeds moves.json with
// mainline power/PP/range values from PokeAPI - this script overwrites
// `power`/`range`/`target`/`radius`/`ppMax` with PMD's own scale and shape,
// and adds `accuracy`/`critRate`/`piercing`, which PokeAPI has no equivalent
// for, all sourced from each move's own Bulbapedia page ("Pokemon Mystery
// Dungeon series" section). calculateDamage's formula (see
// src/entities/damage.ts) is calibrated for this PMD power scale, not
// mainline's - see #162. Run this after fetch-pokedex.mjs whenever the
// moveset changes, instead of hand-editing moves.json.
//
// Usage:
//   node scripts/fetch-pmd-moves.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const POKEDEX_PATH = new URL('../src/entities/pokedex.json', import.meta.url)
const MOVES_PATH = new URL('../src/entities/moves.json', import.meta.url)
const API = 'https://bulbapedia.bulbagarden.net/w/api.php'

// Bulbapedia's MDMoveRow template exists per-game (RB/TDS/BSL/GTI/SMD/RTDX).
// Prefer the SMD row; when a move has none (dropped from SMD's movepool, or
// a fan/never-released move id), fall back to the closest available game in
// rough chronological distance from SMD - RTDX (2020 remake) first, then the
// earlier games in release order.
const GAME_PRIORITY = ['SMD', 'RTDX', 'GTI', 'BSL', 'TDS', 'RB']

// Bulbapedia doesn't document a per-move critical-hit rate for the PMD
// series. Use PMD's flat base rate (4%) for every move, except a small
// hardcoded list of moves that boost it in the mainline games (12.5%, the
// mainline "high critical-hit ratio" value) - Bulbapedia's PMD move pages
// don't call this out explicitly, so this list is carried over from
// mainline knowledge rather than sourced per-move.
const DEFAULT_CRIT_RATE = 4
const BOOSTED_CRIT_RATE = 12.5
const BOOSTED_CRIT_MOVES = new Set([
  'karate-chop',
  'razor-leaf',
  'crabhammer',
  'slash',
  'aeroblast',
  'cross-chop',
  'shadow-claw',
  'air-cutter',
  'blaze-kick',
  'poison-tail',
  'night-slash',
  'psycho-cut',
  'sky-attack',
  'spacial-rend',
  'leaf-blade',
  'stone-edge',
])

function critRateFor(slug) {
  return BOOSTED_CRIT_MOVES.has(slug) ? BOOSTED_CRIT_RATE : DEFAULT_CRIT_RATE
}

// Mainline turn-priority bonuses (see Move.priority in moves.ts), keyed by
// move slug - every move absent here acts at normal priority. Unlike the PMD
// data fetched below, Bulbapedia's MDMoveRow has no priority column, so this
// is carried over from mainline knowledge the same way BOOSTED_CRIT_MOVES is.
const MOVE_PRIORITY = {
  'quick-attack': 1,
  'aqua-jet': 1,
  'ice-shard': 1,
  'mach-punch': 1,
  'shadow-sneak': 1,
  'sucker-punch': 1,
  'extreme-speed': 2,
  'fake-out': 3,
  'feint': 2,
  // Mainline's forced-switch family (see fetch-pokedex.mjs's ForceSwitchEffect) always goes last.
  'roar': -6,
  'whirlwind': -6,
  'dragon-tail': -6,
  'circle-throw': -6,
}

function priorityFor(slug) {
  return MOVE_PRIORITY[slug] ?? 0
}

// Fallback accuracy for a move with no MDMoveRow at all in any game (logged
// for manual review - see main loop below).
const FALLBACK_ACCURACY = 100

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`)
  return res.json()
}

// "vine-whip" -> "Vine Whip"
function titleCase(slug) {
  return slug
    .split('-')
    .map((w) => w.replace(/^./, (c) => c.toUpperCase()))
    .join(' ')
}

// Resolves a move slug to its exact Bulbapedia page title via opensearch,
// since several move pages use punctuation titleCase can't guess (e.g.
// "double-edge" -> "Double-Edge (move)", "u-turn" -> "U-turn (move)").
// Returns null if no matching "<Name> (move)" page exists.
async function resolveTitle(slug) {
  const query = `${titleCase(slug)} (move)`
  const url = `${API}?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json`
  const [, titles] = await fetchJson(url)
  return titles.find((t) => t.endsWith('(move)')) ?? null
}

// Fetches a resolved Bulbapedia page's raw wikitext, following redirects.
async function fetchWikitext(title) {
  const url = `${API}?action=query&titles=${encodeURIComponent(title)}&redirects=1&prop=revisions&rvprop=content&rvslots=main&format=json`
  const data = await fetchJson(url)
  const page = Object.values(data.query.pages)[0]
  if (page.missing !== undefined) return null
  return page.revisions[0].slots.main['*']
}

// Parses every {{MDMoveRow|game=XXX|...}} line in a move's wikitext into
// {game, fields} records, fields being the raw key=value pairs.
function parseMoveRows(wikitext) {
  const rows = []
  for (const match of wikitext.matchAll(/\{\{MDMoveRow\|([^}]*)\}\}/g)) {
    const fields = {}
    for (const pair of match[1].split('|')) {
      const [key, value] = pair.split('=')
      if (key && value !== undefined) fields[key.trim()] = value.trim()
    }
    if (fields.game) rows.push(fields)
  }
  return rows
}

// "95%" -> 95, "—%" (or any dash) -> null (never misses, e.g. Swift).
function parseAccuracy(acc) {
  if (!acc) return null
  const digits = acc.match(/\d+/)
  return digits ? Number(digits[0]) : null
}

// "12" -> 12, "—" (or any dash, status moves) -> null, "?" (undocumented) -> undefined
// so the caller can fall back to keeping the existing mainline value.
function parsePower(pow) {
  if (!pow) return undefined
  if (/^[-—]+$/.test(pow.trim())) return null
  const digits = pow.match(/\d+/)
  return digits ? Number(digits[0]) : undefined
}

// "25" -> 25 (base PP, not the accmax-style ppmax cap - we don't model PP growth).
function parsePp(pp) {
  if (!pp) return undefined
  const digits = pp.match(/\d+/)
  return digits ? Number(digits[0]) : undefined
}

const RANGE_TILES_AWAY = /^(\d+)\s+tiles?\s+away/
const RANGE_AROUND_USER = /^(\d+)\s+tiles?\s+around user/

// Maps a PMD MDMoveRow `range` string onto our target/range/radius/piercing
// model (see MoveTarget in moves.ts). Returns null for a string this parser
// doesn't recognize, so the caller can keep the existing (mainline-derived)
// value and flag it for manual review. "Front area" (a handful of moves,
// e.g. Barrage) has no equivalent shape in our engine - approximated as a
// plain frontal hit.
function parseRange(rangeRaw) {
  if (!rangeRaw) return null
  const raw = rangeRaw.trim().toLowerCase()
  if (raw === 'front' || raw === 'front area') return { target: 'frontal', range: 1, radius: 0 }
  const away = raw.match(RANGE_TILES_AWAY)
  if (away)
    return {
      target: 'ranged',
      range: Number(away[1]),
      radius: 0,
      piercing: raw.includes('piercing'),
    }
  if (raw === 'entire room') return { target: 'room', range: 0, radius: 0 }
  const around = raw.match(RANGE_AROUND_USER)
  if (around) return { target: 'area', range: 0, radius: Number(around[1]) }
  if (raw === 'user') return { target: 'self', range: 0, radius: 0 }
  return null
}

// Picks the row for the closest game to SMD (see GAME_PRIORITY) out of every
// row a move's wikitext has.
function pickRow(rows) {
  for (const game of GAME_PRIORITY) {
    const row = rows.find((r) => r.game === game)
    if (row) return { row, game }
  }
  return null
}

async function fetchMoveData(slug) {
  const title = await resolveTitle(slug)
  if (!title) return null
  const wikitext = await fetchWikitext(title)
  if (!wikitext) return null
  const rows = parseMoveRows(wikitext)
  const picked = pickRow(rows)
  if (!picked) return null
  return {
    accuracy: parseAccuracy(picked.row.acc),
    power: parsePower(picked.row.pow),
    ppMax: parsePp(picked.row.pp),
    rangeInfo: parseRange(picked.row.range),
    rangeRaw: picked.row.range,
    game: picked.game,
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pokedex = JSON.parse(readFileSync(POKEDEX_PATH, 'utf8'))
const catalog = JSON.parse(readFileSync(MOVES_PATH, 'utf8'))

const referencedSlugs = new Set(
  pokedex.flatMap((e) => [...e.learnset.map((l) => l.move), ...(e.machineMoves ?? [])]),
)
const slugs = [...referencedSlugs].filter((slug) => catalog[slug]).sort()

// Rebuilds a move entry with accuracy/critRate/range fields inserted in
// Move-type order instead of tacking them on at the end. `power`/`target`/
// `range`/`radius`/`piercing`/`ppMax` are overwritten in place only when PMD
// data was found for them - each falls back to the move's existing
// (mainline-derived) value otherwise.
function withPmdFields(move, power, accuracy, critRate, rangeInfo, ppMax, priority) {
  const { name, type, kind, target, range, radius, piercing, charges, effect } = move
  return {
    name,
    type,
    power,
    accuracy,
    critRate,
    kind,
    target: rangeInfo?.target ?? target,
    range: rangeInfo?.range ?? range,
    radius: rangeInfo?.radius ?? radius,
    ...((rangeInfo?.piercing ?? piercing) ? { piercing: true } : {}),
    ...(charges ? { charges: true } : {}),
    ...((priority ?? move.priority ?? 0) !== 0 ? { priority: priority ?? move.priority } : {}),
    ...(effect ? { effect } : {}),
    ...((ppMax ?? move.ppMax) !== undefined ? { ppMax: ppMax ?? move.ppMax } : {}),
  }
}

console.log(`Fetching PMD data for ${slugs.length} moves...`)
for (const [i, slug] of slugs.entries()) {
  process.stdout.write(`  [${i + 1}/${slugs.length}] ${slug}... `)
  const result = await fetchMoveData(slug)
  const critRate = critRateFor(slug)
  const mainlinePower = catalog[slug].power
  if (!result) {
    console.log(
      'no MD data found, using fallback accuracy and mainline power (manual review needed)',
    )
    catalog[slug] = withPmdFields(
      catalog[slug],
      mainlinePower,
      FALLBACK_ACCURACY,
      critRate,
      null,
      undefined,
      priorityFor(slug),
    )
  } else {
    // result.power is undefined when the row's pow field couldn't be parsed
    // (e.g. "?") - keep the mainline value rather than dropping power data.
    const power = result.power !== undefined ? result.power : mainlinePower
    const powerNote = result.power === undefined ? ', power kept mainline (manual review)' : ''
    // "User" range (-> target 'self') means "doesn't hit a tile" in PMD -
    // fine for a status move (matches our self-effect short-circuit), but a
    // damage-dealing move with it (e.g. Payback, some charge-up moves) can't
    // be represented as a no-target hit in our engine - keep its existing
    // target/range instead of leaving it unable to ever land.
    let rangeInfo = result.rangeInfo
    if (rangeInfo?.target === 'self' && catalog[slug].kind !== 'status') rangeInfo = null
    const rangeNote =
      rangeInfo === null && result.rangeInfo !== null
        ? `, range "${result.rangeRaw ?? ''}" unsupported for a ${catalog[slug].kind} move, kept (manual review)`
        : rangeInfo === null
          ? `, unrecognized range "${result.rangeRaw ?? ''}" kept (manual review)`
          : ''
    if (result.game !== 'SMD')
      console.log(`no SMD row, using ${result.game} (manual review)${powerNote}`)
    else {
      console.log(
        `pow=${power ?? 'status'} acc=${result.accuracy ?? 'never misses'} pp=${result.ppMax ?? 'kept mainline'}${powerNote}${rangeNote}`,
      )
    }
    catalog[slug] = withPmdFields(
      catalog[slug],
      power,
      result.accuracy,
      critRate,
      rangeInfo,
      result.ppMax,
      priorityFor(slug),
    )
  }
  await sleep(150)
}

writeFileSync(MOVES_PATH, JSON.stringify(catalog, null, 2) + '\n')
console.log(
  `Wrote PMD power/accuracy/critRate/range/pp for ${slugs.length} moves to src/entities/moves.json`,
)
