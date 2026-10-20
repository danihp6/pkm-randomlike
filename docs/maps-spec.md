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
> readout), the **special rooms in the plan** (the guaranteed shop, the mini-boss
> and the mega-stone leaves) and their **own content** (the Mart panel at the shop
> counter, the mini-boss's reward choice and the mega-stone treasure) have all
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
       + a few special rooms (shop, mini-boss, mega-stone)
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
    #    dead-end leaf, so the boss has a single door and the floor keeps its cycle.
    #    Both the entry and the boss are single-door leaves.
    # 5. portal: the boss room's portal is carved on a free wall from the start and
    #    sealed until the boss falls. A fresh arrival spawns the player at the entry
    #    room's centre; walking back in through its link spawns at that door.
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

- The **boss room** is a **dead-end leaf** hung off the farthest regular room, so
  its only door is the way in (`docs/maps-spec.md` §2). It is deliberately **quiet**:
  **no tall grass, no ledges, no ground items and no regular trainers**, just the
  boss. The map's **entry room** is quiet the same way, so the run starts and ends
  each floor in a clean room.
- The boss is a fixed, themed trainer at the map's `maxLevel`, fielding a
  **fixed party of six** (`bossPartySize('boss', mapIndex)`, `src/data/bosses.ts`);
  **map 1** is the exception at **three**, because the first floor is the run's
  on-ramp.
- The portal is **carved from the start** on a free wall of the boss room and stays
  **sealed** while the boss stands, so the room looks the same before and after.
  Once the boss falls the portal opens; stepping through it advances the run to the
  next map (heal stop intact: HP/PP only, never a resurrection).
- The last map of a finite run holds the **final boss**: there is no portal, and
  beating it wins the run. Infinite mode reopens the portal forever.
- The boss room rolls its **own** battle-start condition (`BOSS_BATTLEFIELD_CHANCE`,
  `src/data/battlefields.ts`): **30%**, twice a regular room's 15% (§7). It is the
  floor's headline fight, so it is likelier to begin under a weather, a terrain or a
  field condition.

## 7. Special rooms & the economy (D33)

Beyond its K regular rooms, a floor can hold **special rooms**. They are extra
**leaves** (one door, the `dead-end` shape) and carry **only their own content** —
no tall grass, no regular trainers, no ground items. Every special leaf is tagged
`wild` by the floor's role pass (§3 step 7), so the population pass never adds a
regular trainer to one. Their content:

| Room | Per floor | Placement | Content |
| --- | --- | --- | --- |
| **shop** | exactly one, **from map 2 on** (map 1 has none) | a leaf near the entry | a counter; the interact key (`E`) opens a Pokémon-style **floating Mart card** over the route that exists only in this room; a BUY row is taken by dragging it onto the bag or a living member, a SELL row by a click |
| **mini-boss** | medium chance | a leaf anywhere | one strong trainer fielding a **fixed party of three** (**two** on map 1, `bossPartySize('miniboss', mapIndex)`); beating it offers **one floating window of six rows** — three **items** from the map's reward pool and three **Pokémon it presents only by their highest stat and their nature** (`ATTACK · Adamant`), never by name, sprite, types or moves — each row taken by dragging it onto the bag or the party, with no keyboard path |
| **mega-stone** | low chance, **from map 3 onward** | a leaf anywhere | one random **Mega Stone** item |
| **casino** | 30 % chance, **from map 2 onward** | a leaf anywhere | a **slot machine** counter with a Team Rocket grunt beside it; the interact key (`E`) opens the machine's own window, where one **spin** costs the floor band's price (`CASINO.price`, `src/data/casino.ts`) and pays an item, an **Egg** or the fight against the grunt |
| **gated** | 20 % chance, **from map 3 onward** | a leaf anywhere | one **vault** sealed by a **bush**, a **rock** or a **pond**; the interact key opens it when a party member has the obstacle's **type** — Bug or Grass / Rock or Fighting / Water — and the reward inside is one ground item |
| **trade** | 20 % chance, **from map 3 onward** | a leaf anywhere | a counter; the interact key (`E`) opens the room's own window, which lists the **party** and one `LEAVE` row. Giving a member away rolls **one random Pokémon on acceptance** (never previewed) and places it in the party at the **squad's level**; one trade per room, and refused on a single-member party |
| **no-heal** | 20 % chance, **from map 3 onward** | a leaf anywhere | one `psychic` trainer; **every battle that starts in the room** refuses the **player's** Bag and healing moves (`docs/battle-spec.md` §2) |

Specials count **outside** K (`K` regular rooms + the specials), are rolled on
the same `map` stream, and are discovered like any room: they appear on the
minimap only once **entered**, with their own icon. The shop is guaranteed **from
map 2 on** — map 1 is the run's on-ramp, with no money for a counter and already a
10-ball pack, so its floor hangs no shop leaf at all; the **mini-boss** leaf rolls
with a **50%** chance, the **mega-stone** leaf with **15%** (only **from map 3
onward**), the **casino** leaf with **30%** (only **from map 2 onward**), the
**gated** leaf with **20%** (only **from map 3 onward**), the **trade** leaf with
**20%** (only **from map 3 onward**) and the **no-heal** leaf with **20%** (only
**from map 3 onward**), and any of them may coincide on the same floor. The
casino's draw, then the **gated** leaf's, then the **trade** leaf's and then the
**no-heal** leaf's are the **last** statements of the special pass, in that order,
so no floor's shop, mini-boss, mega-stone, casino, gated leaf, trade leaf, room id
or room size moved when any of them shipped.

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
source, and a SELL row still sells one unit on a click. It exists only while the
player is in the shop room (it is opened at the counter with `E` and is
unavailable anywhere else), so buying is tied to the room rather than to a menu
key.

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

### The casino (the slot machine)

The casino's counter is a **slot machine** with a **Team Rocket grunt** standing
beside it. Facing the machine with the interact key (`E`) opens the machine's own
window — a title, the run's money, two rows (`SPIN ¥<price>` and `LEAVE`) and one
message line. One **spin**:

- costs the floor band's **price**: `CASINO.price` in `src/data/casino.ts` is
  300 / 700 / 1000 / 1500 / 2000 / 2500 from the `early` to the `end` band;
- is a **battle against the grunt** with `CASINO.battleChance` (**15 %**, one rate
  for every band) **before** any prize is drawn — and that fight **locks the
  machine for the rest of the floor** (`casino-lock-<map>` in `pickedItems`), so
  the window answers "The machine is out of order." on every later attempt,
  however the battle ends;
- otherwise pays **one weighted row** of the band's prize table: a catalogue item
  (the band's potion rung, its ball, an Oran Berry, a held item, a **Nugget**) or
  the **Egg**, which carries one weight of each band's total (≈ 9 % of paying spins
  early, ≈ 12 % late).

A spin is a **pure function of the run** (`casinoSpin`, `src/ui/casino.ts`): its
stream is `Rng(hashSeed(`${seed}:casino:${mapIndex}:${n}`))`, where `n` is the
number of `casino-spin-<map>-*` marks the run already holds, so a reloaded run
continues the same sequence and no other stream in the game moves. A spin the run
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
  with `ROOM_BATTLEFIELD_CHANCE` (**15%**), the **boss room** with its own
  `BOSS_BATTLEFIELD_CHANCE` (**30%**, §6), and the map's **entry room** and every
  **special leaf** (shop, mini-boss, mega-stone, casino) are **quiet** — they roll
  none.
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
- **O-M3 — Portal.** Resolved by Phase 9 step 7: the portal is **carved from the
  start** on a free wall of the boss room and stays **sealed** while the boss
  stands, so the room looks identical before and after; once the boss falls it
  opens, and stepping through it advances the run to the next map.
- **O-M4 — Special probabilities.** Resolved by the plan's special pass and the
  rooms' own content (archived in `CHANGELOG.md`), with the shop-from-map-2 rule
  landed by Batch 5d (`Task-70`): the shop is guaranteed **from map 2 on** (map 1
  hangs none), the mini-boss leaf rolls at **50%** and the mega-stone leaf at
  **15%** — the mega-stone only **from map 3 on** — and the two may coincide on one
  floor.
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
