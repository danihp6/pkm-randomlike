# `src/data/dex/` — generated

Do not edit by hand. Regenerate with `npm run data:dex`
(`scripts/build-dex.mjs`, reads `@pkmn/dex`, Gen 9). The package is a
devDependency; the game only ever reads these JSON files.

`meta.json` records the source, the generation and the row counts — a test
asserts the counts still match, so a bad regeneration fails loudly.

## Files

| File | Fields that matter to us |
| --- | --- |
| `species.json` | `id`, `num`, `name`, `types`, `baseStats`, `abilities`, `prevo`, `evos`, `evolutions[]`, `weightkg`, `heightm`, `genderRatio`, `nfe`, `catchRate`, form fields |
| `moves.json` | `id`, `name`, `type`, `category`, `basePower`, `accuracy`, `pp`, `priority`, `target`, `flags`, `secondaries`, `critRatio`, `drain`, `recoil`, `multihit`, `status`, `volatileStatus`, `boosts`, `self`, `weather`, `terrain`, `desc`, `shortDesc` |
| `abilities.json` | `id`, `name`, `desc`, `shortDesc`, `flags` |
| `items.json` | `id`, `name`, `desc`, `shortDesc`, `isBerry`, battle flags |
| `learnsets.json` | `{ [speciesId]: { [moveId]: source[] } }`, sources like `9L24` (gen 9, level 24), `9M` (TM), `9T` (tutor), `9E` (egg) |
| `natures.json` | `name`, `plus`, `minus` |
| `types.json` | `name`, `damageTaken` (defensive multipliers per attacking type) |

## Notes

- Handler functions are intentionally absent: JSON.stringify dropped them. Effect
  behaviour lives in `src/engine/battle/effects/` (`docs/showdown-reuse.md`).
- Learnset sources are filtered to `gen >= 8`, excluding pure-event (`S`)
  sources, to keep the file close to Gen 9. A kept source can still name a move
  that no longer exists in Gen 9, so learnset entries are also intersected with
  `moves.json`: a learnset never references a move id that isn't in the move set.
- Typed accessors live next to the JSON (`species.ts`, `moves.ts`, `learnsets.ts`,
  `types.ts`, `natures.ts`, `evolutions.ts`, re-exported from `index.ts`). Only
  they read the JSON.
- `isNonstandard` entries (CAP, Gigantamax, old-gen exclusives) were filtered at
  generation time.
