# Spec: Task-272 — A route is two to four screens long

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule.
- **Role:** Dev.
- **Objective:** a route node of the region plan now generates one continuous
  top-down map — `ROUTE_WIDTH` (60) tiles wide and `ROUTE_HEIGHTS[0|1|2]` (120,
  160 or 200) tall, i.e. two, three or four 60×40 screens of **one** biome — with
  one opening band on the map's own border for every neighbour the plan names, a
  guaranteed lane that crosses every screen, no internal transition and no
  interior door. Before this task the only route generator carved one 20×20 room;
  after it, `src/engine/region/route/` turns a `RegionPlan` node into a map a scene
  can draw and walk.
- **Environment:** worktree `../wt-pkm-272`, branch `task-272`.
- **Dependencies:** none from this batch. Reads the region contract shipped by
  Batch 117 (`src/engine/region/plan.ts` for `RegionPlan`/`RegionNode`/`nodeOf`,
  `src/engine/region/streams.ts` for `nodeStreams`, `src/data/region.ts` for
  `ROUTE_WIDTH`/`ROUTE_HEIGHTS`) and the shipped single-room carver in
  `src/engine/routes/`.

### Exclusive paths (single writer)

- `src/engine/region/route/layout.ts` (new)
- `src/engine/region/route/map.ts` (new)
- `src/engine/region/route/streams.ts` (new)
- `src/engine/region/route/index.ts` (new)
- `src/engine/region/route/README.md` (rewrite — it currently only holds the folder)
- `src/engine/region/route/layout.test.ts` (new)
- `src/engine/region/route/map.test.ts` (new)
- `docs/routes-spec.md` **§1 only** (rewrite that section; §2-§6 are not yours)

**Nothing outside this list.** No `src/engine/routes/**` change (the carver is
read-only), no `src/engine/region/README.md` (Batch 119's `[Task-277]`), no
`src/engine/region/index.ts` (same), no scene, no `package.json`, no data table.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1, §2 (the node kinds, the identity and the stream family).
- `docs/routes-spec.md` §1 (the section you rewrite) and §2 (what the shipped
  carver does).
- `docs/tileset-spec.md` §1 (the map values) and §2 (the atlas contract).
- `src/engine/region/plan.ts`, `src/engine/region/streams.ts`.
- `src/data/region.ts`, `src/data/biomes.ts`.
- `src/engine/routes/sketch.ts` (`sketchRoute`, `RouteRequest`), `routeMap.ts`
  (`RouteMap`), `layout.ts` (`AccessEdge`, `SHAPES`), `doors.ts` (`borderEdge`,
  `openingBandCells`), `walls.ts` (`DEFAULT_WALL_FOOTPRINT`), `validate.ts`
  (`reachableTiles`).
- `src/engine/map.ts`, `src/engine/grid.ts`, `src/engine/rng.ts`,
  `src/engine/tileFrames.ts` (`resolveTileFrame`), `src/engine/frameMap.ts`
  (`buildFrameMesh`), `src/engine/tileset.ts`.
- `src/data/tilesets/frlg.ts` (`FRLG_FOREST_TILESET`) — the map test resolves the
  stitched map against it.

## 🔒 Contract

### TypeScript — `src/engine/region/route/layout.ts`

```ts
import type { RegionPlan } from '../plan';
import type { Tile } from '../../grid';
import type { AccessEdge } from '../../routes/layout';

/** One 60x40 screen of a route, in stitched rows. */
export type RouteScreen = Readonly<{
  index: number; // 0-based, top to bottom
  top: number; // the screen's first stitched row, index * SCREEN_HEIGHT
  bottom: number; // its last stitched row, top + SCREEN_HEIGHT - 1
}>;

export type RouteOpeningRole = 'entry' | 'exit';

/** One border opening: which edge it sits on and which neighbour it serves. */
export type RouteOpening = Readonly<{
  edge: AccessEdge;
  role: RouteOpeningRole;
  neighbourKey: string;
}>;

export type RouteLayout = Readonly<{
  /** `plan.seed`, the run seed. */
  seed: string;
  /** The node key, e.g. `route:3` or `lateral:5`. */
  key: string;
  /** `biomeForRoute(node.id).id` — the route's one biome. */
  biomeId: string;
  width: number; // ROUTE_WIDTH
  height: number; // ROUTE_HEIGHTS[screens - 2]
  screens: readonly RouteScreen[];
  openings: readonly RouteOpening[];
}>;

export const SCREEN_HEIGHT = 40;

export function routeScreens(screens: 2 | 3 | 4): readonly RouteScreen[];

export function planRouteLayout(
  plan: RegionPlan,
  key: string,
  screens?: 2 | 3 | 4,
): RouteLayout;

/** The carver's spine split into one segment per screen (see below). */
export function spineSegments(
  layout: RouteLayout,
  spine: readonly Tile[],
): readonly (readonly Tile[])[];
```

- `planRouteLayout` throws `Error("not a route node: <key>")` when `nodeOf(plan,
  key)` is undefined or its `kind` is neither `'route'` nor `'lateral'`, and
  `Error("bad screen count: <n>")` for an explicit `screens` outside 2…4.
- **Determinism:** it reads **only** `nodeStreams(plan.seed, key).layout`, and it
  always takes exactly two draws from it, in this order, **even when `screens` is
  given** (so forcing a height never moves a later draw):
  1. `screens` (when absent): `rng.int(2, 4)`;
  2. the carve seed: `String(rng.int(0, 0x7fffffff))`.
  Nothing else reads RNG: `biomeId` is `biomeForRoute(node.id).id` (a pure
  function of the node), and the openings are derived from `plan` alone.
- **The opening rule.** The entry neighbour is: the node before `key` in
  `plan.chain`; or, when `key` is not on the chain (a lateral), the node its
  `lateralOf` names; or, when neither exists, the first of `node.edges` in sorted
  order. The entry opening's edge is always `'N'` — a route is a tall map, so its
  two long ends are the only bands a 60-wide screen can carry, and the chain order
  (not the coarse map position) decides which end is which. Every **other**
  neighbour of `node.edges`, in `node.edges` order, gets the next unused edge of
  `['S', 'E', 'W']`. Consequences to rely on: a chain route has one `'N'` entry
  band and one `'S'` exit band; a lateral (one neighbour, the parent) has **one**
  band, role `'entry'`, edge `'N'`, and no `'exit'` band at all — it is walked
  into and back out of (`docs/region-spec.md` §1).
- `spineSegments(layout, spine)` returns one array per screen, in screen order,
  each holding the spine tiles whose `y` falls in `[top, bottom]`. It is a filter,
  not a path walk, so it preserves the spine's own order; the union of the
  segments must equal `spine` and no segment may be empty for a generated route.

### TypeScript — `src/engine/region/route/map.ts`

```ts
import type { Tile } from '../../grid';
import type { TileMap } from '../map';
import type { AccessEdge } from '../../routes/layout';
import type { RegionPlan } from '../plan';
import type { RouteOpeningRole, RouteScreen } from './layout';

/** One opening's whole band of border cells. */
export type RouteOpeningBand = Readonly<{
  edge: AccessEdge;
  role: RouteOpeningRole;
  neighbourKey: string;
  /** The band cells on the map border, in `openingBandCells` order. */
  tiles: readonly Tile[];
}>;

/** A generated region route: one continuous map, no rooms, no doors. */
export type RegionRouteMap = Readonly<{
  seed: string; // plan.seed
  key: string;
  biomeId: string;
  width: number;
  height: number;
  tiles: TileMap;
  /** The entry band's anchor tile (the carver's `entry`). */
  entry: Tile;
  /** One tile per exit band, in `bands` order (`[]` for a lateral). */
  exits: readonly Tile[];
  /** The guaranteed lane from the entry band to every exit band. */
  spine: readonly Tile[];
  screens: readonly RouteScreen[];
  /** One band per opening, in `layout.openings` order. */
  bands: readonly RouteOpeningBand[];
}>;

export function generateRoute(
  plan: RegionPlan,
  key: string,
  screens?: 2 | 3 | 4,
): RegionRouteMap;
```

- `generateRoute` = `planRouteLayout(plan, key, screens)`, then **one**
  `sketchRoute` call for the whole route, then the band derivation:
  - `sketchRoute({ seed: carveSeed, routeIndex: 0, biomeId: layout.biomeId,
    layout: biomeForRoute(node.id).layout, width: layout.width,
    height: layout.height, openings: layout.openings.map(({ edge, role }) =>
    ({ edge, role })), grassPatches: biome.terrain.grassPatches,
    ledges: biome.terrain.ledges, wall: DEFAULT_WALL_FOOTPRINT })`.
    Pass **no** `loot`, **no** `lootExclude`, **no** `trainerArchetypes`, no
    `quiet`, no `gate`, no `signEdge`: population is `[Task-277]`'s.
  - `bands`: the layout opening whose `role` is `'entry'` is anchored on
    `routeMap.entry`, and the `'exit'` openings are anchored on `routeMap.exits`
    in order. Each band's cells are
    `openingBandCells(opening.edge, anchor, width, height,
    SHAPES[routeMap.shape].pathWidth)` — the shipped `doors.ts` helper and the
    carver's own lane width, never a hard-coded 2.
  - `spine` is `routeMap.spine`, `entry` is `routeMap.entry`, `exits` is
    `routeMap.exits`, `screens` is `layout.screens`.
- **Why one carve and not one per screen.** `sketchRoute` chooses each opening's
  border column from its own stream and `RouteRequest` (read-only this batch) has
  no field to force it. Two independently carved slices therefore open their
  shared seam at two different columns, and joining them would leave a horizontal
  tunnel across the map at every seam — the opposite of "there is no seam". The
  carver is still the carver: it is handed the route's whole height, its openings
  and its biome, and it returns one map that already satisfies every criterion
  below. `screens` stays a real concept (it is what the height and
  `spineSegments` are made of) so a later batch can anchor per-screen content.
- Rules: no Phaser, no DOM, no `Math.random`, no `localStorage`; one biome per
  map; **no `DOOR` (15) and no `EXIT` (2) cell is ever written** — every
  connection is plain `FLOOR` on the map's own border.

### TypeScript — `src/engine/region/route/streams.ts`

```ts
export { nodeStreams, type NodeStreams, type NodeStreamPass } from '../streams';
```

Nothing else in the file. It exists so the folder's barrel re-exports the whole
route surface (the plan's node streams included) and a later batch imports the
route's four passes from one place.

### TypeScript — `src/engine/region/route/index.ts`

```ts
export * from './layout';
export * from './map';
export * from './streams';
```

No other symbol, no default export.

### Data

- Reads `ROUTE_WIDTH`, `ROUTE_HEIGHTS` (`src/data/region.ts`) and
  `biomeForRoute` / `BIOMES` (`src/data/biomes.ts`). It hard-codes no size, no
  biome id and no terrain count.

## 🧩 Data and configuration

No new data row. `SCREEN_HEIGHT = 40` is the carver's own screen height (the plan's
`ROUTE_HEIGHTS` are 120/160/200 = 3/4/5 × 40) and lives in `layout.ts` as the one
geometry constant of the folder, beside `sketch.ts`'s own generator constants.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the two test files below.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-272` — must be **exactly** the eight
    paths of the exclusive list (nothing under `src/engine/routes/`,
    `src/engine/region/index.ts`, `src/engine/region/README.md`, `src/scenes/`).
  - Every criterion below is `[unit]`; **no browser pass is owed** and QA runs no
    scene.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean.
  - [ ] `[unit]` `npm test` is green, and `npm test -- src/engine/region/route -t
        "stacks two, three and four 60x40 screens from the node"` passes.
  - [ ] `[unit]` `npm test -- src/engine/region/route/layout.test.ts -t "names
        every neighbour exactly once, the entry band on N"`: for each of the seeds
        `['alpha','bravo','charlie','delta','echo','foxtrot','golf','hotel']`
        and **every** node of `planRegion(seed).nodes` whose kind is `'route'` or
        `'lateral'`, `planRouteLayout(plan, node.key).openings.map((o) =>
        o.neighbourKey)` sorted equals `[...node.edges]` sorted, exactly one
        `'entry'` opening exists, it is on `'N'`, and a node with a single edge
        has `openings.length === 1`.
  - [ ] `[unit]` `npm test -- src/engine/region/route/layout.test.ts -t "forces a
        screen count without moving the openings"`: for the same seeds and nodes,
        `planRouteLayout(plan, key)` and `planRouteLayout(plan, key, 2 | 3 | 4)`
        return equal `openings` and `biomeId`, and `height` equals
        `ROUTE_HEIGHTS[n - 2]`.
  - [ ] `[unit]` `npm test -- src/engine/region/route/layout.test.ts -t "splits
        the spine per screen, one non-empty segment each"`: for eight seeds ×
        `screens` ∈ {2,3,4} on the node `route:1`, `spineSegments` returns
        `screens.length` segments, each non-empty, and their concatenation sorted
        by `y` equals the route's `spine`.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "carves 60 x
        every ROUTE_HEIGHTS for eight seeds"`: for every seed × `screens` ∈
        {2,3,4} on `route:1`, `const map = generateRoute(plan, 'route:1', screens)`
        has `map.width === ROUTE_WIDTH` and `map.height ===
        ROUTE_HEIGHTS[screens - 2]`, and `map.tiles.length === map.height` with
        every row `60` long.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "connects the
        entry band to every exit band"`: `reachableTiles(map.tiles, map.entry)`
        (from `src/engine/routes/validate.ts`) contains every cell of every band
        whose `role` is `'exit'`; for a lateral node the assertion is that the
        entry band is walkable and `map.exits` is empty.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "leaves no
        walkable cell outside the reachable set"`: for the same 24 maps, every
        cell that is not on the border ring (`x === 0 || x === width - 1 ||
        y === 0 || y === height - 1`) and for which `isWalkable(map.tiles, tile)`
        is true is present in `reachableTiles(map.tiles, map.entry)`.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "keeps every
        opening on the final border and draws no door"`: every band cell satisfies
        `borderEdge(cell, map.width, map.height) === band.edge`, every band cell is
        `FLOOR` (`tileAt`), every screen boundary `screens[i].bottom` /
        `screens[i + 1].top` is crossed by at least one walkable column
        (`{x : isWalkable(tiles, {x, y: bottom})}` ∩ `{x : isWalkable(tiles,
        {x, y: top})}` is non-empty), and no cell of the map is `DOOR` or `EXIT`.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "resolves
        every cell to a frame in the forest tileset"`: `buildFrameMesh(map.tiles,
        FRLG_FOREST_TILESET).frames` holds no `-1` for the same 24 maps.
  - [ ] `[unit]` `npm test -- src/engine/region/route/map.test.ts -t "pins a fixed
        seed's stitched digest"`: the file defines a `digest(plan, key, screens)`
        that returns `${width}x${height}|${biomeId}|${entry.x},${entry.y}|` +
        `bands.map((b) => b.edge + ':' + b.neighbourKey + ':' +
        b.tiles.map(tileKey).join('.')).join('|') + '|' +
        hashSeed(tiles.map((row) => row.join('')).join('/')).toString(36)`, and
        asserts it with a **literal `toBe('…')`** (no snapshot file) for
        `planRegion('alpha')` / `'route:1'` / `3`. Run that single test twice:
        both runs green and `git status --porcelain` stays empty.
  - [ ] `[unit]` `npm test -- src/engine/region/route/layout.test.ts -t "rejects a
        key that is not a route or a lateral"`: `planRouteLayout(plan, 'city:1')`
        and `planRouteLayout(plan, 'nope:1')` both throw, and
        `planRouteLayout(plan, 'route:1', 5 as 2)` throws.
  - [ ] `[unit]` `git diff --name-only origin/main...task-272` lists nothing
        outside the eight exclusive paths.
  - [ ] `[unit]` `src/engine/region/route/README.md` names every file in the
        folder, one role line each, with no exported name in the lines, and
        `docs/routes-spec.md` §1 says a route is two to four 60-wide screens of one
        biome with one band per neighbour.
  - [ ] No `[live]` criterion exists for this task; **no browser pass is owed**.

## 📣 Coordination

- **For the Architect:** the item's "the carver is called per screen slice" is not
  reconcilable with "there is no seam" while `RouteRequest` cannot force an
  opening's border column; this spec freezes one whole-route carve instead (see
  `map.ts` above) and keeps `screens` as the real height/section concept.
- **For the next batch (the world scene):** `RegionRouteMap` is the whole public
  surface — `tiles`, `entry`, `exits`, `spine`, `bands`, `screens`. A scene walks
  and draws it; it must not re-derive the bands (`bands` is authoritative). The
  bar to walk through is `bands[i].tiles`; a lateral has one band and no exit, so
  its `exits` is `[]`.
- The folder's barrel (`index.ts`) is **not** wired into
  `src/engine/region/index.ts` by this task — `[Task-277]` owns that file.
  `src/engine/region/README.md` lines 26-29 still say the folder is empty;
  `[Task-277]` rewrites them, this task does not.
- `docs/routes-spec.md` §1 must say, in one paragraph, that the shipped
  single-screen room pipeline in §2 is the **legacy floor generator** the region
  replaces and that it is swept in Batch 125 — otherwise §1 and §2 contradict each
  other in the combined document.

## ⛔ Out of scope

- No scene work: `RouteScene`/`WorldScene` are untouched, no camera, no drawing,
  no scroll. The route is never wired into a scene here.
- No population: no trainers, no ground items, no pockets, no gate, no chamber
  policy beyond what the carver does on its own. That is Batch 119's
  `planNodeContent`.
- No save change, no `RunState`, no `Position`.
- No change to `src/engine/routes/**` — not one line. If the shipped carver
  misbehaves on a tall map, report it; do not fix it here (Batch 125 deletes
  those modules).
- No new dependency, no new tileset, no new map value.
- No deletion of the old floor modules.
