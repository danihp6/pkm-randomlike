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

1. **Frame**: fill with `WALL`, carve a guaranteed-connected walkable area from
   start to exit (random-walk or BSP-carved rooms, whichever the biome wants).
2. **Terrain pass**: place tall grass patches, water bodies, ledges.
3. **Population pass**: trainers (each with a facing), items, and the exit.
4. **Validation pass**: flood-fill from the start must reach the exit and every
   trainer. If it does not, reroll from the same seed with the next stream
   value. This validation is what makes the generator safe to call blind.

Every pass consumes the same `Rng`, so `(seed, routeIndex)` fully determines the
map.

**Layout style.** The shape a route takes must follow the original
FireRed/LeafGreen games for its biome and tileset, not a generic roguelike blob:
a forest reads like Viridian Forest, a cave like Mt. Moon, a beach cave like the
Seafoam passages. The route's biome/tileset picks the carving style, the props
and the obstacles, while the map semantics (`WALL`, `TALL_GRASS`...) stay the
same so any tileset still renders (`docs/tileset-spec.md`). This is the target
for the cave/dungeon biomes in particular, and it supersedes the donor BSP cave
as the default look (`D6`).

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
- The species pool narrows and the trainer rosters get deeper (more Pokémon, more
  items) as the band rises.
- A trainer roster is generated deterministically from the route seed and never
  exceeds the route's level cap.

## 7. Healing stops

Between two routes the player gets a healing stop (a resting point): HP and PP
restored, PC box accessible, no resurrection. Items bought or found between
routes are the only economy. The stop is a screen: it shows the healed party and
the box and lets the player reorder them before continuing to the next route.

Loot is **on the ground**: each route places `ROUTE_LOOT[band].count` items from
a weighted, band-scaled pool (`src/data/loot.ts`), drawn from the route `Rng`
alongside the positions, and stepping on one adds it to the bag. The route HUD
shows the bag as FRLG item icons.
