# PokeRandomLike — Routes Spec

How a route is generated, walked and exited. The generator is pure logic in
`src/engine/routes/` and takes a seeded `Rng`.

## 1. What a route is

A rectangular tile map, sized for a single screen (no scrolling beyond the
camera follow), containing:

- a **entry** opening, where the player arrives from the previous route;
- one or more **exit** openings (the shape's far ends). Openings sit on the map
  border and punch a gap in the tree ring: the **band** the lane leaves there
  (`openingBandCells`: the seeded cell plus the cells toward `+y` on a `W`/`E`
  opening or `+x` on an `N`/`S` one, `pathWidth` cells in all) is all door, not just
  the one cell the tidy may or may not widen. They are plain floor and stepping on
  one does **not** end the route yet, so the map can be inspected without leaving
  it;
- a one-tile ring of trees/rock along the border and a solid tree interior, with
  the shape's lanes carved through it.

A route is one **room** of a **map** (a Binding of Isaac-style floor,
`docs/maps-spec.md`): all its rooms share the map's biome, level range and size
band, and a route's openings join it to its grid neighbours — leaving by one edge
enters the neighbour by the **opposite** edge. A room's shape follows from its
opening set: one opening is a **dead-end**, two opposite a **corridor** (no
branches), two adjacent a `bend`, three a T and four a crossing. The room
**farthest from the entry** holds the map **boss**, whose onward opening opens the
**portal** to the next map.

## 2. Generation pipeline

1. **Layout**: pick the carver style (`forest`, the only style for now) and its
   **shape** (`src/engine/routes/layout.ts`): where the route enters and leaves
   and how the paths connect those openings. It is currently `open`: the interior
   is filled with trees and the shape's lanes (spine and branches) are carved
   through them, leaving the one-tile tree/rock border solid. Lanes are carved at
   least two tiles wide (no one-tile lane is left) and every lane keeps a
   margin of the motif's footprint (`wallMargin`, `max(cols, minHeight)`) from the
   border, so it never carves into the `cols`-wide band the border ring belongs to
   and always leaves a strip at least a whole object tall (a bitten fence could not
   be cleaned without opening the map, and a shorter strip would be a stump with no
   trunk). The lane's **far edge**, not its anchor, is what keeps the margin: the
   spine's jittered waypoints and the hub are pulled in by `pathWidth - 1`, and
   `carveBranches` pulls its last lane cell in by `branchWidth - 1`, so a lane
   never lands a one-row stump at the border. Only an opening pierces the ring, where the corridor runs straight in
   for `margin` tiles before it may turn; the opening is aligned to its motif band,
   so the `pathWidth`-wide approach never spills into the tree in the band beside
   it, and `placeAccess` opens the opening's **whole band**
   (`openingBandCells`), so a `pathWidth`-wide lane always leaves a `pathWidth`-wide
   gap in the ring. An opening also keeps a clearance of the motif's footprint
   (`2 * cols`) from every map corner, so a corner tree is never bitten into a
   partial or one-tile piece.
2. **Wall tidy**: `cleanWalls` (`src/engine/routes/walls.ts`) removes any wall
   remnant the tileset's wall motif would draw cut off. The motif's footprint
   (`WallFootprint`, taken from the tileset's `wallPattern`) gives the width a run
   needs to show a whole object and the shortest whole-object height; a lane that
   grazes the forest leaves a one- or two-tile sliver, and a lane that bites the
   side of a tree leaves a `cols`-wide band that is no longer solid. Such a bitten
   tree is removed **whole** (its `cols`-wide row is cleared) and the rest of the
   column is then **un-stacked** (trimmed to whole objects, stubs dropped), so a
   tall wall still reads as stacked whole trees. The tree each cell belongs to is a
   fixed **global grid** of `cols`-wide bands from the map's left edge: a lane that
   falls inside a band widens to the whole band, so no mass keeps a cut tree and no
   lane is left one tile wide. The tidy only ever turns wall back into floor, so
   it can widen a lane but never block it: the entry, every exit and the spine keep
   working and the openings stay reachable. A cell on the one-tile border ring is
   only dropped to widen an opening (a lane already reaches the ring beside it), so
   the map stays fenced.
3. **Terrain pass**: `terrain` in `src/data/biomes.ts` sets how many tall grass
   patches and ledge lines a biome stamps, and those **base counts scale in tiers
   with the map size** (`MAP_SIZE_TIERS` in `src/data/mapSize.ts`): the map's
   area in tiles falls in `small` (terrain ×1), `medium` (×2) or `large` (×3), so a
   bigger route carries proportionally more terrain without the count matching the
   size pixel by pixel. Every route is at least **30x30**, so the smallest route
   lands in `medium`. Both land on the carved floor **off the spine, the openings
   (their whole band) and the pockets** (a pocket is a loot spot, kept clear for its
   item). A grass
   patch is packed **against the walls**: it first stretches across a wall-to-wall
   corridor so it
   touches a wall at both ends, but only when that gap is no wider than
   `GRASS_SPAN_MAX` (5 tiles); otherwise it falls back to a small block anchored on
   a wall, so grass never floats in open floor. A patch may also **spill onto a
   tree's walkable tip**: a tip cardinally adjacent to grass shares its cell with
   the patch (`grassTipKeys`), drawn under the crown with an encounter on stepping
   there. A ledge line is a
   whole object of at least **three tiles** — a left cap, repeated centre tiles and
   a right cap (`LedgeFrames`) — and is dropped whole rather than left as a stub
   when it cannot reach three tiles or would strand a branch behind its one-way
   drop. A run is also **pegged to a wall at one lateral end** (the tile just
   outside its left or right cap is wall), so it reads as a lip on the terrain
   instead of a rock floating in open floor. Grass is walkable; a ledge only gives
   way downward. Water is decoration (`D18`), not a terrain pass.
4. **Population (trainers + ground items)**: a route places **trainers** and
   **one item at the far end of each optional path** (a `pocket`), drawn from the
   level band's weighted loot pool (`ROUTE_LOOT` in `src/data/loot.ts`) on the
   `populate` stream. The room's **role** (`MapRoom.role`, `docs/maps-spec.md` §2)
   decides the trainers: a `wild` room places **none** and spends no draw on them,
   while a `trainers` room places **1-2** (`TRAINERS_PER_ROOM`), always including
   **one on the main lane** and a second one by an optional pocket when one takes
   it — and its first trainer may instead wear the room's **special** archetype
   (the paragraph after the special NPC's, below). The count no longer follows the
   route's size; a trainer stands on floor
   hugging a **solid** wall (never a walkable tree tip). On the **main lane** it
   looks down the lane; on an **optional path** it looks **across** it, wall to wall
   (a vertical path is watched horizontally and vice versa), so the sight closes
   the branch. Either way it looks down a **passable** line with a `sight` of 5 (a
   straight cardinal line that stops at a wall, a ledge,
   water or another trainer, though a walkable tree tip is open), and some cycle
   their facing on a timer like a
   "spinning" trainer. Placement never plugs a passage: a trainer is kept only
   while every tile the entry could reach stays reachable with the trainers as
   blockers (ledges and water count as impassable), no two trainers stand in
   neighbouring tiles, and no trainer spawns watching — or able to spin and watch —
   the player's entry tile. A pocket a hazard sealed, or that is no longer
   walkable, is skipped, so loot is never stranded. An optional path holds an item
   only with the band's `itemChance` probability (0.5 / 0.6 on the on-ramp's maps
   1-2, 0.75 from map 3 on); when it does, the
   item sits on the **deepest** tile of the branch, as far down the path as it can.
   The number of items also follows the route's **size** (a bigger map carves more
   optional paths), not its band. A pocket is kept clear of tall grass (an item
   never spawns on grass) and of ledges. Each item rolls a **hidden** flag from the
   band's `hiddenChance`; a hidden item shows a faint sparkle instead of a Poke
   Ball. Ids are stable
   (`trainer-<routeIndex>-<n>`, `item-<routeIndex>-<n>`) and the draw order is the
   deterministic `pockets` order. A **quiet** room — the map's entry room, its boss
   room and its special rooms (shop/mini-boss/mega-stone; `docs/maps-spec.md`
   §2/§6/§7) — skips the terrain and population passes
   entirely, so it holds no tall grass, ledges, items or trainers; only its lanes
   are carved.
5. **Validation pass**: `validateRoute` (`src/engine/routes/validate.ts`) reports a
   checklist instead of throwing, and its `ok` flag is what gates the reroll. It
   gates the exit flood-fill **with** the trainers in the way (`blockedByTrainers`)
   and **avoiding** them (`unreachable`) — the trainer-free fill is what guarantees
   no forced battle — plus `strandedItems` and `itemsOnTerrain` (no placed item off
   the entry's flood-fill or on tall grass or a ledge), `spineBlocked` (the
   guaranteed lane stays floor), `borderBreaches` (the ring opens only where an
   opening justifies it), `borderBandGaps` (every declared opening's whole band is
   `FLOOR` and exits, so a route the tidy left half-open is re-rolled) and
   `trainerIssues` (every pose rule in step 4 above).
   `unreachablePockets` is **reported, never gated**: a pocket the entry cannot
   reach is a finding, not a failure, because `placeItems` may skip a pocket a
   hazard sealed. A route whose `ok` is false is rerolled by `sketchRoute`
   (`src/engine/routes/sketch.ts`) on fresh streams — the attempt index is part of
   every stream key, so a reroll is a new deterministic map — up to `MAX_ATTEMPTS`
   (8), then it throws rather than return a bad map. This validation is what makes
   the generator safe to call blind.

Every build pass draws from its own `Rng` stream, all derived from
`(seed, routeIndex, attempt)` (`src/engine/routes/streams.ts`), so `(seed,
routeIndex)` fully determines the map and a reroll can never shift an earlier
attempt. Adding a roll to the terrain pass cannot move the path the layout pass
already placed.

Routes scatter **ground items** again, one per optional path (step 4 above), and
now also **trainers**: the generated map holds the carved tiles (spine, branches,
pockets and the terrain flavour), the entry, its exits, the items and the
trainers. The trainer archetypes (`src/data/trainers.ts`) and the roster builder
(`src/engine/run/roster.ts`) field a team per trainer, and the route scene draws
them, blocks their tile, freezes the player while a spotter walks over and opens
the menu battle, and hides a beaten one. The algorithm's rationale and its open
questions are in `docs/route-generator.md`.

The map size is an input: every route is at least **30x30** tiles at 24px, the
map's size range rolls each room above that floor, and the floor's **entry room**
and **boss room** are always exactly **30x30** (`docs/maps-spec.md` §1/§6). The
camera follows the player, bounded to the generated map. The whole map is visible
at once: there is no fog of war, like the originals (`D6`).

**Biome and shape.** Only the FireRed/LeafGreen **forest** biome is active
(`BIOME_ORDER = ['forest']` in `src/data/biomes.ts`), so every route uses its
tileset and encounter table. A route's **shape** — the set of openings that join
it to its grid neighbours — is a first-class generator input: the registry in
`src/engine/routes/layout.ts` defines `dead-end` (1 opening), `corridor` (2
opposite, no branches), `straight` (2 opposite, branchy), `bend` (2 adjacent),
`tee` (3) and `cross` (4), each with its `openings` (an edge and a role) and
the `links` the spine joins, and `RouteMap` carries an `entry`, a list of
`exits`, the `spine` and the optional `branches`/`pockets`.
The **biome, size and the opening set now come from the map plan**
(`docs/maps-spec.md` §2–§3), so a route no longer rolls its own shape: the plan
lays the rooms on a grid, joins them so every opening is the neighbour's opposite,
and the opening set picks the shape. Every opening is placed on its edge and the
guaranteed **spine** joins each
`links` pair with cardinal, cost-guided corridors, so a `cross` leaves three exits
and a `bend` runs an L. A multi-link shape routes every link through a shared
**central hub**, so all the openings are connected by construction. Optional
secondary paths are then carved off the **network** (the spine plus every lane
already carved, so a branch can grow off another branch, not only off the spine):
the count is the shape's base `branchCount` plus a map-size tier bonus, lanes are
**at least two tiles wide** and scale with the free space, opening into a small
**chamber** on a roomy map. The far end is the **pocket** — the loot spot.
Branches stay inside the one-tile
border. The interior is solid tree, so the carved spine, branches and pockets are
the visible lanes; the terrain pass and the population pass keep them clear and
populate them (steps 3-4). The `hedges` and `maze` carvers stay parked in
`src/engine/routes/sketch.ts` for later biomes (`D6`).

**Map passives (room entry and a win).** A party member's **ability** also acts
outside battle. `src/data/passives.ts` holds `MAP_PASSIVES`: one row per
`{ ability, trigger, effect }`, where `trigger` is `'room'` (the room is entered) or
`'win'` (a battle in the room was won) and `effect` is that row's chance plus the
catalogue ids it pays. `src/engine/run/passives.ts` is the whole rule: it reads the
**party's** abilities (the box never counts) and, for every row whose trigger matches
and whose ability the party holds, mints its own stream
`${seed}:passive:${mapIndex}:${roomId}:${ability}`, rolls the row's chance and, on a
hit, one item from the row's list, adds it with `addItem` and records
`passive-<ability>-<trigger>-<mapIndex>-<roomId>` in `pickedItems`, which
`advanceMap` clears. A room therefore pays each row **at most once per floor**: a
revisit and a reload pay nothing, the next floor pays again, and no stream the route,
the plan or the encounter tables already read moves (`D11`). The route scene calls it
once per trigger — at the end of a room transition (`transitionTo`, after the room is
rebuilt and before the HUD refresh) and after a won battle's folds
(`applyBattleResult`, before the save) — and floats the shipped
`Obtained <item>!` notice for each payment. The two shipped rows are **Pickup** (a
room entry) and **Honey Gather** (a win), the dex's out-of-battle item abilities
(`docs/battle-spec.md` §11.1). The run's first room is not a room entry: the run
begins standing in it.

**The special NPC is a per-room fixture, not a pass.** A regular `trainers` room may
hold one special NPC (`docs/maps-spec.md` §7). It is placed **when the room is
built**: the presence and row roll on the room's own `${seed}:npc:<roomId>` stream
and the standing tile on `${seed}:npc:<roomId>:<npcId>:spot`, so no layout, terrain,
population, validation or encounter stream moves and a fixed seed keeps every route
it already generated. The scene rolls it once per room build (never in `update`),
draws it as an ordinary overworld actor and blocks its tile; the interact key opens
the one NPC card. `NPC_ROWS` ships fifteen rows (`src/data/npcs.ts`): the merchant,
the five edit rows and the sacrifice, the four run-modifier rows and the four
item-and-battle rows (the medic, the chef, the berry tree and the Mega Stone
keeper).

**The special trainer is an archetype override, not a pass.** A regular `trainers`
room may hold **at most one** special trainer, never in the map's entry room, its
boss room or a special room: its **first** trainer may instead wear a set-piece
archetype (`SPECIAL_ARCHETYPES` and the `SPECIAL_TRAINER_ROWS` spawn table in
`src/data/trainers.ts`). It is placed **when the room is built**: one presence
roll and then the weighted row pick, in that order, on the room's own
`Rng(hashSeed(`${seed}:special-trainer:<roomIndex>`))` stream, where `roomIndex`
is the same stable per-room index (`routeIndexForRoom(plan, roomId)`) the room's
route is generated from. The drawn row **replaces the room's first trainer's
archetype**, keeping its `id`, tile, facing, sight and spin, so the population
count, its pose rules and the reachability guard are untouched and the body is
never added twice: a `trainers` room still fields 1-2 trainers. Three rows ship —
the **ninja** (0.1), the **Impostor** trainer (0.08) and the **secret battle**
(0.2, gated on `RunState.missionsCompleted >= 1`, so it only joins the draw once
the run has met a floor mission) — so a `trainers` room has an **18 %** chance of a
special trainer before that first mission and **38 %** after it. The ninja's
`sightMode: 'invisible'` hides **only its sprite** while the player is more than
one tile away; its line of sight is unchanged, so it still spots the player and
opens the battle, and the sprite is re-painted after every step, every room
rebuild and the debug teleport (and forced on screen the moment it starts its
chase). The Impostor's `forcedAbility: 'Imposter'` is stamped on **every member of
its roster** and bypasses the run's ability roll, and its `reward` pays one
**Ability Shield** with the first win, through `addItem` and only on the win that
marks the trainer beaten. The roll reads its own stream, so no layout, terrain,
populate, item, validation or encounter stream moves and a fixed seed keeps every
route it already generated.

**A special leaf's own content is placed by its room descriptor, not by a pass.** A
leaf that needs no new tile value and no second carve — the **puzzle** room's row of
switches and the ground item its solve pays — is laid out **when the room is built**,
by the descriptor (`src/scenes/rooms/puzzle.ts`) through `src/engine/routes/puzzle.ts`,
from the route's own tiles and the room's own minted streams
(`${seed}:puzzle:<map>:<roomId>:row|sites|order`). No build pass in
`src/engine/routes/sketch.ts` and no `RouteRequest` field is involved, so every route
the floor already generated, every trainer and item it already placed and every
encounter stream stay exactly where they were, and a fixed seed keeps the room's
switches, its reward tile and its press order identical on every visit.

## 3. Wild encounters

- Walking onto a `TALL_GRASS` tile rolls an encounter with the route's table.
- Tall grass is stamped from `terrain.grassPatches` on the off-spine floor, never
  on the spine or an opening, so a clean encounter-free lane always exists. A tree
  tip a patch shares (`grassTipKeys`) rolls the same encounter.
- The table is the **BST pool** of the band the **squad's level** falls in
  (`bandForLevel(squadLevel(run))`, resolved when the room's encounter stream is
  built), with legendaries and mythicals banned (`D39`) and a flat weight, so any
  species whose base-stat total falls in that band's window can appear. A species
  with a hand-authored **variant family** (Eiscue, Morpeko, Minior) keeps its
  single row: the roll picks which forme the individual is generated as, on its own
  stream, so the band's table and its weights do not move (`D38`).
- The grass never offers a species the run has already **caught**: the run keeps a
  run-long record of every species a successful catch brought in
  (`RunState.caughtSpecies`; death does not clear it, `D5`) and the table drops
  those species together with their whole evolution line and every forme sharing
  their national dex number. A table the exclusions would empty falls back to the
  unfiltered band, so the grass keeps rolling; the trainer pools are not narrowed,
  so a trainer may still field a line the player owns.
- The roll uses the route RNG, so walking the same grass in the same order
  produces the same encounters.
- The **magician's type** (`RunState.modifiers.nextWildType`, `docs/maps-spec.md` §7)
  narrows the band's table before the draw and is consumed by the next wild encounter
  that actually rolls: a step that rolls nothing keeps it. A type no species of the
  band carries falls back to the whole band, so a narrowed table is never empty.
- The **berry tree's** wild is a **second wild source**, not grass: its own
  `${seed}:npc:<roomId>:<npcId>:wild` stream, the room's live table (so the
  magician's type and the caught-species exclusions still apply), the same
  `rollWildLevel` and floor cap, `BERRY_TREE_ENEMY_BOOSTS` on the enemy lead and
  `noFlee`; it spends the room's single capture exactly like a grass step.
- A wild encounter's **level** is `clamp(floor(squadLevel(run) × fraction), 1, cap)`
  — `fraction` is one draw on the encounter stream in `[0.60, 0.75)` and `cap` is
  the floor's `maxLevel` (`WILD_LEVEL_FRACTION`, `wildLevel`, `rollWildLevel`;
  `src/data/wildLevels.ts`, `src/engine/routes/encounters.ts`). The seed fixes the
  draw, not the level, so the same grass on a stronger squad fields a stronger wild
  (D11/D17 amended). The table is the band the **squad's level** falls in
  (`bandForLevel(squadLevel(run))`), resolved when the room's encounter stream is
  built.
- Only the species and level are rolled. Stats, types and evolutions come from
  the species; the moveset and ability are rolled separately when the Pokémon is
  built (`D17`).
- A successful catch spends the room's single capture (`RunState.capturedRooms`).
  A room's capture is spent the moment its **first wild battle starts**, whatever
  the outcome: catching the Pokémon, defeating it or running away all close the
  room's window, so **only the first wild Pokémon that appears can ever be caught**
  there. Once spent, the **minimap marks the room** with a Poké Ball and the BALL
  command is disabled for any later encounter in the room.
- **The run's very first catch is certain** (`docs/battle-spec.md` §6): while
  `RunState.stats.catches === 0`, every capture attempt is an outright success
  whatever the species, the target's HP, the ball or its status, so the party can
  never be left with nothing to grow.
- When a catch leaves the party still **full**, a **capture screen** opens: the
  caught Pokémon's stats sit beside the party so the player can compare, then
  **swap it for a party member** (the replaced member goes to the PC) or **send it
  to the PC**. The floor's catch stays swappable out of the PC for the rest of the
  floor (`docs/routes-spec.md` §6), and its STATS tab shows the biome and route it
  was caught in.
- The **static species** of a static leaf (`docs/maps-spec.md` §7) is fought through
  the same wild path but is **not** drawn from the wild table — its species comes
  from `STATIC_SPECIES` (or `LEGENDARY_SPECIES` on the legendary variant), so
  `WILD_BANNED_TAGS` and `speciesPool` are unchanged and the room's capture rule is
  the shipped one: the battle that starts spends it.

## 4. Run structure

A run walks a chain of **maps** (`docs/maps-spec.md`); each map is a Binding of
Isaac-style floor — a grid of rooms sharing a biome and a level range, closed into
at least one cycle — and the **room farthest from the entry** holds the boss that
opens the portal to the next map:

```
map:  rooms 1..K-1    regular rooms (wild encounters, items, trainers)
      farthest room   the map boss (its max level) -> portal
run:  map 1 -> map 2 -> ... -> final map (final boss ends a finite run)
```

- Finite mode: the chain has a fixed length and the final boss ends it.
- Infinite mode: same generator, no final boss; the maps keep climbing and the
  run ends only when the party is wiped.
- Every floor carries **one mission**: chosen deterministically from the run seed
  when the floor is built (its own stream, so no route, roster or encounter draw
  moves), it is evaluated when the run takes the portal. Meeting it bumps a
  **run-long counter** and pays a **fixed reward row** (`{ kind: 'room' }` today,
  read by the special-room tasks); the first kind is `flawless` — leave the floor
  having lost **no HP** and without a casualty.
- The older mini-boss/boss cadence (`RUN_CHAIN` in `src/data/run.ts`) is folded
  into the map boss; the route kinds are re-derived from the map plan
  (`docs/maps-spec.md` §3).

## 5. Difficulty bands

- Each **map** has one level anchor: its **cap** (`levelCapForMap`). The floor's
  band is the **window derived from the caps** — it opens at the previous floor's
  cap and closes at this one (`levelWindowForMap`, `docs/maps-spec.md` §5) — so the
  band's `maxLevel` **is** the map's cap and clamps XP gain (`docs/battle-spec.md`
  §7). The per-route band is gone, and no room has a working level: the map's window
  **is** the band (`bandForMap`, `bandForLevel`).
- Each trainer archetype is presentation and reward only (identity, sprites,
  money); it no longer carries a species list. Every roster draws from the floor's
  **BST pool** (`speciesPool`, `src/engine/run/pool.ts`, `D39`), which varies only
  by the band's BST window and the roster's bans, and the wild table from the
  **squad's own** band (`bandForLevel(squadLevel(run))`); the party size grows with
  the band (`band`'s `trainerSize`). A wild's level is a fraction of the live squad
  level (60-75 %), floored and clamped to the floor's cap, and is never drawn from
  the map's range. The three **set-piece** rows (`ninja`, `impostor`, `secret`)
  live in `SPECIAL_ARCHETYPES`, so the route never rolls them; an archetype's
  `sightMode` is its route **sprite's** draw mode, not its `sight`, and its
  `forcedAbility` is the ability **name** its whole roster starts with, bypassing
  `D17`'s roll for that roster only; its `reward` is a bag item paid with a first
  win through `addItem`, on top of the money the band still scales. The secret
  row's gate reads the mission record's run-scoped counter,
  `RunState.missionsCompleted`.
- The wild table bans legendary and mythical species; a trainer roster may field
  them in the bands their BST lands in. A **boss** (map boss and mini-boss) fields
  the **upper half** of its band's BST window, one step above the floor's regular
  trainers.
- A trainer roster is generated deterministically from the route seed and the
  map's band, and never exceeds the map's level cap. A **regular** trainer's level
  is a percentage of the **live squad level** (`squadLevel`, D35) by its own party
  size — 100 / 90 / 80 / 70 % for 1 / 2 / 3 / 4 members, floored and clamped to the
  floor's cap (`TRAINER_LEVEL_PERCENT` and `trainerLevel`,
  `src/data/trainerLevels.ts`, `docs/maps-spec.md` §5) — so the seed fixes the
  species picks while the level follows the player (D11/D17 amended). The **boss**
  and the **mini-boss** keep the level draw they shipped with (the boss at the
  map's cap). Trainers are placed by the population pass (step 4): the floor's plan
  tags each regular room `trainers` or `wild`, and a `trainers` room fields 1-2 of
  them — one on the main lane and a second by a pocket — while a `wild` room holds
  none, so the count follows the floor's composition, not the room's size
  (`docs/maps-spec.md` §2).
- The map's **farthest room from the entry** fields the boss at the map's
  `maxLevel`, a fixed party of **six** (**three** on map 1, `src/data/bosses.ts`).
- The floor's **population** comes from its composition: exactly
  `trainerRoomsForMap(mapIndex)` of its regular rooms are `trainers` rooms (2 on
  maps 1-2, 3 on maps 3-5, 4 on maps 6-8, up to 6 past the table) and each fields
  1-2 trainers, so maps 1-2 read as a walkable start without thinning the count by
  band (`TRAINER_ROOMS_PER_MAP`, `src/data/population.ts`).

## 6. Healing stops

Between two routes the player gets a healing stop (a resting point): HP and PP
restored, no resurrection. The stop no longer opens a screen; the party and the
PC box are managed from the route HUD.

**The PC (the HUD's BOX window) is always viewable, but swapping between the
party and the PC is locked** except in two windows (`docs/maps-spec.md` §7):

- on the **first visit to a floor's entry room** the PC is fully editable, so a
  player can rearrange the party and the box before setting off;
- a catch that lands in the PC while the party is full — the engine places the
  catch itself, party first, PC second — stays swappable out of the PC **only
  while the run still stands in the room it was caught in**: the first door or
  portal closes that window (`RunState.pcCatch`), so a catch is never locked in
  the room that took it and never follows the run out of it. Leaving the entry
  room and coming back locks the PC for the rest of the floor, and a new floor
  resets both windows.

A boxed member the player cannot swap reads as **locked** (a dim veil on its
cell), and reordering the party within itself stays free. A catch that goes to
the PC says so in a **transient notice** at the top of the screen — one line,
dismissed by itself, taking no key and blocking no movement.

- The HUD carries the floor's own **mission** in one line under the
  transient-notice strip, and meeting it raises one transient notice through the
  same module (one message at a time, no key, no block). The static leaf floats its
  refusal line when its seal does not yield to the party (`docs/maps-spec.md` §7),
  and a legendary leaf floats one more line on entry.

A **consumable** rides the same drag: a heal or a status cure dropped from the bag
onto a party or box member is spent on it only when it would change something — HP
below max, or a primary status the item cures — and is a silent no-op otherwise (no
consumption, no notice, never an equipped item). The rule is pure run state in
`src/engine/run/items.ts`; the HUD only calls it.

A member can also leave the run **on purpose**, in the **trade** room
(`docs/maps-spec.md` §7) — the one place outside a battle where a member is
removed. It is the player's choice, the room asks once, the given member is gone
for good and is not counted as a casualty (no RIP entry, no release beat), and the
return joins at the squad's level exactly as a catch does. A single-member party is
refused, because a run cannot hold no party.

A member can be **edited** by a special NPC (`docs/maps-spec.md` §7): the tutor, the
nature, ability and IV readers and the species swapper each edit one **party**
member the card asks for, and a row without `repeatable` answers **once per floor**.
A tutored move lives in the MOVES tab's band, tagged `Tutor`, until it is equipped
again, so an unequip never loses it.

The PC box also carries a **fixed RIP tab**, at the right end of its page-tab
strip: a **third pane of the same window** (`RunState.rip`), listing the run's
fallen, one avatar cell each, in the order they fell — the party's first, the
box's after. A dead cell reads like a **locked** box cell (the same dim veil).
The list is **read-only everywhere** and permadeath stays permanent (`D5`): the
dead can never be moved into the party, a living member can never be deposited
into RIP, the list never reorders and no revive reaches it. Clicking a dead cell
opens the usual member detail with the dead member's stats and moves — the
rename field, the evolution branches, the move reorder and the learnset pool are
hidden — and the tab reads `RIP` in every locale, so it carries no key. A page
tab, and the wheel over the window, page **whichever list the window is
showing**; the keyboard's `left`/`right` cycle party → PC → RIP.

Each floor also carries a **Pokevial**: a single bar in the party window's
header (top-right), its fill climbing through three colour stages with
**POKEVIAL** written inside (no charge count). Pressing it **only when the bar is
full** applies a heal on the spot — HP and PP restored across the party **and**
the PC box and a primary status cured, though never a resurrection — and empties
the meter, so the player can rest mid-floor and shake off a poison or a burn
without walking back to a stop. Each charge is earned by **beating a trainer**
(one each, up to the cap of three) and a floor's **boss** fills the bar to the
top; the meter **carries over** from one floor to the next, so only a fresh run
starts it full. The pointer only reads as a click over a full bar.

Ground items sit on the route's pockets (step 4), nudged onto the most
wall-hugging tile their lane opened so an item rests against walls (a corner
where the branch allows it). A visible item draws the FRLG field Poke Ball and
**blocks its tile** while it is there; a hidden one draws a faint sparkle and
does **not** block, so the player can walk over it and take it underfoot. Either
way the **interact key** (`E` by default) takes it, adding it to the run's bag,
marking it in `RunState.pickedItems` (so a reload does not respawn it) and raising
the route's **transient notice** — the run's own `Obtained <name>!` line, naming
the item and dismissing itself, exactly the way a boxed catch does. Picked ids
reset when the route advances. The route HUD still shows the run's bag as FRLG
item icons.

The **reset** key (`R` by default) is a run-level affordance: holding it fades
the whole screen out under a small filling ring; releasing before it fills fades
back in, and completing it clears the save and starts a fresh run with a new
seed.
