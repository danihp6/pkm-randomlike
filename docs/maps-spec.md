# PokeRandomLike — Maps Spec

A **map** is a group of several routes of one biome. It is the unit of biome,
level range and size, and the chain of maps is what a run actually walks. This
file is the source of truth for that layer; the per-route geometry stays in
`docs/routes-spec.md` and the `D##` decisions behind it in
`docs/tech-decisions.md` (D28–D32).

> Status: blueprint. `src/data/maps.ts` (the tuning tables) is in; the plan
> generator, the chained openings, the boss/portal and the HUD map are the open
> steps in `TODO.md` Phase 9. Until they land the game still walks a flat route
> chain with a per-route biome.

## 1. What a map is

A run is a chain of **maps**. Each map is a short chain of **routes**:

```
run = map 1 -> map 2 -> ... -> map N        (N fixed in finite mode)

map = route 1 -> route 2 -> ... -> route K  (K random, from the map's range)
```

- One **biome** is rolled for the whole map, so every route in it shares the
  tileset and the encounter table (D28). `BIOME_ORDER` is the pool it rolls from;
  only `forest` exists for now.
- One **level range** (`minLevel..maxLevel`) belongs to the map. Within the map
  the routes ramp from `minLevel` to `maxLevel`.
- The **last route holds the boss** at the map's `maxLevel`. Beating it seals
  nothing and opens the way on: a **portal** appears and steps the run into the
  next map (D31).
- Route **sizes** grow as the run advances: the map index widens the range a
  route rolls its side from, and each route picks a side inside its range.

A run therefore grows in three steps at once — stronger Pokémon (level range),
bigger routes (size range) and more routes per map (route-count range) — all
driven by the map index, never by the player's level.

## 2. Composition (what is rolled, and from where)

Everything a map is comes from one **map stream** keyed
`(seed, "map", mapIndex)`, so a plan is a pure function of the seed and the map
index (D11 / D29):

```
Plan(mapIndex, mapRng): MapPlan
    tuning   = mapTuning(mapIndex)                 # src/data/maps.ts
    biome    = Pick(BIOME_ORDER, mapRng)
    routeCount = RollRange(tuning.routes, mapRng)
    entryEdge[1] = West                            # the first map's first route
    for i in 1..routeCount:
        exitEdge[i]  = Pick(Edges \ { entryEdge[i] }, mapRng)   # never the way in
        shape[i]     = shapeFor(entryEdge[i], exitEdge[i])      # corridor | bend
        size[i]      = RollRange(tuning.size, mapRng)           # per route, in tiles
        if i < routeCount:
            entryEdge[i+1] = Opposite(exitEdge[i])              # the chain matches
    bossRoute = routeCount                          # the boss closes the map
```

`RollRange` is a single uniform draw rounded to an integer, so the plan consumes
a fixed number of draws per route and a fixed-seed test is stable.

## 3. Tuning tables (`src/data/maps.ts`)

| Knob | Drives |
| --- | --- |
| `levels.minLevel` / `maxLevel` | the map's Pokémon band; the player cap is `maxLevel` |
| `routes.min` / `max` | how many routes the map groups |
| `size.min` / `max` | the tile side each route of the map rolls |

`MAP_TUNING` is a table per map (1..6 today) and `MAP_TUNING_STEP` grows a map
past the last row, so an infinite run keeps climbing. Retuning is a data edit,
never a generator edit (`docs/route-generator.md` §2).

## 4. A route matches its neighbours (D30)

The openings of two consecutive routes line up, so the chain reads as one path:

- Route `i`'s **exit edge** is route `i+1`'s **entry edge, opposite** it. If a
  route exits **right (E)**, the next enters from the **left (W)** — the player
  keeps moving the way they were going.
- The two openings sit on the **same border band** (the same row for an E/W
  step, the same column for N/S), so the corridor one route ends in continues
  into the corridor the next one starts in.
- The pair of edges picks the **shape**:

  | entry → exit | shape | reads as |
  | --- | --- | --- |
  | opposite (W→E, N→S) | `corridor` | a straight passage, one entry/one exit, no branches |
  | adjacent (W→N, …) | `bend` | an L |

`corridor` is the "pasillo": the only openings are its entry and its exit, its
lane is narrow and it carries **no optional branches** (`branchCount = 0`), so it
is the clean connector between two branchier routes. It is added to the shape
registry in `src/engine/routes/layout.ts` beside `straight` / `bend` / `cross`.

The first route of a map enters from the map's edge (West today); the last exits
into the portal.

## 5. Levels & the player's cap (D29)

- `levelRangeForMap(mapIndex)` is the band. Wild encounters and trainer rosters
  draw species and levels from it, never from the player's level (D17).
- Within the map, route `i` of `K` fields `minLevel + (i-1) / (K-1) *
  (maxLevel - minLevel)` as its working level, so the map ramps and the boss sits
  at the top.
- The **player's own cap** for the map is `levelCapForMap(mapIndex)`
  (`= maxLevel`): XP gain clamps there, exactly as the per-route cap did (D9),
  and an evolution the cap blocked waits until the next map.

## 6. Boss & portal (D31)

- The map's last route fields the **boss** — a fixed, themed trainer at the
  map's `maxLevel`, distinct from the route's regular trainers. It is the map's
  gate, not an optional fight.
- The route's **exit is sealed** while the boss stands. Once it falls, a
  **portal** opens on the exit tile; stepping on it advances the run to the next
  map (heal stop intact: HP/PP only, never a resurrection).
- The last map of a finite run holds the **final boss**: there is no portal, and
  beating it wins the run. Infinite mode reopens the portal forever.

## 7. The route HUD map (D32)

The `I` overlay's route header grows into a **map view**: the plan's route graph
is drawn as tiles

- a node per route, labelled with its `routeInMap`, shaped by its `size`;
- a connector between two routes drawn on the shared edge, so the entry/exit
  matching is visible at a glance;
- the **current** route highlighted, and the boss node marked.

**Fog of discovery:** a route is drawn only once it has been **discovered** (the
route has been entered). Routes ahead — and the connectors to them — stay hidden
until the player reaches them, so the map reveals itself as the run advances. The
plan already holds the full graph; the run state holds which nodes are
discovered.

The pure layout (node positions, connectors, reveal filter) lives in
`src/ui/mapView.ts` and is unit-tested; `RouteScene` only draws it.

## 8. Determinism

- The plan is `Plan(seed, mapIndex)`; the routes are `BuildRoute(seed, mapPlan,
  routeInMap)` with their own `layout` / `terrain` / `populate` streams.
- Streams are keyed by the **map and the route inside it** (or by the global
  route index), never by wall-clock or player input, so a seed reproduces the
  whole chain (D11).
- Adding a roll to a later step (say, the HUD never rolls) cannot shift earlier
  geometry because each pass owns its stream.

## 9. Open questions

- **O-M1 — Branching maps.** Is a map always a linear chain, or may a route
  branch into two (the `cross` shape) and the graph become a real map? A linear
  chain is assumed for now; branching would change the plan and the HUD.
- **O-M2 — Discovery rule.** Does a route reveal when it is **entered**, or
  earlier, when its opening is visible from the previous route?
- **O-M3 — Portal placement.** On the exit tile, or a fixed spot in the boss
  route? It must not block the return walk.
- **O-M4 — Biome runs.** May the same biome repeat on consecutive maps, and is
  the roll uniform or weighted toward variety?
