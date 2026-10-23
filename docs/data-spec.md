# PokeRandomLike — Data Spec

Content lives in `src/data/` and is either generated (dex) or authored (tables,
rosters, route configs). Balancing must not require touching engine code.

## 1. Generated: `src/data/dex/`

Produced by `npm run data:dex` from `@pkmn/dex`, committed, never edited by hand.
See `docs/showdown-reuse.md` for the contents and filters, and
`src/data/dex/README.md` for the field list. Because `@pkmn/dex` has no catch
rate, the generator merges one in from the committed PokeAPI table
(`scripts/data/catch-rates.json`); capture balances against `catchRate`. It also
merges a canonical `heightm` from `scripts/data/heights.json` (PokeAPI, via
`scripts/fetch-heights.mjs`), which sizes the battle sprite
(`src/data/spriteSize.ts`).

`megas.json` is generated beside `species.json`: every Mega forme whose base
species is in the playable set, each with its `baseSpeciesId`, `stoneId` and
`stoneName` — 89 today, `meta.json`'s `counts.megas` being the authority. It is
battle-only content (`D34`) — never spawned, only reached through a held stone
(`src/engine/battle/mega.ts`). Two rows are **hand-authored** in
`scripts/build-dex.mjs` beside the generated pass. Greninja's **Ash** forme is a
Mega the dex cannot carry as one: `isMega` is unset on the entry and it is marked
`battleOnly: "Greninja-Bond"` instead, so `isPlayable` drops it from
`species.json` by id (`HAND_MEGA_IDS`) and the generator builds the row itself,
with its own authored stone `Greninjite Ash`. And four **stat boosts** are
authored for the formes the deleted form-change abilities used to reach (`D38`),
which were stat-identical to their base: Castform-Sunny/Rainy/Snowy gain 60 Sp.
Atk (480) and Cherrim-Sunshine 30 Sp. Atk and 30 Sp. Def (510), `baseStats` and
`bst` moving together. A Mega may be tagged `Past` (the games already ran
it) or `Future`, the dex's own "announced, not released" tag for the formes
Legends Z-A and Champions announced, and the filter takes both exactly alike. The
nine `Future` formes whose dex entry leaves `isMega` unset — Absol Z, Garchomp Z
and Lucario Z (`forme: 'Mega-Z'`), Meowstic (`'M-Mega'`/`'F-Mega'`),
Magearna-Original (`'Original-Mega'`) and the three Tatsugiri (`'Curly-Mega'` and
the two others) — are in neither file: the games reach them from a stone, never
from the grass, so `isPlayable` drops them by name-shape (`isUnflaggedMegaForme`)
instead of leaving them ownable, and `megas.json` cannot take them either —
three would share one of `meowsticite`/`magearnite`/`tatsugirinite`, which its
one-stone-per-forme guard rejects.

`gmaxes.json` is generated beside it too: every Gigantamax forme whose base species
is in the playable set, each with its `baseSpeciesId` and the **G-Max Stone** that
formes it — `stoneId` / `stoneName`, one per forme, named `<the base's Mega-style
name> G` (`Venusaurite G`, `venusauriteg`) — **34** today, `meta.json`'s
`counts.gmaxes` being the authority. The filter is the dex entry's **name**
(`/Gmax$/i`, the same test `isBattleBossForm` uses), so the G-Max formes stay out of
`species.json` exactly as they are kept out of the wild tables, the rosters and the
starter offers (`D39`), and `baseSpeciesId` is `normalizeId(changesFrom)` — the
**exact** base forme, which is what resolves `Toxtricity-Low-Key-Gmax` to
`toxtricitylowkey` and `Urshifu-Rapid-Strike-Gmax` to `urshifurapidstrike`. A row
takes its base species' `weightkg` (the dex's G-Max entries carry the placeholder
`weightkg: 0`), plus a `catchRate` and a `heightm`, and **no evolutions**; a G-Max
whose base is out of the set is skipped, and a duplicate id, base species or stone
(the latter also against the Mega pass's own stone ids) stops the build. All three
are map keys in `gmaxes.ts`, so the generator refuses them. The mechanic
is `D44` (`src/engine/battle/gmax.ts`), and it is stone-gated: the only condition is
that the Pokémon's own species has a G-Max forme **and it holds that forme's stone**.
**`Eternatus-Eternamax` is not a Gigantamax forme** — its name ends in `-Eternamax`,
not `Gmax` — so it is in neither generated file and Eternatus cannot Gigantamax in
this game.

## 2. Generated: `src/data/audio/`

Written by `node scripts/frlg/render-frlg-audio.mjs` from the pret/pokefirered
checkout, committed, never edited by hand — the same rule as the dex, and byte for
byte reproducible from the same inputs. Two tables, both keyed by our own ids and
both valued with a cue id of `src/audio/cues.ts` (`D22` addendum):

- `cries.json` — **455** rows, one per species with a national number up to 386,
  the range the decompilation carries a cry sample for: `"pikachu":
  "cry-pikachu"`. A species resolves through its own name, or through its raw
  `baseSpecies` for a forme (`Raichu-Alola` → `Cry_Raichu`), both normalized like
  `normalizeId`; the decompilation's `cry_tables.inc` is **not** the index, since
  its rows are ordered by the game's internal species number, which is not our
  `num`. A species above 386 has no row and its cry is silent.
- `moveSounds.json` — **295** rows, a move id → the cue of the sound that move's
  own animation plays: `"tackle": "move-comet-punch"`. The rows come from
  `data/battle_anim_scripts.s`: each `Move_<NAME>:` block's first `playse`-family
  sound, mapped to our move id by lowercasing and dropping non-alphanumerics, plus
  the cartridge's own renames (`VICE_GRIP` → `visegrip`, `FAINT_ATTACK` →
  `feintattack`, `HI_JUMP_KICK` → `highjumpkick`). A block whose sound is outside
  the `SE_M_*` family or whose id the dex does not carry is skipped and named by
  the generator (`Move_CUT`, `Move_COUNT` today); every other move gets the shared
  `hit` cue.

`index.ts` is the typed accessor beside them (`cryCueFor`, `moveSoundCueFor`, both
null when there is no row, plus `CRY_ROW_COUNT` / `MOVE_SOUND_ROW_COUNT`), and its
type import from `src/audio/cues.ts` is type-only, so the folder has no runtime
cycle with the cue table.

## 3. Authored

| File | What it holds | Phase |
| --- | --- | --- |
| `src/data/dex/natures.ts` | typed view over `dex/natures.json` | 1 |
| `src/data/tilesets/*.ts` | one biome tileset config + palette per biome | 0 |
| `src/data/biomes.ts` | biome → tileset, layout and terrain flavour | 2 |
| `src/data/maps.ts` | per-map tuning: level range, room-count range and room width/height range, plus the infinite-run step | 9 |
| `src/data/bosses.ts` | the fixed party sizes a floor's boss and mini-boss field (six and three, three and two on map 1), read by the route scene's roster build (`docs/maps-spec.md` §6/§7) | 9 |
| `src/data/trainers.ts` | trainer archetypes: name, class, sprite, money base/jitter (D33), `carriesMega` (bosses/`ace`) and the **AI script flags** its trainers think with (`aiFlags`, D46); the roster is the floor's BST pool (`D39`), not a species list here | 2/9 |
| `src/data/items.ts` | the run's item catalogue: balls, potions, status cures, held items and berries (no Revive), plus the **competitive held set** (`COMPETITIVE_HELD`: the damage/Speed/accuracy/crit/last/survive items, the resist and pinch berries and the self-status orbs whose effect `effects/items.ts` models, and the items it does not model yet, which `UNMODELLED_ITEMS` records by name, D16), **valuables** (sellable), **Mega Stones**, the **G-Max Stones** (`gmax`, 8 000, one per G-Max forme, D44), the **Plates** (`plate` + 1.2x `typeBoost`, D37), the **Memories** and **Drives** (`memory`/`drive`, D37, ground-only treasure that retypes Multi-Attack and Techno Blast) and the **TMs** (`machine` pocket), the chef's dish (`chefstew`, a one-turn `boosts`/`below`/`consumed` buff) and the escape held item (`smokeball`, `flee`, read by `battle/runAway.ts` through its `onTryEscape`), the **Tera Crystals** (`teraType`, one held row per battle type, 4 000 — the holder fights as that single type from the moment it takes the field), the five **coloured candies** (`candy`, 2 400 — one permanent ±1 stat treat whose stat and sign the run draws per colour from its own seed), and the three **route consumables** (`routeEffect`, 2 000 — the exorcist's, the weather man's and the medic's work in a bottle, riding the `'heal'` gesture kind and refused in battle), each with a Poké Dollar price | 3/6/10 |
| `src/data/tms.ts` | the base-Gen-9 TM table: TM number → move id (TM001 … TM171), hand-authored from the dex's `9M` flags, with the id/number/move helpers `items.ts` turns into reusable machines (D36) | 10 |
| `src/data/shop.ts` | the shop's per-band core (Balls/Potions) and the weighted pool its one or two rotating items are drawn from (D33), plus the bands whose counter shows the **G-Max Stone** row (`SHOP_GMAX_STONE_BANDS`, `late`/`end`, D44) | 9 |
| `src/data/spriteSize.ts` | the battle sprite size curve: canonical height (m) → drawn height (px), the power and clamps | 5 |
| `src/data/run.ts` | chain length, boss cadence, level bands (level range, party size and BST window, D39), starter pool, starting bag | 2 |
| `src/data/portraits.ts` | portrait atlas URL and frame mapping (dex number − 1) | 6 |
| `src/data/itemIcons.ts` | typed view over the generated `anil/item-icons.json` (Añil item icon frames, 24px, normalised id → frame, with `hasItemIcon`/`itemIconFrame` and the Mega Stone / TM fallbacks); the route and battle bag grids draw each stack's cell icon through `itemIconFrame`, and a stack whose id resolves to no frame keeps its cell and its count badge with no icon | 6 |
| `src/data/anil/item-icons.json` | generated frame map for the Añil item icon atlas | 6 |
| `src/data/frlg/item-icons.json` | generated frame map for the FRLG item icon atlas (superseded by the Añil one) | 6 |
| `src/data/typeIcons.ts` | typed view over the generated `frlg/type-icons.json` (Añil type badge frames, repacked in place) | 7 |
| `src/data/frlg/type-icons.json` | generated frame map for the Añil type badge atlas | 7 |
| `src/data/statusIcons.ts` | typed view over the generated `frlg/status-icons.json` (Añil status badge frames, repacked in place) | 7 |
| `src/data/frlg/status-icons.json` | generated frame map for the Añil status badge atlas | 7 |
| `src/data/abilityText.ts` | the ability-text override table: the ids whose dex blurb is competitive-play boilerplate while the engine ports the ability (`docs/balance/effect-coverage.md`), read by `abilityDescription` | 6 |
| `src/data/passives.ts` | the map-passive table (`MAP_PASSIVES`): the **out-of-battle** abilities a route rewards, each row's trigger (`'room'` on entry, `'win'` on a won battle), its chance and the catalogue ids it pays, read by `src/engine/run/passives.ts` (`docs/routes-spec.md` §2) | 10 |

- A **coloured candy**'s rule is per **run**, not per catalogue row: the colour →
  stat/sign mapping is drawn on `Rng(hashSeed('<seed>:candy:<colour>'))`, so red
  moves Speed in one run and Attack in another, and every candy of a colour moves the
  same stat in the same run. The run stores only the colours it has **discovered**
  (`RunState.discoveredCandy`, run-long); the catalogue never carries the mapping, so
  a banded candy row needs no data change to work (`src/engine/run/items.ts`,
  `candyTreat`). The route bag's description card reads that list through
  `bagDiscoveredCandy` (`src/ui/bag.ts`) and prints `candyTreat`'s stat and sign for
  a discovered colour, so the card says which stat the candy moves before it is
  spent; an undiscovered candy and the battle's own card print the catalogue
  description instead.

## 4. Typed accessors

JSON is imported and immediately wrapped by a typed accessor module, so engine
code never sees a `any`:

- `src/data/dex/species.ts` → `Species`, `getSpecies(id)`, `speciesByNum(n)`,
  `playableSpecies()`, `catchRateOf(id)`, `heightOf(id)`
- `src/data/dex/megas.ts` → `MegaForm`, `MEGA_FORMES`, `megaFormForItem(id)`,
  `megaFormOf(id)`, `megaFormsForBase(id)`, `isMegaSpecies(id)`,
  `megaMatchesSpecies(stoneId, speciesId)`
- `src/data/dex/gmaxes.ts` → `GmaxForm`, `GMAX_FORMES`, `gmaxFormForItem(id)`,
  `gmaxFormOf(id)`, `gmaxFormForBase(id)`, `isGmaxSpecies(id)`,
  `gmaxMatchesSpecies(stoneId, speciesId)`
- `src/data/dex/moves.ts` → `Move`, `getMove(id)`, `moveByType(type)`,
  `isDamaging(move)`
- `src/data/dex/learnsets.ts` → `learnsetOf(speciesId)`, `levelUpMoves(id, level)`,
  `learnableBy(id, method)`, `parseLearnSource(code)`
- `src/data/dex/types.ts` → `effectiveness(attackType, defenderTypes)`, `TYPE_NAMES`
- `src/data/dex/natures.ts` → `natureMultiplier(nature, stat)`,
  `statAtLevel(species, level, nature, ivs, evs)`
- `src/data/dex/evolutions.ts` → `evolutionFor(speciesId, level)`,
  `isLevelEvolution(evolution)`
- `src/data/dex/items.ts` → `DexItem`, `getDexItem(id)`, `allDexItems()`
  (the catalogue's own text and a berry's `naturalGift`)
- `src/data/audio/index.ts` → `cryCueFor(speciesId)`, `moveSoundCueFor(moveId)`,
  `CRY_ROW_COUNT`, `MOVE_SOUND_ROW_COUNT`

Accessors are pure and unit-tested; the JSON shape is checked by a test that
asserts counts against `meta.json` so a bad regeneration fails loudly.

## 5. Rules

- One source of truth per fact. `species.json` knows Pikachu's base stats; no
  other file repeats them.
- Adding content = adding a file or a row, plus (for a chalk-equivalent, i.e. a
  new mechanic) a section in the matching spec under `docs/`.
- Regenerating the dex is a deliberate act: `npm run data:dex`, then `npm test`,
  then update `meta.json` counts if they changed.
