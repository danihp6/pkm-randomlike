# `src/data/` — content contract

Everything balanceable lives here; the engine reads it and never hardcodes it.

## Layout

- `dex/` — **generated**, committed, do not edit by hand. Produced by
  `npm run data:dex` from `@pkmn/dex`. See `docs/showdown-reuse.md`. Typed
  accessors live beside it (`species.ts`, `moves.ts`, `abilities.ts`,
  `learnsets.ts`, `types.ts`, `natures.ts`, `evolutions.ts`).
- `tilesets/` — one file per biome tileset plus the shared `palettes.ts` and the
  `index.ts` registry. Contract in `docs/tileset-spec.md`.
- `biomes.ts` — biome → tileset, terrain flavour and encounter tables.
- `mapSize.ts` — the map-size tiers (small / medium / large by area) that scale a
  biome's base `grassPatches` / `ledges` counts and add optional paths to a
  shape's `branchCount`, so density and exploration hold across route sizes
  (`docs/routes-spec.md` §2).
- `maps.ts` — the per-map tuning: level range, room-count range and the room
  width/height range, plus the infinite-run step past the last map
  (`docs/maps-spec.md` §4).
- `encounters.ts` — per-biome species pools and weights by level band.
- `trainers.ts` — trainer archetypes and their themed species pool per level band.
- `loot.ts` — the per-band ground-item pools a route's pockets draw from, plus
  each band's `hiddenChance` (`docs/routes-spec.md` §2 step 4).
- `run.ts` — level bands, the per-route cap and the run chain cadence.
- `keybinds.ts` — the confirm/cancel/move/run/interact/reset/hud/settings actions,
  their default keys, labels and the pure rebind rules (`D23`). The Phaser half is
  `src/input/`.
- `items.ts` — the battle item catalogue: balls with catch multipliers, potions,
  status cures, X-items and held items (Leftovers, berries, the 1.2x type
  items). Held items are registered by `engine/battle/effects/items.ts`.

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
