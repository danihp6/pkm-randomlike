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
| `megas.json` | a battle-only `Species` plus `baseSpeciesId`, `stoneId`, `stoneName`; every Mega of a playable base species, `Past` or `Future` — the dex's own "announced, not released" tag (D34) |
| `gmaxes.json` | a battle-only `Species` plus `baseSpeciesId` (the exact `changesFrom`); every dex `…-Gmax` entry whose base species is playable — 34 today, one per species (D44) |
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
- Typed accessors live next to the JSON (`species.ts`, `megas.ts`, `gmaxes.ts`, `moves.ts`,
  `items.ts`, `learnsets.ts`, `types.ts`, `natures.ts`, `evolutions.ts`,
  re-exported from `index.ts`). Only they read the JSON.
- `evolutions.ts` also owns two **hand-authored tables** beside the dex, because
  a canon trigger the game resolves as a level is not dex data (`D38`). The first
  is `FORM_EVOLUTIONS`: the branches the generated `species.json` cannot carry,
  keyed by the evolving species' id, one-way, and reached as ordinary evolution
  rows in the STATS graph. It holds **Rotom's five appliances** (a key-item forme
  change, one level from the BST band, an appliance offering none and never
  leading back) and the **formes the deleted form-change abilities used to reach**
  (`D41`): Palafin-Hero, Wishiwashi-School, Cherrim-Sunshine, Castform's three
  (Sunny/Rainy/Snowy), Cramorant's Gulping/Gorging, Aegislash-Blade, the two Zen
  formes, Ogerpon's three masks, and the sequential Zygarde and Terapagos stages —
  the sequences carrying an authored level, since a chain cannot share the single
  level a species' band resolves. Four of those rows land on a forme the generator
  also raises by 60 stat points (`FORM_STAT_BOOSTS` in `scripts/build-dex.mjs`),
  because each was stat-identical to its base species. The second table is
  `VARIANT_FORMES`: the three families (Eiscue, Morpeko, Minior) whose only other
  forme is not an evolution at all, so each stays **one pool entry** and the
  engine rolls which forme an individual is generated as (`variantSpecies` on a
  `Rng.split('variant')` sibling stream in `src/engine/run/pool.ts`). Both tables
  leave the generated `species.json` untouched: a `rotom` row still reads
  `evolutions: []`, `evos: []`, `prevo: ""`.
- The playable set is the **full National Dex** (`D40`): every species with a
  number, `Past` Dexit entries included. Only non-species are dropped at
  generation time — CAP/fan entries, `Custom` (MissingNo, Pokéstar), LGPE's
  partner starters (no art), and the battle-only Gigantamax/Eternamax formes.
  `megas.json` is generated beside the set (never inside it) so a held stone has
  a target; a Mega whose base is not played is skipped. A Mega may carry either of
  the dex's two tags — `Past` (the games already ran it) or `Future`, its own
  "announced, not released" mark for the formes Legends Z-A and Champions
  announced — and both are taken alike. The nine `Future` formes the dex leaves
  `isMega` unset on (Absol Z, Garchomp Z, Lucario Z, Meowstic, Magearna-Original,
  the three Tatsugiri) name the forme instead, so `isPlayable` drops them by
  name-shape: they are reached from a stone, never from the grass, and adding
  them here would ship one id in both files — three of them share a stone the
  generator's one-stone guard rejects.
- `gmaxes.json` rides beside `megas.json` as the battle-only **Gigantamax** set
  (`D44`): one row per dex `…-Gmax` entry whose base species is playable, keyed by
  its exact `changesFrom` (`baseSpeciesId`), so `gmaxFormForBase(id)` resolves one
  G-Max forme per species. It is reached through
  `src/engine/battle/gmax.ts`; no item and no stone gates it.