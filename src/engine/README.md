# `src/engine/` — pure game rules

Every rule that decides what happens lives here: the route and map generators, the battle state
machine and the run state with its progression. Nothing in this folder may import Phaser, touch
the DOM or read `localStorage`, so the whole folder loads under Node. The browser half of storage
and settings lives outside it, in `src/storage.ts` and `src/settings.ts`. Rules are pure
functions with a co-located `*.test.ts` that `npm test` runs headless.

## Layout

- `rng.ts` — the seeded random generator and the seed helpers: every draw comes from a named
  stream off the run seed, so one seed and the same inputs replay the same run (`D11`).
- `grid.ts` — tile/pixel conversion; `map.ts` — the tile vocabulary, walkability, corner cuts and
  the step and ledge rules.
- `pathfinding.ts` — grid A* over the walkable map, with optional custom passability and cost.
- `tileset.ts` — the atlas contract every biome tileset satisfies (`D10`), read by the frame resolver.
- `tileFrames.ts` — a map value and its neighbours turned into an atlas frame: autotiling and variants.
- `frameMap.ts` — the dev "Map" tool's per-cell frame dump and the codec that round-trips it.
- `save.ts` — the versioned save codec: migrations, settings and the run, against a storage interface.
- `index.ts` — the barrel re-exporting the top level; each subfolder has its own.
- `battle/` — the menu battle and its effects: `battle/fighter.ts`, `battle/state.ts`,
  `battle/order.ts`, `battle/damage.ts`, `battle/moveType.ts`, `battle/accuracy.ts`,
  `battle/status.ts`, `battle/volatile.ts`, `battle/turn.ts`, `battle/commands.ts`,
  `battle/mega.ts`, `battle/gmax.ts`, `battle/runAway.ts`, `battle/capture.ts`, `battle/ai.ts` and the ported
  effect handlers in `battle/effects/` (`D16`).
- `maps/` — the floor plan and its geometry: `maps/plan.ts` (the room grid and its links),
  `maps/progress.ts` (boss and portal edges), `maps/route.ts` and `maps/streams.ts`.
- `routes/` — the route generator and its validation: `routes/sketch.ts`, the shapes and access
  edges in `routes/layout.ts`, `routes/routeMap.ts`, `routes/validate.ts`, `routes/encounters.ts`,
  `routes/trainers.ts`, `routes/doors.ts`, `routes/walls.ts`, `routes/streams.ts`,
  `routes/battlefield.ts` (the weather, terrain or field condition a room's battles begin under)
  and `routes/gate.ts` (the gated reward room's vault carve and its two per-floor ids).
- `run/` — the run state and its books: `run/state.ts` (party, box, bag and money),
  `run/progression.ts` (XP and levels), `run/battleLink.ts` + `run/resolve.ts` (the post-battle
  resolve), `run/roster.ts` + `run/pool.ts` (rosters, the species pool and the variant roll
  that picks an individual's forme at generation, `D38`/`D39`), plus
  `run/chain.ts`, `run/floors.ts`, `run/levelCap.ts`, `run/heal.ts`, `run/learnset.ts`,
  `run/nickname.ts` (the member names the player types), `run/reward.ts`, `run/perms.ts`,
  `run/items.ts` (the route's consumable rule: whether an item applies and the use that spends it),
  `run/starters.ts`, `run/share.ts`, `run/party.ts` (the party predicates a room asks: what
  types, moves and abilities the party holds), `run/memberEdits.ts` (the member-edit NPC
  transactions: the tutor, the four re-rolls and the sacrifice), `run/trade.ts` (the deliberate
  trade: one member out, one rolled member in at the squad's level) and `run/passives.ts` (the
  map passives a room's abilities pay), and `run/missions.ts` (the floor's mission and its
  progress).

## Rules

1. No Phaser import, no DOM and no `localStorage`; a rule that needs any of them belongs in
   `src/scenes/` or `src/render/`.
2. Every random draw comes from a named stream off the run seed, never `Math.random()`.
3. A change to the random streams, the generator or a battle-odds model ships a regression test.
4. Balance and content live in `src/data/`; rebalancing must never need an engine edit.
5. Adding a module means adding its line here.
