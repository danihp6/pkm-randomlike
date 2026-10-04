# PokeRandomLike — Routes Spec

How a route is generated, walked and exited. The generator is pure logic in
`src/engine/routes/` and takes a seeded `Rng`.

## 1. What a route is

A rectangular tile map, sized for a single screen (no scrolling beyond the
camera follow), containing:

- a **entry** opening, where the player arrives from the previous route;
- one or more **exit** openings (the shape's far ends). Openings sit on the map
  border and punch a gap in the tree ring; they are plain floor and stepping on
  one does **not** end the route yet, so the map can be inspected without leaving
  it;
- a one-tile ring of trees/rock along the border and a solid tree interior, with
  the shape's lanes carved through it.

## 2. Generation pipeline

1. **Layout**: pick the carver style (`forest`, the only style for now) and its
   **shape** (`src/engine/routes/layout.ts`): where the route enters and leaves
   and how the paths connect those openings. It is currently `open`: the interior
   is filled with trees and the shape's lanes (spine and branches) are carved
   through them, leaving the one-tile tree/rock border solid.
2. **Terrain pass**: optional tall grass patches and ledges, both **off** by
   default (`terrain` in `src/data/biomes.ts`), so a route is a carved
   tree lane for now. The passes stay in the generator, ready to be re-enabled.
3. **Validation pass**: flood-fill from the entry must reach every exit. If it does
   not, reroll from the same seed with the next stream value. This validation is
   what makes the generator safe to call blind.

Every build pass draws from its own `Rng` stream, all derived from
`(seed, routeIndex, attempt)` (`src/engine/routes/streams.ts`), so `(seed,
routeIndex)` fully determines the map and a reroll can never shift an earlier
attempt. Adding a roll to the terrain pass cannot move the path the layout pass
already placed.

Routes no longer scatter **trainers** or **ground items**: the population pass
was removed and the generated map holds only tiles, the entry and its exits. The trainer
archetypes (`src/data/trainers.ts`) and the roster builder (`src/engine/run/roster.ts`)
stay in place, ready for when encounters come back. The target generator, with
pseudocode and a review of the draft, is in `docs/route-generator.md`.

The map size is an input: the default is **20x20** tiles at 24px for now, and the
camera follows the player, bounded to the generated map. The whole map is visible
at once: there is no fog of war, like the originals (`D6`).

**Biome and shape.** Only the FireRed/LeafGreen **forest** biome is active
(`BIOME_ORDER = ['forest']` in `src/data/biomes.ts`), so every route uses its
tileset and encounter table. A route's **shape** — where it enters and leaves and
how the paths connect those openings — is a first-class generator input: the
registry in `src/engine/routes/layout.ts` defines `straight` (2 opposite),
`bend` (2 adjacent) and `cross` (4, opposite pairs), each with its `openings`
(edge + entry/exit) and the `links` the spine joins, and `RouteMap` carries an
`entry`, a list of `exits`, the `spine` and the optional `branches`/`pockets`.
Every opening is placed on its edge and the guaranteed **spine** joins each
`links` pair with cardinal, cost-guided corridors, so a `cross` leaves three exits
and a `bend` runs an L. A multi-link shape routes every link through a shared
**central hub**, so all the openings are connected by construction. `branchCount`
secondary paths are then carved off the spine: lanes are **at least two tiles wide**
and scale with the free space, opening into a small **chamber** on a roomy map. The
far end is the **pocket** — the future loot spot. Branches stay inside the one-tile
border. The interior is solid tree, so the carved spine, branches and pockets are
the visible lanes; the terrain pass and the population pass keep them clear and
populate them (steps 5-7). The `hedges` and `maze` carvers stay parked in
`src/engine/routes/sketch.ts` for later biomes (`D6`).

## 3. Wild encounters

- Walking onto a `TALL_GRASS` tile rolls an encounter with the route's table.
- No route has tall grass right now (`terrain.grassPatches` is 0 everywhere), so
  wild encounters are dormant until a terrain pass turns them back on.
- The table is per **biome**, weighted, and drawn from the route's level band.
- The roll uses the route RNG, so walking the same grass in the same order
  produces the same encounters.
- Only the species and level are rolled. Stats, types and evolutions come from
  the species; the moveset and ability are rolled separately when the Pokémon is
  built (`D17`).

## 4. Run structure

```
route 1..N-1    regular routes (wild encounters)
mini-boss       every MINIBOSS_EVERY routes, one fixed trainer with a themed team
boss            closes each block of BOSS_BLOCK routes
final boss      the last route of a finite run
```

- Finite mode: the chain has a fixed length and the final boss ends it.
- Infinite mode: same generator, no final boss; the difficulty bands keep
  climbing and the run ends only when the party is wiped.

## 5. Difficulty bands

- Each route has a level band derived from its index (band start/end) and a
  per-route level cap that clamps XP gain (`docs/battle-spec.md` §7).
- Each trainer archetype carries one species pool per band (`src/data/trainers.ts`),
  so a band's rosters field their own mix and the party size grows with the band
  (`band`'s `trainerSize`).
- A trainer roster is generated deterministically from the route seed and band,
  and never exceeds the route's level cap. No route places a trainer for now, so
  this stays dormant until the population pass returns.

## 6. Healing stops

Between two routes the player gets a healing stop (a resting point): HP and PP
restored, PC box accessible, no resurrection. The stop is a screen: it shows the
healed party and the box and lets the player reorder them before continuing to
the next route.

Ground items were removed with the population pass: routes no longer scatter
loot and `src/data/loot.ts` is gone. The route HUD still shows the run's bag as
FRLG item icons; how it refills between routes is on hold alongside route
population.
