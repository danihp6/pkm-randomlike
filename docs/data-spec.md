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
`stoneName` — 88 today, `meta.json`'s `counts.megas` being the authority. It is
battle-only content (`D34`) — never spawned, only reached through a held stone
(`src/engine/battle/mega.ts`). A Mega may be tagged `Past` (the games already ran
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

## 2. Authored

| File | What it holds | Phase |
| --- | --- | --- |
| `src/data/dex/natures.ts` | typed view over `dex/natures.json` | 1 |
| `src/data/tilesets/*.ts` | one biome tileset config + palette per biome | 0 |
| `src/data/biomes.ts` | biome → tileset, layout and terrain flavour | 2 |
| `src/data/maps.ts` | per-map tuning: level range, room-count range and room width/height range, plus the infinite-run step | 9 |
| `src/data/bosses.ts` | the fixed party sizes a floor's boss and mini-boss field (six and three, three and two on map 1), read by the route scene's roster build (`docs/maps-spec.md` §6/§7) | 9 |
| `src/data/trainers.ts` | trainer archetypes: name, class, sprite, money base/jitter (D33) and `carriesMega` (bosses/`ace`); the roster is the floor's BST pool (`D39`), not a species list here | 2/9 |
| `src/data/items.ts` | the run's item catalogue: balls, potions, status cures, X-items, held items and berries (no Revive), plus the **competitive held set** (`COMPETITIVE_HELD`: the damage/Speed/accuracy/crit/last/survive items, the resist and pinch berries and the self-status orbs whose effect `effects/items.ts` models, and the items it does not model yet, which `UNMODELLED_ITEMS` records by name, D16), **valuables** (sellable), **Mega Stones**, the **Plates** (`plate` + 1.2x `typeBoost`, D37) and the **TMs** (`machine` pocket), each with a Poké Dollar price | 3/6/10 |
| `src/data/tms.ts` | the base-Gen-9 TM table: TM number → move id (TM001 … TM171), hand-authored from the dex's `9M` flags, with the id/number/move helpers `items.ts` turns into reusable machines (D36) | 10 |
| `src/data/shop.ts` | the shop's per-band core (Balls/Potions) and the weighted pool its one or two rotating items are drawn from (D33) | 9 |
| `src/data/spriteSize.ts` | the battle sprite size curve: canonical height (m) → drawn height (px), the power and clamps | 5 |
| `src/data/run.ts` | chain length, boss cadence, level bands (level range, party size and BST window, D39), starter pool, starting bag | 2 |
| `src/data/portraits.ts` | portrait atlas URL and frame mapping (dex number − 1) | 6 |
| `src/data/itemIcons.ts` | typed view over the generated `anil/item-icons.json` (Añil item icon frames, 24px, normalised id → frame, with `hasItemIcon`/`itemIconFrame` and the Mega Stone / TM fallbacks) | 6 |
| `src/data/anil/item-icons.json` | generated frame map for the Añil item icon atlas | 6 |
| `src/data/frlg/item-icons.json` | generated frame map for the FRLG item icon atlas (superseded by the Añil one) | 6 |
| `src/data/typeIcons.ts` | typed view over the generated `frlg/type-icons.json` (Añil type badge frames, repacked in place) | 7 |
| `src/data/frlg/type-icons.json` | generated frame map for the Añil type badge atlas | 7 |
| `src/data/statusIcons.ts` | typed view over the generated `frlg/status-icons.json` (Añil status badge frames, repacked in place) | 7 |
| `src/data/frlg/status-icons.json` | generated frame map for the Añil status badge atlas | 7 |
| `src/data/abilityText.ts` | the ability-text override table: the ids whose dex blurb is competitive-play boilerplate while the engine ports the ability (`docs/balance/effect-coverage.md`), read by `abilityDescription` | 6 |

## 3. Typed accessors

JSON is imported and immediately wrapped by a typed accessor module, so engine
code never sees a `any`:

- `src/data/dex/species.ts` → `Species`, `getSpecies(id)`, `speciesByNum(n)`,
  `playableSpecies()`, `catchRateOf(id)`, `heightOf(id)`
- `src/data/dex/megas.ts` → `MegaForm`, `MEGA_FORMES`, `megaFormForItem(id)`,
  `megaFormOf(id)`, `megaFormsForBase(id)`, `isMegaSpecies(id)`,
  `megaMatchesSpecies(stoneId, speciesId)`
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

Accessors are pure and unit-tested; the JSON shape is checked by a test that
asserts counts against `meta.json` so a bad regeneration fails loudly.

## 4. Rules

- One source of truth per fact. `species.json` knows Pikachu's base stats; no
  other file repeats them.
- Adding content = adding a file or a row, plus (for a chalk-equivalent, i.e. a
  new mechanic) a section in the matching spec under `docs/`.
- Regenerating the dex is a deliberate act: `npm run data:dex`, then `npm test`,
  then update `meta.json` counts if they changed.
