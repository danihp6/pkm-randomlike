# PokeRandomLike — Showdown Reuse

What we take from Pokémon Showdown, how, and what is still ours to write.
Decision `D3`/`D4` in `docs/tech-decisions.md`.

## 1. The split

Showdown is two things: **data** (species, moves, abilities, items, learnsets,
types, natures) and **behaviour** (the `sim/` battle engine, whose ability/item/
move effects are TypeScript handlers). We take the first wholesale and port the
second selectively, because we need a battle flow Showdown does not model: a
player-facing menu with **bag**, **switch**, **run**, **capture** and
**permadeath**.

We deliberately do **not** embed `@pkmn/sim`. Its battle model is a black box
driven by two sides' choices; bag, run and capture are client-side concerns
there anyway, so we would end up writing the same glue we are writing now, plus
an adaptor over its event loop.

## 2. Data: build-time, committed, no runtime dependency

`scripts/build-dex.mjs` (`npm run data:dex`) reads `@pkmn/dex` and writes
`src/data/dex/*.json`:

| File | Contents | Count |
| --- | --- | --- |
| `species.json` | stats, types, abilities, forms, evolutions, gender ratio, weight, catch rate | 1291 (full National Dex) |
| `megas.json` | every Mega forme of a played species: stats, types, ability, `baseSpeciesId`, `stoneId`, `stoneName` | 48 |
| `moves.json` | type, category, power, accuracy, PP, priority, target, flags, secondaries | 685 |
| `abilities.json` | name, description, flags | 310 |
| `items.json` | name, description, battle flags | 249 |
| `learnsets.json` | per species, move sources (`9L24`, `9M`, `9E`, `8L1`, ...) | 1289 |
| `natures.json` | 25 natures with stat deltas | 25 |
| `types.json` | the 18x18 effectiveness chart | 19 |

Notes:

- The playable set is the **full National Dex** (`D40`): every numbered species,
  the `Past` Dexit entries included. Only CAP/fan entries, `Custom` (MissingNo,
  Pokéstar), LGPE's partner starters and the battle-only Gigantamax/Eternamax
  formes are dropped.
- `megas.json` is generated beside the playable set (never inside it) so a held
  stone has a target (`D34`). A Mega whose base species is not played is skipped,
  so no dead stones ship.
- `@pkmn/dex` carries no catch rate, so `build-dex.mjs` merges one in from
  `scripts/data/catch-rates.json` (PokeAPI `pokemon_species.csv`, keyed by
  national dex number, fetched once by `scripts/fetch-catch-rates.mjs`). Capture
  balances against this; regeneration never touches the network.
- Learnset sources are filtered to `gen >= 8` and exclude pure-event sources
  (`S`), so the tables stay close to Gen 9.
- `JSON.stringify` drops handler functions on purpose: the JSON is metadata.
  Behaviour is ours.
- The dex package is a **devDependency**; the game reads the committed JSON and
  never ships the package.

## 3. Behaviour: what we write, in what order, and the coverage problem

Behaviour is a large surface. "Gen 9 complete" is roughly 300 abilities, 250
battle items and ~200 moves with non-trivial effects. The plan is a declarative
effect registry with the same hooks as Showdown's handlers:

1. **Generic engine** (no per-effect code): turn order, priority, stat stages,
   damage, STAB, type chart, crits, accuracy, PP, primary status, capture, XP,
   switching, bag, run, permadeath.
2. **Hooks**: `onSwitchIn`, `onStart`, `onResidual`, `onModifyStat`,
   `onModifyDamage`, `onTryHit`, `onAfterMove`, `onStatus`, `onBoost`, ...
   Effects register handlers, exactly like Showdown, just with a smaller
   battle-state object.
3. **Effect files** grouped by category under `src/engine/battle/effects/`,
   each handler a direct port of Showdown's, adapted to our state object. Batches
   are ordered by how often a route actually meets the effect: status items and
   berries first, then the common competitive abilities, then the long tail.
4. **Coverage table**: `docs/balance/effect-coverage.md` lists every ability and
   item as `port | no-op | excluded`, so nothing is silently missing; regenerate
   it with `npm run docs:coverage`. In a develop build, a battle against an
   unported effect logs a warning through the `src/dev` gate.
5. **Descriptions come free**: because `abilities.json`/`items.json` carry
   `shortDesc`, the UI can always explain an effect even on the day it is a
   no-op.

The honest risk: steps 3–4 are the bulk of the work and they are mechanical, not
architectural. The plan makes them additive and testable one effect at a time
rather than a big-bang rewrite.

## 4. What we extend beyond Showdown

| Feature | Why Showdown alone is not enough |
| --- | --- |
| Bag with limited stock | Showdown's `useitem` assumes an unlimited pool per side |
| Run | Client-side in Showdown; the odds formula is ours |
| Capture | Not part of the simulator at all |
| Permadeath | Showdown never removes a Pokémon from a trainer's roster |
| Level caps | Simulators don't clamp XP |
| Route-scale AI | Showdown's AI is a simple choice heuristic; we need roster + switch logic for trainers |
