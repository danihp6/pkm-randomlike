# Task-304 — The deprecated position fields go

## 🎯 Scope

- **Task type:** engine rule + UI readers + one dev tool (mixed; no new screen).
- **Role:** Dev.
- **Objective:** `RunState` stops carrying the three floor-era position fields
  `mapIndex`, `routeIndex` and `routeInMap`. The run's only position is its
  `nodeKey`: every reader that kept those fields alive answers off the node the run
  stands on (its `badge`, its `cap`, its `name`, its `id` and the key itself). The
  `compatForNode` writer that stamped them on every node entry is replaced by a
  node-entry reset of the four fields the run still declares (`arrivalEdge`,
  `discoveredRooms`, `bossDefeated`, `levelCap`), so the save stays **v28**: an old
  document still loads and still resolves its node, and a new one simply stops
  writing the three numbers.
- **Environment:** worktree `../wt-pkm-304`, branch `task-304`.
- **Dependencies (already merged on `main`):** `[Task-298]` (the floor modules are
  gone, so these three fields have no producer left), `[Task-302]` (`RouteScene`
  plays region route screens) and `[Task-276]` (the region run). Do not re-open any
  of their seams.

### Exclusive paths (single writer)

This batch is **one task**, so no path collides with a batch-mate. The list below is
the whole union of what the task may modify. **Nothing outside it.**

Modifications:

- `src/engine/run/state.ts` + `state.test.ts`
- `src/engine/run/battleLink.ts` + `battleLink.test.ts`
- `src/engine/run/dark.ts` + `dark.test.ts`
- `src/engine/run/resolve.ts` + `resolve.test.ts`
- `src/engine/run/passives.ts` + `passives.test.ts`
- `src/engine/run/memberEdits.ts` + `memberEdits.test.ts`
- `src/engine/run/floors.ts` + `floors.test.ts` (doc/comment and its own reads only)
- `src/engine/run/badge.test.ts`, `src/engine/run/curve.test.ts`,
  `src/engine/run/nickname.test.ts`, `src/engine/run/trade.test.ts` (fixtures only)
- `src/engine/save.ts` + `save.test.ts`
- `src/engine/region/travel.ts` + `travel.test.ts`
- `src/engine/region/league.test.ts`, `src/engine/region/tower.test.ts`,
  `src/engine/region/missions.test.ts` (fixtures only)
- `src/ui/runSummary.ts` + `runSummary.test.ts`
- `src/ui/hud/state.ts` + `state.test.ts`
- `src/ui/hud/panels/party/view.test.ts`,
  `src/ui/hud/panels/party/partyPanel.test.ts`,
  `src/ui/hud/panels/run-over/view.test.ts`,
  `src/ui/hud/panels/main-menu/view.test.ts` (fixtures only)
- `src/ui/rocketPanel.ts` + `rocketPanel.test.ts`
- `src/ui/casino.ts` + `casino.test.ts`
- `src/ui/partyScreen.test.ts` (fixture only)
- `src/scenes/GymScene.ts`, `src/scenes/LeagueScene.ts`
- `src/scenes/RouteScene.ts` (only `debugRouteContext()` and an import it frees)
- `src/scenes/panels/rewards.ts`
- `src/dev/debugMenu.ts` + `debugMenu.test.ts`
- `src/engine/run/README.md`, `src/engine/region/README.md`, `src/ui/README.md`

If typechecking demands a file **not** in this list, stop and report it; do not edit
it. (`src/data/maps.ts`, `src/data/README.md` and the i18n tables are expected **not**
to move: `levelCapForMap` keeps a live reader in `src/engine/run/floors.ts`.)

### Inputs (read-only)

- `AGENTS.md`, `docs/design-spec.md` §3, `docs/region-spec.md` §2–§3 and §7,
  `docs/maps-spec.md` (the retired vocabulary), `docs/tech-decisions.md` `D29`,
  `D31`, `D32`, `D11`.
- `design/screens/01-main-menu.json` — the board's `row value CONTINUE` reads
  `"MAP 3 · FOREST"`, so the Continue row keeps the `<MAP n> · <biome>` shape; the
  number it prints is the node's **badge**. Do not invent a city-name label.

## 🔒 Contract

```ts
// src/engine/run/state.ts
export type RunState = Readonly<{
  // `mapIndex`, `routeIndex` and `routeInMap` are GONE. Everything else stays.
  nodeKey: string;
  // ...
}>;

/** The four run fields a node entry resets; the run's position is `nodeKey` alone. */
export type NodeEntry = Readonly<{
  arrivalEdge: MapEdge;          // 'N'
  discoveredRooms: readonly number[]; // [0]
  bossDefeated: boolean;         // false
  levelCap: number;              // node.cap
}>;

export function nodeEntry(seed: string, key: string): NodeEntry;

/** The plan node the run stands on; a key the plan does not hold reads as the town. */
export function runNode(run: RunState): RegionNode;

// DELETED: `RunNodeCompat`, `compatForNode`, `advanceRoute`, `advanceMap`.
```

- `nodeEntry` replaces `compatForNode` one-for-one for the four surviving fields and
  keeps its contract: never throws, draws no Rng, reads no clock; an unknown key
  reads as the town.
- `runNode` is total: `nodeOf(planRegion(run.seed), run.nodeKey)`, falling back to
  `nodeOf(planRegion(run.seed), planRegion(run.seed).townKey)!`. Both are already
  imported by `state.ts`; do not add a cycle.
- `advanceRoute` / `advanceMap` have no live caller (only `state.test.ts` drove
  them) and both exist only to move the deleted fields. Delete them and their
  tests; keep `advanceMissions`, `healParty`, `decayModifiers`, `missionMet` and
  their exports untouched.
- Determinism: no RNG stream is added. Where a stream's key used a removed field,
  the key is re-based on `run.nodeKey` (see the table below); a stream keeps its
  own purpose and stays a pure function of `(seed, nodeKey, …)`.

```ts
// src/engine/run/dark.ts
export function isDarkCatch(seed: string, nodeKey: string, catchId: string): boolean;
// hash: `${seed}:dark:${nodeKey}:${catchId}`

// src/engine/run/passives.ts
export function passiveMark(
  ability: string,
  trigger: MapPassiveTrigger,
  nodeKey: string,
): string; // `passive-${ability}-${trigger}-${nodeKey}`
// rng: `${seed}:passive:${nodeKey}:${ability}`

// src/engine/run/battleLink.ts
export type BattleLaunch = Readonly<{
  // `routeIndex` is GONE (nothing read it).
  runSeed: string;
  // ...
}>;
export function battleSeed(runSeed: string, position: number, key: string): number;
```

### The reader table (this is the whole job)

| File | Today | After |
| --- | --- | --- |
| `src/engine/run/state.ts` | declares/creates/advances the three | fields gone; `nodeEntry` + `runNode` added; `createRun` uses `nodeEntry(init.seed, plan.townKey)` |
| `src/engine/save.ts` | parses/encodes the three and derives `levelCap` from the stored `mapIndex` | never reads or writes the three; `levelCap` = `nodeEntry(value.seed, nodeKey).levelCap`; `parseDiscoveredRooms(value.discoveredRooms, 0)`; `parseCapturedRooms(value.capturedRooms, value.captureUsed, 0)`; `SAVE_VERSION` stays **28** |
| `src/engine/region/travel.ts` | spreads `compatForNode(run.seed, toKey)` | spreads `nodeEntry(run.seed, toKey)` |
| `src/engine/run/resolve.ts` | `trainerXpMultiplierForMap(next.mapIndex)`, `isDarkCatch(seed, next.mapIndex, next.routeInMap, id)` | `trainerXpMultiplierForMap(runNode(next).badge)`, `isDarkCatch(next.seed, next.nodeKey, id)` |
| `src/engine/run/passives.ts` | mark + rng keyed on the two numbers | `runNode(run)` is not needed: key on `run.nodeKey` (new signature above) |
| `src/engine/run/memberEdits.ts` | `speciesPool(bandForMap(run.mapIndex), 'wild')` | `speciesPool(bandForNode(runNode(run)), 'wild')` |
| `src/ui/runSummary.ts` | `routesCleared` from `routeIndex`; label `{ map: run.mapIndex, biome: biomeForMap(run.seed, run.mapIndex) }` | `routesCleared` = route-kind nodes in `run.visitedNodes` (`isRouteKind` from `src/engine/region/route/layout.ts`), minus one when `won === false` (never below 0); label `{ map: runNode(run).badge, biome: getBiome(biomeForRoute(runNode(run).id)).name }` |
| `src/ui/hud/state.ts` | `HudState['route']` carries the three; `biomeForMap(seed, mapIndex)` | the three leave the type and the projection; `biomeId = biomeForRoute(runNode(run).id).id`. No panel reads them, so no panel's view changes |
| `src/ui/rocketPanel.ts` | `bandForMap(host.run.mapIndex)`, `casinoGruntTrainerId(host.view.mapIndex)` | `bandForMap(runNode(host.run).badge)` and `casinoGruntTrainerId(runNode(host.run).badge)` |
| `src/ui/casino.ts` | `bandForMap(run.mapIndex)` | `bandForMap(runNode(run).badge)`; the id builders keep their `number` parameter |
| `src/scenes/panels/rewards.ts` | `bandForMap(run.mapIndex)` + two hashes on it | `bandForNode(runNode(run))` + hashes on `run.nodeKey` |
| `src/scenes/GymScene.ts`, `src/scenes/LeagueScene.ts` | `battleSeed(run.seed, run.routeIndex, …)` and `routeIndex: run.routeIndex` in the launch | `battleSeed(run.seed, runNode(run).badge, …)`; the `routeIndex` launch field is gone |
| `src/scenes/RouteScene.ts` | `debugRouteContext()` reports `mapIndex: 0`, `roomInMap`, `roomCount` | those three leave the object (and `screenIndexOf` from the import list if it becomes unused) |
| `src/dev/debugMenu.ts` | `DebugRouteContext` declares the three `@deprecated` numbers | the three leave the type; `routeIndex` (the carver preview input) stays |
| `src/engine/run/floors.ts` | doc says callers "hold the run's explicit position (`RunState.mapIndex`)" | the comment says the node's badge; `levelWindowForMap`, `bandForMap` and `runBand` keep working off `levelCapForMap` |

Rule of thumb for anything not in the table: the node is the answer. `runNode(run)`
gives `badge` (the map/stretch number), `cap` (the level cap), `id` (the biome
index), `name` and `key`. Never store a derived number back on the run.

## 🧩 Data and configuration

No key, default or balancing value changes. `src/data/maps.ts`'s `MAP_TUNING` /
`levelCapForMap` stay (live readers: `src/engine/run/floors.ts`,
`src/data/trainerLevels.ts` comments). The save schema stays v28 and the three
fields stop being written; a document that still carries them decodes as if it did
not.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task
    updates.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-304` audit against the exclusive paths list.
  - The `[live]` criterion is the only browser pass: 1280×800, `npm run dev`, CDP
    over the runner's headless Chromium, reading the canvas
    (`renderer.snapshotArea` + `getImageData`) and the DOM HUD (`#hud`) rather than
    a screenshot. A fixed seed and a saved run standing on `city:3` are enough.
- **Acceptance criteria:**
  - [ ] `[unit]` `grep -rn "\.mapIndex\|\.routeIndex\|\.routeInMap" src --include=*.ts`
        finds **no** read or write of a `RunState` field, and
        `grep -rn "compatForNode" src` is empty. The only surviving hits are the
        documented carriers: `CatchLocation` (`progression.ts`, `partyDetail.ts`),
        `CompletedMission` (`state.ts`, `save.ts`, `region/missions.ts`), the
        room-panel view (`scenes/panels/*`, `engine/run/trade.ts`), the route
        carver and its preview inputs (`engine/routes/**`, `RouteParams`,
        `frameMap.ts`, `debugMenu.ts`, `battleSeed`'s numeric parameter,
        `data/maps.ts`, `region/routeScreens.ts`). QA lists every hit and shows
        each is one of those.
  - [ ] `[unit]` `RunState` no longer declares the three: the type in
        `src/engine/run/state.ts` has no such member (a type-level test or the
        compiled `tsc --noEmit` plus a grep of the declaration).
  - [ ] `[unit]` A v28 save written **before** the change still loads: a document
        carrying `mapIndex`, `routeIndex`, `routeInMap`, `nodeKey`, `arrivalEdge`
        and `levelCap` decodes, its `nodeKey` survives, its `arrivalEdge` survives
        and no thrown error or `null` comes back.
  - [ ] `[unit]` For a fixed seed, the Continue row, the HUD's route state, the
        Rocket band and the casino price answer off the node: `runPositionLabel`
        prints `Map <badge> · <biomeForRoute(node.id).name>`, `HudState.route.biomeId`
        is `biomeForRoute(node.id).id` and the casino band id equals
        `bandForMap(node.badge).id` — each pinned by a test with a fixed seed.
  - [ ] `[unit]` `advanceRoute`/`advanceMap`/`compatForNode` are gone and nothing
        imports them; the mission, heal and modifier helpers they used keep their
        tests green.
  - [ ] `[unit]` `npm test` and `npm run build` are green.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; the three folder
        maps named above are updated in the same diff.
  - [ ] `[live]` At 1280×800 on a v28 save standing on `city:3` (badge 3): the
        main menu's Continue row reads `Map 3 · Deep Forest` (the node's badge and
        `biomeForRoute(node.id).name`), the in-route HUD's party header level equals
        `bandForNode(node).maxLevel` (`badgeCap(3)`), and opening the Rocket panel
        shows the band `bandForMap(3).id`. **Measurement:** the Continue row's
        string is read from `#hud`/canvas text and compared with the two repo
        functions for the same seed; the party header's `Lv` number is compared with
        `badgeCap(3)`; the Rocket panel's band id is read from the mounted panel and
        compared with `bandForMap(3).id`.

## 📣 Coordination

- **For the Architect:** this batch was cut as one task and the three free slots
  could not be filled — `[Task-299]` (Batch 130) *depends* on this sweep, so adding
  it would break its own `*Dependencies:*` line. Batch 129 therefore runs one dev
  and one combined QA pass.
- **Plan widening (recorded):** the plan's `Claims` line named 14 files and the
  `Measured` paragraph named nine readers. The tree holds more readers than that
  (`resolve.ts`, `passives.ts`, `memberEdits.ts`, `dark.ts`, `GymScene`,
  `LeagueScene`, `scenes/panels/rewards.ts`, `battleLink.ts`, the HUD panel
  fixtures), and the plan's literal `grep -rn "mapIndex\|routeIndex\|routeInMap"
  src` cannot ever be empty because the route carver's per-screen `routeIndex`,
  `CatchLocation.mapIndex` and `CompletedMission.mapIndex` are different, stored
  concepts. This spec widens the path list to every real reader and scopes the grep
  to `RunState` reads; nothing else in the plan changes.
- **For the next batch:** `[Task-299]` documents the region's vocabulary against a
  `RunState` that no longer carries a floor position; the phrase "the run's position
  is its node" is now literally true in the code, and `nodeEntry`/`runNode` are the
  two helpers to cite.

## ⛔ Out of scope

- `CatchLocation` (`caughtAt.mapIndex` / `caughtAt.routeInMap`) and
  `CompletedMission.mapIndex`: stored records, not the run's position. Renaming
  them would move the save schema and the STATS card — not this task.
- The route carver's own `routeIndex` (`RouteParams`, `src/engine/routes/**`,
  `frameMap.ts`) and the room-panel `RoomHostView.mapIndex`: the carver's screen
  index, not the run's.
- `src/data/maps.ts`, `levelCapForMap`, `MAP_TUNING`, `bandForMap`,
  `levelWindowForMap`, `runBand`: still live through `floors.ts`.
- New HUD fields, new i18n keys, new screens, `design/` edits, `package.json`,
  `vite.config.ts`, `src/data/dex/**`, `src/main.ts`.
- Any behaviour change beyond "read the node": no re-pinning of a battle outcome,
  no new RNG stream, no change to the catch limit, the level cap, the wild band or
  the economy.
