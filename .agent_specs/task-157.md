# Spec: Task-157 — The centre chamber, and the dead ends lose their branches

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (route generator) + docs.
- **Role:** Dev.
- **Objective:** Every room **with no through-lane** — the map's **entry room**, its
  **boss room** and every `dead-end` leaf — gets one **central chamber**: a diamond
  grown from the room's own centre, **never a perfect one**, re-rolled per seed on a
  stream of its own (`route:<room>:chamber`), which **stops at the walls** instead of
  stamping a rhombus over them. The chamber joins the room's carved network, so the
  spine, the hazard passes and `validateRoute` still see one floor. **Dead ends lose
  their optional branches** (`branchCount` 2 → 0) and the loot and trainers those
  branches carried move **into the chamber's own pockets**, using the rule the
  branches' pockets already follow (an item sits on the deepest, wall-hugging floor
  tile).
- **Environment:** worktree `../wt-pkm-157`, branch `task-157`.
- **Dependencies:** none. The pipeline, the streams and the shape table ship.

### Exclusive paths (single writer)

Nothing outside this list. No other task in this batch claims any of these paths.

- `src/engine/routes/streams.ts`
- `src/engine/routes/streams.test.ts`
- `src/engine/routes/layout.ts`
- `src/engine/routes/layout.test.ts`
- `src/engine/routes/sketch.ts`
- `src/engine/routes/sketch.test.ts`
- `src/engine/routes/validate.ts` (expected **not** to need an edit; listed so that a
  genuine need does not become a cross-task edit — if you do not change it, say so)
- `src/engine/routes/validate.test.ts`
- `src/engine/routes/terrain.test.ts` (only if a chamber fixture belongs in it; prefer
  `sketch.test.ts`)
- `docs/routes-spec.md` (**this task's alone** — §2 only, see Coordination)
- `docs/maps-spec.md` §2 "Topology: a closed room graph on a grid (D30)" — **only** §2

### Inputs (read-only)

- `src/engine/rng.ts` (`Rng`, `hashSeed`)
- `src/engine/routes/walls.ts` (`WallFootprint`, `DEFAULT_WALL_FOOTPRINT`, `cleanWalls`,
  `wholeRunHeight`) — read the wall footprint rules here; do **not** edit the file
- `src/engine/routes/gate.ts`, `doors.ts`, `trainers.ts` (the population passes the
  chamber must not disturb)
- `src/engine/maps/plan.ts` (`MapRoom.openings`, `MapOpeningKind`), `progress.ts`
  (`RoomView.openings`)
- `src/data/mapSize.ts` (`branchCountForSize`, `terrainScaleForSize`)
- `src/data/biomes.ts`, `src/data/tilesets/*` (the wall pattern a room carries)
- `src/scenes/RouteScene.ts` — **read-only**: Task-156 owns it in this batch. In
  particular `buildRoute` (line 1024-1064) passes `openings` only when `params.room`
  exists and never sets a chamber flag; you must not need it to.
- `AGENTS.md`

## 🔒 Contract

### TypeScript — `src/engine/routes/layout.ts`

```ts
/** The centre chamber a room carves: none, or a jittered diamond. */
export type ChamberKind = 'none' | 'diamond';

export type ShapeSpec = Readonly<{
  openings: readonly Access[];
  links: readonly Link[];
  pathWidth: number;
  jitter: number;
  branchCount: number;
  branchMin: number;
  branchMax: number;
  /** The centre chamber this room carves (`Task-157`). */
  chamber: ChamberKind;
}>;

/**
 * The chamber a room's own opening set asks for: an explicit `override` wins
 * (`true` → diamond, `false` → none); otherwise a room with **fewer than two**
 * openings — the map's entry room (0) and every leaf (1) — carves one.
 */
export function chamberFor(openings: readonly Access[], override?: boolean): ChamberKind;

/**
 * The shape spec for a room's actual opening set: the template's feel (path width,
 * branch count, chamber) with the plan's edges, the links that join them and the
 * chamber the opening set (or `chamber`) asks for.
 */
export function specForOpenings(openings: readonly Access[], chamber?: boolean): ShapeSpec;
```

- `SHAPES`: **`'dead-end'` gets `branchCount: 0`** and `chamber: 'diamond'`; the other
  five keep their `branchCount` and carry `chamber: 'none'`.
- `chamberFor([], undefined) === 'diamond'` (the entry room), `chamberFor([oneAccess],
  undefined) === 'diamond'` (a leaf), `chamberFor([a, b], undefined) === 'none'`,
  `chamberFor([a, b], true) === 'diamond'`, `chamberFor([], false) === 'none'`.
- `specForOpenings` returns `{ ...SHAPES[shapeForEdges(edges)], openings, links: linksForEdges(edges), chamber: chamberFor(openings, chamber) }`.
- The shape-driven path (no `openings`, the dev generator / frame importer / an engine
  test) keeps `SHAPES[shape].chamber`: `'diamond'` for an explicit `shape: 'dead-end'`,
  `'none'` for the other five.

### TypeScript — `src/engine/routes/streams.ts`

```ts
export type RouteStreams = Readonly<{
  layout: Rng;
  terrain: Rng;
  populate: Rng;
  /** The centre chamber's own pass (`Task-157`): `route:<room>:chamber`. */
  chamber: Rng;
}>;

export function routeStreams(seed: string, routeIndex: number, attempt: number): RouteStreams;
```

`chamber: new Rng(hashSeed(\`${base}:chamber\`))` with the existing
`base = \`${seed}:route:${routeIndex}:${attempt}\``, minted beside the other three.
`RouteStreamPass` (`keyof RouteStreams`) gains `'chamber'` for free.

### TypeScript — `src/engine/routes/sketch.ts`

```ts
export type RouteRequest = Readonly<{
  // …every field it carries today…
  /**
   * Force the centre chamber on or off. Absent, the room's opening set decides
   * (`chamberFor`): the entry room and every leaf carve one, everything else does not.
   */
  chamber?: boolean;
}>;

/** One room's centre chamber: the tiles it opened and the loot spots it owns. */
export type ChamberCarve = Readonly<{
  /** Every tile the chamber opened, as `tileKey` strings. */
  tiles: ReadonlySet<string>;
  /** The pockets it owns, in draw order: the two lateral extremes of its widest row. */
  pockets: readonly Readonly<{ x: number; y: number }>[];
  /** The radius the room drew, before the room's own clamp (`4` … `6`). */
  radius: number;
}>;

/**
 * Carves `shape`'s centre chamber into `tiles` and returns it, or `null` when the
 * shape asks for none. Pure: every draw comes from `rng`, nothing else is read.
 */
export function carveChamber(
  tiles: number[][],
  shape: ShapeSpec,
  width: number,
  height: number,
  rng: Rng,
  margin: number,
): ChamberCarve | null;
```

**The carve (pin it exactly; the tests read these rules):**

1. Centre: `cx = Math.floor(width / 2)`, `cy = Math.floor(height / 2)` — the same cell
   the centre spawn uses (`sketch.ts`, the open flow's `entry` fallback).
2. `const drawn = rng.int(4, 6);` — **the first and only radius draw**.
3. Clamp into the room: the usable box is `minX = margin`, `maxX = width - margin - 1`,
   `minY = margin`, `maxY = height - margin - 1`; `radius = Math.max(2, Math.min(drawn, Math.floor((Math.min(maxX - minX, maxY - minY) - 1) / 2)))`.
   The margin is the one `attemptRoute` already computes (`wallMargin(request.wall)`), so
   the chamber can never enter the `cols`-wide band the border ring owns, a corner
   clearance or an opening's band.
4. Half-width per row: `half(dy) = radius - Math.abs(dy)`, and
   `width(dy) = half(dy) + (dy === 0 ? 1 : rng.int(0, 1))` — **the centre row always
   carries one extra tile**, so the outline is *never* the perfect rhombus, and each of
   the other rows is re-rolled per seed. Iterate `dy` from `-radius` to `+radius`, top
   to bottom, so the draw order is fixed.
5. A row carves `x` from `cx - width(dy)` to `cx + width(dy)` — but each cell is written
   **only** when it is inside the usable box and currently `WALL`; the walk stops at the
   first cell that is outside the box (the chamber "stops at the walls": it never bites
   the border ring, never overwrites a lane or a door band, and never touches a cell
   `cleanWalls` could have to tidy). A cell that is already `FLOOR` counts as inside and
   is kept.
6. Pockets: `pockets = [{ x: cx - width(0), y: cy }, { x: cx + width(0), y: cy }]` (left
   then right) — the far ends of the widest row, so the branches' own "deepest,
   wall-hugging" pocket rule lands an item on each side of the chamber.

**Integration in `attemptRoute` (the open flow, between the spine and the branches):**

- `resolveShape(request)` applies the chamber to the spec (see `specForOpenings`).
- Immediately after the spine snapshot and the centre-spawn lane (`snapshot('spine',
  'carve spine')`, line 1482) and **before** `carveBranches`, run

```ts
    const chamber = carveChamber(tiles, shape, width, height, streams.chamber, margin);
    const chamberCarves: BranchCarve[] = chamber
      ? chamber.pockets.map((target) => ({ target, tiles: [...chamber.tiles] }))
      : [];
    if (chamber) {
      for (const key of chamber.tiles) spine.add(key);
      snapshot('branches', 'carve chamber');
    }
```

  then `carveBranches` runs as today and **the two lists are concatenated** — the
  chamber's pockets come first, so `choosePockets` sees them before any branch's:

```ts
    branches = branched.branches;
    carves = [...chamberCarves, ...branched.carves];
```

  (a chamber room has `branchCount: 0`, so `branched` is empty there, but the merge must
  be explicit so a room that ever carries both cannot lose a pocket). The chamber's
  pockets are **not** added to `branches`: a dead end must report `branches: []`.
- `choosePockets` (`sketch.ts`) then sees two carves whose `tiles` are the chamber and
  whose `target` is a lateral extreme, so `pockets` holds two chamber cells and the
  existing `placeItems`/`placeTrainers` passes need **no change**: the item sits on the
  deepest tile of each carve (its target), and the branch trainer's pocket search
  (`TRAINER_POCKET_RANGE`) finds its spot by the chamber.
- Because every chamber tile is in `spine`, the terrain pass (`openKeys`) and the pocket
  rules keep tall grass and ledges **off** the chamber, which is what makes "the chamber
  never bites a ledge, an opening band or a wall" true by construction rather than by a
  guard. Do not weaken `openKeys`/`pocketKeys`.
- `RouteMap.spine` therefore contains the chamber tiles; `RouteMap.branches` does not.
- No new `RouteStep['phase']`: the frame uses the existing `'branches'` phase with the
  label `'carve chamber'`, so the dev stepper paints one more frame and nothing else
  changes.

### Data

- `ShapeSpec.chamber: 'none' | 'diamond'`; `SHAPES['dead-end'].branchCount` 2 → 0.
- The chamber's stream `route:<room>:chamber` (derived: `${seed}:route:${routeIndex}:${attempt}:chamber`).
- No new content table, no run field, no `SAVE_VERSION` step, no i18n key.

## 🧩 Data and configuration

The radius band (`4`…`6`), the centre row's extra tile and the two pockets are in
`sketch.ts` next to the carve, because they are the shape's own geometry, not a
balancing table: no map, band or biome reads them. `branchCount` stays the balancing
knob and now reads `0` for the leaf template.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-157` audit against the exclusive paths list.
  - Every criterion here is `[unit]`: the generator is headless and deterministic, so
    **this task owes no browser pass**.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/engine/routes/layout.test.ts` pins `chamberFor`: `[]` and one
        opening → `'diamond'`; two openings → `'none'`; `true` forces diamond, `false`
        forces none; `SHAPES['dead-end'].branchCount === 0` and
        `SHAPES['dead-end'].chamber === 'diamond'`; the other five templates read
        `'none'` and keep their shipped `branchCount` (0/2/2/3/2).
  - [ ] `[unit]` `src/engine/routes/streams.test.ts` pins the fourth stream: for the same
        `(seed, routeIndex, attempt)`, `routeStreams(...).chamber.next()` twice gives the
        same sequence, and `chamber` differs from `layout`/`terrain`/`populate` at the
        same position; adding it moves nothing — the three shipped streams' first three
        draws are the same values the test pinned before this task.
  - [ ] `[unit]` `src/engine/routes/sketch.test.ts` — **one fixed seed pins one
        chamber's outline**: build a `dead-end` room (`openings: [{ edge: 'W', role:
        'entry' }]`, any 30×30 request) at a written-down seed and assert the exact list
        of `(x, y)` the chamber opened, row by row. Write the literal list into the test.
  - [ ] `[unit]` **Four seeds never repeat an outline**: four written-down seeds on the
        same request give four pairwise-different `(radius, tiles)` pairs.
  - [ ] `[unit]` **Never a perfect rhombus**: for 20 seeds, the chamber's centre row is
        exactly `radius + 1` tiles half-wide and the outline is not equal to the perfect
        diamond of the same radius.
  - [ ] `[unit]` **It stops at the walls**: for 20 seeds and for both the `dead-end` and
        the entry-room request (`openings: []`), every chamber tile is `FLOOR` after the
        carve, none of them lies on the border ring (`x === 0`, `x === width - 1`,
        `y === 0`, `y === height - 1`), none lies within `wallMargin(request.wall)` of a
        border, and none lies in any declared opening's band (`openingBandCells`).
  - [ ] `[unit]` **The chamber is one floor with the room**: every chamber tile is
        reachable from the entry in the final route, the route's `spine` contains every
        chamber tile, and `validateRoute(route).ok` is `true`.
  - [ ] `[unit]` **A dead end fields no branch and still holds its item**:
        `route.branches` is `[]` for a dead-end request, `route.pockets` holds two
        chamber tiles, and a request with a loot pool (`itemChance: 1`) places its item
        on one of them.
  - [ ] `[unit]` **Nothing else moved**: a `straight` room, a `cross` room and a
        two-opening `corridor` room built at the same seeds produce the **same tiles**
        as before this task (pin their tile hashes or a tile list in the test), because
        `chamberFor` answers `'none'` for them and the new stream is never read.
  - [ ] `[unit]` `npm test` is green across the generator's own suite:
        `src/engine/routes/*.test.ts` and `src/engine/maps/*.test.ts` (a dead-end's
        content moved; `validate.ts` stays green on every shape).
  - [ ] `[unit]` `git diff main...task-157 --name-only` lists no path outside the
        exclusive list — in particular **no** `src/scenes/RouteScene.ts` (Task-156's),
        no `src/engine/maps/plan.ts` (Task-158's), no `src/engine/routes/walls.ts`, no
        `src/engine/run/**`, no `package.json`.

## 📣 Coordination

- **For the Architect / the plan:** `walls.ts` is **not** in the exclusive list (the
  TODO entry claimed it): the chamber keeps `wallMargin`'s bounds, which `sketch.ts`
  already computes, so `cleanWalls` needs no change and the file stays read-only for
  this task. `validate.ts` is listed but expected to need no edit.
- **For Task-158 (Batch 71):** the boss room today carries **two** openings (`roomView`
  adds the sealed portal to the link), so `chamberFor` answers `'none'` for it. Task-158
  makes the boss room a two-door line and the chamber must sit in the middle: it sets
  **`chamber: true`** on that room's `RouteRequest` (it owns `RouteScene.ts` then — the
  flag already exists, so this task needs no scene change) and reads
  `RouteMap.spine`/`chamberFor`'s contract from here. The entry room needs nothing: it
  arrives with `openings: []` and gets its chamber from `chamberFor` alone.
- **For the next batch:** `RouteRequest.chamber`, `ShapeSpec.chamber`, `ChamberCarve`
  and `carveChamber` are frozen. `RouteMap.pockets` keeps its `{ x, y }[]` type, so
  nothing downstream learns a new shape.
- **`docs/routes-spec.md` §2 — three edits, all inside §2:**
  1. a **new numbered step between step 1 (Layout) and step 2 (Wall tidy)**:
     the centre chamber — which rooms get one (`chamberFor`), the outline formula
     (`|dx| ≤ radius − |dy| + jitter(row)`, the centre row always one wider), the
     `chamber` stream, and the rule that it stops at the walls.
  2. the sentence at the end of the pipeline ("Every build pass draws from its own `Rng`
     stream, all derived from `(seed, routeIndex, attempt)`") gains the fourth stream's
     name.
  3. the "**Biome and shape.**" paragraph: `dead-end` has **no** branches now, and its
     words "opening into a small **chamber** on a roomy map" (a branch's far end) must be
     renamed to **cul-de-sac** in that paragraph and anywhere in §2 that uses "chamber"
     for a branch end, so the doc never confuses the branch cul-de-sac with the centre
     chamber.
- **`docs/maps-spec.md` §2 — one edit:** the shape table (the six "Openings → Shape"
  rows) gains a sentence under it naming which rooms carry the centre chamber (the
  entry, the boss and every `dead-end`), and that a dead-end's content now sits in the
  chamber's pockets. Do not touch §6 (Task-156's), §7 or §10.

## ⛔ Out of scope

- Moving the boss's cell or the player's spawn into the chamber — Task-158.
- Changing the boss room's opening set, its portal or `bossRoomSealed` — Task-158.
- A chamber for any other shape (a `corridor`, `bend`, `tee`, `cross` or `straight`
  room without an explicit `chamber: true`), and a chamber bigger than the room allows.
- New terrain inside the chamber (grass, ledges, water), a new tile type or a new
  tileset frame.
- The `hedges` and `maze` carvers (parked, `D6`) — the chamber is an **open**-flow carve
  only; both keep their current output.
- Re-tuning `branchCount`, `branchMin`/`branchMax` or the map-size tiers for any shape
  other than the dead-end template.
- A save field, an i18n key or a `SAVE_VERSION` step.
