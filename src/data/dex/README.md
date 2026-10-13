# `src/data/dex/` — generated

Do not edit by hand. Regenerate with `npm run data:dex`
(`scripts/build-dex.mjs`, reads `@pkmn/dex`, the full National Dex). The package
is a devDependency; the game only ever reads these JSON files.

`meta.json` records the source, the generation and the row counts — a test
asserts the counts still match, so a bad regeneration fails loudly.

## Files

| File | Fields that matter to us |
| --- | --- |
| `species.json` | `id`, `num`, `name`, `types`, `baseStats`, `abilities`, `prevo`, `evos`, `evolutions[]`, `weightkg`, `heightm`, `genderRatio`, `nfe`, `catchRate`, form fields |
| `megas.json` | a battle-only `Species` plus `baseSpeciesId`, `stoneId`, `stoneName`; every Mega of a playable base species (D34) |
| `moves.json` | `id`, `name`, `type`, `category`, `basePower`, `accuracy`, `pp`, `priority`, `target`, `flags`, `secondaries`, `critRatio`, `drain`, `recoil`, `multihit`, `status`, `volatileStatus`, `boosts`, `self`, `weather`, `terrain`, `desc`, `shortDesc` |
| `abilities.json` | `id`, `name`, `desc`, `shortDesc`, `flags` |
| `items.json` | `id`, `name`, `desc`, `shortDesc`, `isBerry`, battle flags |
| `learnsets.json` | `{ [speciesId]: { [moveId]: source[] } }`, sources like `9L24` (gen 9, level 24), `9M` (TM), `9T` (tutor), `9E` (egg) |
| `natures.json` | `name`, `plus`, `minus` |
| `types.json` | `name`, `damageTaken` (defensive multipliers per attacking type) |

## Notes

- Handler functions are intentionally absent: JSON.stringify dropped them. Effect
  behaviour lives in `src/engine/battle/effects/` (`docs/showdown-reuse.md`).
- Learnset sources prefer `gen >= 8` and drop pure-event (`S`) sources, to keep
  the tables close to Gen 9. A Dexit species with no gen-8 source at all (Ledyba,
  Castform…) falls back to its own newest learnset so it still has moves; a
  forme without a learnset of its own inherits its base species'. A kept source
  can still name a move that no longer exists in Gen 9, so learnset entries are
  intersected with `moves.json`.
- Typed accessors live next to the JSON (`species.ts`, `megas.ts`, `moves.ts`,
  `items.ts`, `learnsets.ts`, `types.ts`, `natures.ts`, `evolutions.ts`,
  re-exported from `index.ts`). Only they read the JSON.
- The playable set is the **full National Dex** (`D40`): every species with a
  number, `Past` Dexit entries included. Only non-species are dropped at
  generation time — CAP/fan entries, `Custom` (MissingNo, Pokéstar), LGPE's
  partner starters (no art), and the battle-only Gigantamax/Eternamax formes.
  `megas.json` is generated beside the set (never inside it) so a held stone has
  a target; a Mega whose base is not played is skipped.
