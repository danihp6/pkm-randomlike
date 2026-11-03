# Spec: Task-276 — RunState v28: the node, the badges and the record

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + save schema.
- **Role:** Dev.
- **Objective:** a run is anchored on a **region node**, not on a floor. `RunState`
  gains `nodeKey`, `visitedNodes`, `badges`, `capturedNodes` and `towerStreak`, the
  save steps 27 → 28 by **discarding** an old run while keeping settings and the
  history store, and the run record counts **badges** instead of floors. The old
  floor fields stay on the state as `@deprecated` compatibility aliases so the
  shipped `RouteScene` keeps compiling and behaving until the sweep deletes them.
- **Environment:** worktree `../wt-pkm-276`, branch `task-276`.
- **Dependencies:** the region plan — `src/engine/region/plan.ts` (`planRegion`,
  `nodeOf`, `RegionPlan`, `RegionNode`) and `src/data/region.ts` (`BADGE_CAPS`),
  both already merged.

### Exclusive paths (single writer)

- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/save.ts`
- `src/engine/save.test.ts`
- `src/engine/run/history.ts`
- `src/engine/run/history.test.ts`
- `src/engine/run/index.ts`
- `src/engine/run/README.md`
- `docs/region-spec.md` **§8 only**

### Inputs (read-only)

- `AGENTS.md`
- `docs/region-spec.md` (§1, §2, §8)
- `src/engine/region/plan.ts`, `src/engine/region/streams.ts`
- `src/data/region.ts`, `src/data/maps.ts`
- `src/engine/maps/plan.ts` (`arrivalEdgeFor`, `planMap`)
- `src/engine/run/{state,save,history}.ts` as shipped
- `src/scenes/RouteScene.ts` (read only, to confirm every deprecated field it reads
  survives — **do not edit it**)

## 🔒 Contract

### TypeScript — `src/engine/run/state.ts`

```ts
export type RunState = Readonly<{
  // ... every field it has today, plus the five below ...
  /** The region node the run stands on: `nodeKey(kind, id)` of a `planRegion` node. */
  nodeKey: string;
  /** Every node the run has entered, in first-entry order, starting with `nodeKey`. */
  visitedNodes: readonly string[];
  /** The badges held, ascending, deduplicated; badge `n` is gym `city:n`'s. */
  badges: readonly number[];
  /** The nodes whose single catch has been spent. */
  capturedNodes: readonly string[];
  /** The tower's own streak, kept apart from the record (`D62`). */
  towerStreak: number;
}>;
```

Rules:

- `mode`, `mapIndex`, `routeIndex`, `routeInMap`, `arrivalEdge`, `discoveredRooms`,
  `bossDefeated`, `levelCap`, `capturedRooms` and the mission fields **stay** and
  keep their current types and meaning. `mode`, `mapIndex`, `routeIndex`,
  `routeInMap` and `levelCap` gain a `@deprecated` doc comment that says they are
  the old floor scene's compatibility fields, derived from `nodeKey` at creation and
  removed by the sweep. They are still encoded by the save: `RouteScene` reads them.
- `visitedNodes` and `capturedNodes` are strings; `badges` holds integers in
  `1..BADGE_CAPS.length + 1`; `towerStreak` is a whole number `>= 0`.
- **No RNG.** This task reads no stream and calls no clock (`D11`).

`createRun(init: RunInit)` keeps its signature and gains:

- `nodeKey = plan.townKey`, `visitedNodes = [plan.townKey]`, `badges = []`,
  `capturedNodes = []`, `towerStreak = 0`, where `plan = planRegion(init.seed)`.
- the deprecated fields, derived by the helper below from `plan.townKey`.

Add one exported pure helper used by both `createRun` and the save decoder:

```ts
export type RunNodeCompat = Readonly<{
  mapIndex: number;
  routeIndex: number;
  routeInMap: number;
  arrivalEdge: MapEdge;
  discoveredRooms: readonly number[];
  bossDefeated: boolean;
  levelCap: number;
}>;

/** The deprecated floor fields a node implies: the plan's chain position read as a floor. */
export function compatForNode(seed: string, key: string): RunNodeCompat;
```

Its rule, exactly:

1. `plan = planRegion(seed)`; `node = nodeOf(plan, key)`; when that is `undefined`
   the node is the plan's town (`nodeOf(plan, plan.townKey)`), never an error.
2. `chainIndex = plan.chain.indexOf(node.key)`; when it is `-1` (a lateral), use
   `plan.chain.indexOf(node.lateralOf ?? '')`, and `0` if that is `-1` too.
3. `mapIndex = Math.min(FINITE_MAPS, Math.max(1, chainIndex + 1))`
   (`FINITE_MAPS` from `src/data/maps.ts`), `routeIndex = Math.max(1, chainIndex + 1)`,
   `routeInMap = 0`, `discoveredRooms = [0]`, `bossDefeated = false`,
   `arrivalEdge = arrivalEdgeFor(planMap(seed, mapIndex), 0)`,
   `levelCap = node.cap`.
4. It reads no RNG and no clock.

`advanceRoute` and `advanceMap` keep their behaviour and **do not touch** the five
new fields: the old floor scene still walks floors until the region scene replaces
it (a later task). Say so in their doc comments.

### TypeScript — `src/engine/save.ts`

- `SAVE_VERSION = 28`.
- `SAVE_MIGRATIONS[27]` is the **only** new step and it is one line of intent:

```ts
27: (document) => ({ ...document, version: 28, run: null }),
```

  It keeps `settings` and `history` exactly as the document carried them.
- `parseRun` reads a **v28** run:
  - the shape guards it has today stay where they still apply: a non-empty string
    `seed`, `mode` of `'finite' | 'infinite'` (deprecated but still required by the
    old scene), a non-empty party, a parseable box and bag. Absent/invalid → `null`.
  - `nodeKey`: a string that `nodeOf(planRegion(seed), ...)` resolves; otherwise
    `plan.townKey`. Never throws on a hand-edited key.
  - `visitedNodes`: the strings that resolve to a node of the plan, in document
    order, deduplicated, and with `nodeKey` appended when absent. An absent field is
    `[nodeKey]`.
  - `badges`: integers in `1..BADGE_CAPS.length + 1`, deduplicated, **sorted
    ascending**. An absent field is `[]`.
  - `capturedNodes`: the strings that resolve to a node of the plan, in document
    order, deduplicated. An absent field is `[]`.
  - `towerStreak`: an integer `>= 0`, else `0`.
  - the deprecated fields keep the decoder rules they have today (`routeIndex >= 1`,
    the room clamped into the plan, `parseDiscoveredRooms`, `readArrivalEdge`,
    …); when one is missing or invalid it falls back to `compatForNode(seed, nodeKey)`
    instead of `floorForRoute`. **`floorForRoute` must not be imported any more**
    (its last two call sites are the ones this task replaces).
- `parseHistory` keeps every row that carries a **v28** shape and drops the ones
  that do not: a row is kept only when `badges` is an integer `>= 0`; its
  `mapReached` is read as today and defaults to `badges`. A row written before v28
  carries `mapReached` and no `badges`, so it is dropped (the floors it counted no
  longer mean anything). Rows keep their existing field checks otherwise.

### TypeScript — `src/engine/run/history.ts`

```ts
export type RunHistoryRecord = Readonly<{
  seed: string;
  /** @deprecated the endless run is retired; the record is the badge count. */
  mode: RunMode;
  /** The badges the run earned. The record (`D62`). */
  badges: number;
  /**
   * @deprecated compatibility figure the shipped stats card and the ranking still
   * read: it equals `badges`, so a card shows the badge count until the sweep.
   */
  mapReached: number;
  catches: number;
  casualties: number;
  playtimeMs: number;
  won: boolean;
  endedAt: string;
  species: readonly RunSpeciesRecord[];
}>;

/** The run fields `makeHistoryRecord` reads. A structural subset of `RunState`. */
export type RunHistory = Readonly<{
  seed: string;
  mode: RunMode;
  badges: readonly number[];
  stats: RunStats;
  party: readonly RunPokemon[];
  box: readonly RunPokemon[];
  rip: readonly RunPokemon[];
}>;
```

`makeHistoryRecord` sets `badges = run.badges.length` and
`mapReached = Math.min(99, run.badges.length)`; everything else is unchanged. No RNG
and no clock: the ending instant still arrives as an argument.

### `src/engine/run/index.ts`

`export * from './state'` and the rest stay byte-identical except for the two lines
below, which you add verbatim (their modules land in two sibling tasks of this
batch; a barrel export of a module that does not exist yet would not build, so they
are **not** exported here — this task only writes the two `README.md` lines):

- none in `index.ts`. Do not add a `export * from './gates'` or
  `export * from './levelCurve'`: those files do not exist in your branch.

### Data

No new data keys. `BADGE_CAPS` (and its length + 1, the League badge) is the only
ladder this task reads.

## 🧩 Data and configuration

None. Every figure this task needs is already in `src/data/region.ts` and
`src/data/maps.ts`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`; green.
  - `git diff --name-only main...task-276` against the exclusive paths list.
  - One `[live]` criterion: a browser pass, described below.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` A v27 document decodes to `run: null` with the **same** settings,
    while the migration's own output keeps the document's `history` array verbatim
    (assert both: the step's return value, and the decoded document).
  - [ ] `[unit]` A v28 document round-trips (`encodeSave` → `decodeSave`) keeping
    `nodeKey`, `visitedNodes`, `badges`, `capturedNodes` and `towerStreak`
    unchanged, and the deprecated `mode` still survives the round trip.
  - [ ] `[unit]` A v28 document whose history rows lack `badges` decodes to an empty
    history; a v28 row with `badges: 3` decodes to one row with `badges: 3` and
    `mapReached: 3`.
  - [ ] `[unit]` `createRun({ seed, starter })` stands on
    `planRegion(seed).townKey`, has `badges: []`, `visitedNodes: [townKey]`,
    `capturedNodes: []`, `towerStreak: 0`, and its deprecated fields equal
    `compatForNode(seed, townKey)`.
  - [ ] `[unit]` The record reads badges: a run with three badges yields a
    `RunHistoryRecord` with `badges: 3` and `mapReached: 3`; a run with none yields
    `0` and `0`.
  - [ ] `[unit]` A hand-edited v28 document with an unknown `nodeKey`, an unknown
    `visitedNodes` entry, badge `0`, badge `99` and a negative `towerStreak`
    decodes without throwing, to the town, with those entries dropped and
    `towerStreak: 0`.
  - [ ] `[unit]` `src/engine/` still imports no Phaser and no DOM, and no
    `Math.random()` or `Date.now()` entered it.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` A **v27** save in `localStorage` boots into the main menu with no
    CONTINUE row and untouched settings. Measurement: start
    `npm run dev -- --port <free> --strictPort`, navigate to it at 1280×800, then
    `localStorage.setItem('pokerandomlike.save', <a v27 document: version 27, a
    settings object with volume 0.4 and language 'es', a syntactically valid
    v27-shaped run, and one history row>)`, `location.reload()`, and read over CDP
    (`Runtime.evaluate`, not a screenshot):
    (a) `document.querySelectorAll('.main-menu__row-button').length === 4`, and no
    row's text contains the CONTINUE label of the active locale (`menu.continue`);
    (b) `JSON.parse(localStorage.getItem('pokerandomlike.save')).settings.volume === 0.4`
    and `.language === 'es'`; (c) the stored document's `run` is `null`. Report the
    three values read.

## 📣 Coordination

- For the Architect: three plan lines could not be taken literally without breaking
  the build, and this spec pins the resolution. (1) `mode` **stays** on `RunState`
  and on `RunHistoryRecord` as a `@deprecated` field: `RouteScene` reads
  `this.run.mode` in four places and the main-menu card filters history by
  `record.mode`, and both are outside this task's paths — the infinite run's removal
  is the sweep's. (2) `mapReached` **stays** on `RunHistoryRecord` as a
  `@deprecated` figure equal to `badges`, because `src/ui/hud/panels/stats/*` and
  `src/net/ranking.ts` still read it. (3) The new levels module is
  `src/engine/run/levelCurve.ts`, not `curve.ts`: `src/engine/run/curve.test.ts`
  already exists (the XP-budget regression, `Task-83`) and must not be overwritten.
- For the next batch: the run is now anchored by `nodeKey`; `visitedNodes`,
  `badges`, `capturedNodes` and `towerStreak` are the fields `travel` (Batch 121),
  `grantBadge`, the catch key and the tower read. The deprecated floor fields are
  read-only history: a new task must not add a reader.
- `src/engine/run/README.md` must gain these lines **verbatim**, in the Layout list,
  after the `history.test.ts` line, because the two siblings of this batch cannot
  write that file:

  ```
  - `gates.ts` — the badge gate on a settlement's way forward: whether an exit is a gate,
    whether the badges open it and which badge it names (`exitGate`, `nextBadge`).
  - `gates.test.ts` — each city's exit with and without its badge, the edges back and the
    named badge.
  - `levelCurve.ts` — the region's level rules: a regular trainer off its stretch's cap, its
    distance to the gym and its party size, a wild at 60-75 % of the squad, a leader at the
    cap, and the band a node reads (`trainerLevel`, `wildLevel`, `leaderLevel`,
    `bandForNode`).
  - `levelCurve.test.ts` — the three size factors, the distance ladder, the wild share over
    1 000 seeded draws and the leader at the cap.
  ```

  Keep `curve.test.ts`'s existing line untouched.

## ⛔ Out of scope

- Moving the run between nodes, `travel`, the region scene, `grantBadge`, the catch
  key, the tower: later batches.
- Deleting the deprecated fields or the floor modules: the sweep.
- Any edit to `src/scenes/**`, `src/ui/**`, `src/net/**` or `src/data/**`.
- Regenerating the dex.
