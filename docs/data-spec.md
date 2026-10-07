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

## 2. Authored

| File | What it holds | Phase |
| --- | --- | --- |
| `src/data/dex/natures.ts` | typed view over `dex/natures.json` | 1 |
| `src/data/tilesets/*.ts` | one biome tileset config + palette per biome | 0 |
| `src/data/biomes.ts` | biome → tileset, encounter table, level band flavour | 2 |
| `src/data/encounters.ts` | per-biome species pools and weights by band | 2 |
| `src/data/trainers.ts` | trainer archetypes: name, class, sprite, per-band species pools | 2 |
| `src/data/items.ts` | the run's item catalogue: balls, potions, status cures, X-items, held items and berries (no Revive), each with a Poké Dollar price | 3/6 |
| `src/data/spriteSize.ts` | the battle sprite size curve: canonical height (m) → drawn height (px), the power and clamps | 5 |
| `src/data/run.ts` | chain length, mini-boss cadence, boss cadence, level caps, starter pool, starting bag | 2 |
| `src/data/portraits.ts` | portrait atlas URL and frame mapping (dex number − 1) | 6 |
| `src/data/itemIcons.ts` | typed view over the generated `frlg/item-icons.json` (FRLG icon frames) | 6 |
| `src/data/frlg/item-icons.json` | generated frame map for the FRLG item icon atlas | 6 |

## 3. Typed accessors

JSON is imported and immediately wrapped by a typed accessor module, so engine
code never sees a `any`:

- `src/data/dex/species.ts` → `Species`, `getSpecies(id)`, `speciesByNum(n)`,
  `playableSpecies()`, `catchRateOf(id)`, `heightOf(id)`
- `src/data/dex/moves.ts` → `Move`, `getMove(id)`, `moveByType(type)`,
  `isDamaging(move)`
- `src/data/dex/learnsets.ts` → `learnsetOf(speciesId)`, `levelUpMoves(id, level)`,
  `learnableBy(id, method)`, `parseLearnSource(code)`
- `src/data/dex/types.ts` → `effectiveness(attackType, defenderTypes)`, `TYPE_NAMES`
- `src/data/dex/natures.ts` → `natureMultiplier(nature, stat)`,
  `statAtLevel(species, level, nature, ivs, evs)`
- `src/data/dex/evolutions.ts` → `evolutionFor(speciesId, level)`,
  `isLevelEvolution(evolution)`

Accessors are pure and unit-tested; the JSON shape is checked by a test that
asserts counts against `meta.json` so a bad regeneration fails loudly.

## 4. Rules

- One source of truth per fact. `species.json` knows Pikachu's base stats; no
  other file repeats them.
- Adding content = adding a file or a row, plus (for a chalk-equivalent, i.e. a
  new mechanic) a section in the matching spec under `docs/`.
- Regenerating the dex is a deliberate act: `npm run data:dex`, then `npm test`,
  then update `meta.json` counts if they changed.
