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
   through them, leaving the one-tile tree/rock border solid. Lanes are carved at
   least two tiles wide (no one-tile lane is left) and every lane keeps a
   margin of the motif's footprint (`wallMargin`, `max(cols, minHeight)`) from the
   border, so it never carves into the `cols`-wide band the border ring belongs to
   and always leaves a strip at least a whole object tall (a bitten fence could not
   be cleaned without opening the map, and a shorter strip would be a stump with no
   trunk). The lane's **far edge**, not its anchor, is what keeps the margin: the
   spine's jittered waypoints and the hub are pulled in by `pathWidth - 1`, and
   `carveBranches` pulls its last lane cell in by `branchWidth - 1`, so a lane
   never lands a one-row stump at the border. Only an opening pierces the ring, where the corridor runs straight in
   for `margin` tiles before it may turn; the opening is aligned to its motif band,
   so the `pathWidth`-wide approach never spills into the tree in the band beside
   it. An opening also keeps a clearance of the motif's footprint (`2 * cols`) from
   every map corner, so a corner tree is never bitten into a partial or one-tile
   piece.
2. **Wall tidy**: `cleanWalls` (`src/engine/routes/walls.ts`) removes any wall
   remnant the tileset's wall motif would draw cut off. The motif's footprint
   (`WallFootprint`, taken from the tileset's `wallPattern`) gives the width a run
   needs to show a whole object and the shortest whole-object height; a lane that
   grazes the forest leaves a one- or two-tile sliver, and a lane that bites the
   side of a tree leaves a `cols`-wide band that is no longer solid. Such a bitten
   tree is removed **whole** (its `cols`-wide row is cleared) and the rest of the
   column is then **un-stacked** (trimmed to whole objects, stubs dropped), so a
   tall wall still reads as stacked whole trees. The tree each cell belongs to is a
   fixed **global grid** of `cols`-wide bands from the map's left edge: a lane that
   falls inside a band widens to the whole band, so no mass keeps a cut tree and no
   lane is left one tile wide. The tidy only ever turns wall back into floor, so
   it can widen a lane but never block it: the entry, every exit and the spine keep
   working and the openings stay reachable. A cell on the one-tile border ring is
   only dropped to widen an opening (a lane already reaches the ring beside it), so
   the map stays fenced.
3. **Terrain pass**: `terrain` in `src/data/biomes.ts` sets how many tall grass
   patches and ledge lines a biome stamps, and those **base counts scale in tiers
   with the map size** (`MAP_SIZE_TIERS` in `src/data/mapSize.ts`): the map's
   area in tiles falls in `small` (terrain ×1), `medium` (×2) or `large` (×3), so a
   bigger route carries proportionally more terrain without the count matching the
   size pixel by pixel. The default 20x20 route is `small`, so it keeps its biome
   counts untouched. Both land on the carved floor **off the spine and the
   openings** (ledges also avoid the pockets). A grass patch is packed
   **against the walls**: it first stretches across a wall-to-wall corridor so it
   touches a wall at both ends, but only when that gap is no wider than
   `GRASS_SPAN_MAX` (5 tiles); otherwise it falls back to a small block anchored on
   a wall, so grass never floats in open floor. A patch may also **spill onto a
   tree's walkable tip**: a tip cardinally adjacent to grass shares its cell with
   the patch (`grassTipKeys`), drawn under the crown with an encounter on stepping
   there. A ledge line is a
   whole object of at least **three tiles** — a left cap, repeated centre tiles and
   a right cap (`LedgeFrames`) — and is dropped whole rather than left as a stub
   when it cannot reach three tiles or would strand a branch behind its one-way
   drop. A run is also **pegged to a wall at one lateral end** (the tile just
   outside its left or right cap is wall), so it reads as a lip on the terrain
   instead of a rock floating in open floor. Grass is walkable; a ledge only gives
   way downward. Water is decoration (`D18`), not a terrain pass.
4. **Validation pass**: flood-fill from the entry must reach every exit. If it does
   not, reroll from the same seed with the next stream value. This validation is
   what makes the generator safe to call blind.

Every build pass draws from its own `Rng` stream, all derived from
`(seed, routeIndex, attempt)` (`src/engine/routes/streams.ts`), so `(seed,
routeIndex)` fully determines the map and a reroll can never shift an earlier
attempt. Adding a roll to the terrain pass cannot move the path the layout pass
already placed.

Routes no longer scatter **trainers** or **ground items**: the population pass
was removed, so the generated map holds only the carved tiles (spine, branches,
pockets and the terrain flavour) plus the entry and its exits. The trainer
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
**central hub**, so all the openings are connected by construction. Optional
secondary paths are then carved off the **network** (the spine plus every lane
already carved, so a branch can grow off another branch, not only off the spine):
the count is the shape's base `branchCount` plus a map-size tier bonus, lanes are
**at least two tiles wide** and scale with the free space, opening into a small
**chamber** on a roomy map. The far end is the **pocket** — the future loot
spot. Branches stay inside the one-tile
border. The interior is solid tree, so the carved spine, branches and pockets are
the visible lanes; the terrain pass and the population pass keep them clear and
populate them (steps 5-7). The `hedges` and `maze` carvers stay parked in
`src/engine/routes/sketch.ts` for later biomes (`D6`).

## 3. Wild encounters

- Walking onto a `TALL_GRASS` tile rolls an encounter with the route's table.
- Tall grass is stamped from `terrain.grassPatches` on the off-spine floor, never
  on the spine or an opening, so a clean encounter-free lane always exists. A tree
  tip a patch shares (`grassTipKeys`) rolls the same encounter.
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
restored, no resurrection. The stop no longer opens a screen; the party and the
PC box are managed from the route HUD (`I` / `P`) at any time, so the player can
reorder them there and then continue to the next route.

Ground items were removed with the population pass: routes no longer scatter
loot and `src/data/loot.ts` is gone. The route HUD still shows the run's bag as
FRLG item icons; how it refills between routes is on hold alongside route
population.
