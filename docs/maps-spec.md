# PokeRandomLike — Maps Spec

A **map** is a floor of **routes** (rooms) of one biome, laid out on a coarse
grid and joined by openings into a **closed graph** — Binding of Isaac's floors
with rooms. It is the unit of biome, level range and size, and the chain of maps
is what a run actually walks. This file is the source of truth for that layer; the
per-route geometry stays in `docs/routes-spec.md` and the `D##` decisions behind
it in `docs/tech-decisions.md` (D28–D33).

> Status: shipped. The tuning tables (`src/data/maps.ts`), the plan generator
> (`planMap`), the plan-driven route shapes and size, the per-map levels, the run's
> floor tracking, the boss/portal, the route HUD **minimap** (`src/ui/mapView.ts`),
> the **Poké Dollar economy** (trainer drops, the valuables and the bag's money
> readout), the **special rooms in the plan** (the mini-boss, mega-stone, gated,
> trade and no-heal leaves) and their **own content** (the Mart panel the merchant
> opens, the slot machine the Team Rocket NPC carries, the mini-boss's reward choice
> and the mega-stone treasure) have all
> shipped, and the Phase 9 docs/migration pass closed the phase: the algorithm
> below is what the tree runs, and every number in it is the tree's. The `D##`
> decisions behind it are D28–D33.

## 1. What a map is

A run is a chain of **maps** (floors). Each map is a small **graph of routes**
(rooms) placed on a coarse grid:

```
run  = map 1 -> map 2 -> ... -> map N            (N fixed in finite mode)

map  = a grid of K rooms joined by openings      (K random, from the map's range)
       connected, closed into at least one cycle, no dangling opening
       + a few special rooms (mini-boss, mega-stone, gated, trade, no-heal, static,
         secret-shop)
```

- One **biome** is rolled for the whole map (never the previous map's), so every
  room in it shares the tileset and the encounter table (D28). `BIOME_ORDER` is
  the pool; only `forest` exists for now, so the no-repeat rule is inert.
- One **level cap** (`cap`, `levelCapForMap`) belongs to the map: it is the player's
  ceiling and the top of the floor's band. The floor's level **window** is
  **derived** from the adjacent caps — it opens at the previous floor's cap and
  closes at this one (`levelWindowForMap`, `src/engine/run/floors.ts`, D29), so no
  per-map range is stored.
- The **room farthest from the entry** (graph distance) holds the **boss** at the
  map's `maxLevel`. Its onward opening is the **portal** to the next map (D31).
- Room **sizes** follow from a room's **shape**, scaled by the map's ceiling. The
  frozen table is the size on the **last tuned map** (map 8):

  | Shape | Width x height | Reads as |
  | --- | --- | --- |
  | `cross` | 40x40 | a square crossing |
  | `straight` | 40x40 | the older wide route, no branches |
  | `tee` | 40x48 | a T junction, slightly tall |
  | `bend` | 44x44 | an L, the widest square |
  | `corridor` | 52x30 | east-west by default |
  | `dead-end` | 30x30 | a leaf |

  A `corridor`'s long side follows its opening axis: a north-south corridor reads
  **30x52**. Every earlier map scales both sides by its own
  `size.max / MAP_MAX_ROOM_SIZE` (`56`), rounded and clamped to `[30, 56]`, so a
  map's own tuned ceiling decides how far the aspect has grown. The **entry room**,
  the **boss room** and **every special leaf** are always exactly **30x30** — the
  quiet leaves read the same on every map. Infinite maps past map 8 saturate
  `size.max` at 56 and use the frozen table unchanged. No room is ever smaller than
  **30x30** or larger than **56x56**.

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
- the **entry room** is a **single-door leaf**: it joins the floor through exactly
  one link, so it has a single exit forward. The **boss room** hangs the same way,
  off that one link, but its plan records a second opening on the wall **opposite**
  it — the `portal` — so it reads **`corridor`** while only the link is usable
  until the portal opens. The cycle lives in the rest of the floor, so a floor needs
  at least **six rooms** (the two leaves plus a four-room core, `src/data/maps.ts`).

An opening is one of:

| Opening | Where | Meaning |
| --- | --- | --- |
| **entry** | exactly one, on the entry room | the map entrance; a fresh run or a portal step spawns the player at the room's **centre** (no carved outward door) |
| **portal** | exactly one, on the boss room, on the wall opposite its link | sealed until the boss falls, then the way to the next map |
| **link** | 0–4 per room | joins two rooms; its counterpart is the neighbour's opposite link |

The **portal's edge derives from the boss room's own link** — it is
`OPPOSITE_EDGE` of it, never a fresh pick off the room's free walls — so recording
it takes no draw and a fixed seed's floor does not move. No other room carries one.

**No outward door on the entry room:** the entry is the map's origin, not a way
back off it, so the route builder leaves that wall solid and the run starts the
player in the middle of the room. The entry room's only other opening is the
single `link` that joins it to the floor, so it too is a **single-door leaf**.
Walking **back** into the entry room through that link spawns the player at the
link like any other room. Every other opening on a regular room is a `link`; the
boss room's second one is its `portal`.

**No dangling openings:** every `link` is joined to another room. A room whose
only opening is a single `link` is a **dead-end room** — a deliberate leaf, not an
exit into nothing. Dead-end rooms hold the same content as any optional room:
trainers, ground items and tall grass (`docs/routes-spec.md` §2). The `portal` is
not a `link` and never dangles: it leads to the next map, not to a room, so the
cell beyond it stays whatever the grid says.

Content is seeded per room and it **persists while the run is on the floor**: a
beaten trainer, a taken ground item and a spent capture stay spent when the room
is walked back into, and only the map advance clears them. A floor tags each of its
**regular** rooms with a population **role** (`MapRoom.role`): exactly
`trainerRoomsForMap(map)` of them are `trainers` — **2 on maps 1-2**, **3 on maps
3-5**, **4 on maps 6-8**, one more every two maps past the last row up to
`TRAINER_ROOMS_MAX = 6` (`src/data/population.ts`) — and every other room is
`wild`. A `trainers` room fields **1-2 trainers**; a `wild` room, the entry, the
boss and every special leaf field **none**. So a floor fields 1-2 trainers per
trainer room and never a wall of them, and its count no longer follows the room
size. Each room grants **one capture attempt**, spent by the room's **first wild
battle** whatever its outcome (`docs/routes-spec.md` §3); the run tracks the rooms
that spent theirs.

The **shape** of a room follows from its opening set (its count and edges):

| Openings | Shape | Reads as |
| --- | --- | --- |
| 1 (`link`) | `dead-end` | a room with one way in, the loot/exploration leaf |
| 2, opposite | `corridor` | the "pasillo": a narrow passage, no branches |
| 2, adjacent | `bend` | an L |
| 3 | `tee` | a T junction |
| 4 | `cross` | a crossing |
| 2, opposite, branchy | `straight` | the older wide route with optional branches |

A room with **no through-lane** also carries a **centre chamber**
(`docs/routes-spec.md` §2): the map's **entry room** and every `dead-end` leaf carve
one because their opening set is narrower than two doors, and the **boss room** asks
for one explicitly (`chamber: true`) — its link plus the sealed portal is otherwise
two openings. A `dead-end` no longer carves optional branches: its ground items, and
the trainer that guards them, sit in the chamber's two pockets, one at each lateral
extreme of its widest row, so a leaf reads as one room holding its hoard. The
chamber comes off the room's own `chamber` stream, so it never moves a lane the
spine already placed, and it stops at the walls instead of stamping over the border
ring, an opening band or a neighbour's door.

## 3. Composition (shipped algorithm)

Everything a map is comes from one **map stream** keyed `(seed, "map", mapIndex)`,
so a plan is a pure function of the seed and the map index (D11 / D29):

```
planMap(seed, mapIndex): MapPlan
    tuning  = mapTuning(mapIndex)                    # src/data/maps.ts
    rng     = Rng(seed : "map" : mapIndex)
    biome   = Pick(BIOME_ORDER \ { previousBiome }, rng)
    K       = RollRange(tuning.routes, rng)
    draw[i] = { w: RollRange(tuning.size, rng), h: RollRange(tuning.size, rng) }  per room
              # frozen stream: these two draws still run for every room, special
              # leaves included, but a room's size no longer comes from them

    # 1. grow the floor: the entry sits at the grid origin with a **single** door
    #    (its outward edge stays free) into a 2x2 core of four rooms, then expand
    #    from the core to adjacent free cells (one door per new room) until K rooms
    #    are placed. The core is closed into a 4-cycle, so the floor always loops
    #    without ever giving the entry a second door.
    # 2. close cycles: add a random number of extra doors (at least one) between
    #    adjacent rooms past the entry that are not already joined, so the floor
    #    closes one or more loops. No door ever touches the entry room.
    # 3. shapes: derive each room's shape from its opening set (table above) and
    #    size it from ROOM_SHAPE_SIZES scaled by the map's own ceiling:
    #    side = clamp(round(side(map 8) * tuning.size.max / MAP_MAX_ROOM_SIZE),
    #    MAP_MIN_ROOM_SIZE, MAP_MAX_ROOM_SIZE), a corridor's long side following
    #    its opening axis. The entry, boss and special leaves stay 30x30.
    # 4. boss: the farthest regular room; hang the boss room off it as an extra
    #    leaf, so its one `link` is the way in and the floor keeps its cycle.
    # 5. portal: the boss room's plan opening is the wall **opposite** its link (no
    #    draw: `OPPOSITE_EDGE` of the link), so the room reads `corridor` and keeps a
    #    single usable exit. The carve opens that door from the start on a free wall
    #    and the scene seals it until the boss falls; the room forces
    #    `RouteRequest.chamber`, because its link plus the sealed portal is otherwise
    #    two openings. A fresh arrival spawns the player at the entry room's centre;
    #    walking back in through its link spawns at that door.
    # 6. specials: hang the special rooms off the tree (see §7).
    # 7. roles: shuffle the regular rooms that are neither the entry nor the boss
    #    (one draw per candidate beyond the first, on the same stream) and tag the
    #    first `trainerRoomsForMap(map)` of them `'trainers'`; everything else is
    #    `'wild'`. Appended after every shipped draw, so no floor moves.
```

A room never exceeds four openings (its four grid neighbours); `K` stays inside
the map's range so expansion never runs out of free cells. Draws happen in a fixed
order, so a fixed-seed test is stable; an unavailable cell retries
deterministically. The role pass (step 7) is the **last** thing the stream does:
its draws sit after the no-heal leaf's, so a seed's biome, room count, topology,
ids, sizes and specials are exactly what they shipped, and only each room's
`role` is new.

## 4. Tuning tables (`src/data/maps.ts`)

| Knob | Drives |
| --- | --- |
| `cap` | the map's level cap: the player's XP/level ceiling and the top of the floor's level window |
| `routes.min` / `max` | how many rooms the map's graph holds |
| `size.min` / `max` | the map's room-size ceiling: each room's shape size (`ROOM_SHAPE_SIZES`) is scaled by `max / MAP_MAX_ROOM_SIZE`, rounded and clamped to `[30, 56]`; `min` stays 30 and the entry/boss/special leaves are pinned to 30x30 |

`MAP_TUNING` is a table per map (1..8 today) and `MAP_TUNING_STEP` grows a map
past the last row, so an infinite run keeps climbing: the **cap** steps up by
`levelStep` a map, 8 levels at a time, until it saturates at `MAP_MAX_LEVEL`. The
floor's level window is derived from the caps (`levelWindowForMap`) rather than
stored, so a row holds one level number and the window climbs with it instead of
widening on its own. The room count grows with the map as well but is capped at
`MAP_MAX_ROUTES`, so a deep floor never becomes a huge maze. Retuning is a data
edit, never a generator edit (`docs/route-generator.md` §2).

The room-size ceiling rises from 30 on maps 1-3 to **56** on map 8, and
`MAP_TUNING_STEP.sizeStep` keeps climbing `size.min` past the last row while
`size.max` saturates at `MAP_MAX_ROOM_SIZE` (56). Maps 1-4 therefore read regular
rooms at 30x30, map 6's corridor at 37x30 and map 8's corridor at 52x30
(`ROOM_SHAPE_SIZES`, `roomSizeForShape` in `src/data/maps.ts`).

## 5. Levels & the player's cap (D29)

- `levelWindowForMap(mapIndex)` is the floor's **window**: it opens at the
  **previous floor's cap** and closes at this floor's cap, and map 1 opens at the
  run's first band floor (`LEVEL_BANDS[0].minLevel`) because it has no previous cap.
  `bandForMap` reads the archetype pool from that window (`bandForLevel(window.minLevel)`)
  while the band's `minLevel`/`maxLevel` stay the window's own ends. Wild encounters
  draw their **species window** from the band the squad's own level falls in
  (`bandForLevel(squadLevel(run))`) and their **level** as a fraction of that squad
  level — `clamp(floor(squadLevel(run) × fraction), 1, cap)`, with
  `fraction ∈ [0.60, 0.75)` (`WILD_LEVEL_FRACTION`, `wildLevel`,
  `src/data/wildLevels.ts`, D11/D17 amended).
- There is no per-room **working level**: the window only picks the band, and the
  level of every route member follows the live squad (D35). A **regular trainer's**
  level is `clamp(floor(squadLevel(run) × percent[size]), 1, cap)`, with `percent`
  **1.00 / 0.90 / 0.80 / 0.70** for a party of **1 / 2 / 3 / 4** members
  (`TRAINER_LEVEL_PERCENT`, `trainerLevel`, `src/data/trainerLevels.ts`; the size is
  the floor's `trainerSize`), so a trainer scales with the live squad and the floor's
  cap is still its hard ceiling (D11/D17 amended). The **boss** is pinned to the cap
  and the **mini-boss** keeps the level draw it shipped with, because the scene
  passes no `levelFor` for those two fights.
- The **player's own cap** for the map is `levelCapForMap(mapIndex)`, 9 on the first
  floor up to 55 on the eighth (`docs/balance/route-curve.md`): XP gain clamps there,
  exactly as the per-route cap did (D9), and an evolution the cap blocked waits until
  the next map.

## 6. Boss & portal (D31)

- The **boss room** is a **two-door line** in the plan (`docs/maps-spec.md` §2): one
  `link`, the way in, plus a `portal` on the wall **opposite** it. It reads
  `corridor` and is deliberately **quiet**: **no tall grass, no ledges, no ground
  items and no regular trainers**, just the boss in the centre chamber it forces with
  `RouteRequest.chamber`. The map's **entry room** is quiet the same way, so the run
  starts and ends each floor in a clean room.
- That door is **sealed** while the boss stands: `bossRoomSealed(boss, bossDefeated)`
  (`src/engine/routes/bossRoom.ts`) refuses the step back out until the boss falls,
  and it is the **portal**, never this door, that carries the run to the next floor.
  The seal cannot soft-lock a run: the boss stands on the chamber's **middle line**,
  at the far end from the door (`bossChamberTile`), with `DEFAULT_TRAINER_SIGHT`, so
  it walks over and opens the fight on its own, and a loss in the room is a normal
  loss (`D5`).
- That door has a **sign on the approach side** (`docs/routes-spec.md` §2): the room
  that links **into** the boss room draws one static sign one tile inside that
  opening's band (`bossSign`), so it reads before the player steps through. The sign
  is solid, blocks its tile, and sits on the same cell on every visit and on a
  reload (the build reads the plan and no RNG). The interact key opens the room's NPC
  card with the one title `boss.sign` ("BOSS ROOM" / "SALA DEL JEFE"); it adds no run
  field, no save step and no stream.
- The party and the box take **one free heal** when the room is first built on a
  floor — HP and PP only, never a resurrection (`D5`) — through
  `bossRoomHeal(run, mapIndex)`, recorded as the `pickedItems` mark
  `boss-heal-<mapIndex>`. `advanceMap` clears `pickedItems`, so the next floor's boss
  room heals again, while a reload in the same room never heals twice.
- The boss is a fixed, themed trainer at the map's `maxLevel`, fielding a
  **fixed party of six** (`bossPartySize('boss', mapIndex)`, `src/data/bosses.ts`);
  **map 1** is the exception at **three**, because the first floor is the run's
  on-ramp.
- That fight is a **double battle** — two actives per side — on **25 %** of floors;
  the mini-boss's own fight rolls **10 %** (`BOSS_PARTY[kind].doubleChance`). The
  answer comes from the fight's own stream,
  `${seed}:double:<kind>:<mapIndex>:room:<roomId>`, so it is stable per floor and
  room and no other floor draw moves (D11). A one-member party on a double fight
  still degrades to the single layout (`secondActiveIndex = -1`).
- The portal is **carved from the start** on the plan's `portal` opening — the wall
  opposite the room's link — and stays **sealed** while the boss stands, so the room
  looks the same before and after. Once the boss falls the portal opens; stepping
  through it advances the run to the next map (heal stop intact: HP/PP only, never a
  resurrection).
- The last map of a finite run holds the **final boss**: there is no portal, and
  beating it wins the run. Infinite mode reopens the portal forever.
- The boss room **always** begins its battles under one of the two **openings** of
  `BOSS_OPENINGS` (`src/data/bosses.ts`), drawn by `bossOpeningRoll(seed, roomIndex)`
  on the room's own `${seed}:battlefield:<roomIndex>` stream: `endure` for the
  **run**'s opening, or `crit` for the **boss**'s. There is no chance roll and no
  quiet boss room.
- The **arena row is symmetric** by the engine's own rules: Endure leaves a lethal
  hit at 1 HP and the crit stage raises every move's ratio, on **both sides** alike,
  so the condition itself favours nobody. The **side** of an opening is its stat
  stage — the boss's lead one Speed stage down (`run`) or one Defence stage up
  (`boss`) — applied through `BattleSetup.enemyBoosts`, the only one-sided channel
  `createBattle` has.

## 7. Special rooms & the economy (D33)

Beyond its K regular rooms, a floor can hold **special rooms**. They are extra
**leaves** (one door, the `dead-end` shape) and carry **only their own content** —
no tall grass, no regular trainers, no ground items. Every special leaf is tagged
`wild` by the floor's role pass (§3 step 7), so the population pass never adds a
regular trainer to one. Their content:

| Room | Per floor | Placement | Content |
| --- | --- | --- | --- |
| **mini-boss** | medium chance | a leaf anywhere | one strong trainer fielding a **fixed party of three** (**two** on map 1, `bossPartySize('miniboss', mapIndex)`); beating it offers **one floating window of six rows** — three **items** from the map's reward pool and three **Pokémon it presents only by their highest stat and their nature** (`ATTACK · Adamant`), never by name, sprite, types or moves — each row taken by dragging it onto the bag or the party, with no keyboard path |
| **mega-stone** | low chance, **from map 3 onward** | a leaf anywhere | one random **Mega Stone** item |
| **gated** | 20 % chance, **from map 3 onward** | a leaf anywhere | one **vault** sealed by a **bush**, a **rock** or a **pond**; the interact key opens it when a party member has the obstacle's **type** — Bug or Grass / Rock or Fighting / Water — and the reward inside is one ground item |
| **trade** | 20 % chance, **from map 3 onward** | a leaf anywhere | a counter; the interact key (`E`) opens the room's own window, which lists the **party** and one `LEAVE` row. Giving a member away rolls **one random Pokémon on acceptance** (never previewed) and places it in the party at the **squad's level**; one trade per room, and refused on a single-member party |
| **no-heal** | 20 % chance, **from map 3 onward** | a leaf anywhere | one `psychic` trainer; **every battle that starts in the room** refuses the **player's** Bag and healing moves (`docs/battle-spec.md` §2) |
| **static** | 25 % chance, **from map 3 onward** | a leaf anywhere | one **vault** behind a bush, a rock or a pond, opened when a party member holds the seal's property (Bug or Grass, Rock or Fighting, or the pond's ability) and holding **one static species** at the squad's level, fought and caught like a wild |
| **secret-shop** | 20 % chance, **from map 3 onward** | a leaf anywhere | one **vault** behind a bush, a rock or a pond, opened when a party member has the obstacle's **type** (Bug or Grass / Rock or Fighting / Water); behind it a **counter** whose interact key opens the Mart card on the room's **own fixed stock** — four held items and two TMs at catalogue price |
| **banned** | 20 % chance, **from map 3 onward** | a leaf anywhere | one `blackbelt` trainer; **every battle that starts in the room** bars the party's most-used species from being sent out (`docs/battle-spec.md` §2) |
| **puzzle** | 20 % chance, **from map 2 onward** | a leaf anywhere | a row of **switches** the interact key presses in the row's own order; a wrong press resets the sequence; the solved room pays one **ground item** |

Specials count **outside** K (`K` regular rooms + the specials), are rolled on
the same `map` stream, and are discovered like any room: they appear on the
minimap only once **entered**, with their own icon. There is no shop room: the
Mart is the floor's guaranteed **merchant** special NPC's window (§ *The special
NPC*), one per floor from map 2 on. The **mini-boss** leaf rolls with a **50%**
chance, the **mega-stone** leaf with **15%** (only **from map 3 onward**), the
**gated** leaf with **20%** (only **from map 3 onward**), the **trade** leaf with
**20%** (only **from map 3 onward**), the **no-heal** leaf with **20%** (only
**from map 3 onward**), the **static** leaf with **25%** (only **from map 3
onward**) and the **secret-shop** leaf with **20%** (only **from map 3 onward**),
and any of them may coincide on the same floor. The **gated** leaf's draw, then the
**trade** leaf's and then the **no-heal** leaf's run on the `map` stream and are the
**last** statements of its special pass, in that order, so no floor's mini-boss,
mega-stone, gated leaf, trade leaf, room id or room size moves when any of them
shipped; the static leaf's `…:static-room` stream and then the secret-shop leaf's
`…:secret-shop-room` stream are the **last** draws of the pass, each **minted**
rather than taken from the `map` stream, so neither can move a floor's trainer roles
either. The puzzle leaf's `…:puzzle-room` draw is the special pass's **last** one,
after the banned leaf's own minted `…:banned-room` draw, so it moves nothing either.
The slot machine's own leaf retired with its room (`Task-117`): the Team Rocket NPC
carries the machine now (§ *The slot machine*), so no floor hangs a casino leaf and
the gated, trade and no-heal draws read the values that leaf used to take.

Every floor is also given one **mission** (`src/data/missions.ts`,
`src/engine/run/missions.ts`), drawn from the run seed on its own
`${seed}:map:<floor>:mission` stream when the floor is built, so no route, roster or
encounter the floor already rolled moves. It is judged **when the run takes the
portal**, across the whole floor: the one kind that ships, `flawless`, is met when
the floor took **no HP** out of the party and lost no member, and a casualty the
floor was entered with does not count against it. A met mission bumps the run's
`missionsCompleted` and its row pays a **fixed reward** — a `{ kind: 'room' }` row
today, consumed by the special-room tasks — so this table is where a new kind or a
new payout is written, never a branch in the scene.

The **gated** leaf is the type-gated vault (`src/data/gates.ts`,
`src/engine/routes/gate.ts`, `D47`'s room descriptor `src/scenes/rooms/gate.ts`).
Its content:

- the room holds a **one-tile vault** behind a single obstacle: a **bush**
  (Bug or Grass), a **rock** (Rock or Fighting) or a **pond** (Water). The three
  kinds are a data table; each row names the party **types** that open it, the map
  value the seal is stamped as (`BUSH`/`ROCK`/`WATER`, `src/engine/map.ts`) and the
  FRLG cell it draws. The generator carves the vault as its own pass off two minted
  streams (`${seed}:gate:${routeIndex}` for the kind, `…:site` for the site), so no
  route the floor already built moves (`docs/route-generator.md` §3.7).
- **any party member** of any one of the row's types opens it; the box is never
  asked, and a member at 0 HP counts (`partyHasType`,
  `src/engine/run/party.ts`). With none of them, the interact key prints the
  obstacle's own line and **nothing** changes.
- the opening is **permanent for the floor**: it rides `pickedItems` as
  `gate-<mapIndex>-<roomId>`, which `advanceMap` clears, so a revisit and a reload
  draw the vault the run opened and the next floor's room is sealed again.
- the reward inside is **one ordinary ground item** from the floor band's pool
  (`ROUTE_LOOT`), off its own stream
  (`${seed}:gate:${mapIndex}:${roomId}:reward`) and booked as
  `gate-loot-<mapIndex>-<roomId>`, so a moved loot table cannot move a shipped
  vault's reward. It is a **visible** item, so it blocks its own tile and is
  collected from the corridor.

The **trade** leaf (`src/engine/run/trade.ts`, `D47`'s room descriptor
`src/scenes/rooms/trade.ts`) is the one place outside a battle where a member
leaves the run **on purpose** (`docs/routes-spec.md` §6). Its content:

- the room holds a **counter**; the interact key (`E`) opens the room's own window,
  which lists the **party** in order and one `LEAVE` row. Leaving grants nothing and
  trades nothing (`LEAVE`, or `Q`/cancel, closes the window).
- the trade is **optional** and **one per room**: it is recorded as
  `trade-<mapIndex>-<roomId>` in `pickedItems`, which `advanceMap` clears, so a
  revisit and a reload answer "the trade in this room is done" and the next floor's
  room is open again.
- it is **refused while the party holds a single member**, because a trade would
  leave the run with an empty party, which `RunState` cannot represent.
- the given member leaves **at once** and is **not a loss**: no RIP entry, no
  release beat and `stats.casualties` untouched. Its level, HP and moves leave with
  it, and the squad's shared XP bar does not move.
- the received one is rolled **on acceptance** — never previewed — from
  `speciesPool(band, 'wild')` off its own stream
  (`${seed}:trade:${mapIndex}:${roomId}`), and joins at `squadLevel` through
  `adoptAtLevel` with **full HP/PP**: the catch rule it copies is the **level**, not
  the damage share. It is **not a catch** (`stats.catches`, `caughtSpecies`, `pcCatch`
  and the room's capture untouched) and lands in the party (the box would only take
  it on a full party, which the trade's own removal makes impossible).

The **shop panel** and the **mini-boss reward** are both **floating glass cards**
over the route HUD (`D45`), not modal windows: each is moved by its own header,
each closes from its own drawn ✕, and neither takes a key, a scrim or a saved
position, so the route keeps walking behind them. They are **pointer-only**:
every row is a **drag source** and a release resolves it against the shipped drop
targets — the bag panel, a living party or box member, and (for the reward's
anonymous Pokémon rows) the party panel. A row released anywhere else changes
nothing. The Mart's BUY row buys on that drop (the units land in the bag, then a
member drop spends or equips one), a BUY row the run cannot afford is not a drag
source, and a SELL row still sells one unit on a click. The card exists only while
the counter that owns it is at hand: the floor's **merchant** special NPC raises it
from his `TRADE` row (from map 2 on, in the floor's first trainer room) and the
**secret-shop** leaf raises it from its counter with `E`. It is unavailable
anywhere else, so buying stays tied to the room rather than to a menu key.

### The static-species leaf

The **static** leaf (`src/data/staticSpecies.ts`, `src/engine/routes/staticSpecies.ts`,
`D47`'s room descriptor `src/scenes/rooms/staticSpecies.ts`) is the one special room
whose prize is a **Pokémon** rather than an item. It hangs off a regular room from
**map 3 onward** with a **25%** chance, on its own
`${seed}:map:<floor>:static-room` stream, as the **last** draw of the special pass.
Its content:

- the room carves the **shipped gated vault** unchanged (`carveGatedVault`,
  `RouteRequest.gate`): one one-tile pocket behind a **bush**, a **rock** or a **pond**,
  chosen by `gateKindFor` on the same two minted streams the gated leaf uses, so no
  route or terrain the floor already built moves.
- the seal opens for a **party property**, never a field move, and the two kinds are
  data (`STATIC_GATES`, keyed by the obstacle the carve picked): a **type** row
  (Bug or Grass for the bush, Rock or Fighting for the rock) is asked through
  `partyHasType`, and the **pond** is a **feature** row asked through
  `partyHasAbility` — Water Absorb, Swift Swim or Storm Drain. The box is never asked
  and a member at 0 HP counts, exactly like the gated leaf.
- **two** records ride `pickedItems`, both cleared by `advanceMap`:
  `static-<mapIndex>-<roomId>` means the vault stays open for the floor, and
  `static-mon-<mapIndex>-<roomId>` means the species is gone for the floor. They are
  written **before** the change they describe — the opening before the rebuild, the
  species before its battle starts — so a revisit and a reload agree.
- the far side holds **one species** from `STATIC_SPECIES` (the first stage of each
  pseudo-legendary line) at `squadLevel(run)`, drawn on its own
  `…:static-species:<roomId>` stream over the list minus the evolution lines the run
  already **holds** (the party, box and rip members plus `caughtSpecies`, read
  through `wildExclusions` exactly like the grass); a filter that would empty the
  list falls back to the unfiltered list, so the room always fields a species. Its
  interact starts a **normal wild battle**
  through the scene's own wild path (`RoomHost.startWildBattle` → `startBattle`), so
  it spends the room's single capture exactly like a tall grass step and inherits the
  catch rule, the level cap and the moveset/ability roll. It is **not** drawn from the
  wild table, so `WILD_BANNED_TAGS` and `speciesPool` are untouched.

The same leaf may hold a **legendary** instead, and that variant is a **conditional
roll** on its own `…:static-variant:<roomId>` stream: it is read only when the floor
is **map 4 or later**, the run's `missionsCompleted` reads **exactly `1`** and the
floor's own mission is `flawless`, and then it is legendary with a **25%** chance. Both
facts are written by `advanceMap` alone — never `missionMet`, `hpLost` or a casualty
count — so a mid-floor HP loss, a death or a `rebuildRoom()` cannot flip a room the
run has already seen. It reads as **once per run with no new field**: the first met
mission lifts the counter to 1 and the branch closes again the moment the next floor
is cleared, so at most one floor of a run ever offers legendaries, and the species
list is `LEGENDARY_SPECIES` (an explicit data list, never `speciesPool`).

### The secret-shop leaf

The **secret-shop** leaf (`src/data/shop.ts`'s `SECRET_SHOP`,
`src/engine/routes/secretShop.ts`, `D47`'s room descriptor
`src/scenes/rooms/secretShop.ts`) is the Mart's late shelf behind the gated leaf's
own seal. It hangs off a regular room from **map 3 onward** with a **20%** chance, on
its own `${seed}:map:<floor>:secret-shop-room` stream, as the **last** draw of the
special pass. Its content:

- the room carves the **shipped gated vault** unchanged (`carveGatedVault`,
  `RouteRequest.gate`): one one-tile pocket behind a **bush**, a **rock** or a
  **pond**, chosen by `gateKindFor` on the same two minted streams the gated leaf
  uses, so no route or terrain the floor already built moves.
- the seal opens for a **party type**, never a field move: `secretShopGateOpen` is
  `partyHasType` over the obstacle's own row of `GATES` — Bug or Grass for the bush,
  Rock or Fighting for the rock, Water for the pond — so the seal's art and its rule
  can never disagree. The box is never asked and a member at 0 HP counts, exactly
  like the gated leaf. With none of them the interact key prints the obstacle's own
  `gate.locked.*` line and **nothing** changes.
- **one** record rides `pickedItems`, cleared by `advanceMap`:
  `secret-shop-<mapIndex>-<roomId>` means the vault stays open for the floor. It is
  written **before** the rebuild it describes, so a revisit and a reload draw the
  vault the run opened.
- the far side holds a **counter** on the vault's own pocket tile; its interact key
  opens the shipped **Mart card** (`openMart(host, stock)` in
  `src/scenes/rooms/shop.ts`) on the room's **own fixed shelf**: `SECRET_SHOP.held`
  then `SECRET_SHOP.tm`, one unit each at their catalogue price — four held items
  (Leftovers, Life Orb, Choice Band, Focus Sash) and two machines (TM088 Swords
  Dance, TM114 Shadow Ball). That is the late-band gear the Mart withholds, and from
  map 3 on it is the run's chance to buy it early.
- the shelf reads **no stream at all**: a run opens the same six rows on every
  floor. The card keeps the merchant's SELL tab, money line, drag, ✕ and floating
  (non-modal) behaviour, and it is keyed on the `secret-shop` cache key so a floor's
  merchant shelf and the secret one never trade rows.

### The special NPC

A **regular `trainers` room** may hold **one special NPC** — a medic, an exorcist,
a berry tree — beside the run's own rooms (`src/data/npcs.ts`,
`src/engine/routes/npcs.ts`, the card in `src/ui/npcPanel.ts`). It is a
**build-time fixture**, not part of the generated route: the entry, the boss and
every special leaf are `wild` and never carry one.

- **The guarantee** is a placement, not a roll: a row may carry
  `guaranteedFromMap`, and from that map on the floor puts the row **itself**, once,
  in its **first `trainers` room** — the lowest room id with `role: 'trainers'`
  (`firstTrainerRoom`) — whenever the scene asks about that room
  (`guaranteedNpc`). It reads no RNG and no run state, so it cannot move any other
  stream, and it is never rolled twice. The **merchant** is that row:
  `guaranteedFromMap: 1`, so **every** floor of a run holds exactly one merchant —
  the on-ramp's first floor included, selling the shipped early band's stock with
  the money the run has. Its one `TRADE` row opens the **Mart** (§7's shop panel)
  without spending the card, so the merchant answers again for the rest of the floor.
- **The roll** runs once per room build, on the room's own stream
  (`${seed}:npc:<roomId>`), so no map, route, encounter, roster or battle draw
  moves (`D11`). One draw decides presence and, on a hit, one draw picks the row:
  each row's weight is its chance × 10 000, a row whose weight is 0 is never picked,
  and the walk is the table's own order, so a higher chance is likelier and the
  table breaks ties. Two rooms never share a stream: adding a room cannot move
  another room's NPC.
- **The chance** is `clamp01(chance + floorStep × (floor − 1))`: `chance` is the
  map-1 value and `floorStep` what every later floor adds, so a row's balance lives
  in one line of the table and nowhere in the engine.
- **Eligibility** is the **party's** shape: a row may require a type, a move or an
  ability that any party member holds — a member at 0 HP counts, the box is never
  asked, and the comparison is case-insensitive (`npcRequirementMet`,
  `src/engine/run/party.ts`). A row whose gate the run fails is filtered out before
  the roll.
- **The spot** is one free tile on its own stream
  (`${seed}:npc:<roomId>:<npcId>:spot`): never the entry or its four neighbours,
  never an exit, a wall, a trainer or a visible ground item. A live NPC **blocks its
  tile** like a trainer or a visible item; it has no line of sight and never spins.
  A row whose sprite key the packed overworld atlas lacks is dropped whole — no art,
  no block and no interact.
- **The card** the interact key opens is **one modal shell** (`src/ui/npcPanel.ts`)
  for every NPC that raises one — every row but the Team Rocket grunt, whose key
  opens the machine, never a card: the row's name as its title, its greeting as one
  wrapped paragraph, its own choices in order and the shell's `LEAVE` row last (six
  choices at most; `LEAVE` and cancel both close it). The caller resolves the
  strings and wires the chosen row's effect, so the shell owns no rule and no run
  state.
- **The use record** is `npc-<mapIndex>-<roomId>-<id>` in `pickedItems`, which
  `advanceMap` clears: a greeting records nothing, only a chosen choice marks it,
  and no save field or `SAVE_VERSION` step was added. A revisit and a reload read
  the same record.

`NPC_ROWS` ships **sixteen** rows: the **merchant**, the **Team Rocket** grunt that
carries the slot machine (§ *The slot machine*), and the **six** rolled rows the
party edits need — the **tutor** (one move of `TUTOR_MOVES`), the **nature**,
**ability** and **IV** re-rolls, the **species** swap and the **sacrifice**, which
takes one whole bag stack for one of `SACRIFICE_REWARDS` — then the **four
run-modifier** rows below, then the **four item-and-battle** rows: the **medic**,
the **chef**, the **berry tree** and the **Mega Stone keeper**. A row is a rolled
row (its `chance`/`floorStep` and its optional gate) or a **guaranteed** one
(`guaranteedFromMap`, `chance: 0`); `roomNpc` never picks a zero-weight row, so a
guaranteed row is only ever placed and a row whose step has not lifted it off zero
is not rolled yet. The five edit rows and the four run-modifier rows carry 2 % on
map 1 and the sacrifice 4 %, each growing 0.5 points per floor, and the four new
rows carry 1 % growing 0.25 points, so an eligible floor puts an NPC in a trainer
room **≈26 % early and ≈68 % by map 8** (without the sacrifice: ≈22 %, then ≈61 %).
Each later NPC task adds its own row, copy and effect beside them.

The **Team Rocket grunt** is the second row that carries a room's content, after the
merchant: `chance: 0` with `floorStep: 0.03`, so it is worth **0 on map 1** (a zero
weight is never rolled) and **3 % per trainer room on map 2, rising to 21 % on map
8**; it is `repeatable`, because the machine's own `casino-spin-*`/`casino-lock-*`
marks are its record, so a revisit can spin again until the floor's lock. Because
the floor's **guaranteed merchant** already stands in the first trainer room on
every floor, the roll reads the floor's *other* trainer rooms: measured over 2 000
seeds per floor on a run that has completed no mission (so the sacrifice is gated
out), a floor holds the grunt **2.9 %** of the time on map 2, **10.9 %**
on map 3, **16.1 %** on map 4, **22.6 %** on map 5, **38.0 %** on map 6, **45.6 %**
on map 7 and **51.1 %** on map 8 — **≈1.9 floors a run** (maps 2-8) carry the
machine, against the retired 30 % leaf's ≈2.1. It raises no card: the interact key
opens the machine directly, so the row carries no `choices`; `casino.title` is the
panel's title and also the row's `greetingKey`, which is never rendered because no card
is raised, and the panel prints its own `casino.*` lines, so no new copy was added.

The **run-modifier** rows each write one fact that outlives the room, into the run's
own `RunState.modifiers` record (three of the four; the gate pays an item), and each
is one-shot per floor like the rolled member rows — its `npcUseId` mark in
`pickedItems` and `advanceMap`'s clear are what forget it:

| id | chance / step | what its one choice writes |
| --- | --- | --- |
| `exorcist` | 2 %, +0.5 pt | `modifiers.curse = true`: the **next** enemy battle starts with its lead one Attack stage down (`CURSE_ENEMY_BOOST`), and that battle spends the curse. |
| `weather-man` | 2 %, +0.5 pt | `modifiers.forcedField = { id, floorsLeft: FORCED_FIELD_FLOORS }` with a `ROOM_BATTLEFIELDS` row drawn on its own stream; it overrides the room's own rolled condition and `advanceMap` spends one floor of it. |
| `magician` | 2 %, +0.5 pt | `modifiers.nextWildType`, one id of `MAGICIAN_TYPES` drawn on its own stream; it narrows the grass to that type and the next wild encounter that actually rolls spends it. |
| `type-gate` | 2 %, +0.5 pt | `grant: { types: ['bug'], itemId: 'silverpowder' }`: a party holding a **Bug** gets one Silver Powder (a `held`, never-consumed item); without one it refuses and marks nothing. |

Their copies are `npc.exorcist.*`, `npc.weather.*`, `npc.magician.*` and
`npc.gate.*`; the three modifier draws (`${seed}:npc:<roomId>:<npcId>:field` and
`…:type`, plus `npcSpot`'s) are their own streams, so no map, encounter, roster or
battle draw moves (`D11`).

The **item-and-battle** rows pay in items or in a battle, and none of them
stores anything beyond its use mark:

| id | chance / step | what its one choice does |
| --- | --- | --- |
| `medic` | 1 %, +0.25 pt | `healParty` over the party **and** the box (HP and PP, never a resurrection and no status cure) plus the `npc-<mapIndex>-<roomId>-medic` mark in `pickedItems`: the mark is the whole record, so a second talk heals nothing, and `advanceMap`'s clear is what makes it once per floor. |
| `chef` | 1 %, +0.25 pt | `CHEF_BERRY_COUNT` (**3**) berries of `BERRY_IDS`, taken in table order, for one `chefstew` equipped on the chosen party member; the dish is a `held` row whose `boosts`/`below`/`consumed` make it one turn's buff, so it rides the member like any held item and adds no run field. |
| `berry-tree` | 1 %, +0.25 pt | `npcBerryHarvest` gives `BERRY_TREE_MIN`-`BERRY_TREE_CAP` (**1-4**) berries off `${seed}:npc:<roomId>:<npcId>:berries`; `npcTreeWild` then fields the room's own wild table off `…:wild`, buffed by `BERRY_TREE_ENEMY_BOOSTS` and carrying `noFlee`. It is a **normal wild battle**: it spends the room's capture like grass. |
| `mega-stone` | 1 %, +0.25 pt | a normal trainer battle under `npc-trainer-<mapIndex>-<roomId>-mega-stone` (the `ace` archetype, so `resolveBattle` marks `defeatedTrainers` and pays its XP and money); a **win** pays one id of `MEGA_STONE_IDS` through `addItem`, drawn on `…:prize`. It reads the list; it never mints a stone. |

Two things the table now has beyond the party gate:

- **An eligibility kind that is not a party property.** `requires` may be
  `{ kind: 'missionsCompleted', min }`, which `npcRequirementMet` answers from the
  run's own `missionsCompleted` (`src/engine/routes/npcs.ts`) and never from a
  member: the sacrifice's `min: 1` only holds on a floor the run reached after
  completing one, so a fresh run never meets it.
- **`repeatable`.** A row marked `repeatable: true` writes **no** `npcUseId` mark, so
  its answer — the merchant's card, the rocket's machine with its own
  `casino-spin-*`/`casino-lock-*` record — comes again on the same floor; a row
  without it is one-shot and carries its mark after the first successful use. The
  **merchant** and the **Team Rocket NPC** are the repeatable rows: the merchant's
  Mart and the machine's own `casino-spin-*`/`casino-lock-*` marks are the record,
  so neither needs an `npcUseId` mark.

### The no-heal room

The **no-heal** leaf (`src/data/noHeal.ts`, `D47`'s room descriptor
`src/scenes/rooms/noHeal.ts`) is the one room whose **battles** impose a rule of
their own. It hangs off a regular room from **map 3 onward** with a **20%** chance,
as the **last** draw of the special pass (after the trade leaf), so no earlier
leaf moves because of it. Its content:

- one trainer of the `psychic` archetype at the room's **farthest walkable tile**,
  under the floor's own stable id `noheal-<mapIndex>` in `defeatedTrainers`, so a
  beaten room stays beaten on a revisit and a reload finds nothing to fight;
- entering the room floats the room's **notice** through the route HUD's strip
  (`noHealRoomNotice`, `src/ui/notice.ts`, the `notice.noHealRoom` line). The room
  has **no window**: the rule surfaces through the notice and the battle menus;
- **every battle that starts in the room** — its trainer's, and a dev-opened wild —
  carries `BattleLaunch.noHeal`, which `createBattle` copies onto
  `BattleState.noHeal` and announces as the battle feed's first line.

The rule itself:

- the **player's** Bag is refused: `No items can be used in this room.` The BAG row
  is drawn disabled and the cursor skips it;
- the **player's** moves listed in `BARRED_HEALING_MOVES` (`src/data/noHeal.ts`: the
  self-heals, the effect-handled heals and the draining attacks) are refused with
  `That move cannot be used in this room.`, and drawn disabled; when a barred move
  is the fighter's **only** PP-legal move the command validates and resolves as
  **Struggle**, the same fallback as "No PP" (`docs/battle-spec.md` §2);
- **nothing else** moves: the enemy's side and its own healing moves, the AI, the
  abilities, the held items, the residual heals (Leftovers, berries, terrain, Leech
  Seed, Aqua Ring, Ingrain), the Pokevial, the PC and the map heal stop are
  untouched, and a loss in the room is a **normal loss** (`D5`).

### The banned-species room

The **banned** leaf (`src/data/bannedRoom.ts`, `D47`'s room descriptor
`src/scenes/rooms/banned.ts`) is the room whose **battles** bar the party's
**most-used species**. It hangs off a regular room from **map 3 onward** with a
**20%** chance, drawn **last of all** on its own minted
`${seed}:map:<floor>:banned-room` stream, so no floor's topology, specials, room
ids, sizes, roles or any earlier leaf moves because of it. By map 3 a party has
fought enough battles for the counter to name somebody. Its content:

- one trainer of the ordinary `blackbelt` archetype at the room's **farthest
  walkable tile**, under the floor's own stable id `banned-<mapIndex>` in
  `defeatedTrainers`, so a beaten room stays beaten on a revisit and a reload finds
  nothing to fight. The archetype carries **no Mega**: the room already takes the
  player's best member away;
- entering the room floats the room's **notice** through the route HUD's strip
  (`bannedRoomNotice`, `src/ui/notice.ts`, the `notice.bannedRoom` line, which names
  the barred species). The room has **no window**;
- **every battle that starts in the room** — its trainer's, and a dev-opened wild —
  carries `BattleLaunch.bannedSpecies`, resolved once by `bannedSpeciesOf`
  (`src/engine/routes/bannedRoom.ts`) as the species of the **party** member with the
  highest `battlesUsed` (ties to the lowest party index, an absent counter as 0, the
  **box never read**), which `createBattle` copies onto `BattleState.bannedSpecies`
  and announces after the no-heal line.

The rule itself (`docs/battle-spec.md` §2):

- the battle opens on the first **living** member the ban does not name, so a barred
  lead is replaced before the start hooks run (in a double battle the second active
  is picked the same way);
- a switch or forced replacement into the barred species is refused with
  `That Pokémon is barred in this room.`, and its party row is drawn disabled;
- when the barred species is the **only** living off-field member the ban bends and
  it is switchable again, because a battle must always have a legal send-out. The
  enemy side is never filtered;
- the rule ends **with the battle**: the barred member is never sent out, so its HP
  and PP are untouched, it can be sent out normally in the next battle, and nothing
  about the ban is written to the run. The rule draws **no RNG at all**.

The usage counter is the run's per-member fact (`RunPokemon.battlesUsed`, save step
**21 → 22**): the post-battle fold bumps it for every player fighter the battle
fielded (`BattleState.usedFighterIds`, which the battle books on send-out), and only
those, so a bench member's counter does not move.

### The puzzle room

The **puzzle** leaf (`src/data/puzzles.ts`, `src/engine/routes/puzzle.ts`, `D47`'s
room descriptor `src/scenes/rooms/puzzle.ts`) is the one special room whose content
is a **rule the player plays** rather than a counter or a seal. It hangs off a
regular room from **map 2 onward** with a **20%** chance, drawn **last of all** on
its own minted `${seed}:map:<floor>:puzzle-room` stream, so no floor's topology,
specials, room ids, sizes, roles or any earlier leaf moves because of it. Its
content:

- the room holds a row of **switches**: `PUZZLES` rows name how many (three, then
  four from map 5 on) and the catalogue item a solve pays. The room's own layout is
  minted by `puzzleLayout` on three streams keyed by `(seed, map, room)`: `…:row`
  picks the row (one `int`), `…:sites` picks one **walkable, reachable** tile per
  switch plus the reward tile — never within one step of the room's entry, so a
  spawn can never press one — and `…:order` shuffles the slot indices into the order
  the room must be pressed in. A fixed seed's room therefore carries the same row,
  the same switch tiles, the same reward tile and the same order on every visit and
  every reload.
- the interact key on a switch **presses** it: the correct next slot advances the
  sequence, any other press sends it back to the start (the row's own
  `wrongResets`, `true` in both shipped rows) and floats the room's reset line; the
  discs show the progress — resting grey until their turn, gold once pressed.
- the completed sequence writes `puzzle-<mapIndex>-<roomId>` to the run's
  `pickedItems`, which `advanceMap` clears, and the room then places **one ordinary
  visible ground item** (`puzzle-loot-<mapIndex>-<roomId>`, its `itemId` the row's
  reward) on the room's reward tile. A revisit and a reload re-read that mark: the
  room shows no switches, and the item stands there until it is collected. Nothing
  in the grid, the trainers or the loot tables moves, and **no run field and no save
  step** is added.
- the progress of one visit lives in the descriptor's own module state, never in the
  run: leaving the room forgets a half-pressed sequence, and the **solve** is the
  only fact that survives it.

### The slot machine (the Team Rocket NPC's panel)

The machine is the **Team Rocket** special NPC's panel, not a room (`Task-117`): a
`rocket` row of `NPC_ROWS` stands in a regular trainer room like any other NPC, and
the interact key **opens the machine directly**, with **no** NPC card in between
(the merchant's card shape does not apply to this row). Its window is a cabinet
with **three reels**,
every face a drawn item of the band's table or, on the fight, the grunt's Rocket
icon. The two rows (`SPIN ¥<price>` and `LEAVE`) answer the pointer as well as the
keys, the run's money sits in the corner and one message line reports the reveal. A
spin **books** its outcome before the first frame and then reveals it — an 800 ms
spin, the reels stopping 160 ms apart — and a second press, or any pointer press on
the card, skips to the booked faces, so a reload mid-spin neither re-rolls nor
refunds. It is **modal**: it takes the keyboard while it is up, and closing it
returns the keys to the route. One **spin**:

- costs the floor band's **price**: `CASINO.price` in `src/data/casino.ts` is
  300 / 700 / 1000 / 1500 / 2000 / 2500 from the `early` to the `end` band;
- is a **battle against the grunt** with `CASINO.battleChance` (**15 %**, one rate
  for every band) **before** any prize is drawn — and that fight **locks the
  machine for the rest of the floor** (`casino-lock-<map>` in `pickedItems`), so
  the window answers "The machine is out of order." on every later attempt,
  however the battle ends;
- otherwise pays **one weighted row** of the band's prize table: a catalogue item
  (the band's potion rung, its ball, an Oran Berry, a **Nugget**) or the **Egg**,
  which carries one weight of each band's total (≈ 8 % of paying spins early,
  ≈ 12 % late). One row of every band — weight 1 — is the **grouped equipable**: it
  names no id and pays one member of `casinoHeldPool(band)` (`src/ui/casino.ts`),
  the band's own `SHOP_ROTATION` shelf in table order, without the consumables and
  the ids the engine does not model, so a newly banded held item reaches the machine
  the day the Mart bands it. `early` and `low`, whose shelves are berry-only, draw
  `mid`'s seven equipables. The grouped row's absolute chance is `0.85 × 1 / total`
  — ≈ 7.1 % / 6.5 % / 9.4 % / 12.1 % / 10.6 % / 10.6 % from `early` to `end` — and
  the `low` and `mid` rows ship **diluted** (`docs/balance/economy.md`, `## The
  casino's spin`).

The grunt the machine may serve is a **set-piece** built on the NPC's own tile under
the floor's stable id `casino-grunt-<map>` (`src/ui/rocketPanel.ts`), started through
the scene's own trainer path, so a beaten grunt cannot be fought twice on a floor and
no route trainer is appended for it.

A spin is a **pure function of the run** (`casinoSpin`, `src/ui/casino.ts`): its
stream is `Rng(hashSeed(`${seed}:casino:${mapIndex}:${n}`))`, where `n` is the
number of `casino-spin-<map>-*` marks the run already holds, so a reloaded run
continues the same sequence and no other stream in the game moves. The grouped
row's extra draw is the **last** `rng.int` of that stream, taken only when the pick
landed on it, so every other outcome draws exactly what it drew before. A spin the run
cannot afford is refused **without spending anything** and without drawing.

The **Egg** is an ordinary bag item (`kind: 'valuable'` and `price: 0`, so the Mart
neither sells nor buys it and it never appears in a sell list). It hatches on the
**floor advance**: crossing the boss room's portal runs `hatchEgg` on the advanced
run, which removes **one** Egg and places **one** member of the new floor's
`speciesPool(band, 'wild')` at the squad's level through the shipped reward path
(`addPokemon`, so a full party sends it to the box, `D7`). It is **not a catch** —
no `stats.catches`, no `caughtSpecies`, no `capturedRooms`, no `pcCatch` — and a
band whose pool resolves to nothing leaves the Egg in the bag for the next floor.

### A room's battle condition

A room's battles can begin under a **weather**, a **terrain** or a **field
condition** — dense **fog**, **Gravity**, **Trick Room**, the **radiant zone**
(every ability disabled), **Dark Aura** and **Fairy Aura** (Dark / Fairy moves
×1.33 on both sides), the **all-types change** (every fighter becomes one type),
**Endure** (a lethal hit leaves 1 HP) and **+1 crit stage** — the
`ROOM_BATTLEFIELDS` table of `src/data/battlefields.ts` (seventeen rows, each with
the overlay's `tint` and `alpha`). The condition belongs to the **room**, so
**every** battle that starts there, a wild encounter included, begins under it.

- Which room rolls, and how often: a room that fields **regular trainers** rolls one
  with `ROOM_BATTLEFIELD_CHANCE` (**15%**), the **boss room** instead **always** takes
  one of the two openings of `BOSS_OPENINGS` (`src/data/bosses.ts`, §6) — never a
  chance roll — and the map's **entry room** and every **special leaf** (mini-boss,
  mega-stone and the rest) are **quiet** — they roll none.
- One roll per room, off the run seed and the room's **stable** index
  (`routeIndexForRoom`, §9): `Rng(hashSeed(\`${seed}:battlefield:${roomIndex}\`))`,
  one draw for the chance and one for the row. It is the roll's **own** stream, so
  no other stream moves and a revisit shows the same condition.
- A seeded weather/terrain/field condition lasts its own rule's canonical duration
  (`WEATHER_TURNS`, `TERRAIN_TURNS`, `FIELD_CONDITION_TURNS`); dense fog carries no
  turn count and is a field condition, never a weather (`docs/battle-spec.md` §4).
- The six whole-field rows (radiant, Dark Aura, Fairy Aura, all-types, Endure and
  the crit stage) last the **whole battle**, carry no turn count and draw **no**
  RNG; their exact rules are `docs/battle-spec.md` §4.
- The route draws it as one **tinted filter** over the whole room, at the row's
  `tint` and `alpha`, so a conditioned room reads as such before any battle starts.
  It brings no player-facing text and no minimap marker.

### The economy (Poké Dollars)

- **Money comes only from defeating trainers.** Each trainer drops a **fixed base
  amount** (data, `src/data/trainers.ts`, per archetype/band) plus a random
  **jitter**, and the run starts with **none**. The economy is tight and fair,
  Binding of Isaac-style: every purchase is a real trade-off.
- The **shop** always stocks the same **four rows**, in this order: a **10× pack**
  of the band's own ball at **half** the catalogue price snapped to a round hundred
  (Poke / Great / Ultra Ball for 1000 / 3000 / 6000), the band's **potion rung**
  (Potion → Super Potion → Hyper Potion → Full Restore), and **two distinct held
  items** drawn from the band's weighted pool (`SHOP_ROTATION`, banded by power), at
  the catalogue `price` (`src/data/items.ts`). The band's **one TM** off `SHOP_TM`
  is appended after them at the catalogue 3000, so the counter shows **five rows**;
  a machine can therefore be bought at the counter, not only found on the ground.
  The shop **buys any sellable item** at `sellPrice`, and a bought pack resold unit
  by unit returns exactly what it cost, so the pack is never a money loop.
  **Cures and X-items are no longer sold**: every `kind: 'status'` item (Antidote,
  Full Heal, …) and every `kind: 'boost'` item (X Attack, X Defense, X Speed) has
  left the buy list, so they reach a run from **ground loot** and the **mini-boss
  reward** alone.
  Only the new **valuables** (Nugget, Big Nugget, Pearl, Big Pearl, Stardust, Star
  Piece, …) are worth real money; anything else sells for a token, so the shop is a
  sink and valuables are the way to cash out.
- **Valuables** are ordinary items added to the **ground-item loot pool**
  (`src/data/loot.ts`), so they turn up in a room's pockets and are carried to the
  shop.
- **Mega Stones** are new `held` items, one per Mega-capable species. Holding one
  lets the Pokémon **Mega Evolve once per battle** (the Mega Evolution mechanic is
  a prerequisite step, `D34`); the mega-stone room hands out one at random. The
  mini-boss's item choice draws from the map's reward pool. Its three **Pokémon
  rows** draw from the band's own wild pool (`speciesPool(band, 'wild')`) on the
  sibling stream `${seed}:reward:${mapIndex}:pokemon`, land at the squad's level
  through `addPokemon` (a full party sends them to the box) and are **not a
  catch**: no room capture is spent and `stats.catches` does not move.
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

- The plan is `planMap(seed, mapIndex)`; each room is `sketchRoute` over the
  plan's `routeForRoom(plan, roomId, routeIndex)`, with its own
  `layout` / `terrain` / `populate` streams.
- Streams are keyed by the **map and the room inside it**
  (`routeIndexForRoom(plan, roomId)`), never by the run's moving counter, wall-clock
  or player input, so revisiting a room rebuilds the same room and a seed
  reproduces the whole chain (D11).
- Adding a roll to a later step cannot shift earlier geometry because each pass
  owns its stream.

## 10. Resolved records

Every question this spec opened now has the answer the tree ships; each record
names its answer and the Phase 9 step (or the later batch) that landed it.

- **O-M1 — Floor shape.** Resolved by Phase 9 step 2 (`planMap`,
  `src/engine/maps/plan.ts`): the floor grows a single-door entry leaf into a 2x2
  core closed into a 4-cycle, then expands onto adjacent free cells; the extra
  cycle-closing doors are random with a minimum of one (up to two more), and the
  leaves are whatever the growth and the boss/special hangs produce.
- **O-M2 — Discovery.** Resolved by Phase 9 steps 6 and 8: the run tracks the
  rooms it has entered (`RunState.discoveredRooms`), a room reveals when it is
  **entered**, and a link is drawn only once **both** its ends are known.
- **O-M3 — Portal.** Resolved by Phase 9 step 7 and pinned to the plan by Task-158:
  the boss room's `portal` is a **plan opening** on the wall opposite its one `link`
  (`OPPOSITE_EDGE`, no draw), so the room reads `corridor`, its carve opens both
  doors from the start and the scene seals the portal while the boss stands — so the
  room looks identical before and after; once the boss falls it opens, and stepping
  through it advances the run to the next map. `portalEdgeFor` reads the plan's
  `portal` opening and only falls back to a free-wall pick for a plan with none.
- **O-M4 — Special probabilities.** Resolved by the plan's special pass and the
  rooms' own content (archived in `CHANGELOG.md`): the mini-boss leaf rolls at
  **50%** and the mega-stone leaf at **15%** — the mega-stone only **from map 3
  on** — and the two may coincide on one floor. The guaranteed shop leaf the
  shop-from-map-2 rule once hung (Batch 5d, `Task-70`) is **retired**: the Mart is
  the floor's guaranteed **merchant** NPC on every floor, map 1 included, so no floor
  hangs a shop room.
- **O-M5 — Money numbers.** Resolved as balance, not design: the trainer
  base/jitter, the shop's per-band core and the valuables list/prices are defaults
  in data (the economy pass, `src/data/shop.ts` / `src/data/loot.ts`) that the
  Batch 6 balance pass (`Task-09`) tunes without touching the generator.
- **O-M6 — Mega Stones.** Resolved by Phase 9 step 9 and the mega-stone room: a
  stone is a `held` item, one per Mega forme, and holding it allows a Mega
  Evolution once per battle (`D34`); every dex Mega is in
  (`src/data/dex/megas.json`, 89 formes, the hand-authored Greninja-Ash among
  them).
- **O-M7 — Finite campaign length.** Resolved by Phase 9 step 1 and Batch 5c
  (`Task-69`): a finite run walks **eight** maps (`FINITE_MAPS` in
  `src/data/maps.ts`), capping the squad at 9 → 55, one tuned row per map — a
  length decided here rather than left to the balance pass.
