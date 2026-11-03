# Spec: Task-274 — An interior is a small room with a door back

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule.
- **Role:** Dev.
- **Objective:** every door a settlement emits now resolves to one small indoor map
  built by its own pure generator: `INTERIOR_SIZE` (24×18) for a building and
  `GYM_SIZE` (40×40) for a gym. The player arrives on the map's one return door,
  which leads back to the city it came from; the room kind decides what stands
  inside — the Centre's counter and PC, the gym's four rooms in a fixed order with
  a door between consecutive ones, the laboratory's professor, a house's NPC or the
  casino's cabinet. Before this task the interiors lived inside `RouteScene`'s room
  specials and nothing generated one from a key.
- **Environment:** worktree `../wt-pkm-274`, branch `task-274`.
- **Dependencies:** none from this batch. Reads the region contract shipped by
  Batch 117 (`src/engine/region/plan.ts` for the `RegionPlan` type only,
  `src/engine/region/streams.ts` for `nodeStreams`) and Batch 117's
  `src/data/region.ts` (`INTERIOR_SIZE`, `GYM_SIZE`). **It does not depend on the
  city plan** (a batch-mate): the `interiorKey` grammar is frozen in both specs and
  this file takes plain strings.

### Exclusive paths (single writer)

- `src/engine/region/interior/plan.ts` (new)
- `src/engine/region/interior/index.ts` (new)
- `src/engine/region/interior/README.md` (rewrite — it currently only holds the folder)
- `src/engine/region/interior/plan.test.ts` (new)
- `docs/region-spec.md` **§7.2 only** (new subsection; §7's preamble already lists
  `§7.2`, so do not edit it, and do not touch `§7.1`, `§7.3`-`§7.11`, §3 or any
  other section)

**Nothing outside this list.** In particular: **no import and no edit of
`src/engine/region/city/**`** (a batch-mate), no `src/engine/region/index.ts` or
`src/engine/region/README.md` (Batch 119's `[Task-277]`), no `src/data/region.ts`,
no `src/data/tilesets/**`, no `src/engine/map.ts`, no scene, no `package.json`.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §6 (what a settlement holds), §7 and §7.2's lines.
- `docs/tileset-spec.md` §1 (the interior kind → map value table).
- `src/engine/region/plan.ts` (**type-only** import of `RegionPlan`; no runtime
  value from it), `src/engine/region/streams.ts`, `src/engine/region/README.md`.
- `src/data/region.ts` (`INTERIOR_SIZE`, `GYM_SIZE`).
- `src/engine/map.ts` (`FLOOR`, `WALL`, `DOOR`, `COUNTER`, `HEAL`, `PC`,
  `isWalkable`, `tileAt`, `mapSize`), `src/engine/grid.ts` (`Tile`),
  `src/engine/rng.ts`.
- `src/engine/routes/validate.ts` (`reachableTiles`), `src/engine/tileFrames.ts`
  (`resolveTileFrame`).
- `src/data/tilesets/interior.ts` (`FRLG_INTERIOR_TILESET` — the map test resolves
  the room against it; `INTERIOR_KIND_VALUES` to confirm the mapping, imported only
  by the test if you need it).

## 🔒 Contract

### TypeScript — `src/engine/region/interior/plan.ts`

```ts
import type { RegionPlan } from '../plan';
import type { Tile } from '../../grid';
import type { TileMap } from '../map';

/**
 * What kind of room an interior is. Spelled exactly like the city generator's
 * `BuildingKind` but declared here, so this folder imports nothing from the city
 * folder: the two files agree on a string union, not on a type.
 */
export type InteriorRoomKind = 'centre' | 'gym' | 'lab' | 'house' | 'casino';

/** What stands in a room, as a role the scene fills in. */
export type InteriorSlotRole =
  | 'heal'
  | 'pc'
  | 'counter'
  | 'professor'
  | 'npc'
  | 'cabinet'
  | 'trainer'
  | 'leader';

/** One placeable thing: a free tile the scene puts its own actor or prop on. */
export type InteriorSlot = Readonly<{ role: InteriorSlotRole; tile: Tile }>;

/** One of a gym's four rooms, in the fixed order below. */
export type InteriorRoom = Readonly<{
  index: number; // 0..3
  name: 'entrance' | 'trainer' | 'puzzle' | 'leader';
  /** The room's floor + wall rectangle, top-left and size, inclusive. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
  /** The DOOR cell that joins it to the room before it; absent on `entrance`. */
  doorIn?: Tile;
}>;

export type InteriorPlan = Readonly<{
  /** `plan.seed`, the run seed. */
  seed: string;
  /** The city-relative key this room was built from, e.g. `centre`, `house:2`. */
  interiorKey: string;
  /** The settlement the door returns to, e.g. `city:3` or `town:1`. */
  cityKey: string;
  kind: InteriorRoomKind;
  width: number;
  height: number;
  tiles: TileMap;
  /** The one DOOR cell: the player arrives on it and it walks them back out. */
  entry: Tile;
  /** What `entry` returns to. Always `cityKey`. */
  returnTo: string;
  /** The room's furniture/host slots; their roles are fixed per kind (see below). */
  slots: readonly InteriorSlot[];
  /** The gym's four rooms, in order. Absent (not `[]`) on every other kind. */
  rooms?: readonly InteriorRoom[];
}>;

/** The kind an `interiorKey` names, or `null` when the string is not one. */
export function interiorRoomKind(interiorKey: string): InteriorRoomKind | null;

export function planInterior(
  plan: RegionPlan,
  interiorKey: string,
  cityKey: string,
): InteriorPlan;
```

- `planInterior` throws `Error("not an interior key: <key>")` when
  `interiorRoomKind(interiorKey)` is `null`.
- `interiorRoomKind` accepts exactly `centre`, `gym`, `lab`, `casino`, `house` and
  `house:<n>` with `n` a positive decimal (`/^house:[1-9]\d*$/`). `'house:0'`,
  `'House'`, `'gym:1'` and `''` are `null`.
- **Determinism:** `planInterior` reads **only**
  `nodeStreams(plan.seed, cityKey + '/' + interiorKey).layout` — that is,
  `${seed}:node:<cityKey>/<interiorKey>:layout`. The key is a
  sub-key of the city node, so no two interiors of a region share a stream, no
  interior is moved by another, and an interior is independent of the city's own
  draws. The `content`, `encounters` and `loot` passes are untouched, so
  `[Task-277]` can lay content on them later without moving a wall.
- Rules: no Phaser, no DOM, no `localStorage`, no `Math.random`; the map is
  emitted in the engine's map values (`src/engine/map.ts`), never in atlas frames;
  `plan.seed` is the only field of `plan` this file reads.

### The rules the plan must satisfy

| kind | size | slots, in this order | other required cells |
| --- | --- | --- | --- |
| `centre` | `INTERIOR_SIZE` | `heal`, `pc` | at least 3 `COUNTER` cells forming one straight row, with the `heal` cell inside that row |
| `gym` | `GYM_SIZE` | `trainer`, `leader` | four rooms (below), 4 `DOOR` cells in all |
| `lab` | `INTERIOR_SIZE` | `professor` | — |
| `house` | `INTERIOR_SIZE` | `npc` | — |
| `casino` | `INTERIOR_SIZE` | `cabinet` | — |

- The room is a rectangle of `FLOOR` framed by a one-tile `WALL` ring. The `entry`
  is the one `DOOR` cell in the bottom wall (`y === height - 1`), and the floor
  tile directly north of it is walkable, so a walk in lands on floor.
- `entry` is the only `DOOR` cell of a non-gym interior and `returnTo === cityKey`
  on every kind.
- **Gym rooms:** four rectangles in the fixed order `entrance`, `trainer`,
  `puzzle`, `leader`, arranged as a 2×2 walk (entrance top-left, trainer
  top-right, puzzle bottom-right, leader bottom-left), each framed by its own
  `WALL` ring. Consecutive rooms share one wall, and that shared wall carries
  **exactly one** `DOOR` cell, recorded as the later room's `doorIn`. The gym's
  four `DOOR` cells are therefore `entry` plus the three `doorIn`s; the `trainer`
  slot lies inside `rooms[1].rect` and the `leader` slot inside `rooms[3].rect`.
- Every slot tile lies inside the map and is cardinally adjacent to at least one
  `isWalkable` cell, so the scene can talk to it from a tile the player can stand
  on.
- Every walkable cell of the map is in `reachableTiles(tiles, entry)` — no floor
  island, and for a gym that means the four rooms are really joined.

## 🧩 Data and configuration

No new data row. The generator's own geometry constants live in `plan.ts` (the
room's ring width `1`, the gym's 2×2 grid, the counter run's length), like
`sketch.ts`'s own constants. Both **sizes** are read from `src/data/region.ts` and
never hard-coded here.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `plan.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-274` — must be **exactly** the five
    paths of the exclusive list; if `src/engine/region/city/**` appears in it, the
    batch rule was broken.
  - Every criterion below is `[unit]`; **no browser pass is owed** and QA runs no
    scene.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "puts the
        return door on the entry tile, back to the city key"`: for every room kind
        (`centre`, `gym`, `lab`, `house:1`, `house:2`, `casino`) and both cities
        `city:1` and `town:1`, `const room = planInterior(planRegion('alpha'),
        kind, city)` has `room.returnTo === city`, `room.entry.y ===
        room.height - 1`, `tileAt(room.tiles, room.entry) === DOOR`, and — outside
        the gym — `room.tiles.flat().filter((v) => v === DOOR).length === 1`.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "places
        each kind its own furniture slots"`: `slots.map((s) => s.role)` equals
        exactly `['heal','pc']` (centre), `['trainer','leader']` (gym),
        `['professor']` (lab), `['npc']` (house:1) and `['cabinet']` (casino); the
        centre also has `>= 3` `COUNTER` cells in one straight row with the `heal`
        tile among them; every slot tile is inside the map and cardinally adjacent
        to an `isWalkable` cell.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "joins the
        gym's four rooms in order, one door between each pair"`:
        `rooms.map((r) => r.name)` equals
        `['entrance','trainer','puzzle','leader']`; `rooms.filter((r) => r.doorIn
        !== undefined).length === 3`; every `doorIn` is `DOOR`, is cardinally
        adjacent to a floor cell of its own `rect` **and** of the previous room's
        `rect`; the whole map holds exactly 4 `DOOR` cells; the `trainer` slot is
        inside `rooms[1].rect` and the `leader` slot inside `rooms[3].rect`.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "sizes a
        room off INTERIOR_SIZE and a gym off GYM_SIZE"`: every non-gym kind has
        `width/height === INTERIOR_SIZE.width/height`; `gym` has
        `width/height === GYM_SIZE.width/height` and `rooms.length === 4`; a
        non-gym plan has `rooms === undefined`.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "reaches
        every floor cell from the entry"`: for every kind and both cities,
        `reachableTiles(room.tiles, room.entry)` contains every cell for which
        `isWalkable(room.tiles, cell)` is true.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "resolves
        every cell to a frame in the interior tileset"`: every cell resolves
        (`resolveTileFrame(room.tiles, x, y, FRLG_INTERIOR_TILESET) !== null`),
        importing the config from `src/data/tilesets/interior.ts`, never the
        registry.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "pins a
        fixed seed's interior digests"`: the file defines `digest(room)` =
        `${width}x${height}|${kind}|${entry.x},${entry.y}|${returnTo}|` +
        `slots.map((s) => s.role + '@' + s.tile.x + ',' + s.tile.y).join('|') + '|'
        + (room.rooms ?? []).map((r) => r.name + ':' + r.rect.x + ',' + r.rect.y +
        ':' + (r.doorIn ? `${r.doorIn.x},${r.doorIn.y}` : '-')).join('|') + '|' +
        hashSeed(room.tiles.map((row) => row.join('')).join('/')).toString(36)` and
        asserts a **literal `toBe([...])`** of six strings (no snapshot file) for
        `planRegion('alpha')` / `city:3`, one per kind
        (`['centre','gym','lab','house:1','house:2','casino']`). Run that one test
        twice: both green, and `git status --porcelain` stays empty.
  - [ ] `[unit]` `npm test -- src/engine/region/interior/plan.test.ts -t "rejects an
        interior key that names no room"`: `interiorRoomKind('gym:1')`,
        `interiorRoomKind('house:0')`, `interiorRoomKind('House')` and
        `interiorRoomKind('')` are all `null`, and `planInterior(plan, 'shop',
        'city:1')` throws.
  - [ ] `[unit]` `git diff --name-only origin/main...task-274` lists nothing outside
        the five exclusive paths, and `git diff -U0 docs/region-spec.md` shows no
        section header other than `§7.2`'s in its hunks.
  - [ ] `[unit]` `src/engine/region/interior/README.md` names every file in the
        folder, one role line each, with no exported name in the lines.
  - [ ] No `[live]` criterion exists for this task; **no browser pass is owed**.

## 📣 Coordination

- **For the Architect:** the plan listed "the city plan (Batch 118)" as this task's
  dependency. That would break the batch's antichain rule, so this spec drops it:
  the room takes `interiorKey: string` + `cityKey: string` and imports no city
  file. The dependency is on the **grammar**, frozen identically in both specs.
- **The `interiorKey` grammar (identical to the city's `CityBuilding.interiorKey`):**
  `centre`, `gym`, `lab`, `casino`, or `house:<n>` with `n` a 1-based decimal. The
  city key is a separate argument, never part of the key.
- **For the next batch (the city screen):** walking onto a `DOOR` cell of a
  `CityPlan` resolves `planInterior(plan, building.interiorKey, cityKey)`; the
  scene spawns the player on `room.entry` and a step back on that same tile
  returns to `cityKey`. `slots` is the list of things to draw/talk to, by `role`.
- The barrel `index.ts` (`export * from './plan';`) is **not** wired into
  `src/engine/region/index.ts` — `[Task-277]` owns that file, as it owns
  `src/engine/region/README.md`'s folder lines.
- `docs/region-spec.md` §7's preamble already lists `§7.1`-`§7.11`; **do not edit
  it**. Write the new `### 7.2 The interior list` subsection under it and stop at
  `§7.3`.

## ⛔ Out of scope

- No scene work: no interior screen, no fade, no warp animation, no NPC sprite.
- No gym puzzle logic: the puzzle room exists as a room with its slot list; the
  puzzle itself is a later task (§7.4).
- No content: no NPC identities, no trainer rosters, no shop stock, no healing
  rule. `slots` are positions and roles only.
- No `CITY_TIERS`-dependent room size, no per-city furniture variation.
- No save change, no `RunState`, no badge gate.
- No new data row, no new map value, no new tileset, no new dependency.
- No deletion of the old floor modules.
