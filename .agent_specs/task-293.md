# Spec: Task-293 — The whole region plays at its real scale

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + data.
- **Role:** Dev.
- **Objective:** the region's full scale stops living in `plan.ts`'s local constants
  and becomes a frozen, documented table the tests can measure: nine settlements,
  eight gym cities and eight main routes, one or two laterals per stretch, one
  Victory Road, the League and the tower — `src/data/region.ts` owns the counts,
  `planRegion` reads them, and `plan.test.ts` asserts the whole arithmetic end to end
  over 64 seeds, including the badge-order walk that must never need a badge the
  player does not hold.
- **Environment:** worktree `../wt-pkm-293`, branch `task-293` (already created;
  `node_modules` is installed — do **not** reinstall, do **not** junction or symlink
  any asset tree).
- **Dependencies (already merged, read them, do not edit them):**
  - the region plan — `src/engine/region/plan.ts` (this task edits it) and its test;
  - the settlement names — `src/engine/region/names.ts`;
  - the settlement generator — `src/engine/region/city/plan.ts` (`planCity`), read
    only, for the size/building assertions;
  - the badge guard — `src/engine/run/gates.ts` (`exitGate`, `nextBadge`), read only,
    for the badge-order walk;
  - the data tables — `src/data/region.ts` (this task edits it) and its test.

### Exclusive paths (single writer)

**Nothing outside this list.** Five paths.

- `src/engine/region/plan.ts`
- `src/engine/region/plan.test.ts`
- `src/data/region.ts`
- `src/data/region.test.ts`
- `docs/region-spec.md` — **§1 only** (`## 1. What a region is`). Edit the frozen
  counts in place; do not add a subsection, do not touch §2-§8.

`src/engine/region/README.md` is **not** this task's and must not be edited: this task
adds no file to that folder, and its `plan.ts` line stays true as written. Task-288
writes that README in this batch. `src/data/README.md` is Task-289's (it adds the
`pois.ts` bullet); this task adds no file there either, so its `region.ts` bullet is
updated **in `src/data/region.ts`'s own header** instead (below).

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`.
- `docs/region-spec.md` — §1 (the section you edit), §2 (identity), §3 (the badge
  ladder), §4 (the guard), §5 (flying).
- `src/engine/region/plan.ts`, `plan.test.ts`, `names.ts`, `streams.ts`,
  `city/plan.ts`, `city/index.ts`, `route/map.ts`,
  `src/engine/run/gates.ts`, `src/engine/run/travel.ts`, `src/engine/rng.ts`.
- `src/data/region.ts`, `src/data/region.test.ts`.

No `design/screens/` frame: this task ships no screen and no HUD panel.

## 🔒 Contract

### `src/data/region.ts`

```ts
/**
 * The region's frozen counts, in one table: what a seed's region always holds.
 * `planRegion` reads these and never hard-codes one; a rebalance changes them here.
 */
export const REGION_COUNTS: Readonly<{
  /** The gym cities, one per badge, badges 1-8. */
  cities: number;                 // 8
  /** One long main route per stretch. */
  mainRoutes: number;             // 8
  /** One or two optional detours per stretch. */
  lateralsPerStretch: Readonly<{ min: number; max: number }>;   // { min: 1, max: 2 }
  /** The starting town. */
  towns: number;                  // 1
  /** The gauntlet between the eighth city and the League. */
  victoryRoads: number;           // 1
  /** The Elite Four and the Champion, one node. */
  leagues: number;                // 1
  /** The endless node behind the Champion. */
  towers: number;                 // 1
  /** The settlements a region names: the town plus every city. */
  settlements: number;            // 9
}>;
```

`REGION_COUNTS` is a plain frozen object literal (`as const` is not needed; the
`Readonly<…>` annotation is the codebase's style). The `settlements` value **must**
equal `towns + cities`; assert it rather than derive it, so a future edit cannot drift
silently.

### `src/engine/region/plan.ts`

```ts
/** The counts a plan actually holds, read off the plan itself. */
export type RegionScale = Readonly<{
  nodes: number;
  settlements: number;
  cities: number;
  gymCities: number;
  routes: number;
  mainRoutes: number;
  laterals: number;
  victoryRoads: number;
}>;

/** The plan's own arithmetic, counted. Pure; reads no RNG and no clock. */
export function regionScale(plan: RegionPlan): RegionScale;
```

- `regionScale` counts the plan: `settlements` = the `town` and `city` nodes,
  `cities` = every `city`, `gymCities` = every node with `gym === true`, `routes` =
  `route` + `lateral`, `mainRoutes` = every `route`, `laterals` = every `lateral`,
  `victoryRoads` = every `victory-road`, `nodes` = `plan.nodes.length`.
- Every local constant the plan used for the counts goes away and is read from
  `REGION_COUNTS` instead: `CITY_COUNT`, `SETTLEMENT_COUNT`, `CHAIN_LENGTH`,
  `LATERALS_MIN`, `LATERALS_MAX`. `CHAIN_LENGTH` becomes
  `REGION_COUNTS.cities * 2 + REGION_COUNTS.towns + REGION_COUNTS.victoryRoads +
  REGION_COUNTS.leagues + REGION_COUNTS.towers` (20 for the shipped table), and the
  half of the chain that is not `town`/`route`/`city` is built from the four single
  nodes' counts, so a table with a different `cities` still emits a consistent spine.
- **Nothing else changes.** Draw order, positions, names, badges, caps, distances and
  edges stay exactly as they are, so `plan.test.ts`'s pinned digest for seed `alpha`
  (line 311) **must not move**. If it changes, the arithmetic changed — revert it.
- `planRegion(seed)` keeps its signature and its purity: same seed → same plan.

### `src/data/region.ts` — header

The file header states the settled counts and points at `REGION_COUNTS`: nine
settlements, twenty chain nodes, sixteen to twenty-four routes, one Victory Road, one
League, one tower, and that `planRegion` reads the table rather than hard-coding it.
Do not export anything else.

## 🧩 Data and configuration

| constant | value | meaning |
| --- | --- | --- |
| `REGION_COUNTS.towns` | `1` | the starting settlement |
| `REGION_COUNTS.cities` | `8` | the gym cities, badges 1-8 |
| `REGION_COUNTS.mainRoutes` | `8` | one long route per stretch |
| `REGION_COUNTS.lateralsPerStretch` | `{ min: 1, max: 2 }` | the optional detours |
| `REGION_COUNTS.victoryRoads` | `1` | the eighth city's gauntlet |
| `REGION_COUNTS.leagues` | `1` | Elite Four + Champion |
| `REGION_COUNTS.towers` | `1` | the endless node |
| `REGION_COUNTS.settlements` | `9` | towns + cities |

Derived, never stored: chain length **20**, routes **16-24**, nodes **28-36**.

`docs/region-spec.md` §1 is edited in place to say the same numbers and to name
`REGION_COUNTS` as their home. Every other section keeps its text: the ladder (§3),
the guard (§4) and the flight (§5) are unchanged.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-293` — audit against the five exclusive paths.
    `docs/region-spec.md` must show **one** hunk, inside §1.
  - **Every criterion is `[unit]`: this task owes no browser pass.** The plan's
    browser walk (a debug teleport through town → city 8 → Victory Road → League)
    needs the node-key teleports that Task-296 (Batch 124) has **not** shipped yet,
    so it cannot be measured today. **No browser pass is owed**; the walk is proven
    headless by the badge-order criterion below and the live pass is owed to the batch
    that ships the teleports.
- **Acceptance criteria:**

  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `src/data/region.test.ts` pins `REGION_COUNTS`: `towns === 1`,
    `cities === 8`, `mainRoutes === 8`, `lateralsPerStretch` is `{ min: 1, max: 2 }`,
    `victoryRoads === 1`, `leagues === 1`, `towers === 1`,
    `settlements === towns + cities === 9`, every value an integer and positive.
  - [ ] `[unit]` `region.test.ts` keeps every shipped assertion green (the three
    tiers' badges/sizes/building counts, `badgeCap`, `citySize`, `cityTierForBadge`,
    `TOWN_SIZE`/`INTERIOR_SIZE`/`GYM_SIZE`/`ROUTE_WIDTH`/`ROUTE_HEIGHTS`).
  - [ ] `[unit]` `src/engine/region/plan.test.ts` proves the scale over **64 seeds**
    (`for (let i = 0; i < 64; i++)` with seeds `scale-0` … `scale-63`):
    `regionScale(plan)` is `{ nodes: 28..36, settlements: 9, cities: 8,
    gymCities: 8, routes: 16..24, mainRoutes: 8, laterals: 8..16,
    victoryRoads: 1 }` and `plan.nodes.length === plan.nodes.length`'s own count.
  - [ ] `[unit]` `plan.test.ts` proves no node is orphaned: over the same 64 seeds,
    every node has at least one edge, every edge is mirrored by the neighbour, no
    edge repeats, and the graph is connected from `plan.townKey` (a flood fill
    reaches all `plan.nodes.length` nodes).
  - [ ] `[unit]` `plan.test.ts` proves every lateral terminates: over the 64 seeds,
    every `lateral` node has exactly one edge, that edge is its `lateralOf` parent,
    and the parent's `edges` names it once; a lateral is on no chain
    (`plan.chain` excludes every lateral key).
  - [ ] `[unit]` `plan.test.ts` proves the Victory Road is one route and the only
    path into the League: over the 64 seeds, exactly one node has
    `kind === 'victory-road'`, that node's neighbours are the eighth city and the
    League, the League's neighbours are exactly the Victory Road and the tower, and
    the tower's neighbour is the League — so no walk can reach the League except
    through the Victory Road.
  - [ ] `[unit]` `plan.test.ts` proves every city's size and building count match its
    tier: over the 64 seeds, for every `city` node `n`,
    `planCity(plan, n.key).width === cityTierForBadge(n.badge).size.width`,
    `planCity(plan, n.key).height === …size.height`, and
    `planCity(plan, n.key).buildings.length === cityTierForBadge(n.badge).buildings`;
    the town is `TOWN_SIZE` with exactly **2** buildings (one `lab`, one `house`).
  - [ ] `[unit]` `plan.test.ts` proves the badge-order walk never needs a badge the
    player does not hold: walk `plan.chain` from the town; keep `held: number[]` and
    push a city's `badge` as the walk beats its gym; before each forward step
    `from -> to` assert `const gate = exitGate(plan, from, to, held)` is `null` or
    `gate.open === true`; and at every `city` node with `gym === true` assert the same
    call **without** that city's badge (held before the gym) answers
    `{ open: false, badge: <the city's own badge> }` — the gate exists and it is the
    one the walk just paid. Over the same 64 seeds.
  - [ ] `[unit]` `plan.test.ts` proves determinism is untouched: the pinned seed
    `alpha`'s plan digest is **byte-identical to `main`** (the test at line 311 is
    not edited), and `planRegion('alpha')` twice is deep-equal.
  - [ ] `[unit]` `plan.test.ts`'s existing suite is otherwise unchanged: the topology,
    the chain walk, the badge/cap/distance block, the route numbering, the key round
    trip, the names and the purity test all still pass with their shipped assertions.
  - [ ] `[unit]` Purity: `src/engine/region/plan.ts` still imports no Phaser, no DOM
    and no clock, contains no `Math.random`, and no draw moved (the digest proves it).
  - [ ] `[unit]` `docs/region-spec.md` §1 names the nine settlements, the twenty chain
    nodes, the sixteen to twenty-four routes, the one Victory Road, the League and the
    tower, and points at `REGION_COUNTS`; `git diff` on that file shows no hunk outside
    §1.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.

- **No `[live]` criterion.** The only live behaviour this task would touch is a debug
  teleport through the chain, which Task-296 (Batch 124) has not shipped; a browser
  pass cannot measure it today, so this task owes **none**. Do not invent one.

## 📣 Coordination

- **For the Orchestrator:** the plan claims `src/engine/region/README.md` for this
  task; this spec does **not** take it (this task adds no file to that folder, so its
  `plan.ts` line stays true, and Task-288 holds the README for its own two lines).
  The exclusive count is therefore five, not six.
- **For the next batch (Task-296's teleports):** once a node-key teleport exists, the
  live walk this task defers becomes measurable — town → city 8 → Victory Road →
  League with every gate opening in order — and the `regionScale` counts are what that
  pass should assert against (`settlements === 9`, `routes` in `16..24`,
  `victoryRoads === 1`).
- **For Task-288/289:** `REGION_COUNTS` is additive; the lateral counts they read off
  `plan.nodes` are unchanged, and their seeds' placements and POIs do not move (the
  plan's digest is pinned by this task's own test).
- **For the balance tasks after this one:** a change to a count is a change to
  `REGION_COUNTS` and *will* move the `alpha` digest; the plan test's pinned string is
  the place that says so out loud.

## ⛔ Out of scope

- Editing `src/engine/region/README.md`, `src/data/README.md`, `src/engine/region/names.ts`,
  `streams.ts`, `content.ts`, `city/plan.ts`, `route/**`, `src/engine/run/gates.ts`,
  `travel.ts`, or any scene.
- Changing the plan's draw order, its positions, its names, its badge/cap arithmetic
  or its edge shape: this task moves **counts into data** and proves the arithmetic,
  it does not retune the world. The pinned `alpha` digest is the proof.
- Adding new `RegionNodeKind`s, new node kinds' generators (Victory Road carver, League
  scene, tower scene) or any teleport/debug key.
- Retuning `CITY_TIERS`' sizes or building counts, or `ROUTE_HEIGHTS`: they are
  asserted as shipped; a wall found by the walk is reported, not "fixed" by moving a
  tier.
- Any HUD panel, `design/screens/` frame, DOM card or `[live]` criterion.
- Any new dependency, `Math.random()` or `Date.now()` in `src/engine/`.
- `src/data/dex/**`, `src/main.ts`, `vite.config.ts`, `package.json`, any generated
  data file.

## ✅ Delivery

Commit on `task-293` only, never on `main`. When `npm test` and `npm run build` are
green, leave an **empty commit** `dev: done task-293` on the tip and
`git push origin task-293`. No other role commits to this branch.
