# Route Generator — algorithm blueprint

> Design blueprint, not code. Live behaviour is `docs/routes-spec.md` and the
> pure implementation is `src/engine/routes/`. This file is the agreed **target**
> algorithm so the next iteration has one place to build from.
> Status: the terrain pass (tall grass, ledges), the **ground-item** population
> and the **trainers** are all **on** (`docs/routes-spec.md` §2). `PlaceItems`
> and `PlaceTrainers` below both run today; the pool is the only difference (the
> caller passes the loot pool and the archetype ids, so an unconfigured build
> places neither).

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
| `wallMargin` (motif `cols`) | `src/engine/routes/sketch.ts` | the border band every lane keeps clear |
| `WallFootprint` (`cols`, `minHeight`) | tileset `wallPattern` | the wall tidy's whole-object size |
| `grassPatches`, `ledges` | `src/data/biomes.ts` | terrain flavour (base counts) |
| map-size tiers (`small`/`medium`/`large`: terrain scale, branch bonus) | `src/data/mapSize.ts` | terrain multiplier and extra optional paths as the map grows |
| `trainerSize`, `minLevel`, `maxLevel` | `src/data/run.ts` | population and levels |
| loot `pool` / `hiddenChance` | `src/data/loot.ts` | item contents and how often one hides |
| encounter table | `src/data/encounters.ts` | wild species |

Balancing must never require touching `sketch.ts`.

## 3. Pipeline

```
BuildRoute(routeIndex, rngs):
    biome = BiomeForRoute(routeIndex)
    band  = BandForRoute(routeIndex)
    shape = Shapes[Pick(rngs.layout)]                 # straight | bend | cross

    # 1. Frame and shape
    tiles = Grid(W, H, WALL)                          # one-tile border, solid but for the openings
    (entry, exits) = PlaceAccess(tiles, shape, rngs.layout)

    # 2. Guaranteed path (solvability first, never overwritten below)
    spine = CarveGuaranteedPath(tiles, entry, exits, shape, rngs.layout)

    # 3. Secondary paths and dead ends (exploration)
    count = shape.branchCount + BranchBonusForSize(W, H)   # +0 small | +1 medium | +2 large
    (branches, pockets) = CarveBranches(tiles, spine, shape, count, rngs.layout)
    #    A branch roots on the network (spine + earlier lanes), so branches can
    #    grow off branches. Every lane keeps `cols` tiles off the border so the
    #    outer tree mass is never bitten; only an opening pierces it.

    # 3b. Tidy the trees: every column must read as whole trees, never a stub.
    CleanWalls(tiles, footprint)          # only turns WALL back into FLOOR

    # 4. Terrain flavour - hazards and grass stay off the spine
    terrainScale = TerrainScaleForSize(W, H)          # small ×1 | medium ×2 | large ×3
    CarveGrass(tiles, biome.terrain.grassPatches * terrainScale, rngs.terrain,
               forbid = spine, never = {entry} + exits)
    CarveLedges(tiles, biome.terrain.ledges * terrainScale, rngs.terrain, forbid = spine)
    # Water is decoration (D18), not a generator terrain pass.

    # 5. Population (items off the spine; trainers still off)
    reachable = FloodFill(tiles, entry)
    trainers  = PlaceTrainers(tiles, reachable, spine, band, rngs.populate)
    items     = PlaceItems(tiles, reachable, pockets, band, rngs.populate, hiddenChance)

    # 6. Decoration (cosmetic; variant indices only, no collision)
    #    The renderer resolves the look from (x, y, routeIndex) - D18.

    return RouteMap(...)
```

### 3.1 PlaceAccess

Each opening names an edge; the shape fixes the pairing. One opening is the
`entry` (where the player arrives), the rest are `exit`s (their far ends). Openings
sit **on the map border** and punch a gap in the tree ring; they are plain floor
(the route has no special `EXIT` tile) and stepping on an exit does **not** end the
route for now. Each opening keeps a clearance of the motif's footprint
(`cornerClearance`, `2 * cols`) from every map corner, so a corridor never bites the
tree in a corner into a partial or one-tile piece, and it is **aligned to its motif
band** so the `pathWidth`-wide approach never spills into the tree in the band
beside it.

```
PlaceAccess(tiles, shape, rng, corner, band):
    entry = null; exits = []
    for opening in shape.openings:
        point = pointOnEdge(opening.edge, rng, corner, band)   # clear of corners, band-aligned
        tiles[point] = FLOOR
        if opening.role == "entry": entry = point else exits.push(point)
    return (entry, exits)
```

### 3.2 CarveGuaranteedPath

The shape's `links` are joined by jittered cardinal corridors that follow a cost
map, so the result meanders instead of running straight. When a shape has more
than one link (the `cross`), every link routes through a shared **central hub**, so
the lanes are guaranteed to meet: the entry reaches every exit by construction,
never by the jittered corridors happening to cross. Each lane starts with a
straight **`OpeningApproach`** of `wallMargin` (`max(cols, minHeight)`) tiles inward
before it may turn, and the A* cost penalises the outer `margin` band, so a corridor
never bites the band the border ring belongs to and always leaves a strip at least a
whole object tall (with its trunk) at the border (`cleanWalls` could otherwise only
fix a bite by opening the fence).

```
CarveGuaranteedPath(tiles, entry, exits, shape, rng, margin):
    spine = Set()
    hub = Center(tiles) if shape.links.length > 1 else null
    for (a, b) in shape.links:
        from = openingPoint(a, entry, exits)          # that opening's border tile
        to   = openingPoint(b, entry, exits)
        waypoints = [from] + OpeningApproach(a.edge, from, margin)
        for i in 1 .. SEGMENTS-1:
            if hub and i == SEGMENTS / 2:
                waypoints.push(hub)                   # every link meets here
            else:
                base = Lerp(from, to, i / SEGMENTS)
                # CarveSquare grows down/right from the anchor, so clamp the waypoint
                # a lane width inside the margin: the lane's far edge keeps the border
                # strip a whole tree, not a one-row stump.
                waypoints.push(Clamp(base + Jitter(shape.jitter, rng), margin, size - margin - shape.pathWidth))
        waypoints += reverse(OpeningApproach(b.edge, to, margin)) + [to]
        for (p, q) in consecutive(waypoints):
            cost(cell) = BASE + Noise(cell, rng) + BorderPenalty(cell, margin)
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
    reach = MaxDistanceFromSpine(tiles)          # how far the interior reaches
    min = Max(shape.branchMin, 0.25 * reach)     # roomier maps get longer lanes
    max = Max(shape.branchMax, 0.70 * reach)
    laneW = Clamp(2 .. 4, 1 + reach / 12)        # at least two tiles wide
    room = laneW >= 3 ? laneW + 1 : 0            # a chamber on roomy maps
    for i in 0 .. shape.branchCount:
        target = PickSolid(farFrom(spine, min .. max),
                           notIn = spine, notNear = {entry} + exits)
        if target is null: continue
        origin = Nearest(spine, target)
        branch = CarveCorridor(tiles, origin, target, width = laneW, rng)
        if room > 0: CarveSquare(tiles, target, room)   # opens the far end
        branches += branch + room
        pockets.push(target)                    # the far end is the loot spot
    return (branches, pockets)
```

Branches are optional; the spine alone always solves the route. Lanes keep a
margin of the motif's width (**`cols`**) from the border, are **at least two tiles
wide**, and scale with the free space: a roomy map gets longer, wider lanes that
open into a small **chamber** at the far end instead of a bare one-tile
cul-de-sac. That far end is the **pocket** - the classic place for loot or a single
special encounter.

### 3.3b CleanWalls

The wall motif draws a whole object only from a run that is at least `cols` wide and
a whole number of objects tall (`wholeRunHeight`): the mass's row is top/body/.../
base, so a one- or two-tile sliver shows a cut-off tree and a run of 3 a bare trunk.
A lane that grazes the forest leaves a one- or two-tile sliver, and a lane that
bites the side of a tree leaves a `cols`-wide band that is no longer solid.

```python
CleanWalls(tiles, footprint):            # footprint = the tileset's WallPattern size
    bands = AnchorBands(tiles, footprint.cols)   # once, from the raw carve
    repeat until nothing changes:
        for each row and each band:      # a band holding both wall and floor is bitten
            if the band is partial: clear the band's whole row of wall
        for x in every column:           # un-stack: runs touching the ring are skipped
            for (start, end) in ColumnRuns(tiles, x):
                target = LargestWholeHeight(end - start + 1)   # even, >= minHeight, else 0
                if target != run height: clear the extra rows
        for y in every row:              # a run narrower than an object is no object
            for (start, end) in RowRuns(tiles, y):
                if width < footprint.cols: clear the run
```

A **bitten tree is removed whole**: a `cols`-wide band that holds both wall and
floor cannot draw as a whole object, so the whole band row goes, and the column is
then un-stacked. The bands are a **fixed global grid** of `cols` columns from the
map's left edge: a lane that falls inside a band widens to the whole band, so no
mass keeps a cut tree and no lane is left one tile wide.

The tidy **only turns `WALL` back into `FLOOR`**, so it can widen a lane but never
block one: the entry, the exits and the spine keep working and the openings stay
reachable. A cell on the one-tile border ring is only dropped to widen an opening
(a lane already reaches the ring beside it), so the map stays fenced. Because the
size a run needs comes from the tileset's motif, a different biome or wall art just
passes its own `WallFootprint`.

### 3.4 PlaceTrainers — optional, never required

Trainers block movement like the originals: they stand on floor hugging a **solid
wall** (never the walkable tip of a tree). A trainer on the **main lane** looks
down the lane, back to a wall; a trainer on an **optional path** looks **across**
it, wall to wall, so the sight closes the branch — a vertical path is watched
horizontally and a horizontal one vertically — and it never stares down its own
axis. One of them always guards the main lane while the rest cluster on the
optional paths by the pocket items. The count
follows the route's **size**: one on the spine, one per optional path (a pocket)
and the map-size tier's `trainerBonus`. Placement never plugs a passage: a
candidate is kept only while the entry still reaches **every** tile it could
before, with ledges and water counting as impassable, so no lane, branch or pocket
is cut off. Two trainers never stand in neighbouring tiles, and no trainer spawns
already watching — or able to spin and watch — the tile the player arrives on.
Some trainers cycle their facing on a timer (a "spinning" trainer) so their line
turns with them.

```
PlaceTrainers(tiles, entry, exits, spine, branches, pockets, band, rng):
    chosen = Set()
    reach  = ReachableTiles(tiles, entry)      # ledges/water impassable
    candidates = floor tiles hugging a solid wall, off the entry/exits/pockets,
                 not next to a chosen trainer, at least 3 from the entry,
                 with a passable facing
    # 1 on the main lane, 1 per pocket on its branch, + tier.trainerBonus
    for i in 0 .. 1 + len(pockets) + trainerBonusForSize(size):
        pos   = PopRandom(candidates without a spot)
        if pos is null: break
        if not KeepsEverythingReachable(tiles, entry, reach, chosen + {pos}): continue
        dirs   = OpenFacings(tiles, pos)         # cardinals onto a passable tile
        if pos on a branch:                      # cross the path, wall to wall
            facing = ChooseCrossFacing(tiles, pos, NearestPocket(pos), dirs)
        else:                                    # main lane: down it, back to wall
            facing = ChooseFacing(tiles, pos, entry, dirs)
        turns  = rng.next() < SPIN_CHANCE && len(dirs) >= 2 ? dirs : null
        if SeesEntry(pos, facing) or any(SeesEntry(pos, t) for t in turns): continue
        chosen += { pos, facing, sight, turns,
                    archetype = RandomArchetype(rng),
                    id = "trainer-<routeIndex>-<i>" }
    return chosen
```

Net effect: the player can always walk entry → every exit, and reach every pocket,
without a forced battle, and every trainer is a choice (and, later, a reward). The
test is a flood fill that treats the chosen trainers as walls.

### 3.5 PlaceItems

```
PlaceItems(tiles, reachable, pockets, band, rng, hiddenChance, itemChance):
    items = []
    for pos in pockets:                     # an optional path's far end
        if pos not in reachable or not walkable: continue
        if rng.next() >= itemChance: continue       # a path may hold nothing
        itemId = PickWeighted(band.pool, rng)
        hidden = rng.next() < hiddenChance
        items += { id = "item-<routeIndex>-<n>", pos, itemId, hidden }
    return items
```

Items are placed **after** terrain, on the pockets that flood-fill proved
reachable, so a hazard that sealed a pocket simply makes it hold nothing instead
of stranding loot. An optional path holds an item only with `itemChance`
probability (`ROUTE_LOOT`, 75% for now), and when it does the pocket is the
**deepest** tile of the branch — the item sits as far down the path as it can.
Because a route carves more optional paths as the map grows
(`BranchBonusForSize`), the number of items follows the route's **size** rather
than its band; the band only decides the contents and the chances (`ROUTE_LOOT`).
A pocket is kept clear of tall grass and ledges, so an item never lands on grass.
The caller may pass no pool (tests, the debug stepper): then the route holds no
items.

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
    assert every trainer stands on floor hugging a solid wall, off the entry/exits/pockets,
           not next to another trainer, and never sees the entry (even when it turns)
    assert no spine cell is WALL / WATER / LEDGE / TALL_GRASS
    assert the one-tile border is solid but for the openings
    assert every pocket has exactly one walkable neighbour (a real dead end)
```

The trainer-free flood fill is the guarantee that no placement can soft-lock the
route behind an unwinnable fight. The generator is stricter than that: it keeps a
candidate only while **every** tile stays reachable, so a trainer never plugs a
lane, a branch or a pocket either, and ledges and water count as impassable.

## 5. Guarantees and tests

- **Determinism:** same `(seed, routeIndex)` → byte-identical `RouteMap`, across
  rerolls and reloads. Regression snapshots per shape with fixed seeds.
- **Solvability:** every exit reachable, and reachable without meeting a trainer.
- **No stranding:** every spawned item is reachable.
- **Clean main lane:** the spine holds no hazard or grass.
- **Posed trainers:** each stands on floor, backed by a **solid** wall, looking
  down a passable lane, never next to another trainer and never watching the
  entry; some cycle their facing.
- **No plugging:** a trainer never cuts off a tile (lane, branch or pocket); the
  trainer-free fill keeps every reachable tile reachable (ledges/water impassable).
- **Stable ids:** `trainer-<route>-<i>`, `item-<route>-<i>`.
- **Bounds:** openings sit on the map border (gaps in the tree ring); the map size is an input (20x20 default for now)
  (single screen, camera follow, `padMap` margin - D26; no fog - D6).

## 6. Decisions taken (from the first draft's review)

1. **Seed everything, per pass**, with the attempt in the key (D11).
2. **Biome and band from `routeIndex`**, not `playerLevel` or a random pick.
3. **Row-major grid** `tiles[y][x]`.
4. **Path width from the shape**, at least two tiles so no lane is left one tile
   wide (the motif's border band is widened to whole trees by `cleanWalls`).
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
- **O-R4 - Which opening is the entry.** *Resolved (D30, `docs/maps-spec.md`).*
  A map's first room enters from a **random edge** and rooms join by **opposite**
  openings, so the floor reads as one connected path; the previous chain rule no
  longer applies.
- **O-R5 - Field gates.** Cut/Rock Smash-style gates stay out of scope unless the
  design adopts a key/flag gate instead of an HM.
