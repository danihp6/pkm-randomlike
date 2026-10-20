# Route Generator — algorithm rationale

> **Implemented, not a blueprint.** The algorithm below ships in
> `src/engine/routes/`; `docs/routes-spec.md` is the live spec, and this file is
> kept as the algorithm's rationale and its open questions (§7). Where a name or a
> rule below disagrees with the code, the code wins — the divergences the draft
> left behind are noted in place.
> Status: the terrain pass (tall grass, ledges), the **ground-item** population
> and the **trainers** are all **on** (`docs/routes-spec.md` §2). `PlaceItems`
> and `PlaceTrainers` below both run today (shipped as `placeItems` and
> `placeTrainers`); the pool is the only difference (the caller passes the loot
> pool and the archetype ids, so an unconfigured build places neither).

## 0. Inputs and determinism

```
GenerateRoute(seed, routeIndex, mode): RouteMap

    for attempt in 0 .. MAX_ATTEMPTS:
        rngs = Streams(seed, routeIndex, attempt)   # see below
        route = BuildRoute(routeIndex, rngs)
        if Validate(route):
            return route
    throw "could not generate a valid route"        # never emit a bad map
```

The shipped entry point is `sketchRoute` (`src/engine/routes/sketch.ts`): it builds
an attempt on fresh streams and retries while `!validateRoute(route).ok`, up to
**`MAX_ATTEMPTS = 8`** (declared at the top of `sketch.ts`), then throws. The draft
below called the bound `BUILD_ATTEMPTS` and the two steps `BuildRoute`/`Validate`;
they ship as `MAX_ATTEMPTS`, `attemptRoute` and `validateRoute`.

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

> **Shipped names.** The draft's trio is superseded: the registry in
> `src/engine/routes/layout.ts` holds six shapes — `dead-end`, `corridor`, `bend`,
> `tee`, `cross` and `straight` — and a room's shape is derived from its opening
> set (`shapeForEdges`), so two opposite openings read as `corridor`, not
> `straight`. `PlaceAccess`, `CleanWalls` and `CarveBranches` ship as
> `placeAccess`, `cleanWalls` and `carveBranches`.

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
| trainer rooms per floor (`TRAINER_ROOMS_PER_MAP`, `TRAINER_ROOMS_MAX`, `TRAINERS_PER_ROOM`) | `src/data/population.ts` | how many of a floor's regular rooms hold trainers, and how many each holds |
| loot `pool` / `hiddenChance` | `src/data/loot.ts` | item contents and how often one hides |
| wild species | `src/engine/run/pool.ts` (`speciesPool`, D39) | the band's BST pool, legendaries/mythicals banned |

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

### 3.4 PlaceTrainers — the room's role decides the count

Trainers block movement like the originals: they stand on floor hugging a **solid
wall** (never the walkable tip of a tree). A trainer on the **main lane** looks
down the lane, back to a wall; a trainer on an **optional path** looks **across**
it, wall to wall, so the sight closes the branch — a vertical path is watched
horizontally and a horizontal one vertically — and it never stares down its own
axis. One of them always guards the main lane and the second stands by an optional
path's pocket when one takes it.

The count comes from the room's **role** (`MapRoom.role`, `docs/maps-spec.md` §2):
the floor's plan tags exactly `trainerRoomsForMap(mapIndex)` of its regular rooms
`trainers` (`TRAINER_ROOMS_PER_MAP`: 2 on maps 1-2, 3 on maps 3-5, 4 on maps 6-8,
one more every two maps past the table up to `TRAINER_ROOMS_MAX = 6`) and every
other room `wild`. A `wild` room places **no trainer and spends no draw** on them;
a `trainers` room places **1-2** (`TRAINERS_PER_ROOM`), drawn **after** the spine
guard, so the guard's own draws never move for a fixed seed and the count no longer
follows the room's size. A request that names no role is treated as `'trainers'`,
which keeps the dev generator, the frame importer and the engine tests on the
shipped pass. Placement never plugs a passage: a candidate is kept only while the
entry still reaches **every** tile it could before, with ledges and water counting
as impassable, so no lane, branch or pocket is cut off. Two trainers never stand in
neighbouring tiles, and no trainer spawns already watching — or able to spin and
watch — the tile the player arrives on. Some trainers cycle their facing on a timer
(a "spinning" trainer) so their line turns with them.

The lane guard holds **when the population pass was asked for trainers**: the
request carries a non-empty archetype pool, the room is not `quiet` (the map's
entry, boss and special rooms, `docs/maps-spec.md` §2/§6/§7, ship no trainer
legitimately) and its role is not `'wild'`. A route the pass was asked to guard
that holds no trainer is
reported by `validateRoute`'s `missingLaneGuard` (`'no-trainers'`) and re-rolled
by `sketchRoute` inside `MAX_ATTEMPTS = 8` (`wantsTrainers` is the single
definition of the condition), so the promise below never ships a bare lane. The
guard is checked on the finished `RouteMap`; it draws no `Rng` value and adds no
stream.

```
PlaceTrainers(tiles, entry, exits, spine, branches, pockets, role, rng):
    if len(archetypes) == 0 or role != "trainers": return []   # a wild room draws nothing
    chosen = Set()
    reach  = ReachableTiles(tiles, entry)      # ledges/water impassable
    candidates = floor tiles hugging a solid wall, off the entry/exits/pockets,
                 not next to a chosen trainer, at least 3 from the entry,
                 with a passable facing
    TryFrom(spine)                              # the spine guard is never rolled away
    wanted = rng.int(TRAINERS_PER_ROOM.min, TRAINERS_PER_ROOM.max)   # one draw
    for pocket in pockets:                      # at most one more, by a pocket
        if len(chosen) >= wanted: break
        TryFrom(branch tiles within TRAINER_POCKET_RANGE of the pocket)
    while len(chosen) < wanted:                 # then anywhere the network has room
        if not TryFrom(spine + branches): break
    return chosen
```

Each `TryFrom` shuffles its pool on the `populate` stream and commits the first
candidate that keeps everything reachable: `pos = PopRandom(candidates)`,
`KeepsEverythingReachable`, then the facing — a branch tile crosses to its nearest
pocket (`ChooseCrossFacing`), a spine tile looks down the lane (`ChooseFacing`) —
plus `turns = rng.next() < SPIN_CHANCE && len(dirs) >= 2 ? dirs : null`, the entry
check and the archetype draw:

```
        if SeesEntry(pos, facing) or any(SeesEntry(pos, t) for t in turns): continue
        chosen += { pos, facing, sight, turns,
                    archetype = RandomArchetype(rng),
                    id = "trainer-<routeIndex>-<i>" }
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
probability (per band in `ROUTE_LOOT`: 50 % on the `early` on-ramp, 60 % on `low`,
75 % from `mid` on), and when it does the pocket is the
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

### 3.7 Gated vault

A room the caller asked for a **gated** vault (`RouteRequest.gate === 'sealed' |
'open'`, `docs/maps-spec.md` §7) gets one extra pass, after the terrain pass and
**before** the population pass, so no trainer and no ground item can ever stand in
the vault. It is a pure carve (`carveGatedVault`, `src/engine/routes/gate.ts`) with
no side effect beyond the two cells it returns:

```
CarveGatedVault(tiles, { seed, routeIndex, entry, reserved, sealed }):
    reached = FloodFill(tiles, entry)
    for y, x row-major, and for dir in N, E, S, W:
        N = (x, y); M = N + dir; C = N + 2*dir
        a site needs: N is FLOOR and reached, N is not reserved and not the entry,
                      M and C are WALL, M and C sit `GATE_INSET` (1) cell inside the
                      fence, M's two neighbours perpendicular to `dir` are WALL,
                      and C's other three neighbours are WALL (one way in)
    kind = GATE_KINDS[Rng(Hash(`${seed}:gate:${routeIndex}`)).int(0, 2)]
    if no site: return null, writing nothing
    (M, C) = sites[Rng(Hash(`${seed}:gate:${routeIndex}:site`)).int(0, sites.length - 1)]
    tiles[M] = sealed ? GATES[kind].tile : FLOOR     # BUSH / ROCK / WATER, never WALL
    tiles[C] = FLOOR
    return { kind, tile: M, pocket: C }
```

The whole rule is inside `RouteMap.gate`, present only when the build was asked for
one; a route built without the flag carries no `gate` key at all. Two minted,
module-local streams (**kind** and **site**, `D11`) mean the pass draws **no value**
from `streams.layout` / `streams.terrain` / `streams.populate`, so **no shipped
route of any seed moves** (pinned in `sketch.test.ts`); `sealed: false` carves the
same site with the seal gone, which is how a revisit and a reload draw the floor the
run already opened. The vault's chamber is never a `pocket` and never on the spine,
because it is a wall until this pass and the entry, the exits and every pocket are
`reserved`.

`validateRoute`'s `expectGate` (`RouteValidationOptions`) makes the vault a
condition of acceptance: with it true and no `gate` on the route, the attempt
reports `missingGate: ['no-gate']` and `sketchRoute` re-rolls, so a gated room that
the room's geometry cannot fit retries on fresh streams rather than shipping
gateless.

## 4. Validation

The shipped checklist is `validateRoute` (`src/engine/routes/validate.ts`). It
returns a report rather than throwing:

```ts
export type RouteValidation = Readonly<{
  ok: boolean;                          // gates the reroll
  unreachable: readonly string[];        // exits the entry cannot reach
  blockedByTrainers: readonly string[];  // exits reachable only through a trainer
  strandedItems: readonly string[];      // placed items not reachable from the entry
  itemsOnTerrain: readonly string[];     // placed items on TALL_GRASS or LEDGE
  spineBlocked: readonly string[];       // spine tiles that are not FLOOR
  borderBreaches: readonly string[];     // open ring tiles no opening justifies
  borderBandGaps: readonly string[];     // an opening band cell that is not a door
  missingLaneGuard: readonly string[];   // §3.4's lane guard, gated on `expectTrainers`
  missingGate: readonly string[];        // §3.7's vault, gated on `expectGate`
  unreachablePockets: readonly string[]; // REPORTED, never gated
  trainerIssues: readonly TrainerIssue[]; // pose rule failures
}>;
```

`validateRoute(route, options?)` takes the caller's `RouteValidationOptions`
(`expectTrainers?: boolean` and `expectGate?: boolean`, both default `false`). `ok`
is true exactly when the **ten** gated lists are empty: `unreachable`,
`blockedByTrainers`, `strandedItems`, `itemsOnTerrain`, `spineBlocked`,
`borderBreaches`, `borderBandGaps`, `missingLaneGuard`, `missingGate` and
`trainerIssues`. **`unreachablePockets` is not in that test**: a pocket the entry
cannot reach is a finding, not a failure, because `placeItems` may skip a pocket a
hazard sealed.

- `unreachable` / `blockedByTrainers`: the entry must reach every exit, and reach
  them again with the trainers treated as blockers, so no placement soft-locks the
  route behind an unwinnable fight.
- `strandedItems` / `itemsOnTerrain`: no placed item may sit off the entry's
  flood-fill or on `TALL_GRASS`/`LEDGE`.
- `spineBlocked`: the guaranteed lane stays `FLOOR`.
- `borderBreaches`: a ring flood-fill runs from the entry and the exits along the
  border, so a ring cell `cleanWalls` widened beside an opening is legal and a lane
  that punched through the fence elsewhere is a breach.
- `borderBandGaps`: an opening's whole band must be a door — the lane is carved
  `pathWidth` wide, so every cell of it (`openingBandCells`) must reach the ring as
  `FLOOR` and read as that opening (`exitEdgeAt`); a band cell a tidy or a hazard
  left a wall is a gap.
- `missingLaneGuard`: §3.4's lane guard, reported as `['no-trainers']` only when
  `options.expectTrainers` is true **and** the route holds no trainer, and `[]`
  otherwise — including the quiet entry/boss rooms and the callers that pass no
  archetype pool. It is a marker, not a `TrainerIssue`: a reason there needs a
  `trainerId` to attribute it to, and a trainer-free route has none.
- `missingGate`: §3.7's vault, reported as `['no-gate']` only when
  `options.expectGate` is true **and** the route carries no `gate`, and `[]`
  otherwise. Same marker rationale as `missingLaneGuard`, and `sketchRoute` passes
  it whenever the request asked for a vault.
- `unreachablePockets`: reported, never gated (see above).
- `trainerIssues`: one `TrainerIssue` per trainer that fails a pose rule, in
  `route.trainers` order, each carrying every reason it fails.

The pose rules are `TrainerIssueReason`'s seven values and nothing else:
`off-floor`, `no-backing-wall`, `on-entry`, `on-exit`, `on-pocket`, `crowded`,
`sees-entry`. `crowded` is one trainer in any of the eight tiles around another
(Chebyshev distance 1); `sees-entry` is checked on the trainer's own facing **and
on every turning facing**.

The reroll is `sketchRoute` (`src/engine/routes/sketch.ts`): it builds an attempt
on fresh streams and retries while
`!validateRoute(route, { expectTrainers: wantsTrainers(request), expectGate:
request.gate !== undefined }).ok`, up to **`MAX_ATTEMPTS = 8`** (declared at the
top of `sketch.ts`), then throws rather than return a bad map. The gate is
**conditional**: `expectTrainers` is true only for a non-quiet room the caller
passed an archetype pool for, so a quiet entry/boss room or a pool-free build is
never failed for shipping no trainer, and `expectGate` is true only for a room the
caller asked for a vault. The
attempt index is part of every stream key, so a reroll is a new deterministic map,
never a mutation of the previous one.

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
- **Guarded main lane:** a route the population pass was asked to guard (a
  non-quiet room with an archetype pool) always holds at least one trainer; a route
  that would ship none is reported (`missingLaneGuard`) and re-rolled inside
  `MAX_ATTEMPTS`.
- **Posed trainers:** each stands on floor, backed by a **solid** wall, looking
  down a passable lane, never next to another trainer and never watching the
  entry; some cycle their facing.
- **No plugging:** a trainer never cuts off a tile (lane, branch or pocket); the
  trainer-free fill keeps every reachable tile reachable (ledges/water impassable).
- **Stable ids:** `trainer-<route>-<i>`, `item-<route>-<i>`.
- **Bounds:** openings sit on the map border (gaps in the tree ring); the map size is an input (30x30 minimum; entry/boss rooms always 30x30)
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
- **O-R5 - Field gates.** Cut/Rock Smash-style **field-move** gates stay out of
  scope unless the design adopts a key/flag gate instead of an HM. A **type** gate
  (the gated reward room, `docs/maps-spec.md` §7) is not one of these: it asks the
  party's types, not a move, so it neither adopts nor closes this row.
