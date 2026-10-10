# PokeRandomLike — Maps Spec

A **map** is a floor of **routes** (rooms) of one biome, laid out on a coarse
grid and joined by openings into a **closed graph** — Binding of Isaac's floors
with rooms. It is the unit of biome, level range and size, and the chain of maps
is what a run actually walks. This file is the source of truth for that layer; the
per-route geometry stays in `docs/routes-spec.md` and the `D##` decisions behind
it in `docs/tech-decisions.md` (D28–D33).

> Status: in progress. The tuning tables (`src/data/maps.ts`), the plan generator
> (`Plan`), the plan-driven route shapes and size, the per-map levels, the run's
> floor tracking, the boss/portal, the route HUD **minimap** (`src/ui/mapView.ts`),
> the **Poké Dollar economy** (trainer drops, the valuables and the bag's money
> readout) and the **special rooms in the plan** (the guaranteed shop, the
> mini-boss and the mega-stone leaves) have shipped, and the **shop room** opens a
> Mart panel at its counter; the mini-boss and mega-stone rooms' own content are
> the open steps in `TODO.md` Phase 9.

## 1. What a map is

A run is a chain of **maps** (floors). Each map is a small **graph of routes**
(rooms) placed on a coarse grid:

```
run  = map 1 -> map 2 -> ... -> map N            (N fixed in finite mode)

map  = a grid of K rooms joined by openings      (K random, from the map's range)
       connected, closed into at least one cycle, no dangling opening
       + a few special rooms (shop, mini-boss, mega-stone)
```

- One **biome** is rolled for the whole map (never the previous map's), so every
  room in it shares the tileset and the encounter table (D28). `BIOME_ORDER` is
  the pool; only `forest` exists for now, so the no-repeat rule is inert.
- One **level range** (`minLevel..maxLevel`) belongs to the map. Within the map
  the routes ramp from `minLevel` to `maxLevel`.
- The **room farthest from the entry** (graph distance) holds the **boss** at the
  map's `maxLevel`. Its onward opening is the **portal** to the next map (D31).
- Room **sizes** grow as the run advances: the map index widens the range a room
  rolls its width and height from, and each room picks both inside it. No room is
  ever smaller than **30x30**, and the floor's **entry room** and **boss room** are
  always exactly **30x30** — the quiet leaves read the same on every map.

## 2. Topology: a closed room graph on a grid (D30)

Like Binding of Isaac, rooms sit on an implicit **grid of cells** and a door on
one room's wall lines up with the neighbour's opposite door:

- a room occupies one grid cell, but is played on its **own screen** (camera
  follow); the grid is what lays out the graph and the minimap, not world space;
- a **link** joins two rooms that share a cell edge, so leaving by East enters the
  neighbour by West; the run keeps the door it arrived through
  (`RunState.arrivalEdge`) so a room seeds the same whatever side it is entered
  from and always lets the player walk straight back;
- the plan must be **connected** and **closed into at least one cycle** (the rooms
  form a loop, not a bare tree), and no opening may dangle;
- the **entry room** and the **boss room** are both **single-door leaves**: each
  joins the floor through exactly one link, so the entry has a single exit forward
  and the boss has a single exit until its portal opens. The cycle lives in the
  rest of the floor, so a floor needs at least **six rooms** (the two leaves plus a
  four-room core, `src/data/maps.ts`).

An opening is one of:

| Opening | Where | Meaning |
| --- | --- | --- |
| **entry** | exactly one, on the entry room | the map entrance; a fresh run or a portal step spawns the player at the room's **centre** (no carved outward door) |
| **portal** | exactly one, on the boss room | sealed until the boss falls, then the way to the next map |
| **link** | 0–4 per room | joins two rooms; its counterpart is the neighbour's opposite link |

**No outward door on the entry room:** the entry is the map's origin, not a way
back off it, so the route builder leaves that wall solid and the run starts the
player in the middle of the room. The entry room's only other opening is the
single `link` that joins it to the floor, so it too is a **single-door leaf**.
Walking **back** into the entry room through that link spawns the player at the
link like any other room. Every other opening is a `link`.

**No dangling openings:** every `link` is joined to another room. A room whose
only opening is a single `link` is a **dead-end room** — a deliberate leaf, not an
exit into nothing. Dead-end rooms hold the same content as any optional room:
trainers, ground items and tall grass (`docs/routes-spec.md` §2).

Content is seeded per room and it **persists while the run is on the floor**: a
beaten trainer, a taken ground item and a spent capture stay spent when the room
is walked back into, and only the map advance clears them. Each room grants **one
capture attempt**, spent by the room's **first wild battle** whatever its outcome
(`docs/routes-spec.md` §3); the run tracks the rooms that spent theirs.

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

    # 1. grow the floor: the entry sits at the grid origin with a **single** door
    #    (its outward edge stays free) into a 2x2 core of four rooms, then expand
    #    from the core to adjacent free cells (one door per new room) until K rooms
    #    are placed. The core is closed into a 4-cycle, so the floor always loops
    #    without ever giving the entry a second door.
    # 2. close cycles: add a random number of extra doors (at least one) between
    #    adjacent rooms past the entry that are not already joined, so the floor
    #    closes one or more loops. No door ever touches the entry room.
    # 3. shapes: derive each room's shape from its opening set (table above).
    # 4. boss: the farthest regular room; hang the boss room off it as an extra
    #    dead-end leaf, so the boss has a single door and the floor keeps its cycle.
    #    Both the entry and the boss are single-door leaves.
    # 5. portal: the boss room's portal is carved on a free wall from the start and
    #    sealed until the boss falls. A fresh arrival spawns the player at the entry
    #    room's centre; walking back in through its link spawns at that door.
    # 6. specials: hang the special rooms off the tree (see §7).
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
| `size.min` / `max` | the range each room rolls its **width and height** from, independently; `min` never drops below 30 and the entry/boss leaves are pinned to 30x30 |

`MAP_TUNING` is a table per map (1..6 today) and `MAP_TUNING_STEP` grows a map
past the last row, so an infinite run keeps climbing. The room count grows with
the map as well but is capped at `MAP_MAX_ROUTES`, so a deep floor never becomes
a huge maze. Retuning is a data edit, never a generator edit
(`docs/route-generator.md` §2).

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

- The **boss room** is a **dead-end leaf** hung off the farthest regular room, so
  its only door is the way in (`docs/maps-spec.md` §2). It is deliberately **quiet**:
  **no tall grass, no ledges, no ground items and no regular trainers**, just the
  boss. The map's **entry room** is quiet the same way, so the run starts and ends
  each floor in a clean room.
- The boss is a fixed, themed trainer at the map's `maxLevel`.
- The portal is **carved from the start** on a free wall of the boss room and stays
  **sealed** while the boss stands, so the room looks the same before and after.
  Once the boss falls the portal opens; stepping through it advances the run to the
  next map (heal stop intact: HP/PP only, never a resurrection).
- The last map of a finite run holds the **final boss**: there is no portal, and
  beating it wins the run. Infinite mode reopens the portal forever.

## 7. Special rooms & the economy (D33)

Beyond its K regular rooms, a floor can hold **special rooms**. They are extra
**leaves** (one door, the `dead-end` shape) and carry **only their own content** —
no tall grass, no regular trainers, no ground items:

| Room | Per floor | Placement | Content |
| --- | --- | --- | --- |
| **shop** | exactly one | a leaf near the entry | a counter; the interact key (`E`) opens a Pokémon-style **shop panel in the HUD** that exists only in this room |
| **mini-boss** | medium chance | a leaf anywhere | one strong trainer; beating it offers a **choice of items** |
| **mega-stone** | low chance, **from map 3 onward** | a leaf anywhere | one random **Mega Stone** item |

Specials count **outside** K (`K` regular rooms + the specials), are rolled on
the same `map` stream, and are discovered like any room: they appear on the
minimap only once **entered**, with their own icon. The shop is guaranteed; the
**mini-boss** leaf rolls with a **50%** chance and the **mega-stone** leaf with
**15%**, the mega-stone only **from map 3 onward**, and the two may coincide on
the same floor.

The **shop panel** is a HUD window like the party/bag panels: a Pokémon
Mart-style list with prices that **only appears while the player is in the shop
room** (it is opened at the counter with `E` and is unavailable anywhere else), so
buying is tied to the room rather than to a menu key.

### The economy (Poké Dollars)

- **Money comes only from defeating trainers.** Each trainer drops a **fixed base
  amount** (data, `src/data/trainers.ts`, per archetype/band) plus a random
  **jitter**, and the run starts with **none**. The economy is tight and fair,
  Binding of Isaac-style: every purchase is a real trade-off.
- The **shop** sells a **fixed core** — Balls and Potions that improve with the
  map's band — plus **one or two random items** from the map's pool, at the
  catalogue `price` (`src/data/items.ts`), and **buys any item** at `sellPrice`.
  Only the new **valuables** (Nugget, Big Nugget, Pearl, Big Pearl, Stardust, Star
  Piece, …) are worth real money; anything else sells for a token, so the shop is a
  sink and valuables are the way to cash out.
- **Valuables** are ordinary items added to the **ground-item loot pool**
  (`src/data/loot.ts`), so they turn up in a room's pockets and are carried to the
  shop.
- **Mega Stones** are new `held` items, one per Mega-capable species. Holding one
  lets the Pokémon **Mega Evolve once per battle** (the Mega Evolution mechanic is
  a prerequisite step, `D34`); the mega-stone room hands out one at random. The
  mini-boss's item choice draws from the map's reward pool.
- The run's **money** lives in `RunState` and shows in the route HUD's **bag
  panel**.

## 8. The route HUD map (D32)

The route HUD's header grows into a **minimap of the floor**, exactly the
Binding of Isaac minimap:

- a **grid of room cells**, each room drawn at its grid position and sized from
  its `size` and shape, with its openings shown on the matching walls;
- the **current** room highlighted, the boss room marked, the portal flagged and
  each special room shown with its own icon; a room whose **single capture** has
  been spent (its first wild battle) shows a **Poké Ball**;
- a link drawn between two rooms only once both are known.

**Fog of discovery:** a room is drawn only once it has been **discovered** (the
room has been entered), and a link only when both its ends are discovered. Rooms
ahead stay hidden until the player reaches them, so the floor reveals itself as
the run advances. The plan already holds the full grid; the run state holds which
rooms are discovered.

The pure layout (cell positions, links, reveal filter) lives in
`src/ui/mapView.ts` and is unit-tested; `RouteScene` only draws it.

## 9. Determinism

- The plan is `Plan(seed, mapIndex)`; the rooms are `BuildRoute(seed, mapPlan,
  routeInMap)` with their own `layout` / `terrain` / `populate` streams.
- Streams are keyed by the **map and the room inside it**
  (`routeIndexForRoom(plan, roomId)`), never by the run's moving counter, wall-clock
  or player input, so revisiting a room rebuilds the same room and a seed
  reproduces the whole chain (D11).
- Adding a roll to a later step cannot shift earlier geometry because each pass
  owns its stream.

## 10. Open questions

- **O-M1 — Floor shape.** Resolved: the number of extra cycle-closing doors is
  random with a minimum of one; leaves are whatever the growth produces.
- **O-M2 — Discovery.** Resolved: a room reveals when it is **entered**, and a
  link only once **both** its ends are known.
- **O-M3 — Portal.** Resolved: the boss room has no onward opening; a new one
  with the portal **appears when the boss falls**.
- **O-M4 — Special probabilities.** Resolved: shop always; mini-boss 50%;
  mega-stone 15% and only **from map 3 on**; the two may coincide.
- **O-M5 — Money numbers.** Balance, not design: the trainer base/jitter, the
  shop's per-band core and the valuables list/prices start as defaults in data and
  are tuned in the Phase 7 balance pass.
- **O-M6 — Mega Stones.** Resolved: functional — holding one allows a Mega
  Evolution once per battle (`D34`); all dex Megas are in.
- **O-M7 — Finite campaign length.** How many maps a finite run walks
  (`FINITE_MAPS` in `src/data/maps.ts`) starts at **6**, matching the tuned rows;
  balance, not design, so the Phase 7 pass may retune it.
