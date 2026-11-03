# Spec: Task-290 — One catch per grass node, and wilds at 60-75 % of the squad

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + the one scene call site that rolls it.
- **Role:** Dev.
- **Objective:** the run's capture rule and its wild-encounter roll stop being
  **floor/room** facts and become **node** facts. After this task `canCapture` /
  `useCapture` answer for `RunState.nodeKey` against the already-persisted
  `RunState.capturedNodes`, a node that has grass (town, city and route alike) is
  capturable exactly once, and a new pure module `src/engine/region/encounters.ts`
  rolls a node's wild encounter with a level drawn as **60-75 % of the squad's
  level** (`wildLevel`) clamped to the node's own cap. The route scene's grass step
  feeds that module instead of the floor band, so the two rules cannot disagree.
- **Environment:** worktree `../wt-pkm-290`, branch `task-290`.
- **Dependencies (all merged on `main`):** the region plan
  (`src/engine/region/plan.ts`, `RegionNode`, `nodeKey`), the region schema
  (`RunState.nodeKey`, `RunState.capturedNodes`, `src/engine/run/state.ts`), the
  level curve (`bandForNode`, `wildLevel` in `src/engine/run/levelCurve.ts`,
  `WILD_LEVEL_FRACTION` in `src/data/wildLevels.ts`), the region route generator
  (`generateRoute`, `src/engine/region/route/map.ts`) and `WorldScene`
  (`src/scenes/WorldScene.ts`).

### Exclusive paths (single writer)

Nothing outside this list:

- `src/engine/region/encounters.ts` (new)
- `src/engine/region/encounters.test.ts` (new)
- `src/engine/region/README.md`
- `src/engine/run/state.ts`
- `src/engine/run/state.test.ts`
- `src/engine/run/resolve.ts`
- `src/engine/run/resolve.test.ts`
- `src/scenes/RouteScene.ts` — **only** the grass/encounter roll, the capture
  call site and the new dev-only debug hook; do not restyle, rename or refactor
  anything else in this 3 900-line file.
- `src/scenes/WorldScene.ts` — **only if** the grass step must move to the base
  scene to be reachable from every node scene. It must never be dead code: if no
  subclass calls the new seam, do not add it and leave this file untouched.
- `docs/region-spec.md` — **§7.9 only**.

### Inputs (read-only)

- `AGENTS.md`
- `docs/region-spec.md` §7 (the node content rules), §7.9's neighbours
- `docs/routes-spec.md` §3 and §5 (the wild band and the capture rule this task moves)
- `src/engine/region/plan.ts`, `src/engine/region/route/{map,layout}.ts`,
  `src/engine/region/streams.ts`, `src/engine/region/content.ts`
- `src/engine/run/{state,resolve,pool,levelCurve,progression}.ts`
- `src/engine/routes/encounters.ts` (the shipped table/roll/`RouteEncounters`)
- `src/data/biomes.ts`, `src/data/wildLevels.ts`, `src/data/run.ts`
- `src/scenes/RouteScene.ts`, `src/scenes/WorldScene.ts`

## 🔒 Contract

### TypeScript — `src/engine/region/encounters.ts` (new, pure: no Phaser, no DOM, no clock)

```ts
import type { Rng } from '../rng';
import type { RegionNode } from './plan';
import type { RunState } from '../run/state';
import type { Encounter, EncounterTable } from '../routes/encounters';

/** The chance a step in a node's grass rolls a wild: the shipped DEFAULT_ENCOUNTER_CHANCE. */
export const NODE_ENCOUNTER_CHANCE: number;

/** The node's wild table: its band's pool (`bandForNode`) minus the run's exclusions. */
export function nodeEncounterTable(node: RegionNode, run: RunState): EncounterTable;

/** The level a wild of this node rolls: `wildLevel(squadLevel(run), rng)`, clamped to `node.cap`. */
export function nodeWildLevel(node: RegionNode, run: RunState, rng: Rng): number;

/** One step's roll: the table, the level rule and `NODE_ENCOUNTER_CHANCE`, in that order. */
export function rollNodeEncounter(
  node: RegionNode,
  run: RunState,
  rng: Rng,
  options?: Readonly<{ shinyRng?: Rng }>,
): Encounter | undefined;
```

- Reuse the shipped `EncounterTable`, `Encounter`, `encounterTableFor`,
  `rollEncounter`, `wildExclusions(run)`, `bandForNode(node)`, `squadLevel(run)` and
  `wildLevel(squadLevel, rng)`. **No second table model and no second level rule.**
- **Determinism (`D11`):** the module draws **only** from the `Rng` it is handed —
  one `rng.next()` for the chance, one for the level, one `rng.int` for a species
  and (when the species has formes) the shipped `variantSpecies` draw inside
  `rollEncounter`. It reads no `Math.random()`, no `Date.now()` and no run stream
  of its own; the caller owns the stream.
- The level is **never** drawn from the badge or from `band.minLevel`: it is the
  squad's share, clamped into `1..node.cap` (so it can never exceed the node's own
  ceiling).

### `src/engine/run/state.ts` — the capture rule is the node

- `canCapture(run)` returns `!run.capturedNodes.includes(run.nodeKey)`.
- `useCapture(run)` appends `run.nodeKey` to `capturedNodes` (same no-op if it is
  already there, same object identity on a no-op).
- `capturedRooms` **stays in the type** (it is in the v28 encode/decode and Batch
  125 deletes the floors) but no rule in this task reads or writes it.
  `advanceMap`/`advanceRoute` keep resetting it exactly as they do today.
- The doc comments above those functions move from "the room" to "the node".
- `src/engine/run/resolve.ts` needs no logic change beyond what the new signature
  requires: `resolveBattle`'s capture branch already calls `useCapture(next)`, and
  `next.nodeKey` is the node the battle was fought on. Keep `caughtAt` /
  `CatchLocation` **untouched** (see Out of scope).

### `src/scenes/RouteScene.ts` — one call site

- Where the scene builds its `RouteEncounters` (around line 1115), feed it
  `nodeEncounterTable(node, this.run)` and a `levelFor` of
  `(rng) => nodeWildLevel(node, run, rng)`, with `node` resolved from the run's
  `nodeKey` through the shipped `planRegion`/`nodeOf`. Keep the shipped shiny
  stream and `wildExclusions` wiring as it is; if `nodeEncounterTable` already
  applies the exclusions, do not apply them twice.
- The capture call site (`canCapture(this.run)` before the launch, `useCapture`
  on return) needs no edit if the predicate moved under it — verify it, and edit
  only if it does.
- **New dev-only hook**, in the shape of the shipped `debugInteriorState`:
  `debugWildState(): { nodeKey: string; canCapture: boolean; capturedNodes: readonly string[]; encounterChance: number }`
  exposed through the existing `exposeDebugScene` machinery as
  `__pkmRoute.debugWildState()`. It must read live run state, never a snapshot
  taken in `create`.

### Data

- No new data table. `NODE_ENCOUNTER_CHANCE` is the shipped `0.15`
  (`DEFAULT_ENCOUNTER_CHANCE`); re-export or reference it, do not re-literal it in
  two places.

### Docs

- `docs/region-spec.md` **§7.9 only**: the capture is per **node** (`capturedNodes`,
  `nodeKey`), the wild's level is 60-75 % of the squad clamped to the node's cap,
  and the roll is `src/engine/region/encounters.ts`'s. Do not touch §6 (§7.10 is
  not yours either).
- `src/engine/region/README.md`: one line for `encounters.ts` + its test, in the
  folder's existing one-role-line-per-file style. Do not rewrite other lines.

## 🧩 Data and configuration

- `RunState.capturedNodes: readonly string[]` already exists and is already encoded
  and decoded by `src/engine/save.ts`; this task only starts writing it. **No
  `SAVE_VERSION` step** and no migration: an old run simply has no captured node
  and can capture once per node it visits from now on.
- No key is added to `src/i18n/**`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the new tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-290` audited against the exclusive paths
    above.
  - One browser pass at **1280×800** with `?debug` for the single `[live]`
    criterion. Start your own `npm run dev -- --port <free> --strictPort`.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks, builds and the whole suite is green.
  - [ ] `[unit]` The declared tests exist and pass.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[unit]` `canCapture`/`useCapture` are keyed by `nodeKey`: on a run standing
    on a route node with grass, the first `useCapture` adds exactly that key to
    `capturedNodes` and `canCapture` flips to `false`; moving the run to another
    node (`{ ...run, nodeKey: 'route:2' }`) makes `canCapture` `true` again; a
    second `useCapture` on the same node returns the same run object. Pinned in
    `src/engine/run/state.test.ts`.
  - [ ] `[unit]` `rollNodeEncounter` draws a level inside the band **1 000 times**
    for a squad level of 30: every level is `>= 18` and `<= 23`
    (`floor(30 × 0.6)` to `floor(30 × 0.75)`), and none exceeds the node's cap on a
    node whose `cap` is below that band. Pinned in
    `src/engine/region/encounters.test.ts`.
  - [ ] `[unit]` The same seed and squad level replay the same encounter sequence
    twice, and two different seeds differ.
  - [ ] `[unit]` The town (`'town:1'`) and every city node with grass are capturable:
    `canCapture(emptyRun(seed) with nodeKey set to each of them)` is `true`.
  - [ ] `[unit]` `resolveBattle`'s captured branch writes the battle's own node into
    `capturedNodes` (re-pin `src/engine/run/resolve.test.ts`'s two `capturedRooms`
    assertions to the node key).
  - [ ] `[live]` At **1280×800** with `?debug`: teleport to the first route node,
    read `window.__pkmRoute.debugWildState()` — it reports that node's key (the
    plan's `route:1`) and `canCapture: true`; step onto that node's grass until a
    wild battle starts (`game.scene.isActive('Battle')` is `true` and the battle's
    launch trigger kind is `wild`) and read its level from the battle state: it is
    inside `[floor(0.6 × squadLevel), floor(0.75 × squadLevel)]`. Then set
    `capturedNodes` for that node through the shipped debug party/run tools (or
    resolve a capture), re-read `debugWildState()` — `canCapture` is now `false` —
    and confirm a second step on the same node's grass starts no battle while
    `debugWildState()` after teleporting to another grass node reports
    `canCapture: true`. Method: DOM/`game.scene` reads over CDP, no screenshot
    diff.
- A criterion you cannot execute is reported **not run**, with the reason. Never
  report a pass you did not measure.

## 📣 Coordination

- For the Architect: the capture rule and the wild roll are now keyed by node; the
  floor fields (`capturedRooms`, `routeInMap`) survive unread and Batch 125's sweep
  deletes them. The catch's display label is deliberately not moved (see Out of
  scope) — if it is wanted, it belongs to the task that owns the `detail.caught`
  key.
- For the next batch: `Task-295` may delete the floor vocabulary freely; this task
  adds no key. `Task-298` deletes `capturedRooms` and the floor scenes; nothing here
  blocks it.

## ⛔ Out of scope

- **`caughtAt` / `CatchLocation` and the STATS tab's "caught at" label.** Its shape
  is the save's and its text is an i18n key; moving it to the node would add a key
  to the table `Task-295` (Batch 124) rewrites and a run field `Task-298` (Batch
  125) deletes. Leave it exactly as it is.
- Wiring a **city's** grass corner to a battle: `CityScene` has no battle launch or
  return seam today, and duplicating `RouteScene`'s is not this task.
- Any change under `src/engine/battle/**`, `src/data/dex/**`, `src/i18n/**`,
  `src/engine/save.ts`, `docs/region-spec.md` §6/§7.10.
