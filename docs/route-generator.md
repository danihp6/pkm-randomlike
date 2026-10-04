# Route Generator — algorithm blueprint

> Design blueprint, not code. Live behaviour is `docs/routes-spec.md` and the
> pure implementation is `src/engine/routes/`. This file is the agreed **target**
> algorithm so the next iteration has one place to build from.
> Status: trainers, ground items and tall grass are turned off right now
> (`docs/routes-spec.md` §2); the population passes below are the plan to bring
> them back, not what runs today.

## 0. Inputs and determinism

```
GenerateRoute(seed, routeIndex, mode): RouteMap

    for attempt in 0 .. BUILD_ATTEMPTS:
        rngs = Streams(seed, routeIndex, attempt)   # see below
        route = BuildRoute(routeIndex, rngs)
        if Validate(route):
            return route
    throw "could not generate a valid route"        # never emit a bad map
```

`BuildRoute` is a **pure function** of `(seed, routeIndex, attempt)` and the data
tables (D11). The attempt index is part of every stream key, so a reroll is a new
deterministic map, not a mutation of the previous one.

```
Streams(seed, routeIndex, attempt):
    layout   = Rng(key = seed : "route" : routeIndex : attempt : "layout")
    terrain  = Rng(key = seed : "route" : routeIndex : attempt : "terrain")
    populate = Rng(key = seed : "route" : routeIndex : attempt : "populate")
```

Separate streams matter: adding a callsign to the terrain pass cannot shift the
path the layout pass already carved. A fixed-seed regression test then only fails
where behaviour really changed.

The biome and band come from `routeIndex`, never from the player's level. The
biome only supplies art and encounters; the **shape** is geometry, seeded per
route:

```
biome = BiomeForRoute(routeIndex)   # BIOME_ORDER = ["forest"] for now
band  = BandForRoute(routeIndex)    # level band, trainerSize, loot tier
shape = Shapes[Pick(rngs.layout)]   # straight | bend | cross (see below)
```

### Shapes and access points

A route's **shape** decides where the player enters and leaves and how the paths
connect those openings. Three shapes for now (more later):

| Shape | Openings | Edges |
| --- | --- | --- |
| `straight` (recta) | 2 | one axis, opposite (e.g. W in / E out) |
| `bend` (L) | 2 | two adjacent edges (e.g. W in / N out) |
| `cross` (+) | 4 | both axes, opposite pairs (W/E and N/S) |

```
ShapeSpec:
    openings: Access[]          # exactly one `entry`, the rest are `exit`s
    links:    Access[][]        # opening pairs the guaranteed path joins
Access:
    edge: "N" | "E" | "S" | "W"
    role: "entry" | "exit"

straight: openings W(in) E(out)   links [[W, E]]          # one opposite pair
bend:     openings W(in) N(out)   links [[W, N]]          # adjacent (the L)
cross:    openings W(in) E N S    links [[W, E], [N, S]]  # both axes (the +)
```

The player arrives at the **entry** and ends the route on any **exit**. The
`links` are what the carve connects, so `straight` joins its opposite pair, `bend`
runs an L and `cross` lays a `+` junction across both axes. `PlaceAccess` turns
each opening into a border tile; the spine guarantees the entry reaches every
exit through the linked paths.

## 1. Data structures

```
RouteMap:
    seed, routeIndex, biomeId, mode
    width, height
    shape:   ShapeSpec
    tiles:   Tile[height][width]     # row-major: tiles[y][x] (engine/map.ts)
    entry:   Point                   # where the player arrives
    exits:   Point[]                 # any one ends the route (1 for now, 2-3 later)
    spine:   Point[]                 # guaranteed entry→exits lane
    pockets: Point[]                 # reachable dead ends (loot spots)
    trainers: Trainer[]
    items:    Item[]

Point:  { x, y }
```

Internal state during the carve:

```
solid:     WALL | WATER | LEDGE     # anything that stops movement
spine:     Set<Point>               # never write solid, grass or a trainer here
branches:  Set<Point>               # optional side paths
reachable: Set<Point>               # FloodFill(tiles, entry), computed after terrain
```

## 2. Tuning knobs (data, not code)

| Knob | Lives in | Drives |
| --- | --- | --- |
| shape `openings`, `pathWidth`, `jitter`, `corridorWidth`, `braid`, `branchCount`, `branchMin/Max`, `pocketChance` | `src/engine/routes/layout.ts` | shape and geometry |
| `grassPatches`, `waterBodies`, `ledges` | `src/data/biomes.ts` | terrain flavour |
| `trainerSize`, `minLevel`, `maxLevel` | `src/data/run.ts` | population and levels |
| loot `count` / `pool` | `src/data/loot.ts` | item contents |
| encounter table | `src/data/encounters.ts` | wild species |

Balancing must never require touching `sketch.ts`.

## 3. Pipeline

```
BuildRoute(routeIndex, rngs):
    biome = BiomeForRoute(routeIndex)
    band  = BandForRoute(routeIndex)
    shape = Shapes[Pick(rngs.layout)]                 # straight | bend | cross

    # 1. Frame and shape
    tiles = Grid(W, H, WALL)                          # one-tile border stays solid
    (entry, exits) = PlaceAccess(tiles, shape, rngs.layout)

    # 2. Guaranteed path (solvability first, never overwritten below)
    spine = CarveGuaranteedPath(tiles, entry, exits, shape, rngs.layout)

    # 3. Secondary paths and dead ends (exploration)
    (branches, pockets) = CarveBranches(tiles, spine, shape, rngs.layout)

    # 4. Terrain flavour - hazards and grass stay off the spine
    CarveGrass(tiles, biome.terrain.grassPatches, rngs.terrain,
               forbid = spine, never = {entry} + exits)
    CarveWater(tiles, biome.terrain.waterBodies, rngs.terrain, forbid = spine)
    CarveLedges(tiles, biome.terrain.ledges, rngs.terrain, forbid = spine)

    # 5. Population (counts from the band; off the spine and the ends)
    reachable = FloodFill(tiles, entry)
    trainers  = PlaceTrainers(tiles, reachable, spine, band, rngs.populate)
    items     = PlaceItems(tiles, reachable, pockets, band, rngs.populate)

    # 6. Decoration (cosmetic; variant indices only, no collision)
    #    The renderer resolves the look from (x, y, routeIndex) - D18.

    return RouteMap(...)
```

### 3.1 PlaceAccess

Each opening names an edge; the shape fixes the pairing. One opening is the
`entry` (where the player arrives), the rest are `exit`s (any one ends the route).

```
PlaceAccess(tiles, shape, rng):
    entry = null; exits = []
    for opening in shape.openings:
        point = pointOnEdge(opening.edge, rng)     # jitter along the edge, clamped in
        tiles[point] = EXIT
        if opening.role == "entry": entry = point else exits.push(point)
    return (entry, exits)
```

### 3.2 CarveGuaranteedPath

The shape's `links` are joined by jittered cardinal corridors that follow a cost
map, so the result meanders instead of running straight.

```
CarveGuaranteedPath(tiles, entry, exits, shape, rng):
    spine = Set()
    for (a, b) in shape.links:
        from = openingPoint(a, entry, exits)          # that opening's border tile
        to   = openingPoint(b, entry, exits)
        waypoints = [from]
        for i in 1 .. SEGMENTS-1:
            base = Lerp(from, to, i / SEGMENTS)
            waypoints.push(base + Jitter(shape.jitter, rng))
        waypoints.push(to)
        for (p, q) in consecutive(waypoints):
            cost(cell) = BASE + Noise(cell, rng)      # deterministic per-cell cost
            path = AStar(tiles, p, q, cost)           # cardinal, engine/pathfinding
            for cell in path:
                CarveSquare(tiles, cell, shape.pathWidth)   # lane may be > 1 wide
                spine += cells(CarveSquare)
    return spine
```

`CarveSquare` never touches the one-tile border. `spine` is the safe lane: no
solid tile, no tall grass and no trainer may ever be written on it.

### 3.3 CarveBranches

```
CarveBranches(tiles, spine, shape, rng):
    branches = Set(); pockets = []
    for i in 0 .. shape.branchCount:
        target = PickFloor(farFrom(spine, min = shape.branchMin),
                           notIn = spine, notNear = {entry} + exits)
        if target is null: continue
        origin = Nearest(spine, target)
        branch = CarveCorridor(tiles, origin, target, width = 1, rng)
        branches += branch
        if IsDeadEnd(tiles, target):       # exactly one walkable neighbour
            pockets.push(target)
    return (branches, pockets)
```

Branches are optional; the spine alone always solves the route. A dead end is a
**pocket** - the classic place for loot or a single special encounter.

### 3.4 PlaceTrainers — always optional

Trainers block movement like the originals, but the generator never lets one sit
on the only way out: a candidate is kept only while every exit stays reachable
without crossing any chosen trainer.

```
PlaceTrainers(tiles, reachable, spine, band, rng):
    chosen = Set()
    candidates = reachable - spine - {entry} - exits
    for i in 0 .. band.trainerSize:
        pos = PopRandom(candidates, minDistanceFrom(entry) = 3)
        if pos is null: break
        if ExitsReachableAvoiding(tiles, entry, exits, chosen + {pos}):
            facing = FaceOpenLane(tiles, pos, rng)   # a cardinal with floor/grass ahead
            chosen += { pos, facing, sight = 3,
                        archetype = RandomArchetype(rng),
                        id = "trainer-<routeIndex>-<i>" }
    return chosen
```

Net effect: the player can always walk entry → every exit without a forced
battle, and every trainer is a choice (and, later, a reward).

### 3.5 PlaceItems

```
PlaceItems(tiles, reachable, pockets, band, rng):
    items = []
    pocketSlots = (pockets ∩ reachable) - occupied
    otherSlots  = reachable - spine - {entry} - exits - trainerTiles
    for i in 0 .. band.loot.count:
        pos = PopRandom(pocketSlots) or PopRandom(otherSlots)
        if pos is null: break
        itemId = PickWeighted(band.loot.pool, rng)
        items += { id = "item-<routeIndex>-<i>", pos, itemId }
    return items
```

Items are placed **after** terrain, on cells that flood-fill proved reachable, so
a hazard that sealed a pocket simply makes it hold nothing instead of stranding
loot.

### 3.6 Decoration

```
variant(x, y) = Hash(seed, routeIndex, x, y) mod VARIANT_COUNT
```

No collision, no per-cell allocation; `RouteScene`/`tileFrames` map the variant
to a prop frame (`D18`). The generator owns placement, not pixels.

## 4. Validation

```
Validate(route):
    reachable = FloodFill(route.tiles, route.entry)

    assert every exit in reachable
    assert FloodFillAvoiding(route.tiles - trainerTiles, route.entry) contains every exit
    assert every item in reachable
    assert no trainer stands on a spine cell
    assert no spine cell is WALL / WATER / LEDGE / TALL_GRASS
    assert the one-tile border is solid and the openings sit inside it
    assert every pocket has exactly one walkable neighbour (a real dead end)
```

The trainer-free flood fill is the guarantee that no placement can soft-lock the
route behind an unwinnable fight.

## 5. Guarantees and tests

- **Determinism:** same `(seed, routeIndex)` → byte-identical `RouteMap`, across
  rerolls and reloads. Regression snapshots per shape with fixed seeds.
- **Solvability:** every exit reachable, and reachable without meeting a trainer.
- **No stranding:** every spawned item is reachable.
- **Clean lane:** the spine holds no hazard, grass or trainer.
- **Stable ids:** `trainer-<route>-<i>`, `item-<route>-<i>`.
- **Bounds:** openings sit inside the solid one-tile border; the map stays 56x32
  (single screen, camera follow, `padMap` margin - D26; no fog - D6).

## 6. Decisions taken (from the first draft's review)

1. **Seed everything, per pass**, with the attempt in the key (D11).
2. **Biome and band from `routeIndex`**, not `playerLevel` or a random pick.
3. **Row-major grid** `tiles[y][x]`.
4. **Path width from the shape** (1 for `straight`/`bend` - D26).
5. **Hazards stay off the spine**, not just off trainers.
6. **The spine is grass-free**, so a clean, encounter-free lane always exists.
7. **Trainers block but are never required**; the spine is trainer-free.
8. **No HM/field-move gates** in the generator until a design decision says so.
9. **Decoration is variant indices only**; the renderer owns the look.
10. **Failure rerolls on new streams**, then throws; it never returns a bad map.
11. **The shape is first-class and seeded** (`straight` / `bend` / `cross`): it
    fixes the openings, the `links` the spine connects and the path geometry. The
    biome only supplies art and encounters. More shapes land later.

## 7. Open questions

- **O-R1 - Pockets.** Must every dead end hold something, or is an empty dead end
  allowed? (Affects how much of the map is "content".)
- **O-R2 - Guarded pockets.** May an optional trainer stand on a branch to a
  pocket (risk/reward), as long as the spine stays clear?
- **O-R3 - Final boss.** Should the finite run's last route use a fixed,
  hand-shaped arena instead of the same open-field generator?
- **O-R4 - Which opening is the entry.** A shape lists its openings and the
  blueprint seeds one as the entry. Should it instead continue from the previous
  route (entry opposite where the last exit was), so a chain of routes reads as
  one continuous path?
- **O-R5 - Field gates.** Cut/Rock Smash-style gates stay out of scope unless the
  design adopts a key/flag gate instead of an HM.
