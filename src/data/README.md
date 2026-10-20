# `src/data/` — content contract

Everything balanceable lives here; the engine reads it and never hardcodes it.

## Layout

- `dex/` — **generated**, committed, do not edit by hand. Produced by
  `npm run data:dex` from `@pkmn/dex`. See `docs/showdown-reuse.md`. Typed
  accessors live beside it (`species.ts`, `megas.ts`, `gmaxes.ts`, `moves.ts`,
  `abilities.ts`, `items.ts`, `learnsets.ts`, `types.ts`, `natures.ts`,
  `evolutions.ts`).
- `i18n/es/` — **generated**, committed: the official Spanish move and ability
  names and descriptions (`moves.json`, `abilities.json`, `meta.json`), produced
  by `node scripts/build-i18n-content.mjs --source <PokeAPI csv dir>` from
  PokeAPI's `es` names and flavour text and read by `src/i18n/content.ts`. The
  English strings stay in the dex (`D43` amended for these two kinds).
- `tilesets/` — one file per biome tileset — the forest's row in `frlg.ts`, wired
  by the `index.ts` registry — plus the shared `palettes.ts` and `placeholder.ts`,
  the procedural sheet kept as a **test fixture**. Contract in
  `docs/tileset-spec.md`.
- `biomes.ts` — biome → tileset and terrain flavour.
- `mapSize.ts` — the map-size tiers (small / medium / large by area) that scale a
  biome's base `grassPatches` / `ledges` counts and add optional paths to a
  shape's `branchCount`, so density and exploration hold across route sizes
  (`docs/routes-spec.md` §2).
- `gates.ts` — the gated reward room's obstacle table: each kind's party types, the map
  value it is stamped as and the atlas cell it draws (`docs/maps-spec.md` §7).
- `maps.ts` — the per-map tuning: level range, room-count range and the room
  width/height range, plus the infinite-run step past the last map
  (`docs/maps-spec.md` §4).
- `bosses.ts` — the fixed party sizes a floor's boss and mini-boss field: six and
  three, or three and two on map 1, the run's on-ramp (`docs/maps-spec.md`
  §6/§7).
- `trainers.ts` — trainer archetypes: identity, sprites, reward and the AI script
  flags their trainers think with (`aiFlags`, `docs/battle-spec.md` §11); their
  roster is the floor's BST pool (`src/engine/run/pool.ts`, `D39`). Its
  `SPECIAL_ARCHETYPES` are the **set-piece** rows a room places itself (the casino's
  `rocket` grunt), kept outside `TRAINER_ARCHETYPES` so the route never rolls them.
- `trainerLevels.ts` — the player-relative trainer level table: each regular party
  size's percentage of the live squad level, and the rule that floors it and clamps
  it to the floor's cap, read by the route's roster build (`docs/maps-spec.md` §5,
  D35, D11/D17 amended).
- `wildLevels.ts` — the wild-level share of the live squad level and the rule that
  floors it and clamps it to the floor's cap, read by the route's encounter stream
  (`docs/routes-spec.md` §3/§5, D11/D17 amended).
- `casino.ts` — the casino room's balance table: one spin's price per band, the
  chance a spin turns into the grunt fight and each band's weighted prize rows.
- `noHeal.ts` — the no-heal room's table: the first floor that may hang it, the
  chance, its trainer's archetype and the move ids the room bars for the player.
- `loot.ts` — the per-band ground-item pools a route's pockets draw from, plus
  each band's `hiddenChance` (`docs/routes-spec.md` §2 step 4).
- `population.ts` — the per-band **population thinning** the route generator reads
  (`trainerBonus` added to the map-size tier's own, and the chance a pocket's guard
  exists at all, `O-M5`; `docs/route-generator.md` §3.4).
- `battlefields.ts` — the `ROOM_BATTLEFIELDS` table: the weather, terrain or field
  condition a room's battles can begin under, each row's overlay tint/alpha and the
  two roll chances (regular rooms and the boss room, `docs/maps-spec.md` §6/§7),
  read by `src/engine/routes/battlefield.ts` and painted by the route.
- `passives.ts` — the map-passive table (`MAP_PASSIVES`): the **out-of-battle**
  abilities a route rewards, each row's trigger (`'room'` on entry, `'win'` on a won
  battle), its chance and the item ids it pays, read by
  `src/engine/run/passives.ts` (`docs/routes-spec.md` §2).
- `run.ts` — level bands (level range, party size and the BST window, `D39`) and
  the run chain cadence.
- `keybinds.ts` — the confirm/cancel/move/run/interact/reset/hud/settings actions,
  their default keys, labels and the pure rebind rules (`D23`). The Phaser half is
  `src/input/`.
- `items.ts` — the battle item catalogue: balls with catch multipliers, potions,
  status cures, X-items and held items (Leftovers, berries, the 1.2x type items
  and the whole **competitive held set**, `COMPETITIVE_HELD`: the damage, Speed,
  accuracy, crit, last and survive items, the resist and pinch berries and the
  self-status orbs). A row's `shortDesc` comes from `dex/items.ts` unless the row
  states one; the effect fields (`damageBoost`, `speedBoost`, `accuracyBoost`,
  `critStages`, `alwaysLast`, `resistBerry`, `recoil`, `selfStatus`, `survive`)
  are read by `engine/battle/effects/items.ts`, and the ids nothing models yet are
  named in that file's `UNMODELLED_ITEMS` (`D16`). Also builds one
  unsold **Mega Stone** per Mega forme from `dex/megas.ts` (`D34`); holding the
  matching stone lets a Pokémon Mega Evolve once per battle. It builds **no**
  G-Max item and no "Gigantamax factor": Gigantamax needs neither (`D44`).
- `abilityText.ts` — the ability-text override table: the ids whose dex blurb is
  competitive-play boilerplate while the engine ports the ability
  (`docs/balance/effect-coverage.md`), read by `abilityDescription`
  (`src/ui/partyDetail.ts`) before the dex's own text.
- `audio/` — **generated**, committed, do not edit by hand: `cries.json`
  (species id → its cry cue, 455 rows) and `moveSounds.json` (move id → the
  sound its own animation plays, 295 rows), written by
  `node scripts/frlg/render-frlg-audio.mjs`. `index.ts` is the typed accessor
  (`cryCueFor`, `moveSoundCueFor`, the two row counts) and every value is a cue
  id from `src/audio/cues.ts` (`D22` addendum).
- `moveCoverage.json` — **generated**, do not edit by hand: every shipped move as
  `port | no-op | excluded` with the seam it was derived from, written by
  `scripts/effect-coverage.mjs` beside the coverage table; regenerate it with
  `npm run docs:coverage`. `moveCoverage.ts` is its typed accessor, and the
  develop-build warning reads it (`D16`).
- `pokemonOverworld.ts` — the accessor over Task-76's committed overworld pairs
  (`src/assets/pokemon/<fileId>.png` + `<fileId>.json`) and their coverage manifest
  (`index.json`): a species id resolves to its pair's file id, texture key, URL, cell
  size, five direction rows and five animation blocks, so a scene draws the party's
  overworld art without knowing the sheet layout. An id the manifest lists as
  `missing` resolves to null. This file is the manifest's only reader.

## Rules

1. One source of truth per fact. Species stats come from `dex/species.json`; no
   other file repeats them.
2. JSON is imported through a typed accessor (e.g. `src/data/dex/species.ts`), so
   engine code never sees `any`.
3. Game text and identifiers are English (`D12`).
4. Adding content means adding a row/file plus a line in the matching spec, not a
   new engine branch.
5. Regenerating the dex is deliberate: `npm run data:dex`, `npm test`, then update
   the counts in `dex/meta.json` if they moved.
