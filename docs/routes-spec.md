# PokeRandomLike — Routes Spec

How a route is generated, walked and exited. The generator is pure logic in
`src/engine/routes/` and takes a seeded `Rng`.

## 1. What a route is

A rectangular tile map, sized for a single screen (no scrolling beyond the
camera follow), containing:

- a **start** tile, where the player arrives from the previous route;
- an **exit** tile, which ends the route;
- a number of **trainers** with a facing direction;
- zero or more **items**;
- a one-tile ring of trees/rock along the border, the only wall; the interior is
  open ground.

## 2. Generation pipeline

1. **Layout**: pick the biome's style (`route`, `forest` or `cavern`) and carve
   its shape — see below. Every style is currently `open`: the interior is left
   as plain ground and only the one-tile tree/rock border is a wall.
2. **Terrain pass**: optional tall grass patches, water bodies and ledges, all
   **off** by default (`terrain` in `src/data/biomes.ts`), so a route is plain
   ground for now. The passes stay in the generator, ready to be re-enabled.
3. **Population pass**: trainers (each with a facing), items, and the exit.
4. **Validation pass**: flood-fill from the start must reach the exit and every
   trainer. If it does not, reroll from the same seed with the next stream
   value. This validation is what makes the generator safe to call blind.

Every pass consumes the same `Rng`, so `(seed, routeIndex)` fully determines the
map.

A route is larger than a screen (the default is 56x32 tiles at 24px), so the
camera follows the player. The scene draws a tree/rock margin outside the
playable edge (`padMap`, `MAP_MARGIN` in `src/scenes/RouteScene.ts`) and bounds
the camera to it, so the border reads as a whole tree frame instead of the empty
background. The margin is sized to the FRLG tree motif: with the route's own
one-tile border the frame is three tiles wide on the sides and four tiles deep
top/bottom, so a side shows the whole three-column tree and the top/bottom line
carries both body rows between its crown and its trunk. The whole map is visible
at once: there is no fog of war, like the originals (`D6`).

**Layout style.** A route's shape is data (`src/engine/routes/layout.ts`): a style
picks the entry and exit edges and the carving kind. The three styles still exist
so a biome can be given its own shape again, but all of them currently carve an
**open field** — the interior is floor and the border is the only wall:

| Style | Entry / exit | Shape |
| --- | --- | --- |
| `route` | W / E | Open field, tree border. |
| `forest` | S / N | Open field, tree border. |
| `cavern` | S / N | Open field, rock border. |

The `hedges` (Route 1) and `maze` (Viridian Forest, Mt. Moon) carvers are kept in
`src/engine/routes/sketch.ts` for when the interiors come back. This supersedes
the donor BSP cave as the default look (`D6`). Adding a biome is a `layout` field
in `src/data/biomes.ts` plus its tileset.

## 3. Trainers and line of sight

- A trainer stores a `facing` (N/E/S/W) and a `sight` range.
- Every player step recomputes which trainers see the player: a straight line
  along the facing, blocked by walls and by anything solid.
- A trainer that sees the player triggers its battle immediately, once.
- Beaten trainers are removed from the route and never re-trigger.

## 4. Wild encounters

- Walking onto a `TALL_GRASS` tile rolls an encounter with the route's table.
- No route has tall grass right now (`terrain.grassPatches` is 0 everywhere), so
  wild encounters are dormant until a terrain pass turns them back on.
- The table is per **biome**, weighted, and drawn from the route's level band.
- The roll uses the route RNG, so walking the same grass in the same order
  produces the same encounters.
- Only the species and level are rolled. Stats, types and evolutions come from
  the species; the moveset and ability are rolled separately when the Pokémon is
  built (`D17`).

## 5. Run structure

```
route 1..N-1    regular routes (wild + trainers)
mini-boss       every MINIBOSS_EVERY routes, one fixed trainer with a themed team
boss            closes each block of BOSS_BLOCK routes
final boss      the last route of a finite run
```

- Finite mode: the chain has a fixed length and the final boss ends it.
- Infinite mode: same generator, no final boss; the difficulty bands keep
  climbing and the run ends only when the party is wiped.

## 6. Difficulty bands

- Each route has a level band derived from its index (band start/end) and a
  per-route level cap that clamps XP gain (`docs/battle-spec.md` §7).
- Each trainer archetype carries one species pool per band (`src/data/trainers.ts`),
  so a band's rosters field its own mix and the party size grows with the band
  (`band`'s `trainerSize`); items arrive with the band's loot, not the roster.
- A trainer roster is generated deterministically from the route seed and band,
  and never exceeds the route's level cap.

## 7. Healing stops

Between two routes the player gets a healing stop (a resting point): HP and PP
restored, PC box accessible, no resurrection. Items bought or found between
routes are the only economy. The stop is a screen: it shows the healed party and
the box and lets the player reorder them before continuing to the next route.

Loot is **on the ground**: each route places `ROUTE_LOOT[band].count` items from
a weighted, band-scaled pool (`src/data/loot.ts`), drawn from the route `Rng`
alongside the positions, and stepping on one adds it to the bag. The route HUD
shows the bag as FRLG item icons.
