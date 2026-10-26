# Spec: Task-176 — A TM is never generated twice as a ground item in one run

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (route generator) + one scene wiring line + one doc line.
- **Role:** Dev.
- **Objective:** Ground items stop handing out the same Technical Machine twice in
  one run. TMs are **reusable keys** here (the run never spends one), so a second
  copy is dead weight. The sketch request learns which ids the run already owns
  (`lootExclude`) and the item pass remembers what it has already placed **inside
  one route**, so neither a second room of the run nor a second pocket of the same
  route can roll a TM the run has or has already placed. Every other item may
  repeat — a second Potion stays legal — so the weighted table only moves for
  TM-bearing pools.
- **Environment:** work only in your own worktree
  `/home/runner/work/pkm-randomlike/wt-pkm-176`, branch `task-176`, spec at
  `.agent_specs/task-176.md` inside it. Never work in
  `/home/runner/work/pkm-randomlike/pkm-randomlike` (that checkout is `main`) and
  never push to `main`.
- **Dependencies:** none. `[Task-52]`'s `pickedItems` idiom (a per-floor record the
  scene reads) and `[Task-9]`'s loot pools are already on `main`.

### Exclusive paths (single writer)

Nothing outside this list. No new file is created, so no folder `README.md`
changes.

- `src/engine/routes/sketch.ts` + `src/engine/routes/sketch.test.ts`
- `src/engine/run/items.ts` + `src/engine/run/items.test.ts`
- `src/scenes/RouteScene.ts`
- `docs/routes-spec.md` **§2** (the generation pipeline's loot paragraph only —
  no other section)

### Inputs (read-only)

- `src/data/loot.ts` (`ROUTE_LOOT`, `BandLoot`, `LootEntry`) and `src/data/tms.ts`
  (`isTmItemId`, `TM_MOVE_IDS`) — the pools and the id shape you filter.
- `src/engine/routes/encounters.ts` (`pickWeighted`) — the weighted draw you keep.
- `src/engine/run/state.ts` (`RunState.bag`, `BagCounts`) — where the owned ids
  come from.
- `docs/routes-spec.md` §2 — the pipeline you document.

## 🔒 Contract

### `src/engine/run/items.ts`

```ts
import type { RunState } from './state';

/**
 * The Technical Machines the run owns, in bag order, deduped: every `bag` stack
 * whose id is a TM (`isTmItemId`, `src/data/tms.ts`) and whose count is above
 * zero. Reads no RNG and no clock, so two calls answer the same list.
 */
export function ownedTmIds(run: RunState): readonly string[];
```

- Bag order (the order `run.bag` holds), not sorted: `addItem` appends, so the
  order is deterministic for a run.
- A stack with `count <= 0` is not owned (defensive; the bag never keeps one).
- Nothing else in the file changes.

### `src/engine/routes/sketch.ts`

`RouteRequest` gains one optional field next to `loot`:

```ts
export type RouteRequest = Readonly<{
  // ... the shipped fields ...
  /**
   * Item ids the caller's run already owns. A TM in this list is never placed as
   * ground loot; every other id is ignored. Absent means nothing is excluded.
   */
  lootExclude?: readonly string[];
}>;
```

`placeItems` keeps its signature role and threads a `taken` set:

- Seed it from `request.lootExclude` (only after filtering through `isTmItemId`:
  a non-TM id in `lootExclude` must never remove a Potion from a pool).
- Per accepted pocket, in the shipped order:
  1. the `itemChance` roll (`rng.next() >= itemChance` skips the pocket) —
     unchanged and **first**;
  2. build the candidates as `loot.filter((entry) => !taken.has(entry.itemId))`;
     if that is empty, skip the pocket and draw **nothing else**;
  3. `pickWeighted(candidates, rng).itemId`;
  4. `if (isTmItemId(itemId)) taken.add(itemId);`
  5. the `hiddenChance` roll, unchanged.
- With `lootExclude` absent and an empty `taken`, the draw sequence and the
  item ids of every shipped seed are **identical to today's** (that is the
  regression criterion below).
- The function's doc comment gains one sentence: a TM is unique to a route and to
  the run (the caller passes what it owns).

### `src/scenes/RouteScene.ts`

One line at the `buildRoute` request (`~1042`, beside `loot: loot.pool`):

```ts
lootExclude: ownedTmIds(this.run),
```

- Import `ownedTmIds` from `../engine/run/items` with the scene's other engine
  imports. No other line of the scene changes.

## 🧩 Data and configuration

No new data key and no new pool: the rule reads the shipped `ROUTE_LOOT` and
`TM_MOVE_IDS`. `src/data/loot.ts` is **not** in this task's paths — a later
balance pass owns the pool contents.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-176` audit against the exclusive paths list.
  - `git diff --stat` must show `src/data/dex/**` and `src/data/loot.ts` untouched.
  - `[live]`: a dev server plus CDP over the headless Chromium, as `docs/agent-ci.md`
    describes. Start your own `npm run dev -- --port <free> --strictPort` and stop
    it when done; prefer reading the game through the page's own modules
    (`await import('/src/main.ts')` exposes `game`) over a screenshot. Say which
    method produced each piece of evidence.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `items.test.ts`: `ownedTmIds` reads a bag of
    `tm032`, `potion`, `tm001` as `['tm032', 'tm001']` (bag order), answers `[]`
    for an empty bag, ignores a `tm999`-shaped stack whose count is 0, and never
    returns a non-TM id.
  - [ ] `[unit]` `sketch.test.ts`: over **40 fixed seeds**, a request with the full
    `early`/`mid` pool never places the same TM id twice in one route
    (`new Set(tmIds).size === tmIds.length` for each seed).
  - [ ] `[unit]` `sketch.test.ts`: a request whose `lootExclude` names `tm032`
    never places `tm032`, on the same 40 seeds, while a Potion may still appear
    (the exclusion is TM-only).
  - [ ] `[unit]` `sketch.test.ts`: a **fixed-seed regression** — for one named
    seed with no `lootExclude`, the route's item list (ids, itemIds and hidden
    flags) is the same list the shipped generator produces today; the same seed
    with `lootExclude: ['tm032']` is re-pinned in the test (the filtered pool
    shifts the draw, and the new list is recorded, never left stale).
  - [ ] `[unit]` `git grep` shows `lootExclude: ownedTmIds(this.run)` in
    `RouteScene.buildRoute` and no other change to the scene's request.
  - [ ] `[live]` On a running build (`npm run dev` + CDP): put two TMs in the bag
    (`game.scene.getScene('Route').addDebugItem('tm032', 1)` and `'tm001'`),
    regenerate a route over **8 seeds** (`regenerateRoute({ seed, routeIndex: 1, … })`)
    and read `scene.route.items`: **zero** of those 8 routes places an item id the
    bag holds, and no route places the same TM id twice. The measurement is the
    count of excluded ids placed (must be 0) and a set-size equality per route.
  - [ ] `[unit]` `docs/routes-spec.md` §2 states the rule in the loot paragraph:
    a TM is unique to the run (the scene passes the bag's TM ids as
    `lootExclude`), a TM cannot repeat inside one route either, and every other
    item may repeat.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

## 📣 Coordination

- For the next batch: `RouteRequest.lootExclude` is the general "the run already
  owns these" seam; it currently filters TMs only. A later rule about a unique
  key item extends the filter **and** whatever `isTmItemId` becomes — do not
  duplicate the predicate in the sketch.
- For the scene: `ownedTmIds(this.run)` is read at `buildRoute` time, so a route
  rebuilt after a pickup (a floor advance, a revisit) already sees the new TM.

## ⛔ Out of scope

- `src/data/loot.ts` contents, the pools' weights, `ROUTE_LOOT` bands.
- The Mart, the shop and the TM tutor (`src/data/shop.ts`, `src/ui/`).
- The bag's own model (`addItem`/`removeItem`) and anything in `src/engine/run/state.ts`.
- Any change to `src/data/dex/**` or a new item.
