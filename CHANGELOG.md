# PokeRandomLike — Changelog

Completed backlog items, kept out of `TODO.md` so the daily backlog stays small.
This file is *what shipped*, grouped by the roadmap phase it belonged to; the
rationale behind each rule (`D##` decisions) lives in
`docs/tech-decisions.md`. The commits carry the moment-by-moment history; this
file is the human-readable summary.

## Phase 0 — Repo & scaffolding

- [x] `git init`; add `.gitignore` (`node_modules/`, `dist/`, `.vite/`, `*.local`,
      `sprite-sources/`).
- [x] Copy the workspace scaffolding from `slate-line`: `package.json` (Phaser
      `^3.90.0`, Vite `^8.3.0`, TypeScript `^7.0.2`, Vitest `^5.0.1`, scripts
      `dev/build/preview/test/test:watch/typecheck`), `vite.config.ts` (port
      `5175`), strict `tsconfig.json`, `index.html`, `opencode.json`,
      `.env.development`.
- [x] `src/main.ts` registers `BootScene`, `RouteScene` and a `BattleScene`
      placeholder; `npm run build` boots.
- [x] Pure engine foundations, ported from `pkm-mystery-dungeon-like` and adapted
      (`D14`, `D15`): `src/engine/rng.ts` (seeded RNG + text/daily seeds),
      `grid.ts`, `map.ts` (tile values, walkability, corner-cut rule, route-sketch
      parser), `fov.ts` (recursive shadowcasting), `vision.ts` (fog of war),
      `pathfinding.ts` (A* with corner-cut and custom blocking), `tileset.ts` (the
      atlas contract + shared wall/water shape sets), `tileFrames.ts` (the
      neighbour-aware frame resolver). 39 Vitest tests, co-located.
- [x] Swappable tilesets (`D10`): `src/data/tilesets/` with the placeholder and
      woods biome configs, the palette table and the registry
      (`TILESETS`, `tilesetTextureKey`); `RouteScene` renders a hardcoded route
      from the registry and proves the swap with `R`.
- [x] Dex pipeline (`D3`): `scripts/build-dex.mjs` (`npm run data:dex`) generates
      `src/data/dex/*.json` from `@pkmn/dex` (Gen 9): 911 playable species, 685
      moves, 310 abilities, 249 items, 819 learnsets, 25 natures, 19 types.
      `meta.json` records the counts; the package is a devDependency.
- [x] Imported art (`D14`): the 11 atlas/UI sheets and the 652 overworld sprite
      sheets (+ their manifests) from `pkm-mystery-dungeon-like`, plus its art
      pipeline scripts under `scripts/legacy-art/`.
- [x] Specs and decisions: `docs/design-spec.md`, `docs/battle-spec.md`,
      `docs/routes-spec.md`, `docs/tileset-spec.md`, `docs/showdown-reuse.md`,
      `docs/data-spec.md`, `docs/art-direction.md`,
      `docs/tech-decisions.md` (`D1`..`D16` + four open questions), folder
      contracts in `src/data/README.md`, `src/data/dex/README.md` and
      `src/assets/README.md`, and `README.md`.
- [x] Verified the slice: `npm test` (39 passing), `npm run build` clean, and the
      dev server renders the route with fog and the tileset swap.

## Phase 1 — Dex accessors & data contracts

- [x] `src/data/dex/species.ts`: `Species`/`Stats`/`Evolution` types plus
      `getSpecies(id)`, `speciesByNum(n)` (prefers the base forme) and
      `playableSpecies()` (the 911-row generated set).
- [x] `src/data/dex/moves.ts`: `Move` type and `getMove(id)`, `moveByType(type)`,
      `isDamaging(move)` (any non-`Status` move, so variable-power moves count).
- [x] `src/data/dex/learnsets.ts`: `learnsetOf`, `parseLearnSource`
      (`9L24`/`9M`/`9T`/`9E`, unknown codes → `other`), `levelUpMoves(id, level)`
      and `learnableBy(id, method)`.
- [x] `src/data/dex/types.ts`: `effectiveness(attackType, defenderTypes)` from the
      defensive chart (0/1/2/3 → 1x/2x/0.5x/0x, multiplied across dual types) plus
      `TYPE_NAMES`, the 18 battle types.
- [x] `src/data/dex/natures.ts`: `natureMultiplier(nature, stat)` and
      `statAtLevel(species, level, nature, ivs, evs)` (Gen 3+ stat formula, IVs
      default to 31, EVs to 0).
- [x] `src/data/dex/evolutions.ts`: `evolutionFor(speciesId, level)` and
      `isLevelEvolution(evolution)`.
- [x] `src/data/dex/index.ts` re-exports the six accessor modules.
- [x] Data-integrity tests (`src/data/dex/dex.test.ts`): row counts match
      `meta.json`, every learnset move exists in `moves.json`, every
      `evolutions[].into` exists in `species.json`, every species type is one of
      the 18, every move type is a known type. 65 tests pass.
- [x] Fixed the generator: `build-dex.mjs` now intersects learnsets with the
      retained move set, so a Gen 8 source naming a Gen 9-removed move no longer
      leaves a dangling id (regenerated `learnsets.json`, counts unchanged).

## Phase 2 — Route generation & exploration

- [x] `src/data/run.ts`: six `LEVEL_BANDS` with level ranges and trainer sizes,
      `ROUTES_PER_BAND`, `bandForRoute(routeIndex)`, `levelCapForRoute` and the
      `RUN_CHAIN` cadence (finite length, mini-boss every 4, boss block 8).
- [x] `src/data/encounters.ts`: per-biome, per-band weighted species pools for
      `wood` and `placeholder`; `src/data/biomes.ts` wires the biome → registered
      tileset + terrain counts + encounter tables and cycles them per route.
- [x] `src/data/trainers.ts`: ten archetypes (Youngster, Lass, Bug Catcher,
      Hiker, Camper, Picnicker, Fisher, Psychic, Black Belt, Ace Trainer) with a
      themed species pool and a placeholder marker colour (`spriteKey: null`, O1).
- [x] `src/engine/routes/routeMap.ts`: the `RouteMap` (seed, route index, biome,
      tiles, start, exit, trainers, items) plus `Facing`/`FACING_VECTORS`.
- [x] `src/engine/routes/validate.ts`: cardinal flood-fill and `validateRoute`,
      which requires the start to reach the exit and every trainer.
- [x] `src/engine/routes/trainers.ts`: `sightLine`/`seesPlayer` - a facing, a
      sight range, blocked by walls and by other trainers; re-evaluated per step.
- [x] `src/engine/routes/encounters.ts`: weighted roll + the `RouteEncounters`
      step counter, so the same grass walked in the same order rolls the same.
- [x] `src/engine/routes/sketch.ts`: the full pipeline (frame, rooms + terraces,
      grass/water/ledge terrain, trainer/item population) off one `Rng`, rerolled
      on validation failure; a frozen route signature guards the regression seed.
- [x] Ledges: `resolveMove` jumps south over a `LEDGE` to the tile beyond (and
      only south); other directions stay blocked.
- [x] `RouteScene` now consumes a generated `RouteMap`: procedural tall-grass,
      item and trainer-figure overlays that respect fog, item pickup, grass
      encounter messages, trainer line-of-sight messages and the exit beat. `R`
      still swaps tilesets.
- [x] Tests: band/trainer/dex existence checks for every authored species, route
      validity across seeds and indices, sight-line and ledge-movement rules, and
      a frozen generator signature. 99 tests pass; `npm run build` clean.

## Phase 3 — Battle engine core (pure, headless, tested)

- [x] `src/engine/battle/fighter.ts`: a battle fighter built from species + level
      + nature + IVs/EVs + moveset, with stat computation, stat stages (−6..+6),
      effective stats and Speed (paralysis halved), and HP/boost helpers.
- [x] `src/engine/battle/state.ts`: the battle state (two sides, parties, turn,
      weather/terrain fields, bag, seeded `Rng`) plus the structured event log
      the UI renders, and `finishBattle`.
- [x] `src/engine/battle/order.ts`: priority then effective Speed, ties on the
      battle RNG.
- [x] `src/engine/battle/damage.ts`: Gen 9 formula (STAB, effectiveness, crit,
      85-100% roll, sun/rain and burn modifiers), a deterministic `estimateDamage`
      for the AI and confusion self-hit damage.
- [x] `src/engine/battle/accuracy.ts`: accuracy/evasion stages and the hit roll.
- [x] `src/engine/battle/status.ts`: burn, poison, badly poisoned, paralysis,
      sleep, freeze with type immunities, wake/thaw counters and residuals.
- [x] `src/engine/battle/volatile.ts`: confusion, flinch, Leech Seed, Substitute,
      Taunt, Encore, trapped and perish count.
- [x] `src/engine/battle/turn.ts`: the turn loop (choices → bag/switch/run →
      moves → residuals → faint/replace) driven only by choices; a faint leaves
      `awaitingReplacement` for the owner's next choice.
- [x] `src/engine/battle/commands.ts`: `fight`, `bag`, `switch`, `run` with their
      validation, PP/Encore/Struggle handling and the battle items.
- [x] `src/engine/battle/runAway.ts`: the run odds (classic speed ratio + 30 per
      failed attempt); trainer battles and traps refuse.
- [x] `src/engine/battle/capture.ts`: Gen 9 catch value and four shake checks,
      ball and status bonuses, wild-only; one capture per route stays a run rule.
- [x] `src/engine/battle/ai.ts`: an expected-value trainer AI (damage,
      effectiveness, accuracy, status/boosts) that switches when the active
      Pokémon cannot hurt the foe and reads only legal state.
- [x] `src/data/items.ts`: the battle item catalogue (balls with catch
      multipliers, potions, status cures, X-items).
- [x] Catch rates: `@pkmn/dex` carries none, so `build-dex.mjs` now merges one
      into `species.json` from the committed PokeAPI table
      (`scripts/data/catch-rates.json`, fetched by `fetch-catch-rates.mjs`);
      `catchRateOf` exposes it and a dex test guards every species.
- [x] Golden test: a scripted fixed-seed battle frozen as an inline formatted log
      (the seed of the balance harness). 165 tests pass; `npm run build` clean.

## Phase 4 — Battle effects: abilities, items, weather, terrain

- [x] `src/engine/battle/effects/registry.ts`: declarative effect registry with
      Showdown's hook names (`onSwitchIn`, `onStart`, `onResidual`,
      `onModifyDamage`, `onTryHit`, `onAfterMove`, `onStatus`, `onBoost`),
      `registerEffect`/`getEffect`/`clearEffects` keyed by normalized id, and a
      dispatch that chains the source ability, the defender's ability and the
      move's own handlers (damage is threaded, boolean hooks stop on the first
      block). Wired into the turn loop: switch-in/start in `createBattle` and
      `performSwitch`, damage/status/boost/residual/after-move around the move
      resolution. No effects are registered yet, so the golden battle is byte for
      byte unchanged. 173 tests pass; `npm run build` clean.
- [x] `src/engine/battle/effects/items.ts`: the held items, registered from the
      catalogue (`kind: 'held'`) — Leftovers (residual 1/16), Sitrus/Oran berries
      (heal below half, single use), Lum Berry (cures a status, single use) and the
      18 type-boost items (1.2x, only when the holder is the move's user). The
      registry now tells each handler which fighter owns the effect (`ctx.owner`),
      so a defender's item never boosts the attacker's move. Fighters gained a
      `heldItem` field. Potions, status cures and X-items already shipped as Bag
      items in Phase 3, so the Bag rejects `held` items. 183 tests pass;
      `npm run build` clean.
