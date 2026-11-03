# PokeRandomLike — Region Spec

One run is one **region**, and this file is the world's source of truth. It does not
replace its neighbours: `docs/design-spec.md` stays the gameplay's, `docs/tileset-spec.md`
the art's and the tileset's, and `docs/tech-decisions.md` the `D##` log (the region's
own decisions are `D59`-`D68`). Where this file and the code disagree, the code wins and
this file is the bug.

## 1. What a region is

One run is one **region**: a procedurally named starting **town**, **eight gym cities**
in badge order, one long **main route** per stretch plus **one or two laterals**, the
**Victory Road**, the **League** and the endless **tower**. `planRegion(seed)` derives
all of it off the run seed into a `RegionPlan` whose `nodes` are `RegionNode`s, each
carrying a `RegionNodeKind` that is one of seven values, spelled as
`src/engine/region/plan.ts` spells them:

| kind | what it is |
| --- | --- |
| `town` | the starting settlement: one laboratory, one house and its patch of grass, no Centre |
| `city` | a gym city, one per badge, badges 1-8 in chain order |
| `route` | a stretch's long main route, two to four screens of one biome |
| `lateral` | one or two optional detours hanging off a `route`; it terminates |
| `victory-road` | the last gauntlet between the eighth city and the League |
| `league` | the Elite Four and the Champion, at `LEAGUE_LEVEL` |
| `tower` | the endless mode behind the Champion |

The chain is `town -> route 1 -> city 1 -> … -> route 8 -> city 8 -> victory road ->
league -> tower`: **20 nodes**, held in order in `RegionPlan.chain`. A lateral hangs off
a `route` and terminates — its only edge is its parent's key, and its parent's `edges`
names it — so it is walked into and back out of, never through. With the laterals a
region is 28 to 36 nodes.

Sizes and counts are data, in `src/data/region.ts`, and no engine file hard-codes one.
`RegionSize` is a tile-count pair, `CityTier` is one rung of the city ladder, and
`cityTierForBadge(badge)` returns the rung a badge's city is built from (`citySize(badge)`
is that rung's square):

| table | value |
| --- | --- |
| `TOWN_SIZE` | 40x40 |
| `CITY_TIERS` | tier 1, badges 1-2: 50x50, 6 buildings; tier 2, badges 3-5: 70x70, 10 buildings; tier 3, badges 6-8: 90x90, 14 buildings |
| `INTERIOR_SIZE` | 24x18 — one building's inside |
| `GYM_SIZE` | 40x40 — the gym's inside, a run of rooms |
| `ROUTE_WIDTH` | 60 tiles, with `ROUTE_HEIGHTS` 120 / 160 / 200 (two, three or four 60x40 screens) |

## 2. Identity and streams

`nodeKey(kind, id)` is the only name a piece of the world has: `<kind>:<id>`, as in
`city:3` or `route:1`. Ids are 1-based within their kind, so a region holds exactly one
`town:1`, the eight cities `city:1`-`city:8` and the eight main routes `route:1`-
`route:8`; laterals are numbered in their own kind. A `RegionNode.key` is
`nodeKey(node.kind, node.id)` and nothing else — never a running counter, never a
position. `parseNodeKey(key)` reads a key back into `{ kind, id }`, or answers `null`
when it is not a well-formed positive-id node key, and `nodeOf(plan, key)` is the node a
key names, or `undefined` when the plan holds none.

The settlements are named from the seed: `settlementNames(rng, count)` draws `Adjective
Noun` pairs off the `names` stream from `NAME_ADJECTIVES` × `NAME_NOUNS`, unique per
region and stable for a stream position and a count. A route's name is `Route <n>` out
of `routeName(n)`, numbered in chain order with the laterals counted in; the Victory
Road, the League and the tower carry the literals `Victory Road`, `League` and `Tower`.

The stream family is one stream for the region and four per node:

| stream | key |
| --- | --- |
| the region's | `${seed}:region`, out of `regionStream(seed)` |
| its two passes | `plan` (the topology) and `names` (the settlements), split off the region's stream by `planRegion` |
| a node's four | `${seed}:node:<key>:layout`, `…:content`, `…:encounters`, `…:loot`, out of `nodeStreams(seed, key)` |

`NodeStreams` is that quadruple — `layout` carves the map, `content` places what it
holds, `encounters` rolls its wilds and `loot` its ground items — and `NodeStreamPass`
names one of the four.

Two consequences follow, and both are the point of the family:

- **No node's stream depends on how many nodes precede it.** A node replays alone when
  it is walked back into, and appending a node cannot move another node's draws (`D11`).
- **The old global route prefix is retired.** `routeIndexForRoom`'s running sum of every
  earlier floor's room count is what made a room's stream move when a floor grew; a
  node's stream is keyed by its own `nodeKey`, so nothing of the kind can happen again.

The plan, the names and the streams are the three modules of the folder:
`src/engine/region/plan.ts`, `src/engine/region/names.ts` and
`src/engine/region/streams.ts`, re-exported by the barrel
`src/engine/region/index.ts`. The three generators each own a folder beside them —
`src/engine/region/route/` for a long route, `src/engine/region/city/` for a settlement
and `src/engine/region/interior/` for a building's inside — and each reads its node's
streams and its node's edges, nothing else.

## 3. The badge ladder and the caps

Eight gyms, one badge each, in chain order: `city:1` holds badge 1 and `city:8` badge 8,
and the chain is walked in badge order. `BADGE_CAPS` is the ladder — **9, 16, 23, 30,
37, 43, 49, 55** — one cap per badge, and `badgeCap(badge)` reads it. Badge 9 is
`BADGE_CAPS.length + 1` and is not a gym: the Victory Road, the League and the tower
share it, and its cap is `LEAGUE_LEVEL` = **60**.

`RegionNode.cap` is `badgeCap(node.badge)`, so every node of a stretch carries its
stretch's number and no other. The cap is the only **level anchor** (`D29`): no node
stores a level range, and the level rules read the cap, the node's distance to its gym
and the party's size. `gymDistance` is the number of main-chain steps to the gym that
closes the stretch — 0 exactly at a gym, one more per step back, and one step off its
route for a lateral. Past the eighth gym there is no gym left, so the count keeps rising
from that gym: the Victory Road is 1, the League 2 and the tower 3.

## 4. The guard, and walking back

The rule: **leaving a city needs its badge, walking back never does, and a locked exit
names the badge it wants.** The town's exit asks for badge 1; an edge back, or an edge
inside the same stretch, is never a gate at all.

The predicate that answers it — whether an edge is gated and which badge it wants
(`exitGate`, `nextBadge`) — is `[Task-278]`'s and is not shipped code: it lands in Batch
119, reads the plan, the edge and the badge list, and answers "not a gate" rather than a
gate for any edge back.

## 5. The map and flying

The region map is the **DOM straight-line graph of the plan's nodes** (`D64`): every
settlement is visible from the start, the visited ones are marked, the current one
blinks, and the routes are not clickable.

Flight is free, it happens out of battle, and it goes only to a **visited settlement**
(`D67`). A flight lands the player on that settlement's Centre door — the laboratory, in
the town — not on its spawn tile, which is where a walk in through an exit band lands.

Neither half is shipped code yet: `[Task-281]` (Batch 120) builds the map card and
`[Task-283]` (Batch 121) builds the travel seam, `travel` included, that the card's
click dispatches.

## 6. Services per settlement

A **city** has a **Pokémon Centre** (heal and PC), a shop and its **gym**. The **town**
has no Centre: it has one **laboratory** and one house. The **League** heals the party
between its battles and sells nothing.

The **laboratory** is where a run starts: no Pokémon, one starter, and the town's exit
stays shut until the starter is taken. Services are doors like any other — Batch 118's
city plan emits a door row for each of them, the Centre's, the gym's and the
laboratory's included.

## 7. What a route and a city hold

What a node holds — its NPCs, its points of interest, its grass, its shops and its
trainers — is rolled per node off that node's `content` stream by `planNodeContent`
(`[Task-277]`, Batch 119) and drawn by the scene tasks. Its subsections are written by
the tasks that ship each piece: `§7.1` the city plan, `§7.2` the interior list, `§7.3`
node content, `§7.4` the gym's puzzle, `§7.5` the city screen, `§7.6` the League and
`§7.10` the missions' schema.

### 7.1 The city plan

A settlement's whole map comes out of `planCity(plan, key)` for a `town` or a `city` node
(`src/engine/region/city/plan.ts`): a square of `citySize(badge)` for a city — 50x50,
70x70 or 90x90 — or `TOWN_SIZE` (40x40) for the town, laid out as a street grid. The map
is emitted in the engine's map values — `PATH`, `PLAZA`, `ROOF`, `DOOR`, `WALL`,
`TALL_GRASS` — never in atlas frames. A key that names anything else is refused with
`not a settlement: <key>`.

The grid is a solid wall ring around 7-tile blocks between 3-tile streets, one street every
10 tiles, centred so the leftover border is shared by the two sides. The **central block** is
the plaza and its centre tile is the **spawn**: where a walk in through an exit band lands,
while a flight lands on the Centre's door (§5). The **bottom-right block** is the **grass
corner**, its whole square `TALL_GRASS`, so a settlement rolls wild encounters with no new
rule. Every other block holds at most one building in its top-left corner — a 5x4 footprint
whose front (top) row is wall with exactly one door and whose other three rows are roof —
and the lots left over stay solid wall. The tile north of a door is a street, so every door
opens onto pavement.

The kinds fill in this order: the **Centre** (a city only), the **gym** (a city only, and
only when the node carries one), the **laboratory**, the **casino** (a city from badge 3),
then houses. A city fills `cityTierForBadge(badge).buildings` of them — 6, 10 or 14 — and
the town holds exactly the two §6 gives it, one laboratory and one house, with no Centre,
gym or casino. Each door names the interior behind it, city-relative and stable across a
rebuild: `centre`, `gym`, `lab`, `casino`, or `house:<n>` numbered 1.. from the first house
when the settlement holds more than one — and `house`, unsuffixed, for the town's single
one. The interior generator parses that string and takes the city key separately.

One **exit band** per neighbour, three tiles wide and two deep, opens on the border edge
the plan implies: the dominant axis of the neighbour's position less the node's, ties going
to the horizontal (`|dx| >= |dy|` picks east or west, otherwise south or north). A band
rides a street and is joined to the grid by a straight run, so a walk in reaches the spawn;
a band is never a gate — walking back never needs a badge (§4).

The generator is deterministic and reads **only** `nodeStreams(seed, key).layout`, in one
fixed order: the buildings' lots are shuffled once, then each door's column in placement
order, and nothing else. The content, encounter and loot passes can therefore layer onto
the same node without moving a wall (`D11`, `D60`).

## 8. The save's v28 rules and the record

`SAVE_VERSION` steps **27 → 28 with no migration**. An older document decodes with its
**run discarded**, while the settings and the history survive untouched; no migration
code exists because there is nothing in production to migrate (`D61`).

A run stands on a **node**, not on a floor. It carries `nodeKey`, `visitedNodes`,
`badges` and `capturedNodes`, and `mapIndex`, `routeIndex` and `routeInMap` stay only as
the deprecated compatibility fields the old scene still reads, all derived from the plan,
until the sweep takes them. The **record** is the badge count, and the tower's streak is
tracked apart from it (`D62`), so an endless run can never inflate the record.

These are the rules `[Task-276]` implements (Batch 119); the schema that ships writes the
field list.
