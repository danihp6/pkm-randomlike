# PokeRandomLike — Maps Spec

A **map** is a floor of **routes** (rooms) of one biome, laid out on a coarse
grid and joined by openings into a **closed graph** — Binding of Isaac's floors
with rooms. It is the unit of biome, level range and size, and the chain of maps
is what a run actually walks. This file is the source of truth for that layer; the
per-route geometry stays in `docs/routes-spec.md` and the `D##` decisions behind
it in `docs/tech-decisions.md` (D28–D32).

> Status: blueprint. `src/data/maps.ts` (the tuning tables) is in; the plan
> generator, the route shapes, the boss/portal and the HUD map are the open steps
> in `TODO.md` Phase 9. Until they land the game still walks a flat route chain
> with a per-route biome.

## 1. What a map is

A run is a chain of **maps** (floors). Each map is a small **graph of routes**
(rooms) placed on a coarse grid:

```
run  = map 1 -> map 2 -> ... -> map N            (N fixed in finite mode)

map  = a grid of K rooms joined by openings      (K random, from the map's range)
       connected, closed into at least one cycle, no dangling opening
```

- One **biome** is rolled for the whole map (never the previous map's), so every
  room in it shares the tileset and the encounter table (D28). `BIOME_ORDER` is
  the pool; only `forest` exists for now, so the no-repeat rule is inert.
- One **level range** (`minLevel..maxLevel`) belongs to the map. Within the map
  the routes ramp from `minLevel` to `maxLevel`.
- The **room farthest from the entry** (graph distance) holds the **boss** at the
  map's `maxLevel`. Its onward opening is the **portal** to the next map (D31).
- Room **sizes** grow as the run advances: the map index widens the range a room
  rolls its width and height from, and each room picks both inside it.

## 2. Topology: a closed room graph on a grid (D30)

Like Binding of Isaac, rooms sit on an implicit **grid of cells** and a door on
one room's wall lines up with the neighbour's opposite door:

- a room occupies one grid cell, but is played on its **own screen** (camera
  follow); the grid is what lays out the graph and the minimap, not world space;
- a **link** joins two rooms that share a cell edge, so leaving by East enters the
  neighbour by West;
- the plan must be **connected** and **closed into at least one cycle** (the rooms
  form a loop, not a bare tree), and no opening may dangle.

An opening is one of:

| Opening | Where | Meaning |
| --- | --- | --- |
| **entry** | exactly one, on the entry room | the map entrance, entered from the previous map |
| **portal** | exactly one, on the boss room | sealed until the boss falls, then the way to the next map |
| **link** | 0–4 per room | joins two rooms; its counterpart is the neighbour's opposite link |

**No dangling openings:** every `link` is joined to another room. A room whose
only opening is a single `link` is a **dead-end room** — a deliberate leaf, not an
exit into nothing. Dead-end rooms hold the same content as any optional room:
trainers, ground items and tall grass (`docs/routes-spec.md` §2).

The **shape** of a room follows from its opening set (its count and edges):

| Openings | Shape | Reads as |
| --- | --- | --- |
| 1 (`link`) | `dead-end` | a room with one way in, the loot/exploration leaf |
| 2, opposite | `corridor` | the "pasillo": a narrow passage, no branches |
| 2, adjacent | `bend` | an L |
| 3 | `tee` | a T junction |
| 4 | `cross` | a crossing |
| 2, opposite, branchy | `straight` | the older wide route with optional branches |

## 3. Composition (target algorithm)

Everything a map is comes from one **map stream** keyed `(seed, "map", mapIndex)`,
so a plan is a pure function of the seed and the map index (D11 / D29):

```
Plan(seed, mapIndex): MapPlan
    tuning  = mapTuning(mapIndex)                    # src/data/maps.ts
    rng     = Rng(seed : "map" : mapIndex)
    biome   = Pick(BIOME_ORDER \ { previousBiome }, rng)
    K       = RollRange(tuning.routes, rng)
    size[i] = { w: RollRange(tuning.size, rng), h: RollRange(tuning.size, rng) }  per room

    # 1. grow the floor: place the entry at the grid origin, then expand to
    #    adjacent free cells (one door per new room) until K rooms are placed.
    #    This is a spanning tree over the grid.
    # 2. close at least one cycle: add one more door between two adjacent rooms
    #    that are not already joined.
    # 3. shapes: derive each room's shape from its opening set (table above).
    # 4. boss: BFS from the entry room; the farthest room is the boss.
    # 5. portal: the boss room's onward opening is the portal (absent on the final map).
    #    The entry room's outward edge is the map entry, entered from the previous map.
```

A room never exceeds four openings (its four grid neighbours); `K` stays inside
the map's range so expansion never runs out of free cells. Draws happen in a fixed
order, so a fixed-seed test is stable; an unavailable cell retries
deterministically.

## 4. Tuning tables (`src/data/maps.ts`)

| Knob | Drives |
| --- | --- |
| `levels.minLevel` / `maxLevel` | the map's Pokémon band; the player cap is `maxLevel` |
| `routes.min` / `max` | how many rooms the map's graph holds |
| `size.min` / `max` | the range each room rolls its **width and height** from, independently |

`MAP_TUNING` is a table per map (1..6 today) and `MAP_TUNING_STEP` grows a map
past the last row, so an infinite run keeps climbing. Retuning is a data edit,
never a generator edit (`docs/route-generator.md` §2).

## 5. Levels & the player's cap (D29)

- `levelRangeForMap(mapIndex)` is the band. Wild encounters and trainer rosters
  draw species and levels from it, never from the player's level (D17).
- Within the map, room `i` of `K` fields `minLevel + (i-1) / (K-1) *
  (maxLevel - minLevel)` as its working level, so the map ramps and the boss sits
  at the top.
- The **player's own cap** for the map is `levelCapForMap(mapIndex)`
  (`= maxLevel`): XP gain clamps there, exactly as the per-route cap did (D9),
  and an evolution the cap blocked waits until the next map.

## 6. Boss & portal (D31)

- The **farthest room from the entry** fields the **boss** — a fixed, themed
  trainer at the map's `maxLevel`, distinct from the room's regular trainers.
- Its onward opening (the **portal**) is **sealed** while the boss stands. Once it
  falls the portal opens; stepping through advances the run to the next map (heal
  stop intact: HP/PP only, never a resurrection).
- The last map of a finite run holds the **final boss**: there is no portal, and
  beating it wins the run. Infinite mode reopens the portal forever.

## 7. The route HUD map (D32)

The `I` overlay's route header grows into a **minimap of the floor**, exactly the
Binding of Isaac minimap:

- a **grid of room cells**, each room drawn at its grid position and sized from
  its `size` and shape, with its openings shown on the matching walls;
- the **current** room highlighted, the boss room marked and the portal flagged;
- a link drawn between two rooms only once both are known.

**Fog of discovery:** a room is drawn only once it has been **discovered** (the
room has been entered), and a link only when both its ends are discovered. Rooms
ahead stay hidden until the player reaches them, so the floor reveals itself as
the run advances. The plan already holds the full grid; the run state holds which
rooms are discovered.

The pure layout (cell positions, links, reveal filter) lives in
`src/ui/mapView.ts` and is unit-tested; `RouteScene` only draws it.

## 8. Determinism

- The plan is `Plan(seed, mapIndex)`; the rooms are `BuildRoute(seed, mapPlan,
  routeInMap)` with their own `layout` / `terrain` / `populate` streams.
- Streams are keyed by the **map and the room inside it** (or by the global route
  index), never by wall-clock or player input, so a seed reproduces the whole
  chain (D11).
- Adding a roll to a later step cannot shift earlier geometry because each pass
  owns its stream.

## 9. Open questions

- **O-M1 — Floor shape.** How many cycles and how many dead-end leaves should a
  floor aim for? A single cycle plus optional leaves is assumed for now.
- **O-M2 — Discovery rule.** A room reveals when it is **entered** (decided); a
  link reveals once both ends are known — confirm that is the intent.
- **O-M3 — Portal opening.** The boss room's onward opening is the portal; on a
  four-opening boss room, which one is "onward"?
- **O-M4 — Special rooms.** BoI has treasure/shop/secret rooms. Do we want any
  beyond the boss, or is every optional room the same (trainers, items, grass)?
