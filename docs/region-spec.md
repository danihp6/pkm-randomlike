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

The three rules are shipped, pure and off the RNG but for the wild's own draw, in
`src/engine/run/levelCurve.ts`:

| rule | what it answers |
| --- | --- |
| `trainerLevel(cap, gymDistance, partySize)` | a regular trainer member: `floor(cap − gymDistance × TRAINER_SIZE_FACTOR[partySize])`, floored again into `1..cap`, so a party at `gymDistance` 0 **is** the cap and every step back costs that size's factor |
| `wildLevel(squadLevel, rng)` | a wild: `WILD_LEVEL_FRACTION`'s 60-75 % of the squad's level, floored, never below 2, off one `next()` of the caller's `encounters` stream |
| `leaderLevel(cap)` | a gym leader, the Elite Four and the Champion: the cap itself, floored, never below 1 |

`TRAINER_SIZE_FACTOR` is `src/data/trainerLevels.ts`'s new table — `1 → 1`, `2 → 0.9`,
`3 → 0.8`, read through `trainerSizeFactor(size)` which clamps the size into `1..3` — so
a step back from the gym costs a bigger party more levels. `bandForNode(node)` turns the
anchor into the band a node reads for its species pool and roster size: the **previous**
stretch's cap (`LEVEL_BANDS[0].minLevel` for badge 1) up to this node's own `cap`, off
the archetype row `bandForLevel` picks for that minimum — the same shape `bandForMap`
has for a floor. A trainer roster posts on a node through `RosterOptions.node`, which
runs `trainerLevel` off it and takes no level draw, exactly as `levelFor` does.

The fights themselves are data, and neither table restates a cap. `src/data/gyms.ts`
holds `GYMS`, one row per badge — its `leaderId` (a `LEADER_IDENTITIES` row in
`src/data/trainers.ts`, the leader's name and class), the route `archetypeId` it borrows
its sprite, AI flags and money base from, its `partySize` or gym 1's fixed three, the
tenth-of-a-chance double battle, the `tmItemId` the badge pays and its
`moneyMultiplier` — and `gymForBadge(badge)` reads the ladder. `src/data/league.ts`
holds `LEAGUE`, the four Elite Four members then the Champion, every row at
`LEAGUE_LEVEL` and each with its own type theme, plus `TOWER`, the endless row behind
the Champion: no leader, no badge and no fixed party, because its streak's rung decides
the fight.

## 4. The guard, and walking back

The rule: **leaving a city needs its badge, walking back never does, and a locked exit
names the badge it wants.** The town's exit names badge 1; an edge back, or an edge
inside the same stretch, is never a gate at all.

The predicate that answers it ships in `src/engine/run/gates.ts`, and it reads the plan,
the edge and the badge list — never a `RunState`, so a caller can ask about a walk it has
not committed to yet. `exitGate(plan, fromKey, toKey, badges)` answers an `ExitGate`, the
pair `{ badge, open }` where `open` is whether `badges` holds that badge, or `null` when
the edge is not a gate at all. An edge is a gate only when both of its ends are nodes of
the plan, `toKey` is one of `fromKey`'s `edges`, `fromKey` is a `city`, and `toKey` is the
**next node on the main chain**: walking back asks the previous chain node, so it is not
forward, and a lateral is off the `chain` entirely, so both directions of every lateral
edge answer `null`. A city's gate asks for `city.badge` — the very badge that city's gym
hands over — so no stretch can be skipped. `nextBadge(plan, key)` is the gym badge a node's
way forward asks for: the stretch's own badge for the town, a city, a route and a lateral
(the town's node carries badge 1, so `nextBadge(plan, plan.townKey)` is 1), and `null` once
no gym is ahead of it, which is every node of badge 9: `BADGE_CAPS.length + 1`, where the
gyms stop. Both functions are pure and total — no RNG, no clock, no DOM, and an unknown
key or a `toKey` that is not a neighbour answers `null` instead of throwing.

The town's door is the prologue's, not the guard's: `exitGate` answers `null` for the
town's forward edge because the town has no badge to win, and that door stays shut until
the starter is taken (`canLeaveTown`, the prologue's own task). Badge-gating the town
would deadlock every run at its first step. `nextBadge(plan, plan.townKey)` still answers
1, because badge 1 is the badge that way forward names.

## 5. The map and flying

The region map is the **DOM straight-line graph of the plan's nodes** (`D64`): every
settlement is visible from the start, the visited ones are marked, the current one
blinks, and the routes are not clickable.

Flight is free, it happens out of battle, and it goes only to a **visited settlement**
(`D67`). A flight lands the player on that settlement's Centre door — the laboratory, in
the town — not on its spawn tile, which is where a walk in through an exit band lands.

The map half ships: the header card draws the plan's straight-line graph, every
settlement visible from the first frame, the visited ones marked and the current one
blinking (`[Task-281]`, Batch 120). The flight half ships with it: `[Task-283]`
(Batch 121) builds the travel seam in `src/engine/region/travel.ts` — `travel` walks an
exit band through `exitGate` and flies free to a visited settlement (`D67`) — and the
card's node markers dispatch it, so a press on a visited settlement flies there. The
routes stay unclickable.

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
### 7.2 The interior list

Every door a settlement emits opens onto one small indoor map the engine builds from
the door's own key — `centre`, `gym`, `lab`, `casino`, `house` or `house:<n>` with `n` a
1-based decimal. A building's inside is `INTERIOR_SIZE` tiles, a gym's is `GYM_SIZE`
(both `src/data/region.ts`); the key names the room, and the settlement it belongs to is
a second, separate key.

The room is a `FLOOR` rectangle inside a one-tile `WALL` ring with a single `DOOR` in its
bottom wall: the player arrives on that door and a step back returns them to the
settlement. A gym is four rectangles in the fixed order `entrance`, `trainer`, `puzzle`,
`leader`, walked as a 2×2 — entrance top-left, trainer top-right, puzzle bottom-right,
leader bottom-left — each in its own ring; consecutive rooms share one wall, and that
wall carries exactly one `DOOR`, so a gym's four doors are its entry plus the three inner
ones.

What stands in a room is a **slot** list: a position and a role the scene fills in, in a
fixed order per kind — `heal` then `pc` at a Centre, `professor` at the laboratory, `npc`
at a house, `cabinet` at the casino, `trainer` then `leader` at a gym. The Centre's
counter is at least three `COUNTER` cells in one straight row with the healing station
set into it. A slot is where a thing goes, never what it says: NPC identities, trainer
rosters and shop stock are content (§7.3), and the gym's puzzle is §7.4.

An interior's geometry comes off the `layout` stream of the city node's sub-key,
`<cityKey>/<interiorKey>` (`D60`), so no two interiors of a region share a stream, none
of them moves when another is built, and the city's own draws never touch one. The
`content`, `encounters` and `loot` passes are left free for a later task.

### 7.3 Node content

`planNodeContent(plan, key, tier)` (`src/engine/region/content.ts`) answers the `NodeContent`
a node holds: `npcs` and `specials`, each a list of `{ npcId }`; `poi`, a `PoiKind` on a
lateral's terminus and `null` on the main chain; `grass`; `shops`, a list of `ShopKind`; and
`trainers`, a count. It is pure and total over the plan: a key the plan holds always
resolves, one it does not is refused with `unknown node: <key>`, and the returned object is
fresh on every call.

The draws come off `nodeStreams(seed, key).content` and off nothing else, in **one fixed
order** — the generic NPC count, each generic id, the special count, each special id, the
trainer count, the POI kind **last** — so a later pass may append a draw without moving an
earlier one (`D60`), and walking back into a node replays it exactly (`D11`). A kind that
holds none of a row takes no draw for it, so the town, the Victory Road, the League and the
tower leave the stream where the previous row left it.

| field | rule |
| --- | --- |
| `npcs` | a `city` draws `2..3` / `4..6` / `7..10` by its own tier — tier 1, 2, 3; every other kind is passed tier 1 and draws `2..3`, except the **town**, which stands exactly one (`NPC_ROWS[0].id`) with no draw at all |
| `specials` | a `city` draws one or two; every other kind stands none and takes no draw. The per-NPC probability is not rolled here — the row's `chance` stays `src/data/npcs.ts`'s |
| `grass` | `true` for `town`, `city`, `route` and `lateral` (the settlement's grass corner, the route's tall grass); `false` for `victory-road`, `league` and `tower`. No draw |
| `shops` | `['mart']` for a `city`, `[]` for every other kind. No draw |
| `trainers` | a `city` draws `1..2` / `2..3` / `3..4` by tier; a `route` or a `lateral` draws `2..4`; the `town`, the `victory-road`, the `league` and the `tower` post none and take no draw |
| `poi` | a node whose `lateralOf` is not `null` draws one of `POI_KINDS`; a main-chain node has `null` and takes no draw |

Both ID lists are drawn **without replacement**, in `NPC_ROWS` order, off a fresh copy of the
row ids — the generic pass and the special pass each take their own copy, so a city may offer
the same row as an NPC and as a special. `POI_KINDS` carries the nine a terminus can end on:
`vault`, `miniboss`, `trade`, `no-heal`, `static`, `secret-shop`, `banned`, `puzzle`,
`legendary`. A kind's own data — its zone, its trigger, its stock — is not this module's;
the content pass only names it.

The counts above are constants of the module until the campaign's full scale moves them into
`src/data/`; they are the only numbers a rebalance would touch, and no other pass reads them.

### 7.4 The gym's puzzle

A gym's third room is the one that asks something of the player, and what it asks comes off a
**stack** (`src/data/puzzles.ts`): `PUZZLE_STACK`, one row per puzzle with its `id`, the `room` it
fills (`'puzzle'`), the first badge whose gym may carry it (`fromBadge`), the `holes` its floor holds
and the room a wrong step drops the player into (`dropsInto`). The first row is `ice` from badge 1,
so every gym rolls the ice room today and no engine file names a puzzle's id on its own.

`planGym(plan, cityKey)` (`src/engine/region/gym/plan.ts`) answers the gym a city node holds: its four
rooms exactly as `planInterior(plan, 'gym', cityKey)` emits them, the stack row the node rolled, the
floor that row lays on the `puzzle` room and the key a solved room is remembered by. A key that
names no gym city — `nodeOf` finds none, or the node's `gym` is false — is refused with
`not a gym: <key>`. The roll is the rows `gymPuzzlesFor(badge)` keeps (`stack.ts`), one draw off the
gym's own `content` sub-key `<cityKey>/gym` (a stack of one takes no draw); the floor is planned off
`<cityKey>/gym/puzzle`, so the city's `content` pass takes the same draws before and after a gym is
planned (`D11`, `D60`).

The **ice room** (`src/engine/region/gym/ice.ts`) is the puzzle room's rect floored in three cells: a
one-cell `solid` ring on the rect's own edges, `ice` inside it and `holes` holes, each at Manhattan
distance 2 or more from the room's `doorIn` so the step that enters the room never falls. The holes
come off one Fisher–Yates shuffle of the eligible cells and nothing else is drawn; a floor too small
to hold them stays all ice with no landings, so a gym is never left unsolvable. Every hole lands on
the same cell: the centre of the rect of the room `dropsInto` names.

`slideStep(room, from, dir)` is the room's whole rule. A step crosses `ice` until a `solid` cell or
the rect's edge stops it on the last cell it entered; a `hole` ends the step where the player stood —
or on the last `ice` cell — and answers that hole's landing, with the hole itself never in the path.
The screen moves the player to the landing's room and cell; the floor fights nothing, spawns nothing
and pays nothing.

A solved gym is one mark in `RunState.pickedItems`, `gymSolvedKey(cityKey)` —
`gym-solved:<cityKey>`. `gymSolved(run, gym)` only asks whether the run carries it: the plan is
recomputed deep-equal on a revisit, so the room the player comes back to is the room they left, and
the flag is a read, never a re-roll.

## 8. The save's v28 rules and the record

`SAVE_VERSION` steps **27 → 28**, and the step does one thing: it sets the document's
`run` to `null`. A v27 (or older) document therefore decodes with its **run
discarded**, while its `settings` and its `history` survive exactly as the document
carried them (`D61`). No run data is migrated: the floors a v27 run counted no
longer mean anything.

A run stands on a **node**, not on a floor. It carries the `nodeKey` it stands on,
`visitedNodes` (every node entered, in first-entry order, starting with `nodeKey`), the
`badges` it holds (integers `1..BADGE_CAPS.length + 1`, ascending and deduplicated;
badge `n` is gym `city:n`'s) and the `capturedNodes` whose single catch is spent, and
`mapIndex`, `routeIndex`, `routeInMap` and `levelCap` stay only as the deprecated
compatibility fields the old scene still reads, all derived from the plan, until the
sweep takes them. The decoder never throws on a hand-edited key: an unknown `nodeKey`
reads as the town, a node list keeps only the keys the plan still holds, and a badge
outside the ladder is dropped. The **record** is the badge count — `RunHistoryRecord`
gains `badges`, and its deprecated `mapReached` carries the same figure for the cards
that still read it — while the tower's own streak travels beside the record as the
run's `towerStreak`, so an endless run can never inflate it (`D62`). A history row
written before v28 carries no `badges` and is dropped by the decoder.

These are the rules `[Task-276]` implements (Batch 119); the schema that ships writes the
field list.
