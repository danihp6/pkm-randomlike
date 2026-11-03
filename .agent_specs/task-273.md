# Spec: Task-273 — A city is a grid with a Centre, a gym and grass

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule.
- **Role:** Dev.
- **Objective:** a settlement node of the region plan now generates one town map —
  a square of `CITY_TIERS[p].size` (50×50, 70×70 or 90×90) for a gym city, or
  `TOWN_SIZE` (40×40) for the starting town — laid out as a street grid of blocks
  and one plaza, with `CITY_TIERS[p].buildings` (6 / 10 / 14) buildings each
  carrying exactly one door, a grass corner, a spawn tile, and one walkable exit
  band on the border for every neighbour the plan names. The starting town is the
  **same** generator with no Centre. Before this task nothing generated a
  settlement: the city content was hand-placed.
- **Environment:** worktree `../wt-pkm-273`, branch `task-273`.
- **Dependencies:** none from this batch. Reads the region contract shipped by
  Batch 117 (`src/engine/region/plan.ts` for `RegionPlan`/`RegionNode`/`nodeOf`,
  `src/engine/region/streams.ts` for `nodeStreams`) and Batch 117's
  `src/data/region.ts` (`CITY_TIERS`, `TOWN_SIZE`, `cityTierForBadge`, `citySize`)
  and city tile vocabulary (`src/engine/map.ts` values `12`-`19`).

### Exclusive paths (single writer)

- `src/engine/region/city/plan.ts` (new)
- `src/engine/region/city/index.ts` (new)
- `src/engine/region/city/README.md` (rewrite — it currently only holds the folder)
- `src/engine/region/city/plan.test.ts` (new)
- `docs/region-spec.md` **§7.1 only** (new subsection; §7's preamble already lists
  `§7.1`, so do not edit it, and do not touch `§7.2`-`§7.11`, §3 or any other
  section)

**Nothing outside this list.** No `src/engine/region/README.md` (Batch 119's
`[Task-277]`), no `src/engine/region/index.ts` (same), no `src/data/region.ts`, no
`src/data/tilesets/**`, no `src/engine/map.ts`, no scene, no `package.json`.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1, §2, §4, §6, §7 (read §7 to know what §7.1 must say,
  and §6 for what a settlement holds), §7.1's own lines.
- `docs/tileset-spec.md` §1 (the city kind → map value table).
- `src/engine/region/plan.ts`, `src/engine/region/streams.ts`,
  `src/engine/region/README.md` (its rules).
- `src/data/region.ts`, `src/data/tilesets/city.ts` (`CITY_KIND_VALUES` — read it
  to confirm the mapping, do **not** import it into the engine).
- `src/engine/map.ts` (`PATH`, `PLAZA`, `ROOF`, `WALL`, `DOOR`, `TALL_GRASS`,
  `isWalkable`, `tileAt`, `mapSize`), `src/engine/grid.ts` (`Tile`),
  `src/engine/rng.ts`.
- `src/engine/routes/layout.ts` (`AccessEdge` — the city shares the vocabulary),
  `src/engine/routes/validate.ts` (`reachableTiles`).
- `src/data/tilesets/city.ts`'s config `FRLG_CITY_TILESET` (the map test resolves
  the map against it) and `src/engine/tileFrames.ts` (`resolveTileFrame`).

## 🔒 Contract

### TypeScript — `src/engine/region/city/plan.ts`

```ts
import type { RegionPlan } from '../plan';
import type { Tile } from '../../grid';
import type { TileMap } from '../map';
import type { AccessEdge } from '../../routes/layout';

/** The five things a city door can lead to. Frozen: the interior generator parses it. */
export type BuildingKind = 'centre' | 'gym' | 'lab' | 'house' | 'casino';

/** One building and the door that opens it. */
export type CityBuilding = Readonly<{
  kind: BuildingKind;
  /** The single DOOR cell of the building's front row. */
  door: Tile;
  /**
   * The interior this door opens, city-relative and stable across a rebuild:
   * `'centre'`, `'gym'`, `'lab'`, `'casino'`, or `'house:<n>'` with `n` counting
   * 1.. from the first house placed. Never carries the city key — the caller
   * already has it.
   */
  interiorKey: string;
  /** The footprint, inclusive of roof, wall and the door: top-left + size. */
  rect: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

/** One border exit. A city band is two-way: walking back never needs a badge. */
export type CityExitBand = Readonly<{
  edge: AccessEdge;
  neighbourKey: string;
  /** The band's border cells, in reading order; every one is walkable. */
  tiles: readonly Tile[];
}>;

export type CityPlan = Readonly<{
  /** `plan.seed`, the run seed. */
  seed: string;
  /** The settlement's node key, e.g. `city:3` or `town:1`. */
  key: string;
  /** The settlement's generated name (`RegionNode.name`). */
  name: string;
  /** The city tier, `null` on the town. */
  tier: 1 | 2 | 3 | null;
  width: number;
  height: number;
  tiles: TileMap;
  /** Where a walk in through any exit band lands. Always walkable. */
  spawn: Tile;
  /** Every building, in placement order; exactly one door each. */
  buildings: readonly CityBuilding[];
  /** One band per neighbour, in `node.edges` order. */
  exits: readonly CityExitBand[];
  /** The grass corner's cells: every one is `TALL_GRASS`. */
  grass: readonly Tile[];
}>;

export function planCity(plan: RegionPlan, key: string): CityPlan;
```

- `planCity` throws `Error("not a settlement: <key>")` when `nodeOf(plan, key)` is
  undefined or its `kind` is neither `'town'` nor `'city'`.
- **Determinism:** it reads **only** `nodeStreams(plan.seed, key).layout`, and it
  takes its draws in a fixed order (buildings' block order first, then the door
  column of each building in placement order, then nothing else). No other pass
  (`content`, `encounters`, `loot`) is touched, so `[Task-277]` can lay content on
  them later without moving a wall. `Math.random` is banned.
- Rules: no Phaser, no DOM, no `localStorage`; the map is emitted in the engine's
  own map values (`src/engine/map.ts`), never in atlas frames; a door is a `DOOR`
  cell whose **north neighbour is a `PATH` cell**, so it is always reachable.

### Data / grammar this task freezes

- `interiorKey` grammar: `kind` or `kind + ':' + n`, where `kind` is one of the five
  `BuildingKind` values and `n` is a 1-based decimal (only `house` uses it, and
  only when a city has more than one). The interior generator (`Batch 118`,
  task-274) parses exactly this string and takes the city key as a separate
  argument; **it does not import this file**, so the grammar is the contract.
- `tier`: the `CityTier.tier` of the city's badge (`cityTierForBadge(node.badge)`),
  `null` on the town.
- Sizes and counts: `citySize(node.badge)` and
  `cityTierForBadge(node.badge).buildings` for a city; `TOWN_SIZE` and **two**
  buildings (one `lab`, one `house`) for the town. The town's "two" is the town's
  composition (`docs/region-spec.md` §6: one laboratory and one house), not a tier
  count, so no `buildings` number is read for it.

## 🧩 Data and configuration

No new data row. The generator's geometry constants live in `plan.ts` beside
`sketch.ts`'s own (`SPINE_SEGMENTS`, `COST_NOISE`): `RING = 2` (border ring),
`STREET_PITCH = 10`, `STREET_WIDTH = 3`, `BLOCK = 7` (the square a block fills),
`BUILDING_WIDTH = 5`, `BUILDING_HEIGHT = 4`, `BAND_WIDTH = 3`. Every **size** and
every **building count** is read from `src/data/region.ts` and never hard-coded
here (the folder's rule 4).

### The layout the contract expects

1. Fill the map with `WALL`, then open a `RING`-wide street-free border: the ring
   stays `WALL` except at the exit bands.
2. Streets: `PATH` columns and rows on a `STREET_PITCH` grid, `STREET_WIDTH` wide,
   aligned so that whole `BLOCK`-wide blocks fall between them. Blocks clipped by
   the border ring are not candidates.
3. The **central** candidate block becomes the `PLAZA`; its centre tile is the
   `spawn` (a town's too).
4. The **bottom-right** candidate block becomes the grass corner: its whole
   `BLOCK × BLOCK` interior is `TALL_GRASS`.
5. Buildings: the remaining candidate blocks, row-major, are shuffled once off the
   `layout` stream; the first `buildings` of them each hold one building in the
   block's top-left corner: its front row is the building's top row (`WALL` with
   exactly one `DOOR` drawn from the stream), the other three rows are `ROOF`. The
   tile directly north of the door is the street above the block, so the door is
   reachable. The kinds fill in this order: `centre` (city only), `gym` (city
   only, and only when `node.gym`), `lab`, `casino` (city only, and only when
   `node.badge >= 3`), then `house:<n>` for the rest.
6. Exit bands: one per neighbour, `BAND_WIDTH` wide, on the edge this task derives
   from the plan: the dominant axis of
   `neighbour.position - node.position`, ties going to the horizontal (`|dx| >=
   |dy|` → `'E'` when `dx > 0` else `'W'`; otherwise `'S'` when `dy > 0` else
   `'N'`). Each band's cells are `PATH`, replacing the ring, and each band is
   joined to the street grid by a straight `PATH` run so the band is reachable
   from the `spawn`.

The algorithm may differ in detail; the acceptance criteria are what must hold.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including `plan.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-273` — must be **exactly** the five
    paths of the exclusive list.
  - Every criterion below is `[unit]`; **no browser pass is owed** and QA runs no
    scene. Nothing in this task draws a city yet.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "gives every
        tier its own square and building count"`: for the seeds
        `['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel']` and
        every badge 1…8, `const city = planCity(planRegion(seed), 'city:' + badge)`
        has `city.width/height === citySize(badge).width/height`,
        `city.buildings.length === cityTierForBadge(badge).buildings`, and
        `city.tier === cityTierForBadge(badge).tier`.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "gives the
        Centre, the gym and the laboratory a door"`: every city has exactly one
        `'centre'`, exactly one `'gym'` (every shipped city has `node.gym === true`)
        and exactly one `'lab'`; the town has exactly one `'lab'` and no
        `'centre'`, `'gym'` or `'casino'`; every building's `door` is `DOOR`
        (`tileAt`) and the tile north of it is `PATH` and `isWalkable`; every
        `door` lies inside its own `rect`.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "reaches every
        exit band from the spawn"`: `exits.map((b) => b.neighbourKey)` sorted
        equals `[...node.edges]` sorted for every settlement, `isWalkable` is true
        at `spawn`, and `reachableTiles(city.tiles, city.spawn)` contains every
        cell of every band.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "draws the
        grass corner on every settlement"`: every settlement has `grass.length >=
        9`, every grass cell is `TALL_GRASS`, all of them lie inside one rectangle,
        and each is in `reachableTiles(tiles, spawn)`.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "makes the
        town the same generator with no Centre"`: `planCity(plan, 'town:1')` has
        `tier === null`, `width === TOWN_SIZE.width`, `height === TOWN_SIZE.height`,
        `buildings.length === 2` with kinds `['lab', 'house']`, no `'centre'`, no
        `'gym'`, and `exits.length === 1` naming `route:1`.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "resolves every
        cell to a frame in the city tileset"`: for every settlement of the eight
        seeds, every cell of `city.tiles` resolves (`resolveTileFrame(city.tiles, x,
        y, FRLG_CITY_TILESET) !== null`). Import the config from
        `src/data/tilesets/city.ts`, never the registry.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "pins a fixed
        seed's settlement digests"`: the file defines
        `digest(city)` = `${width}x${height}|${tier}|${spawn.x},${spawn.y}|` +
        `buildings.map((b) => b.kind + '@' + b.door.x + ',' + b.door.y + ':' +
        b.interiorKey).join('|') + '|exits:' + exits.map((b) => b.edge + ':' +
        b.neighbourKey + ':' + b.tiles.map((t) => `${t.x},${t.y}`).join('.')).join('|')
        + '|grass:' + grass.length + '|' +
        hashSeed(tiles.map((row) => row.join('')).join('/')).toString(36)` and
        asserts `['town:1','city:1',…,'city:8']` delimited by a **literal
        `toBe([...])`** of nine strings (no snapshot file) for
        `planRegion('alpha')`. Run that one test twice: both green, and
        `git status --porcelain` stays empty.
  - [ ] `[unit]` `npm test -- src/engine/region/city/plan.test.ts -t "rejects a key
        that is not a settlement"`: `planCity(plan, 'route:1')`,
        `planCity(plan, 'league:1')` and `planCity(plan, 'nope:1')` all throw.
  - [ ] `[unit]` `git diff --name-only origin/main...task-273` lists nothing outside
        the five exclusive paths, and `docs/region-spec.md`'s only changed hunk is
        inside §7.1 (`git diff -U0 docs/region-spec.md` shows no other section
        header in the hunk list).
  - [ ] `[unit]` `src/engine/region/city/README.md` names every file in the folder,
        one role line each, with no exported name in the lines.
  - [ ] No `[live]` criterion exists for this task; **no browser pass is owed**.

## 📣 Coordination

- **For the Architect:** the plan was cut assuming the city and the interior are
  independent writers; this spec therefore freezes the `interiorKey` **grammar**
  instead of a type shared with `src/engine/region/interior/`. Nothing else in the
  batch reads this folder.
- **For the interior generator (batch-mate, do not import it):**
  `CityBuilding.interiorKey` is `centre`, `gym`, `lab`, `casino` or `house:<n>`
  (1-based). The city key travels separately, so `planInterior(plan, interiorKey,
  cityKey)` can key its stream on `${cityKey}/${interiorKey}` and needs nothing
  from this file.
- **For the next batch (the city screen):** `CityPlan` is the whole surface —
  `tiles`, `spawn`, `buildings` (door + `rect` + `interiorKey`), `exits`, `grass`.
  Walking onto a `DOOR` cell resolves the building by its `door` tile. Flight lands
  on the Centre's door (or the lab's, in the town) and not on `spawn`
  (`docs/region-spec.md` §5); that rule is a scene's, not this plan's.
- The barrel `index.ts` (`export * from './plan';`) is **not** wired into
  `src/engine/region/index.ts` — `[Task-277]` owns that file, as it owns
  `src/engine/region/README.md`'s folder lines.
- `docs/region-spec.md` §7's preamble already lists `§7.1`-`§7.11`; **do not edit
  it**. Write the new `### 7.1 The city plan` subsection under it and stop at
  `§7.2`.

## ⛔ Out of scope

- No scene work: no `WorldScene`, no camera, no drawing, no scroll, no NPC
  sprites, no signs.
- No interiors: this task emits the door list only; the room behind the door is
  the interior generator's.
- No content: no NPCs, no trainers, no items, no shops, no wild tables. That is
  Batch 119's `planNodeContent`.
- No `WATER` and no `SIGN` cells: nothing requires them and no test covers them.
- No gate/badge logic (§4 is `[Task-278]`'s), no save change, no `RunState`.
- No new data row, no new map value, no new tileset, no new dependency.
- No deletion of the old floor modules.
