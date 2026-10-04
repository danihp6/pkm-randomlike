# PokeRandomLike — Routes Spec

How a route is generated, walked and exited. The generator is pure logic in
`src/engine/routes/` and takes a seeded `Rng`.

## 1. What a route is

A rectangular tile map, sized for a single screen (no scrolling beyond the
camera follow), containing:

- a **start** tile, where the player arrives from the previous route;
- an **exit** tile, which ends the route;
- a one-tile ring of trees/rock along the border, the only wall; the interior is
  open ground.

## 2. Generation pipeline

1. **Layout**: pick the layout (`forest`, the only style for now) and carve its
   shape — see below. It is currently `open`: the interior is left as plain
   ground and only the one-tile tree/rock border is a wall.
2. **Terrain pass**: optional tall grass patches, water bodies and ledges, all
   **off** by default (`terrain` in `src/data/biomes.ts`), so a route is plain
   ground for now. The passes stay in the generator, ready to be re-enabled.
3. **Validation pass**: flood-fill from the start must reach the exit. If it does
   not, reroll from the same seed with the next stream value. This validation is
   what makes the generator safe to call blind.

Every pass consumes the same `Rng`, so `(seed, routeIndex)` fully determines the
map.

Routes no longer scatter **trainers** or **ground items**: the population pass
was removed and the generated map holds only tiles, start and exit. The trainer
archetypes (`src/data/trainers.ts`) and the roster builder (`src/engine/run/roster.ts`)
stay in place, ready for when encounters come back. The target generator, with
pseudocode and a review of the draft, is in `docs/route-generator.md`.

A route is larger than a screen (the default is 56x32 tiles at 24px), so the
camera follows the player. The scene draws a tree/rock margin outside the
playable edge (`padMap`, `MAP_MARGIN` in `src/scenes/RouteScene.ts`) and bounds
the camera to it, so the border reads as a whole tree frame instead of the empty
background. The margin is sized to the FRLG tree motif: with the route's own
one-tile border the frame is three tiles wide on the sides and four tiles deep
top/bottom, so a side shows the whole three-column tree and the top/bottom line
carries both body rows between its crown and its trunk. The whole map is visible
at once: there is no fog of war, like the originals (`D6`).

**Biome and shape.** Only the FireRed/LeafGreen **forest** biome is active
(`BIOME_ORDER = ['forest']` in `src/data/biomes.ts`), so every route uses its
tileset and encounter table. A route's **shape** — where it enters and leaves and
how the paths connect those openings — is the generator's next concept: the target
is `straight` (2 opposite), `bend` (2 adjacent) and `cross` (4, opposite pairs),
specced in `docs/route-generator.md`. Live it is still a single entry/exit on an
**open field** (the interior is floor and only the tree border is a wall); the
`hedges` and `maze` carvers stay parked in `src/engine/routes/sketch.ts` until the
shape carve lands (`D6`).

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
