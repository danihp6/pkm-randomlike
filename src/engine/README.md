# `src/engine/` — pure game rules

Every rule that decides what happens lives here: the route and map generators, the
battle state machine and the run state with its progression. Nothing in this folder
may import Phaser, touch the DOM or read `localStorage`, so the whole folder loads
under Node; the browser half of storage and settings lives outside it, in
`src/storage.ts` (the `window.localStorage` probe) and `src/settings.ts` (the
preferences shim). Rules are pure functions with a co-located `*.test.ts` that
`npm test` runs headless.

## Layout

- `rng.ts` — `Rng` plus the seed helpers (`hashSeed`, `rngFromSeed`, `dailySeed`). Every draw comes from a named stream derived from the run seed, so one seed and the same inputs replay the same run (`D11`).
- `grid.ts` — tile/pixel conversion; `map.ts` — the tile vocabulary (`FLOOR`, `WALL`, `TALL_GRASS`, `LEDGE`, `WATER`), walkability, corner cuts and the step/ledge rules.
- `pathfinding.ts` — grid A* (`findPath`) over the walkable map, with optional custom passability and cost.
- `tileset.ts` — the atlas contract every biome tileset satisfies (`D10`): the tile and frame sizes, the frame constants and the `TilesetConfig` the resolver reads.
- `tileFrames.ts` — a map value plus its neighbours turned into an atlas frame: autotiling, wall patterns, weighted variants and ledges.
- `frameMap.ts` — the dev "Map" tool's per-cell frame dump and its import/export codec.
- `save.ts` — the versioned save codec (`SAVE_VERSION`, the migration table, settings and the run in progress) against a structural `StorageLike`.
- `index.ts` — the barrel re-exporting the top level; each subfolder has its own.
- `battle/` — the menu battle and its effects: `battle/fighter.ts`, `battle/state.ts`, `battle/order.ts`, `battle/damage.ts`, `battle/moveType.ts`, `battle/accuracy.ts`, `battle/status.ts`, `battle/volatile.ts`, `battle/turn.ts`, `battle/commands.ts`, `battle/mega.ts`, `battle/runAway.ts`, `battle/capture.ts`, `battle/ai.ts` and the effect handlers in `battle/effects/` (`D16`).
- `maps/` — the floor plan and its geometry: `maps/plan.ts` (the room grid, its links and special rooms), `maps/progress.ts` (boss, mini-boss and the portal edge), `maps/route.ts` (a room's route request) and `maps/streams.ts` (the map's streams).
- `routes/` — the route generator and its validation: `routes/sketch.ts` (the request and the sketcher), `routes/layout.ts` (shapes and access edges), `routes/routeMap.ts`, `routes/validate.ts` (reachability), `routes/encounters.ts` (the wild tables), `routes/trainers.ts` (sight lines), `routes/doors.ts` (border gaps), `routes/walls.ts` and `routes/streams.ts`.
- `run/` — the run state and its books: `run/state.ts` (party, box, bag, money and flags), `run/progression.ts` (XP, levels, `RunPokemon`, evolution), `run/battleLink.ts` + `run/resolve.ts` (the battle-to-run resolve), `run/roster.ts` + `run/pool.ts` (rosters and the floor's species pool, `D39`), plus `run/chain.ts`, `run/floors.ts`, `run/levelCap.ts`, `run/heal.ts`, `run/learnset.ts`, `run/reward.ts`, `run/perms.ts`, `run/starters.ts` and `run/share.ts`.

## Rules

1. No Phaser import, no DOM and no `localStorage`; a rule that needs any of them belongs in `src/scenes/` or `src/render/`.
2. Every random draw comes from a named `Rng` stream derived from the run seed, never `Math.random()`.
3. A change to the RNG, the route/map generator or a battle-odds model ships a fixed-seed regression test with it.
4. Balance and content live in `src/data/`; rebalancing must never need an engine edit.
5. Adding a module means adding its line here.
