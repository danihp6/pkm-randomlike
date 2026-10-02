# PokeRandomLike — Routes Spec

How a route is generated, walked and exited. The generator is pure logic in
`src/engine/routes/` and takes a seeded `Rng`.

## 1. What a route is

A rectangular tile map, sized for a single screen (no scrolling beyond the
camera follow), containing:

- a **start** tile, where the player arrives from the previous route;
- an **exit** tile, which ends the route;
- at least one **tall grass** patch big enough to be worth crossing;
- a number of **trainers** with a facing direction;
- zero or more **items**;
- walls/trees along the border and as internal obstacles;
- water, ledges and caves as biome-flavoured obstacles.

## 2. Generation pipeline

1. **Layout**: pick the biome's style (`route`, `forest` or `cavern`) and carve
   its shape — see below. The carver leaves the start connected to the exit.
2. **Terrain pass**: place tall grass patches, water bodies, ledges — solid
   hazards only off the guaranteed path, so they can never seal the route.
3. **Population pass**: trainers (each with a facing), items, and the exit.
4. **Validation pass**: flood-fill from the start must reach the exit and every
   trainer. If it does not, reroll from the same seed with the next stream
   value. This validation is what makes the generator safe to call blind.

Every pass consumes the same `Rng`, so `(seed, routeIndex)` fully determines the
map.

A route is larger than a screen (the default is 56x32 tiles at 24px), so the
camera follows the player. The scene draws a tree/rock margin outside the
playable edge (`padMap`, `src/scenes/RouteScene.ts`) and bounds the camera to it,
so the border reads as more forest instead of the empty background. The whole map
is visible at once: there is no fog of war, like the originals (`D6`).

**Layout style.** The shape a route takes follows the original FireRed/LeafGreen
map for its biome and tileset, not a generic roguelike blob: a forest reads like
Viridian Forest, a cave like Mt. Moon, an outdoor route like Route 1. The route's
biome picks one of the styles in `src/engine/routes/layout.ts`, while the map
semantics (`WALL`, `TALL_GRASS`...) stay the same so any tileset still renders
(`docs/tileset-spec.md`). The three styles, calibrated against the layouts in the
`pret/pokefirered` decomp (`D26`):

| Style | Reads as | Shape |
| --- | --- | --- |
| `route` | Route 1 | An open grass field (~38% blocked) cut by one-tile tree hedges attached to the borders; a two-tile path is kept clear. |
| `forest` | Viridian Forest | A one-tile-corridor labyrinth (~57% blocked) through dense trees, with a few loops. |
| `cavern` | Mt. Moon | Two-tile rock corridors and wide chambers (~40% blocked). |

This supersedes the donor BSP cave as the default look (`D6`). Adding a biome is
a `layout` field in `src/data/biomes.ts` plus its tileset.

## 3. Trainers and line of sight

- A trainer stores a `facing` (N/E/S/W) and a `sight` range.
- Every player step recomputes which trainers see the player: a straight line
  along the facing, blocked by walls and by anything solid.
- A trainer that sees the player triggers its battle immediately, once.
- Beaten trainers are removed from the route and never re-trigger.

## 4. Wild encounters

- Walking onto a `TALL_GRASS` tile rolls an encounter with the route's table.
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
