# Spec: Task-158 — The boss room is a two-door line with the chamber, and the boss lives in it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (map plan + route chamber) plus one Phaser scene edit.
- **Role:** Dev.
- **Objective:** the map **plan** gives the boss room **two openings** — its one `link` plus
  a new `portal` on the **opposite** wall — so it reads `corridor` instead of `dead-end`; the
  route builder carves `Task-157`'s centre chamber into it (the boss room forces
  `RouteRequest.chamber`); the **boss stands inside that chamber** on every floor instead of
  on the room's farthest walkable tile; and the entry room's centre spawn is pinned as
  chamber floor. `bossRoomSealed` is untouched: the portal exists in the plan and in the
  carved geometry from the start and still refuses the step out until the boss falls.
- **Environment:** worktree `../wt-pkm-158`, branch `task-158`.
- **Dependencies:** `[Task-157]` (Batch 70, merged) — `carveChamber`/`ChamberCarve` and the
  `route:<room>:chamber` stream in `src/engine/routes/sketch.ts`, `ShapeSpec.chamber` and
  `chamberFor` in `src/engine/routes/layout.ts`, and `RouteRequest.chamber`. `[Task-161]`
  merges **after** this task and also edits `RouteScene.ts`.

### Exclusive paths (single writer)

- `src/engine/maps/plan.ts`, `src/engine/maps/plan.test.ts`
- `src/engine/maps/progress.ts`, `src/engine/maps/progress.test.ts`
- `src/engine/routes/routeMap.ts`, `src/engine/routes/sketch.ts`,
  `src/engine/routes/sketch.test.ts`
- `src/scenes/RouteScene.ts`
- `src/ui/mapView.ts`, `src/ui/mapView.test.ts`
- `docs/maps-spec.md` — **only** §2, §3 (steps 4 and 5 of the pseudo-code block), §6 and §10's
  `O-M3` record. No other section.

### Inputs (read-only)

- `docs/maps-spec.md`, `docs/routes-spec.md` (§2, the chamber paragraph), `docs/design-spec.md`.
- `src/engine/routes/{layout,doors,validate,bossRoom}.ts`, `src/engine/maps/index.ts`,
  `src/engine/run/floors.ts`, `src/engine/tileset.ts` (`TILE_SIZE = 24`), `src/data/maps.ts`
  (`MAP_MIN_ROOM_SIZE = 30`), `src/dev/debugMenu.ts` (the `dev.location.tile` label the
  `[live]` reads).
- `src/scenes/RouteScene.ts` before editing: `buildRoom` 660-725, boss placement 701-704,
  `bossTrainer` 951-961, `farthestRoomTile` 967-997, `buildRoute` 1014-1070 (the request at
  1026-1066), `applyRoute` 1079-1084, `sealEdge` 1974-1981.

## 🔒 Contract

```ts
// src/engine/maps/plan.ts
export type MapOpeningKind = 'link' | 'entry' | 'portal';
// MapOpening stays Readonly<{ edge: MapEdge; kind: MapOpeningKind }>; planMap keeps its
// signature. When the boss room's openings hold exactly one `link`, planMap appends one
// { edge: OPPOSITE_EDGE[linkEdge], kind: 'portal' } and sorts both by MAP_EDGES order, so
// `shape` reads 'corridor'. If no leaf could be hung (appendBoss returned -1) the boss is a
// regular room and gains no portal. No new RNG draw.

// src/engine/maps/progress.ts
export function portalEdgeFor(plan: MapPlan, roomId: number): MapEdge | null;
// The edge of the plan's `portal` opening; the old `freeEdges(plan, roomId)[roomId %
// free.length]` pick survives only as the fallback for a plan with none. roomView is
// behaviourally unchanged — every `kind === 'link'` edge plus `portalEdge` — so the `portal`
// opening must not be counted twice (the `link` filter drops it, `portalEdge` re-adds it).

// src/engine/routes/routeMap.ts
export type RouteChamber = Readonly<{
  /** Every tile the carve opened, row-major (by y, then x). */
  tiles: readonly Tile[];
  /** The two loot spots: the widest row's lateral extremes. */
  pockets: readonly Tile[];
  /** The radius the room drew, before the room's own clamp (4 … 6). */
  radius: number;
}>;
// RouteMap gains `chamber?: RouteChamber`, present only when a chamber was carved, so a
// chamber-less route still deep-equals what it did before.

// src/engine/routes/sketch.ts
export function bossChamberTile(route: RouteMap): Tile | null;
// The chamber tile with the greatest Manhattan distance to `route.entry`, ties broken by
// lower y then lower x; null when the route has no chamber. Pure, reads no RNG.
// attemptRoute's RouteMap literal gains, from the `carveChamber` result it already holds:
//   ...(chamber ? { chamber: { tiles: <row-major>, pockets: chamber.pockets, radius: chamber.radius } } : {})

// src/scenes/RouteScene.ts (not exported: the two edits made here)
// buildRoute's RouteRequest gains, beside `quiet`:
//   ...(params.room?.boss === true ? { chamber: true } : {})
// bossTrainer uses: const position = bossChamberTile(this.route) ?? this.farthestRoomTile();
```

- **Determinism:** `planMap` takes **no new draw** (the portal edge derives from the boss's
  link); the carve still reads only the room's `route:<room>:chamber` stream; `chamber: true`
  draws nothing. A fixed seed's rooms, cells, links, sizes, specials and roles stay
  byte-identical; only the boss room's `openings` and `shape` move.
- **Unchanged:** `bossRoomSealed`, the `MAP_MIN_ROOM_SIZE` (30x30) pinning of the entry, boss
  and special leaves, every RNG stream name, every `src/data/` table.
- Rules: no Phaser import in `src/engine/`, no DOM, no per-frame allocation.

## 🧩 Data and configuration

Nothing to add: the boss room's 30x30 size is pinned in `src/data/maps.ts`, the corridor's
feel comes from `SHAPES.corridor` (`pathWidth: 2`, `jitter: 1`, `branchCount: 0`), and the
boss room's chamber is forced by `RouteRequest.chamber` because it now has two openings.

## 🧪 Test and Validation Plan (for QA)

- **Method:** `npm test` (Vitest, headless, green including the new tests); `npm run build`
  (`tsc --noEmit && vite build`); `git diff --name-only main...task-158` against the exclusive
  paths; then the one `[live]` criterion on a dev server over CDP.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `plan.test.ts`'s `assertPlan` holds on the eight shipped seeds × maps 1-8: the
        boss room has exactly one `link` and exactly one `portal`, opposite each other, `shape`
        `'corridor'`, no other room has a `portal`, and the "no dangling opening" loop skips
        `kind === 'portal'` and asserts it resolves to no link.
  - [ ] `[unit]` A 20-fixed-seed test (maps 1-4) asserts the boss's `portal` edge is
        `OPPOSITE_EDGE` of its link edge and `portalEdgeFor(plan, plan.bossRoom)` returns it.
  - [ ] `[unit]` The three pinned floors (`ALPHA_MAP_8`, `SHIPPED_FLOORS`, `PRE_TASK_ROOMS`) are
        re-pinned with the boss room's `shape` token `dead-end` → `corridor` and **nothing else**:
        every other room's id, cell, size, shape, special and every link stay byte-identical.
  - [ ] `[unit]` A 20-fixed-seed test builds the boss room's **production** request —
        `openings: roomView(plan, plan.bossRoom, false).openings`, the room's `width`/`height`,
        `chamber: true`, `quiet: true`, `role: 'wild'`, `routeIndex: routeIndexForRoom(plan,
        plan.bossRoom)` — and asserts `route.chamber` is defined, every one of its `tiles` is
        `FLOOR`, the room's centre `(floor(width/2), floor(height/2))` is in it, and
        `bossChamberTile(route)` is in it, is not `route.entry`, and is ≥3 tiles off every border.
  - [ ] `[unit]` The same 20 seeds assert the **entry** room's route (empty `openings`, no forced
        `chamber` request — its chamber comes from the shape) has `route.entry` `(15,15)` listed in
        `route.chamber.tiles`, and that each
        row between the min/max x of `chamber.tiles` is `FLOOR`, so the chamber is one region
        through the centre.
  - [ ] `[unit]` `validateRoute(...).ok` is `true` for that boss route and for all six `SHAPES`
        templates forced with `chamber: true` on 20 fixed seeds.
  - [ ] `[unit]` `progress.test.ts` asserts `roomView(plan, bossRoom, false)` keeps
        `portalOpen === false` and one usable exit, `portalEdge` equals the plan's `portal` edge,
        and `bossRoomSealed(true, false)` stays `true`.
  - [ ] `[unit]` `mapView.ts` drops the plan's `portal` opening from `roomOpenings` until
        `portalOpen` (sealed: no `portal` opening; open: exactly one, on `portalEdgeFor`'s edge)
        and `mapView.test.ts`'s opening-count expectation accounts for the plan's new opening.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **The boss lives in its chamber, and the spawn is chamber floor.** `npm run dev`
        (1280x800), start a fresh run, open the dev debug panel and read its Route line
        `map M · room R/C · (x,y)`. (a) In the entry room (`room 0/C`) the line reads `(15,15)` —
        `Math.floor(width/2)` of the 30x30 entry room — and `renderer.snapshotArea` +
        `getImageData` of that tile's inner 12x12 canvas px (24 px per tile, `TILE_SIZE`,
        converted with the route camera's scroll) contain no wall-motif pixel. (b) With the
        panel's *room go*, step `room` ids from `0` to `C-1` until a screen shows **no tall grass
        and exactly one trainer sprite** (the boss room; record `R`), snapshot the canvas and take
        the sprite cluster that is not the player's: its centre's tile must satisfy `x == 15` or
        `y == 15` (the chamber's middle line), both coordinates inside `[3, 26]`, and a
        Manhattan distance ≥6 from the debug line's tile (the boss is not on the door and its
        `sight` of 5 has not started the chase). Report the drawn seed, `R`, the label and the
        computed cell; pass when both parts hold.

## 📣 Coordination

- For the Architect: `[Task-161]` also claims `src/scenes/RouteScene.ts`, `routeMap.ts` and
  `docs/maps-spec.md` §6; re-plan it against what this task shipped (`RouteMap.chamber`, the
  plan's `portal` opening). Nothing else in the batch may claim the files above.
- For the next batch: the boss room is `corridor` in the plan (size still 30x30), its portal
  edge is the plan's `portal` opening (never `freeEdges`' pick), and the boss's cell is
  `bossChamberTile(route)`, not `farthestRoomTile`.
- If a committed test pins a boss-room route's tiles, re-pin it here and name it.

## ⛔ Out of scope

- `bossRoomSealed`, the seal's timing and the portal→next-map step (`advanceRoute`).
- The chamber's outline, radius, jitter and pockets (`Task-157`, frozen).
- Moving the boss's sprite, its sight, its facing rule or its fight's arena roll.
- `src/engine/routes/layout.ts`: `chamberFor` keeps its "fewer than two openings" rule.
- Requiring the grid cell **beyond** the portal to be free: the portal is not a `link`, so
  nothing dangles, and demanding it would move a fixed seed's topology.
- Any `src/data/` table, new i18n key or regenerated asset.
