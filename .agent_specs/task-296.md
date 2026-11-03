# Spec: Task-296 — The debug menu knows nodes, not floors

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** dev tooling (DOM overlay) + wiring. No gameplay rule changes.
- **Role:** Dev.
- **Objective:** the `?debug` overlay stops speaking floors. Its route tab lists the
  region plan's **node keys** and teleports the run to one (`onTeleportNode`), it can
  grant a badge (`onGrantBadge`), mark a node visited (`onMarkVisited`) and set the
  tower streak (`onSetTowerStreak`), and the floor / room / tile teleports are gone.
  Every label it draws comes from the shipped `src/i18n` table; the 22-key `dev.*`
  group Task-295 added is the contract (see Contract below). The rest of the panel —
  battle, party, bag, general, the route generator and the frame-map importer — stays
  exactly as it is.
- **Environment:** worktree `../wt-pkm-296`, branch `task-296`.
- **Dependencies (already merged on `main`):** `src/scenes/RouteScene.ts`'s public
  `travelToNode(toKey, mode)` (the region's one travel seam), `src/engine/region/plan.ts`
  (`planRegion`, `RegionNode`, `RegionPlan.nodes`), `src/engine/run/state.ts`
  (`RunState.nodeKey`, `visitedNodes`, `badges`, `towerStreak`),
  `src/engine/run/badge.ts` (`grantBadge`), `src/engine/save.ts`
  (`loadSave`, `storeRun`), `src/storage.ts` (`browserStorage`), and the i18n group
  (`src/i18n/en.ts`, Task-295).

### Exclusive paths (single writer)

- `src/dev/debugMenu.ts`
- `src/dev/debugMenu.test.ts`
- `src/dev/ids.ts`
- `src/dev/README.md`
- `src/main.ts`

**Nothing outside this list.** Do **not** touch `src/scenes/**` (the travel seam
`RouteScene.travelToNode` already exists and is public), `src/i18n/**` (the keys are
already in the table), `src/engine/**`, `package.json` or `TODO.md`. If a path
outside the list must change for the build to stay green, **stop** and say so in your
final report.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-ci.md` §Task states, `src/dev/README.md`'s handler list.
- `src/dev/debugMenu.ts` (the overlay's current shape: tabs `general`, `battle`,
  `party`, `bag`, `route`, `map`; the floor/room/tile controls live in the route tab),
  `src/dev/debugMenu.test.ts`, `src/dev/ids.ts`, `src/main.ts`.
- `src/scenes/RouteScene.ts` — read only: `travelToNode(toKey, mode: TravelMode)`
  (public, async, resolves false when the rule refuses), `debugTravelState()`.
- `src/engine/region/plan.ts`, `src/engine/run/badge.ts`, `src/engine/run/state.ts`,
  `src/engine/save.ts`, `src/storage.ts`.
- `src/i18n/en.ts` — the `dev.*` group Task-295 pinned.

## 🔒 Contract

The exported surface `main.ts` and the panel agree on:

```ts
/** The node-aware context the route tab reads; null when there is no saved run. */
export type DebugNodeContext = Readonly<{
  nodeKey: string;
  badges: readonly number[];
  towerStreak: number;
  visitedNodes: readonly string[];
  nodes: readonly Readonly<{ key: string; kind: string; name: string; badge: number }>[];
}>;

export type DebugMenuHandlers = Readonly<{
  // …the shipped handlers, unchanged…
  readNodeContext: () => DebugNodeContext | null;
  /** Teleports the live run to `nodeKey`; resolves after the fade, or refuses. */
  onTeleportNode: (nodeKey: string) => Promise<DebugTeleportResult>;
  /** Grants badge `badge` (1-8, ladder prefix only); true when the save changed. */
  onGrantBadge: (badge: number) => boolean;
  /** Marks `nodeKey` visited in the save; true when it changed. */
  onMarkVisited: (nodeKey: string) => boolean;
  /** Sets `RunState.towerStreak` (clamped to >= 0); true when it changed. */
  onSetTowerStreak: (streak: number) => boolean;
}>;
```

- **`onTeleportNode`** is `async`: `main.ts` resolves the live `Route` scene and
  returns `await route.travelToNode(nodeKey, 'fly')` as
  `{ ok: true, where: nodeKey }`, or `{ ok: false, error: 'no active route' }` when
  there is no `Route` scene / no run. The panel awaits it and prints the result in
  the same status line the floor teleports used.
- **`onGrantBadge` / `onMarkVisited` / `onSetTowerStreak`** read the saved run with
  `loadSave(browserStorage()).run`, apply the pure rule (`grantBadge`, a
  `new Set([...run.visitedNodes, key])`, `Math.max(0, Math.floor(streak))`), write it
  with `storeRun`, restart the `Route` scene with `{ run: next }` if it is active, and
  return `true` only when the value changed. A refused badge (not the ladder's next
  one) returns `false` and writes nothing.
- **The panel** draws the node list from `readNodeContext().nodes` (key, kind, name
  and badge for each), a node-key text input with a datalist of those keys, the four
  buttons (`dev.teleportNode`, `dev.markVisited`, `dev.grantBadge`,
  `dev.setStreak`), a badge number input and a streak number input. Unknown keys and
  non-integers are rejected with the existing status line, using
  `dev.status.unknownNode`.
- The floor / room / tile handlers and their DOM (`onTeleportFloor`, `onTeleportRoom`,
  `onTeleportTile`, their inputs and their `dev.go` buttons) are **deleted** from the
  overlay and from `DebugMenuHandlers`; `src/main.ts` stops reading
  `game.scene.getScene('Route')` for them. The generator tab and the frame-map
  importer stay.
- `readNodeContext` reads the **save's** run, not the scene's, so the panel can draw
  before a scene exists; that is a dev tool's contract, not a game rule.

### i18n

Use only keys that exist after Task-295: `dev.node`, `dev.nodeTitle`,
`dev.nodePlaceholder`, `dev.teleportNode`, `dev.markVisited`, `dev.badge`,
`dev.badgeTitle`, `dev.badgePlaceholder`, `dev.grantBadge`, `dev.streak`,
`dev.streakTitle`, `dev.streakPlaceholder`, `dev.setStreak`, `dev.mode`,
`dev.modeLeague`, `dev.modeTower`, `dev.status.unknownNode`,
`dev.status.teleportedTo`, `dev.status.badge`, `dev.status.streak`,
`dev.status.visited`, `dev.location.node`, plus the shipped keys the panel already
uses (`dev.route`, `dev.go`, `dev.seed`, …). Do not invent a new key and do not edit
the table. The "the menu reads the node, not the floor" location line uses
`dev.location.node` with `{ node: run.nodeKey }`.

### Determinism

The overlay reads no RNG and no clock. It writes the save only through the shipped
`storeRun`; every rule it applies is a pure engine function.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-296` audit against the four exclusive paths.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `src/dev/debugMenu.test.ts` proves the handler type has no
    `onTeleportFloor` / `onTeleportRoom` / `onTeleportTile`, the panel's mount
    resolves no floor/room/tile input, and every label it draws resolves through
    `t()` with an existing key (the shipped walker's rule in
    `src/i18n/index.test.ts` stays green).
  - [ ] `[unit]` `src/dev/ids.ts` still exports no dead id: its list matches the ids
    the panel actually builds.
  - [ ] `[unit]` The node list is the plan's: a `DebugNodeContext` built from a
    `planRegion(seed)` run holds every node key exactly once, and
    `onMarkVisited('city:2')` is idempotent (a second call returns false).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
    (`git diff --name-only main...task-296`).
  - [ ] `[live]` At 1280×800 with `?debug`: the route tab lists the plan's node keys
    (its node input's datalist holds `plan.nodes.length` options, `town:1` among
    them), teleporting the input to `city:3` moves the run to `city:3`
    (`debugTravelState().nodeKey === 'city:3'` and the scene key is `City` for a
    settlement), granting badge `3` makes `readNodeContext().badges` equal `[1,2,3]`
    and the run's guard lets the party out of the city, and the DOM holds none of the
    old floor/room/tile inputs (no `data-debug-id` for them, no `dev.go` bound to a
    floor). **Measurement:** `npm run dev -- --port 5306 --strictPort`, headless
    Chromium over CDP at 1280×800, seed the save in the page with the tree's own
    `createRun`/`travel`/`storeRun`, open `?debug`, then read
    `document.querySelectorAll('[data-debug-node-option]')`, the input values and
    `game.scene.getScene('Route').debugTravelState()`; report the exact counts and
    strings. Read the canvas only where a drawn label matters; this criterion is
    DOM + game-state, not pixels.

## 📣 Coordination

- **For Batch 125:** after this task the old floor teleport methods on `RouteScene`
  (`teleportToFloor`/`teleportToRoom`/`teleportToTile`) have no caller; they die with
  that scene in the sweep, not here.
- **For the next cycle:** the overlay's floor/room language is gone from the code it
  draws; the `dev.*` floor keys that only `src/dev/debugMenu.ts` used are still in the
  table (Task-295 kept them) and become dead once this task merges: list them in the
  report so the next i18n sweep can prune them.

## ⛔ Out of scope

- No `src/scenes/**`, `src/engine/**` or `src/i18n/**` change; no new i18n key.
- No change to the battle, party, bag, general or map tabs beyond what the shared
  `DebugMenuHandlers` type forces.
- No new dependency, no change to the overlay's toggle key or its `IS_DEVELOP` gate.
