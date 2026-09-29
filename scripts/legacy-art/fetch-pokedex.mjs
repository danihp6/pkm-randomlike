// Source of truth for src/entities/pokedex.json and src/entities/moves.json:
// fetches base stats, level-up evolution data and level-up movesets from
// PokeAPI for a set of species (and everything they evolve into) and
// regenerates both files. Run this whenever a species is added, instead of
// hand-editing either file.
//
// Usage:
//   node scripts/fetch-pokedex.mjs [ids]
//
//   ids - optional comma list of National Dex ids to seed the fetch from
//         (defaults to the ids already present in pokedex.json). Each
//         species' full evolution chain is walked and every member of the
//         chain is included, even ones not in the id list, so evolved forms
//         always have a PokedexEntry with real stats.
//
//         Only level-up evolutions are recorded (evolvesTo/evolvesAtLevel).
//         Stone/trade/friendship/happiness evolutions are left as dead ends
//         since the game has no mechanic for those triggers yet.
//
//         Movesets are level-up moves from each species' debut version
//         group (the earliest entry in VERSION_GROUP_ORDER it has any
//         level-up moves in - red-blue for gen 1, gold-silver for gen 2,
//         etc.), so a species never gets moves from a game it didn't
//         originally appear in. TM/HM-learnable moves for that same version
//         group are recorded separately as `machineMoves`, used by the TM
//         item to teach a random one. Status moves (power: null in PokeAPI) are kept when they
//         carry a stat-stage change (e.g. Growl, Swords Dance), a
//         supported ailment (poison, paralysis, sleep, confusion - e.g.
//         Thunder Wave, Sleep Powder), or force a switch (Roar, Whirlwind -
//         adapted here as a warp to a random free tile, since this game has
//         no switching mechanic); anything else (trapping, leech, etc.)
//         is dropped. Damaging moves with a supported secondary ailment
//         (e.g. Poison Sting) or the same force-switch effect (Dragon Tail,
//         Circle Throw) keep it as well. Each remaining move's
//         target/range/radius is derived heuristically (see moveFromApi
//         below) since PokeAPI has no concept of the grid distances this
//         game's combat uses.
//
// Examples:
//   node scripts/fetch-pokedex.mjs
//   node scripts/fetch-pokedex.mjs 1,4,7
import { readFileSync, writeFileSync } from 'node:fs'

const POKEDEX_PATH = new URL('../src/entities/pokedex.json', import.meta.url)
const MOVES_PATH = new URL('../src/entities/moves.json', import.meta.url)
const API = 'https://pokeapi.co/api/v2'

// Oldest-to-newest version groups a species' level-up learnset can be read
// from. fetchSpeciesEntry picks the first one here a given species has any
// level-up move in - its debut game - so e.g. Pichu (introduced in gen 2)
// gets its gold-silver learnset instead of an empty red-blue one.
const VERSION_GROUP_ORDER = [
  'red-blue',
  'yellow',
  'gold-silver',
  'crystal',
  'ruby-sapphire',
  'emerald',
  'firered-leafgreen',
  'diamond-pearl',
  'platinum',
  'heartgold-soulsilver',
  'black-white',
]

// Keep in sync with PokemonType in src/entities/pokemon.ts.
const TYPE_ALLOWLIST = new Set([
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
])

const STAT_KEY = {
  hp: 'baseHp',
  attack: 'baseAtk',
  defense: 'baseDef',
  'special-attack': 'baseSpAtk',
  'special-defense': 'baseSpDef',
  speed: 'baseSpeed',
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`)
  return res.json()
}

function idFromUrl(url) {
  return Number(url.match(/\/(\d+)\/?$/)[1])
}

// Species whose PokeAPI slug carries a legitimate hyphen rather than a
// variant suffix (e.g. "nidoran-f") - kept in full instead of split.
const HYPHENATED_NAMES = new Set(['ho-oh', 'porygon-z', 'jangmo-o', 'hakamo-o', 'kommo-o'])

function capitalize(name) {
  if (HYPHENATED_NAMES.has(name))
    return name
      .split('-')
      .map((w) => w.replace(/^./, (c) => c.toUpperCase()))
      .join('-')
  // Drop PokeAPI's variant suffixes (e.g. "nidoran-f") - not handled here.
  return name.split('-')[0].replace(/^./, (c) => c.toUpperCase())
}

// "vine-whip" -> "Vine Whip"
function titleCase(slug) {
  return slug
    .split('-')
    .map((w) => w.replace(/^./, (c) => c.toUpperCase()))
    .join(' ')
}

async function fetchSpeciesEntry(id) {
  const pokemon = await fetchJson(`${API}/pokemon/${id}`)
  const entry = { id, name: capitalize(pokemon.name) }
  for (const s of pokemon.stats) {
    const key = STAT_KEY[s.stat.name]
    if (key) entry[key] = s.base_stat
  }
  entry.types = pokemon.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => t.type.name)
    .filter((t) => TYPE_ALLOWLIST.has(t))

  // This species' debut version group: the earliest entry in
  // VERSION_GROUP_ORDER it has any level-up move in.
  const versionGroup = VERSION_GROUP_ORDER.find((vg) =>
    pokemon.moves.some((m) =>
      m.version_group_details.some(
        (d) => d.move_learn_method.name === 'level-up' && d.version_group.name === vg,
      ),
    ),
  )

  // Level-up learnset for that version group: slug + lowest level it's
  // learned at (level 0, egg/evolution moves, is clamped to 1).
  const learnset = []
  for (const m of pokemon.moves) {
    const detail = m.version_group_details.find(
      (d) => d.move_learn_method.name === 'level-up' && d.version_group.name === versionGroup,
    )
    if (!detail) continue
    learnset.push({ level: Math.max(1, detail.level_learned_at), move: m.move.name })
  }
  learnset.sort((a, b) => a.level - b.level)
  entry.learnset = learnset

  // Moves learnable via TM/HM in that same version group.
  entry.machineMoves = pokemon.moves
    .filter((m) =>
      m.version_group_details.some(
        (d) => d.move_learn_method.name === 'machine' && d.version_group.name === versionGroup,
      ),
    )
    .map((m) => m.move.name)
  return entry
}

// PokeAPI stat name -> this game's StatKey (keep in sync with StatKey in
// src/entities/moves.ts). accuracy/evasion aren't a Fighter stat here, so
// stat_changes entries for those are ignored.
const STAT_CHANGE_KEY = {
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spAtk',
  'special-defense': 'spDef',
  speed: 'speed',
}

// Rounds a stat-change effect lasts once applied. PokeAPI has no duration for
// these (mainline games keep them until switch-out/battle end); #111 expires
// them after a fixed number of rounds instead, so every effect gets the same
// value here rather than one derived from the API.
const STAT_CHANGE_DURATION = 5

// Builds this move's StatChangeEffect from its first supported stat change,
// or null if it has none (e.g. only touches accuracy/evasion, or is some
// other kind of status effect - see moveFromApi).
function statChangeEffectFromApi(data) {
  const change = data.stat_changes.find((c) => STAT_CHANGE_KEY[c.stat.name])
  if (!change) return null
  return {
    kind: 'stat-change',
    stat: STAT_CHANGE_KEY[change.stat.name],
    target: data.target.name === 'user' ? 'self' : 'foe',
    stages: change.change,
    duration: STAT_CHANGE_DURATION,
  }
}

// PokeAPI ailment name -> this game's ConditionKind (keep in sync with
// ConditionKind in src/entities/moves.ts). Ailments with no game mechanic yet
// (trapping, leech-seed, etc.) are left unmapped and dropped.
const CONDITION_KEY = {
  poison: 'poison',
  paralysis: 'paralysis',
  sleep: 'sleep',
  confusion: 'confusion',
}

// Rounds a condition lasts once applied, for ailments PokeAPI gives no
// min_turns/max_turns for (poison, paralysis - persist until cured in the
// mainline games, which this game has no items for yet).
const CONDITION_DEFAULT_DURATION = 5

// Builds this move's ConditionEffect from its meta ailment, or null if it has
// none/an unsupported one (see CONDITION_KEY above).
function conditionEffectFromApi(data) {
  const kind = CONDITION_KEY[data.meta?.ailment?.name]
  if (!kind) return null
  const { ailment_chance: ailmentChance, min_turns: minTurns, max_turns: maxTurns } = data.meta
  return {
    kind: 'condition',
    condition: kind,
    target: data.target.name === 'user' ? 'self' : 'foe',
    chance: ailmentChance > 0 ? ailmentChance : 100,
    duration: maxTurns > 0 ? Math.round((minTurns + maxTurns) / 2) : CONDITION_DEFAULT_DURATION,
  }
}

// PokeAPI categorizes mainline's forced-switch move family (meta.category
// "force-switch") as Roar/Whirlwind only - Dragon Tail/Circle Throw deal
// damage first and only force the switch as a secondary effect, so PokeAPI
// leaves their category as plain "damage" instead. Both pairs get this
// game's ForceSwitchEffect (warps the target elsewhere on the floor - see
// combat.ts's pickForceSwitchTile, since there's no switching mechanic to
// force here), so the latter two are special-cased by slug.
const FORCE_SWITCH_SLUG_OVERRIDES = new Set(['dragon-tail', 'circle-throw'])

function isForceSwitchMove(slug, data) {
  return data.meta?.category?.name === 'force-switch' || FORCE_SWITCH_SLUG_OVERRIDES.has(slug)
}

// Derives this game's spatial Move shape from PokeAPI's move data, since
// PokeAPI has no notion of grid distance. Physical moves are melee
// ('frontal', range 1); special moves are treated as ranged (range 4).
// Moves that hit every opponent ('all-opponents'/'all-other-pokemon') become
// 'area' hits around the attacker instead. Status moves (power: null) are
// kept only when they carry a stat-change effect (see statChangeEffectFromApi
// above) or a supported condition (see conditionEffectFromApi above);
// anything else is skipped. Damaging moves keep a supported condition too,
// as a secondary effect (e.g. Poison Sting).
async function moveFromApi(slug, cache) {
  if (cache.has(slug)) return cache.get(slug)
  const data = await fetchJson(`${API}/move/${slug}`)
  if (!TYPE_ALLOWLIST.has(data.type.name)) {
    cache.set(slug, null)
    return null
  }
  const area = data.target.name.includes('all')
  const forceSwitch = isForceSwitchMove(slug, data)
  if (data.damage_class.name === 'status') {
    const effect =
      statChangeEffectFromApi(data) ??
      conditionEffectFromApi(data) ??
      (forceSwitch ? { kind: 'force-switch' } : null)
    if (!effect) {
      cache.set(slug, null)
      return null
    }
    const move = {
      name: titleCase(data.name),
      type: data.type.name,
      power: null,
      kind: 'status',
      target: area ? 'area' : 'frontal',
      range: 1,
      radius: area ? 1 : 0,
      effect,
      ppMax: data.pp,
    }
    cache.set(slug, move)
    return move
  }
  if (data.power == null) {
    cache.set(slug, null)
    return null
  }
  const kind = data.damage_class.name === 'special' ? 'special' : 'physical'
  const effect = conditionEffectFromApi(data) ?? (forceSwitch ? { kind: 'force-switch' } : null)
  const move = {
    name: titleCase(data.name),
    type: data.type.name,
    power: data.power,
    kind,
    target: area ? 'area' : kind === 'special' ? 'ranged' : 'frontal',
    range: area ? 1 : kind === 'special' ? 4 : 1,
    radius: area ? 1 : 0,
    ...(effect ? { effect } : {}),
    ppMax: data.pp,
  }
  cache.set(slug, move)
  return move
}

// Walks a PokeAPI evolution-chain node, fetching stats for every species and
// recording the level-up edge (if any) on its parent entry.
async function walkChain(node, entries) {
  const speciesId = idFromUrl(node.species.url)
  if (!entries.has(speciesId)) {
    console.log(`  [${speciesId}] fetching ${node.species.name}...`)
    entries.set(speciesId, await fetchSpeciesEntry(speciesId))
  }
  for (const evo of node.evolves_to) {
    // base_form set means this detail only applies to a regional variant
    // (e.g. Galarian Meowth -> Perrserker) rather than the default form
    // handled here - skip those so the default form's edge isn't clobbered.
    const detail = evo.evolution_details.find(
      (d) => d.trigger?.name === 'level-up' && d.min_level && !d.base_form,
    )
    if (detail) {
      const entry = entries.get(speciesId)
      entry.evolvesTo = idFromUrl(evo.species.url)
      entry.evolvesAtLevel = detail.min_level
    }
    await walkChain(evo, entries)
  }
}

async function fetchFamily(rootId, entries) {
  const speciesRes = await fetchJson(`${API}/pokemon-species/${rootId}`)
  const chain = await fetchJson(speciesRes.evolution_chain.url)
  await walkChain(chain.chain, entries)
}

const arg = process.argv[2]
const existing = JSON.parse(readFileSync(POKEDEX_PATH, 'utf8'))
const seedIds = arg ? arg.split(',').map(Number) : existing.map((e) => e.id)

const entries = new Map()
for (const id of seedIds) {
  console.log(`[${id}] fetching evolution chain...`)
  await fetchFamily(id, entries)
}

// The chain walk above also visits pre-evolutions (baby forms) and branches
// only reachable via stone/trade/friendship triggers, none of which this
// game can perform. Keep only ids reachable from a seed by following
// evolvesTo edges, so the pokedex doesn't carry unreachable dead entries.
const reachable = new Set()
const queue = [...seedIds]
while (queue.length > 0) {
  const id = queue.shift()
  if (reachable.has(id)) continue
  reachable.add(id)
  const next = entries.get(id)?.evolvesTo
  if (next !== undefined) queue.push(next)
}

const merged = [...entries.values()]
  .filter((entry) => reachable.has(entry.id))
  .sort((a, b) => a.id - b.id)

// Fetch every unique move referenced by a learnset or machine moveset once,
// build the shared catalog, then drop entries for moves that turned out
// unsupported (an unlisted type, or a status move with no stat-change/
// condition effect) - moveFromApi returns null for those.
const moveCache = new Map()
const uniqueMoveSlugs = [
  ...new Set(merged.flatMap((e) => [...e.learnset.map((l) => l.move), ...e.machineMoves])),
]
console.log(`Fetching ${uniqueMoveSlugs.length} unique moves...`)
for (const slug of uniqueMoveSlugs) {
  await moveFromApi(slug, moveCache)
}
const catalog = {}
for (const [slug, move] of moveCache) {
  if (move) catalog[slug] = move
}
for (const entry of merged) {
  const seen = new Set()
  entry.learnset = entry.learnset.filter((l) => {
    if (!catalog[l.move] || seen.has(l.move)) return false
    seen.add(l.move)
    return true
  })
  const machineSeen = new Set()
  entry.machineMoves = entry.machineMoves.filter((move) => {
    if (!catalog[move] || machineSeen.has(move)) return false
    machineSeen.add(move)
    return true
  })
  if (entry.machineMoves.length === 0) delete entry.machineMoves
}

writeFileSync(POKEDEX_PATH, JSON.stringify(merged, null, 2) + '\n')
console.log(`Wrote ${merged.length} species to src/entities/pokedex.json`)
writeFileSync(MOVES_PATH, JSON.stringify(catalog, null, 2) + '\n')
console.log(`Wrote ${Object.keys(catalog).length} moves to src/entities/moves.json`)
console.log('Run scripts/fetch-pmd-moves.mjs next to fill in accuracy/critRate from PMD data.')
