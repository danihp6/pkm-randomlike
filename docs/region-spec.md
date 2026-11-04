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
`REGION_COUNTS` is the region's frozen scale, and `planRegion` reads it: **one town**
and **eight gym cities** (**nine settlements**), **eight main routes** plus **one or
two laterals per stretch** (**sixteen to twenty-four routes**), **one Victory Road**,
**one League** and **one tower** — **twenty chain nodes**, and 28 to 36 nodes with the
laterals. `RegionSize` is a tile-count pair, `CityTier` is one rung of the city ladder,
and `cityTierForBadge(badge)` returns the rung a badge's city is built from
(`citySize(badge)` is that rung's square):

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

A gym hands its badge over only from **its own city**. `grantBadge(run, badge)` —
`src/engine/run/badge.ts`, pure and off no RNG — appends the ladder's next rung and
refuses a badge that is not the city's own, one that would skip a rung or fill a gap,
and one already held, the refusals returning the very run they were given; the town, a
route and the League hand over nothing at all, because they are no gym. The number it
appends is the very number `exitGate` reads (§4), so a city's forward band opens the
moment `badges` carries it and no new gate exists for the badge.

The fights a gym fields are §3's own level rules: the leader at `leaderLevel(cap)` —
the cap itself, with a fixed party when the row names one — and a room-1 trainer at
`trainerLevel(cap, gymDistance, size)` through `trainerRoster`'s node option. The badge
pays the row's `tmItemId` and its money — the borrowed archetype's base plus half its
jitter, at the band's scale, times the row's `moneyMultiplier` — **once**: a second win
over the same leader pays no machine and no money.

Every gym fact is a run fact in a field §8 already lists. The leader and the trainers
are marked in `defeatedTrainers` as `gym-leader:<cityKey>` and
`gym-trainer:<cityKey>:<n>`, both written by `resolveBattle`'s trainer mark on the first
win; the solved room is §7.4's `gym-solved:<cityKey>` in `pickedItems`, written the
first time the player reaches the leader's room, so a revisit replays the same room and
re-pays nothing.

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

A **city** has a **Pokémon Centre**, and its Centre is the city's only place for its three
**services**: the **counter**, the **PC** and the **merchant**. The **town** has no Centre:
it has one **laboratory**, which heals on entry for free, and one house. The **League**
heals the party between its battles and sells nothing. A **route has no service at all**:
nothing between the tall grass gives HP, PP, a party edit or a shelf back.

The Centre is an interior you walk (`src/scenes/services.ts`, scene key `Centre`), opened
from a city's `centre` building like any other door, and its three services are the room's
own:

- **The counter heals.** Entering the Centre rests the **party and the box** — HP and PP
  back to full, through `serviceHeal` (`src/engine/run/heal.ts`) — and commits that run to
  the save, so the file holds the healed squad from the first frame in the room. Standing
  at the counter's healing station re-heals. The counter **never cures a status** and
  **never revives**: a member at 0 HP is gone for good (`D5`).
- **The PC is only here.** `pcFullyEditable` / `pcMemberEditable`
  (`src/engine/run/state.ts`) read one fact, `inCentre`: inside a Centre every party ↔ box
  edit is allowed, on every visit; on a route, in a gym or in any other room both
  directions are refused and a boxed member reads as locked. Reordering the party within
  itself stays free everywhere.
- **The merchant is the region's only shop.** The Centre's counter sells the city's own
  shelf, rolled once per city off `Rng(hashSeed(`${seed}:shop:${cityKey}`))` (`D11`) at the
  band its **tier** buys at (`shopBandForTier`, `src/data/shop.ts`: 1 → `early`, 2 → `mid`,
  3 → `late`), so the eight cities stock three shelves. A bought row is marked per **node**
  (`shopRowKey(nodeKey, itemId)`), so one city's sold-out row never touches another's, and
  the ball row stays endless (`SHOP_BALL_INFINITE`).

The **laboratory** is the town's own service and its free rest: a run starts there with no
Pokémon and one starter, the town's exit stays shut until the starter is taken, and the
room **heals on entry** — party and box, HP and PP, never a status and never a revival —
exactly as a Centre's counter does, because the town has no Centre. Services are doors like
any other — Batch 118's city plan emits a door row for each of them, the Centre's, the gym's
and the laboratory's included.

The prologue is one run state, not a special mode (`[Task-287]`,
`src/engine/run/prologue.ts`): `emptyRun(seed)` is an ordinary v28 run with `party: []` and
`starterTaken: false`, which `hasLivingParty` reads as **alive**, and
`takeStarter(run, speciesId, STARTER_LEVEL)` — the level is 5 — mints the one member off
the run seed (`learnsetSeed: run.seed`, id `catch-1`), sets `xp` to that level's curve,
flips `starterTaken` and adds the starting bag, **10 Poké Balls and 3 Potions**
(`STARTING_BAG`, `src/data/run.ts`), exactly once: a second press returns the same run. The
starter is **not a catch** — `stats.catches` and `caughtSpecies` are untouched — and the
town's door is the pure travel seam's refusal `reason: 'prologue'`, asked only of a walk
that starts in the town, so a flight and a walk back are never refused by it. A run with no
party is a legal save exactly while `starterTaken` is false. The room is the `Lab` scene
(`src/scenes/InteriorScene.ts`), drawn from
`planInterior(planRegion(run.seed), interiorKey, cityKey)`, and the pick inside it is the
shipped `04 Starter pick` panel.

## 7. What a route and a city hold

What a node holds — its NPCs, its points of interest, its grass, its shops and its
trainers — is rolled per node off that node's `content` stream by `planNodeContent`
(`[Task-277]`, Batch 119) and drawn by the scene tasks. Its subsections are written by
the tasks that ship each piece: `§7.1` the city plan, `§7.2` the interior list, `§7.3`
node content, `§7.4` the gym's puzzle, `§7.5` the city screen, `§7.6` the League and
`§7.10` the missions' schema, `§7.11` the tower and `§7.12` the route screen.

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

No hole ever stands on a cell `planGym` keeps clear: the puzzle room's cells in front of the
**leader's door**, which is the room's only interior neighbour. The puzzle room is the only way into
the leader's, and a slide carries the player past a cell without letting them stop on one, so a hole
on the approach would shut the last door of the gym. The shuffle still runs over the whole eligible
floor and the kept cells are only skipped while the holes are picked, so a seed whose holes never
landed there replays the floor it always had; a floor whose kept cells leave fewer sites than
`holes` falls back to the all-ice refusal above.

`slideStep(room, from, dir)` is the room's whole rule. A step crosses `ice` until a `solid` cell or
the rect's edge stops it on the last cell it entered; a `hole` ends the step where the player stood —
or on the last `ice` cell — and answers that hole's landing, with the hole itself never in the path.
The screen moves the player to the landing's room and cell; the floor fights nothing, spawns nothing
and pays nothing.

A solved gym is one mark in `RunState.pickedItems`, `gymSolvedKey(cityKey)` —
`gym-solved:<cityKey>`. `gymSolved(run, gym)` only asks whether the run carries it: the plan is
recomputed deep-equal on a revisit, so the room the player comes back to is the room they left, and
the flag is a read, never a re-roll.

### 7.5 The city screen

A settlement is a place you **walk**, drawn by `CityScene` (`src/scenes/CityScene.ts`), which
extends `WorldScene` and is registered by its own `regionSceneKey` (`City`) — no `main.ts` edit.
`create` plans the region off the run seed, takes the plan of `run.nodeKey` (`planCity`) and draws
it from the **preloaded** node (`cachedWorld` first, `preload` second), never by rebuilding the
generator; a node the plan does not hold, or a world the worker cannot resolve, is a logged no-op
on an empty camera and never a throw.

The player is the player sprite on the plan's own **spawn** — or on the arrival's spawn when the
scene was entered through a travel — one tile per step on the run's movement keys, with the
route's walk/run cadence and its walk cycle. The step rule is `isWalkable` plus `cutsCorner`
(`src/engine/map.ts`): a settlement plans no ledges, so a wall, a roof or water simply refuses the
step. Two tiles do more than walk: a **door** (`CityBuilding.door`) fades the camera once, records
the building's `interiorKey` and starts the scene `interiorSceneKey` names (`'centre' → 'Centre'`,
`'gym' → 'Gym'`, `'lab' → 'Lab'`, `'casino' → 'Casino'`, `'house:<n>' → 'House'`) with
`{ run, cityKey, interiorKey }`, and comes back in on the door tile while that scene does not exist
yet; an **exit band** tile asks `travel(plan, run, band.neighbourKey, 'walk')`, commits the run
(`persistRun`) and re-draws a settlement neighbour in place through `transitionToNode` or hands any
other kind to the scene it names (`Route` for a route or a lateral). A closed gate refuses the band
and **nothing moves**; the badge notice is the HUD's (a later pass).

The walker itself is shared, never per scene: `WorldWalker` (`src/scenes/walker.ts`) slides the
scene's own sprite one cell per step, plays the player's walk cycle and reports each landed step —
`canWalkStep` is its whole rule — so the gym and the League's interior reuse it. `RouteScene` hands
a run that starts on (or walks into) a settlement to `CityScene`, and keeps only the kinds whose
scenes do not exist yet (a route and a lateral stay; `league` is handed to `League`).

### 7.6 The League and the Champion

The League is one **node** and five fights: `src/data/league.ts`'s `LEAGUE` — the four
Elite Four members in order and the Champion last, every row at `LEAGUE_LEVEL` and each
with its own type theme. The rule that plays them is `src/engine/region/league.ts`,
pure and headless; `LeagueScene` is its screen.

`LeagueFoe` is one row resolved to the roster it fields, and `leagueFoe(plan, run,
index)` builds it: the band comes off the League node's `cap` through `bandForLevel`, so
`LEAGUE_LEVEL` answers the last band, and a plan without a `league` node reads
`LEAGUE_LEVEL` too instead of throwing. The roster is `trainerRoster` at
`row.partySize` with `levelFor` the row's own level (never a band draw), off one stream
per row, `${seed}:league:<index>`: a replay fields the same five teams and appending a
row could not move the first five (`D11`, `D60`).

A row is remembered by `leagueTrainerId(index)` — `league:<index>` — in
`RunState.defeatedTrainers`, and the run's League progress is the **prefix** of that
list (`leagueProgress`): a later row beaten on its own completes no earlier one.
`leagueNext` answers the next unbeaten index and `null` once the Champion has fallen;
`leagueWin` marks a row only when it is that one, and a repeat is a no-op;
`leagueCleared` is true only after row 5.

The League's one service is the heal between fights (§6): `leagueEnter` is the shipped
`healParty` — HP and PP back to full across the party and the box, never a status cure
and never a revival (D5) — and it returns the run untouched when nothing is missing. It
runs on entry, after every won row and once more after the Champion.

`leagueReward(foe)` is what a beaten row folds into the run: its roster's levels for the
XP, `isTrainer`, the row's `leagueTrainerId`, and the money the archetype's base and
jitter pay at the League's band — the expected value of `trainerMoney`'s roll, so no draw
is spent outside the roster stream. The Champion's `ace` base pays more than an Elite
Four row's.

The way out is the tower (`tower:1`), walked through the region's one travel seam (§5),
and it opens only once `leagueCleared(run)` is true: before the Champion the League
refuses the press and keeps the run. `LeagueScene` plays the whole chain — the entry
heal, the five fights, the exit — with no shop, no capture and no wandering, and it
registers itself through the folder registry like a city or a gym screen.

### 7.7 The city's people

A settlement is not empty. The content pass (§7.3, `planNodeContent`) decides **how many**
people it holds and **which** rows: `2..3` generic NPCs in a tier-1 city, `4..6` in a tier-2
one and `7..10` in a tier-3 one, and exactly one in the starting town. Those rows are only
names; `nodeNpcs` (`src/engine/region/npcs.ts`) turns them into bodies standing on the
settlement's own tiles, named `npc-<nodeKey>-<n>` (`npc-city:1-0`), the generic NPCs first
and the specials after them. The placement reads no draw of the content pass: it splits its
own stream off the node's `content` one (`nodeStreams(seed, key).content.split('npcs')`,
`D60`), so a later pass can neither move a person nor be moved by one.

Each **special** row the content pass offers carries its own `cityChance` in
`src/data/npcs.ts` (`SPECIAL_NPCS`, `cityChanceOf`): the merchant and the Rocket grunt are
`1`, the five member-edit rows and the sacrifice sit at `0.8`, the four run-modifier rows
at `0.75` and the four item-and-battle rows at `0.9`. One row, one stream, one draw —
`Rng(hashSeed(`${seed}:node:${key}:npc-special:${rowId}`))` — so a special's presence can
never be moved by how many people the node holds, and a generic's line can never be moved by
a special. The generic lines are one table per city tier (`GENERIC_LINES`, tier 1 for badges
1-2, tier 2 for 3-5 and tier 3 for 6-8, the bands `CITY_TIERS` uses; the town reads tier 1)
and they are drawn **after** every tile, so a line cannot move a body.

The tiles are the settlement's own: every walkable tile of `planCity`'s map, never the spawn
(a walk in lands there) and never a building's door (a step there opens the building). One
draw per person, in placement order, and the chosen tile leaves the pool, so no two people
share a tile; a settlement with fewer free tiles than people stands the ones it could place
instead of throwing. The facing is derived from the map — south when the tile below is
walkable, else north, else east, else west — and never drawn.

A person is spent **once per node**: its card writes `npc-<nodeKey>-<n>-<rowId>` (the
placement id plus the row it stands, `npcUseId`) into `RunState.pickedItems`, which is
node-scoped, so a revisit and a reload print `npc.used` and offer no choice. Two effects
resolve headless: the **medic** heals the party and the box (`healParty`, no status cure and
no revival, D5) and the **chef** trades three berries for its dish (`chefTrade`); both mark
the use. Every other special's effect belongs to its own scene — the card answers
`needs-scene` and the scene marks the use when it resolves the row. A generic NPC is
`line-only`: it prints its tier's line and offers `LEAVE`.

`CityScene` stands the people when it enters a settlement (`onNodeArrived` and its first
draw both call the pass once), draws one overworld sprite per body exactly as the route draws
a room's NPC, and opens the card on the interact key — a landed step on a person's tile opens
it before the door and exit-band rules, and the step itself is unchanged: the tile stays
walkable. For the seed `qa-288` the placements are exactly:

| node | index | id | kind | rowId | x | y |
| --- | --- | --- | --- | --- | --- | --- |
| town:1 | 0 | npc-town:1-0 | generic | merchant | 34 | 26 |
| city:1 | 0 | npc-city:1-0 | generic | rocket | 15 | 27 |
| city:1 | 1 | npc-city:1-1 | generic | species | 43 | 32 |
| city:1 | 2 | npc-city:1-2 | generic | merchant | 36 | 38 |
| city:1 | 3 | npc-city:1-3 | special | iv-judge | 36 | 35 |
| city:1 | 4 | npc-city:1-4 | special | ability | 4 | 39 |

The town's one person prints `npc.generic.tier1.3` for that seed, and the two specials
`city:1` stands are the ones whose own draw passed out of the two the content pass offered.

### 7.8 The route's points of interest

A lateral's terminus ends on one **point of interest**, and the kind it ends on is the
content pass's own draw (§7.3). What that kind *is*, is data: `src/data/pois.ts` holds one
row per `PoiKind` in `POI_ROWS`, a discriminated union read through `poiRow(kind)`, and
every row that has a retired room table under it **references** that table rather than
copying it — the vault's `GATE_KINDS`, the no-heal room's rule and its
`BARRED_HEALING_MOVES`, the banned-species row, the secret shop and the shelf its `held`
and `tm` rows make, the static's and the legendary's room and species lists, and the
puzzle stack. No odds and no counters are invented there: a `miniboss`'s presence is the
content draw itself and its roster is the trainer engine's, and a `trade`'s counter is
`src/engine/run/trade.ts`'s rule. The only geometry is `POI_ZONE_WIDTH` (7) and
`POI_ZONE_HEIGHT` (5), and the engine reads them instead of a literal.

`src/engine/region/pois.ts` answers the zone. `poiRect(route)` is the rectangle at the end
of the route's spine: the two zone sizes, and a top-left corner that centres the zone on
the spine's last tile and clamps it one tile inside the border ring, so a zone is always
walkable body and never the ring. `nodePoi(plan, key, content)` builds the one `NodePoi` a
terminus owns — its `kind`, the `row` that kind reads, the `rect` it owns, the `marker`
tile (the spine's end, clamped into the rect), the region's `gateKind` for a vault and the
`speciesId` of a static or a legendary — and refuses a key the plan does not hold with
`unknown node: <key>` and a node that is no lateral with `not a terminus: <key>`.

Three named splits of the region's stream are its whole randomness. `pois:vault` picks the
region's one seal, so every vault of a seed is sealed with the same obstacle and a second
call is the same answer (`regionVaultGate`). `pois:statics` is one Fisher–Yates shuffle of
`STATIC_SPECIES` for the whole region, and the plan's statics take the next species of it
in `plan.nodes` order; a region with more statics than species walks the shuffle by index
modulo the pool's length rather than throwing, which is the one documented order
(`regionStatics`). `pois:legendary:<key>` draws one legendary per legendary terminus. Every
content read is `planNodeContent` off a node's own `content` stream, which replays alone
and in a fixed order (`D60`), so building a POI moves no content draw of the node being
asked about and a fixed seed reproduces the same POI for ever (`D11`).

`inPoiRect`, `poiAt` and `poiBattleRules` are the reads a battle makes. Zones never
overlap, so the first zone that holds a tile is the one, and a `no-heal` zone answers
`noHeal: true` with the room's barred move ids — exactly the launch field
`src/engine/run/battleLink.ts` declares and the list `src/engine/battle/commands.ts` reads,
so a battle begun inside the zone refuses the bag without a battle-side change. Every other
zone, and a tile outside every zone, answers `noHeal: false` and no barred move.

`src/scenes/pois.ts` is the drawing half only: `poiScreenRect` and `poiMarkerPoint` turn a
rect and a marker tile into pixels at a tile size the caller hands in, and `drawPoi` paints
the zone's outline and its marker above the tile layers and returns what it created. It
owns no rule, starts nothing and registers no scene; the scene that mounts it is the
world's (`WorldScene`), which is where the zone is drawn and the rules are folded into a
launch.

### 7.9 A node's catch and its wilds

The single catch is a **node** fact, not a room's and not a floor's: the run carries
the keys whose catch is spent in `capturedNodes`, `canCapture(run)` is
`!run.capturedNodes.includes(run.nodeKey)` and `useCapture(run)` appends the key it
stands on (`src/engine/run/state.ts`). A node that holds grass — the town, a city,
a route, a lateral (§7.3) — is therefore capturable exactly once, and every room of
one node reads the same answer, so walking away from a defeat and back changes
nothing. `resolveBattle`'s capture branch is the one writer: it spends `next.nodeKey`,
the node the battle was fought on. The old per-floor `capturedRooms` stays in the
schema (§8) as a field no rule reads or writes any more, and the sweep deletes it.

A wild's level is the squad's own share, never the node's band floor: it is
`wildLevel(squadLevel(run), rng)` — 60-75 % of the squad (`WILD_LEVEL_FRACTION`),
floored — clamped into `1..node.cap`, so a wild can never stand above the cap of the
stretch it lives in (`nodeWildLevel`, `src/engine/run/levelCurve.ts`).

The roll itself is `src/engine/region/encounters.ts`. `nodeEncounterTable(node, run)`
is the node's band pool (`bandForNode`) minus the run's `wildExclusions`, so the grass
never offers a line the run holds; `NODE_ENCOUNTER_CHANCE` is the shipped
`DEFAULT_ENCOUNTER_CHANCE` (0.15) referenced, never re-literal'd; and
`rollNodeEncounter(node, run, rng, { shinyRng })` is one step: the chance, the species,
then the level, all off the `Rng` the caller hands in and nothing else (`D11`) — the
scene owns the stream and splits the shiny one, so a fixed seed replays the same grass.
The route scene feeds this module the node it resolved from `run.nodeKey`, which is
what keeps the catch rule and the wild rule from disagreeing.

### 7.10 A node's missions

The run's missions are a **stack over the node it stands on**, never a floor it once
walked (`src/engine/region/missions.ts`): every node exposes, in a fixed order, (1) its
**stretch's automatic mission** — lose no Pokémon until the leader of the badge stretch
falls — (2) the **city's fixed mission** when the node is a `city`, and (3) the **random
mission an NPC of that city offers**. A town, a route, a lateral, the Victory Road, the
League and the tower show the stretch row alone: the two city rows are a city's own.

The three scopes are `stretch`, `city` and `random`, and the catalogue behind them is
`STACK_MISSIONS` in `src/data/missions.ts` (`STRETCH_MISSION_ID`, `cityMissionFor(tier)`,
`randomMissions()`, `stackMissionsOfKind(kind)`). It sits beside the retired **floor**
table (`MISSION_TABLE`), which stays verbatim until the sweep deletes it, so no shipped
call site breaks and this section adds no row to it.

`activeMissions(run, plan)` answers the stack as `ActiveMission`s, each carrying the row's
`id`, its `scopeKey` (`stretch`, `city:<key>` or `random:<key>` — stable, and the card's
DOM hook), its `nameKey`, its `status` and its `progress`. Every status is **derived**
from facts the run already persists, so the stack adds no field to the save, no
`SAVE_VERSION` step and no write to the legacy floor path:

| row | present on | `met` when | `failed` when | `progress` |
| --- | --- | --- | --- | --- |
| `stretch` | every node | `completedMissions` holds `{ id: stretch, mapIndex: <the node's badge> }` | that progress is above 0 | `stats.casualties - floorCasualties`, at least 0 |
| `city` | a `city` node | `completedMissions` holds `{ id, mapIndex: <the city's badge> }` | never | 0 |
| `random` | a `city` node | as the city row | never | 0 |

The random row is drawn **once per city and seed** — one `int` over `randomMissions()`
from `Rng(hashSeed(`${seed}:mission:random:<nodeKey>`))` — so a revisit reads the same row
and another seed reads another. That is the stack's only draw: it touches no `plan`,
`layout`, `content` or battle stream (`D11`, `D60`).

`advanceMissions(run, event)` is the one writer of a completion. `enter-node` opens the
node's own stretch — `hpLost` 0 and `floorCasualties` pinned to `stats.casualties` — and
`travel` runs it on every accepted arrival, so the stretch row always reads the node the
run stands on (§4). `leader-fallen` records the stretch's completion and is what
`grantBadge` folds in once the badge is appended, so a badge that is refused records
nothing and a repeated badge completes nothing twice (§3). `mission-met` records any other
row. Each completion appends `{ id, mapIndex: badge }` to `completedMissions` and steps
`missionsCompleted` by one, together, as the floor path already did; an event that records
nothing returns the run **it was given**.

The HUD's **MISSIONS card** draws the stack instead of a single row
(`src/ui/hud/panels/missions/`): one row per mission, in `activeMissions`' order, each
printing `data-hud-missions-row={scopeKey}` and `data-state={status}` over the same box
math and the same six-row cap as before.

### 7.11 The tower behind the Champion

The tower is the region's one **endless** node, `tower:1`, and its rule is
`src/engine/region/tower.ts`. The plan already holds it — `planRegion` appends it after
the League — and the region map draws it with every other node, because the map is the
straight-line graph of the plan (§5), not a list of what a run has unlocked. What the
Champion opens is the **way in**: the tower's door is `towerOpen(run)`, true exactly when
`leagueCleared(run)` is, and both `LeagueScene`'s exit and `towerStep` read it. Before
the Champion there is no tower fight to ask for.

`towerStep(run, streak)` is the fight after `streak` wins: five members at
`LEAGUE_LEVEL` (60), every level forced by `levelFor`, drawn off one stream per rung —
`${seed}:tower:<rung>`, the `D60` family keyed by the rung, so a rung replays alone and
appending one cannot move an earlier rung (`D11`). The foe carries the shipped `TOWER`
row: no leader, no badge and no party table of its own. The tower is an ordinary trainer
battle with no rule the routes do not have, and `towerStep` answers `null` before the
Champion, so a streak can never stand in for the badge.

`towerWin(run, streak)` steps the run's `towerStreak` to `streak + 1` and never
backwards; `towerHeal` is the League's own heal (§6) — HP and PP across the party and
the box, never a status cure and never a revival (`D5`) — and it runs after every won
fight. `towerResolve(run, foe, won)` is the rule in one answer: a win bumps the streak
and heals, and `over` is true exactly when nobody in the party is living. A loss that
leaves a living member re-asks for the same rung: the tower never ends a run that still
has a party. `towerReward(foe)` folds the roster's levels for the XP and the fight's
`tower:<rung>` mark, and pays no Poké Dollars — the endless mode has no shop behind it.

The streak is the tower's **record** and it stays apart from the badge record (`D62`):
`RunHistoryRecord` carries it as `towerStreak` beside `badges`, the badge count is still
the record, and a row written without that figure reads `0`. The run's own `towerStreak`
already travelled the save (§8), so this adds no `SAVE_VERSION` step. `LeagueScene`
plays the tower as its own endless mode — the entry heal, the next rung off the run's own
streak, the heal after a win and the wipe that ends the run — and `RunOverScene` draws
the defeat card with the badge count and the streak. The run ends only when its party
does, so there is no victory state: every ending is the defeat card.

### 7.12 The route screen

A route node is walked as the two-to-four vertical **screens** its own plan already
generated (`docs/routes-spec.md` §1): `planRouteScreens`
(`src/engine/region/routeScreens.ts`) is the whole seam. It takes the node's one carve
(`generateRoute`) and returns, in one answer, the node's route in both shipped shapes,
one `RouteScreenPlan` per screen and the lateral's point of interest; a key that is not
a `route` or a `lateral` is refused with `not a route node: <key>` (the Victory Road, the
League and the tower have no generator yet, so no screen can enter them).

- **The screens** are contiguous row bands of the one carve, so a seam is no transition:
  a step from a screen's last row lands on the next screen's first row, and the screen
  index is re-derived from the player's row every time it is asked. Screen 0's spawn is
  the carver's `entry` — the tile `travel`'s `walkSpawn` answers too, so the seam and the
  screen cannot disagree — and every other screen spawns on the smallest column that is
  walkable on its first row **and** on the row above it, preferring the lane, so the seam
  can always be crossed.
- **Bands** belong to exactly one screen, the one holding their first cell. Pressing
  outward while standing on a band cell hands the run to `travel` (§4): the last screen's
  `S`/`E`/`W` band goes on to the next node, screen 0's `N` band goes back to the parent,
  and a lateral leaves by its only band because it has none of its own. Standing on a band
  is only true once a step has landed there (or a dev teleport placed the walker), so a
  spawn on the entry band never bounces back out.
- **Content is laid per screen** off the node's own streams (`D60`): `planNodeContent`
  counts the trainers, trainer `j` stands on screen `j % screens`, and at most one ground
  item of the node's loot band is placed per screen from screen 1 on, keyed
  `item-<key>-<i>`. **Nothing is placed on the lane, on a band or inside the lateral's POI
  zone**, which is what keeps the carver's guaranteed walkable way end to end clear. A
  screen whose only walkable cells are the lane's therefore loses its trainer slot and is
  not re-tried on another screen: that is the generator's terrain, not a lost draw.
- **The scene reads no floor.** Every value it draws and walks comes from that seam: its
  tileset is the route biome's, its grass and shiny streams are keyed by the node
  (`` `${seed}:encounters:${key}` `` and `` `${seed}:shiny:${key}` ``), its trainer roster
  by the node and the trainer, its battle seed by `hashSeed(nodeKey)`, its band by
  `bandForNode`, and a catch's detail line prints the node's badge and the screen it
  happened on. The run's three deprecated floor fields are still written by `travel` for
  the panels that read them and are read by no route code.

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
