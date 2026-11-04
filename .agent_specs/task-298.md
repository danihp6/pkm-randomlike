# Spec: Task-298 — The floor modules are deleted

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine / scene / tooling sweep (deletion + minimal re-homing).
- **Role:** Dev.
- **Objective:** the run is a **region** and the floors are gone from the game, but their
  machinery is still in the tree. After this task the floor layer has no live reader left:
  the map plan (`src/engine/maps/**`), the floor room descriptors
  (`src/scenes/rooms/**`), the floor minimap (`src/ui/mapView.ts`), `StarterScene` (the
  laboratory prologue replaced it) and the helpers nothing calls any more
  (`floorForRoute`, `routeIndexForRoom`, `capForRoute`) are deleted together with their
  tests; every still-live reader has been moved to the region's own answer. The region's
  route screen (`src/scenes/RouteScene.ts`) **stays** — since `[Task-302]` it draws the
  region's own screens — and so does everything the region still uses: `bandForMap`,
  `levelWindowForMap`, `clampToCap`, `reachedCap` and the room-panel *types* the node
  scenes share. `npm test` and `npm run build` are green at the end.
- **Environment:** worktree `../wt-pkm-298`, branch `task-298`.
- **Dependencies (already merged on `main`):** `[Task-300]` (every node scene mounts the
  HUD panel registry), `[Task-302]` (`RouteScene` plays the region's own route screens
  instead of `planMap`/`roomView`), `[Task-303]` (`victory-road` is a route). They are the
  reason the floor layer has no live reader left; do not re-implement any of their seams.

### Exclusive paths (single writer)

This batch is **one task**, so no path collides with a batch-mate. The list below is the
whole union of what the sweep may create, modify or delete. **Nothing outside it.**

Deletions (delete the module and its co-located `*.test.ts`):

- `src/engine/maps/` — `index.ts`, `plan.ts` + `plan.test.ts`, `progress.ts` +
  `progress.test.ts`, `route.ts` + `route.test.ts`, `streams.ts` + `streams.test.ts`
  (see §"What must survive" before deleting each one).
- `src/scenes/rooms/` — every descriptor module and its test (`banned.ts`, `gate.ts`,
  `megaStone.ts`, `miniBoss.ts`, `noHeal.ts`, `puzzle.ts`, `secretShop.ts`, `shop.ts`,
  `staticSpecies.ts`, `trade.ts`, `fixtures.test.ts`, `registry.ts` +
  `registry.test.ts`), **except** the shared type module (see the re-home rule below).
- `src/ui/mapView.ts` + `src/ui/mapView.test.ts`.
- `src/scenes/StarterScene.ts` + `src/scenes/StarterScene.test.ts`.

Modifications (the minimum each needs; do not refactor beyond it):

- `src/scenes/RouteScene.ts` — one line: the reset chord starts `'Lab'`, not `'Starter'`
  (`restartRun`, ~1027). Nothing else in the file may change; it is the shipped region
  route screen.
- `src/main.ts` — drop the `StarterScene` import and its entry in the scene list.
- `src/scenes/SettingsScene.ts` + `src/scenes/SettingsScene.test.ts` — its `Opener` type
  and default (`'Starter'`, ~48/68/220) become `'Lab'`.
- `src/scenes/MainMenuScene.test.ts` — the scene-folder listing (~303) must stop naming
  `StarterScene.ts`.
- `src/engine/run/floors.ts` + `floors.test.ts` — delete `floorForRoute`,
  `routeIndexForRoom` and `FloorPosition`; keep `levelWindowForMap`, `bandForMap`, and
  `runBand` only if a live reader still needs it (see below).
- `src/engine/run/levelCap.ts` + `levelCap.test.ts` — delete `capForRoute`; keep
  `clampToCap` and `reachedCap`.
- `src/engine/run/state.ts` + `state.test.ts` — `compatForNode` and the dead
  `advanceRoute`/`advanceMap` stop reading `planMap` (see the re-home rule); the three
  deprecated fields stay for `[Task-304]`.
- `src/engine/save.ts` + `save.test.ts` — the legacy decoders that recover a floor
  `arrivalEdge` from the plan keep decoding a **v28** save with no plan: validate the
  stored edge against the compass list alone and fall back to `'N'`. No version step
  (`SAVE_VERSION` stays **28**), no new field, no migration rewrite.
- `src/engine/region/travel.ts` + `travel.test.ts` — only what `compatForNode` needs.
- `src/engine/index.ts` — drop the `export * from './maps'` line.
- `src/engine/routes/index.ts`, `src/engine/routes/npcs.ts` + `npcs.test.ts`,
  `src/engine/routes/sketch.ts`, `src/engine/routes/trainers.ts` — drop every
  `MapPlan`/`MapRoomRole`/`firstTrainerRoom` import; where a **live** function still needs
  the two-member `'trainers' | 'wild'` shape, declare a local `type RouteRole = 'trainers'
  | 'wild'` in the module that owns it.
- `src/scenes/panels/host.ts`, `src/scenes/panels/types.ts`, `src/scenes/panels/trade.ts`,
  `src/scenes/panels/rewards.ts`, `src/scenes/CityScene.ts`, `src/ui/rocketPanel.ts` +
  `rocketPanel.test.ts` — drop the `MapPlan` and `RoomHost`/`RoomPanel` imports by
  re-homing the **types** they still need (see below).
- `src/engine/run/levelCap.ts`'s folder line in `src/engine/run/README.md` and the three
  other folder maps named below.
- `src/data/maps.ts`, `src/data/mapSize.ts`, `src/data/gates.ts`, `src/data/noHeal.ts`,
  `src/data/bannedRoom.ts` — **only if their grep is empty** once the modules above are
  gone (they are not all dead: `src/data/maps.ts` still feeds
  `src/data/trainerLevels.ts`/`wildLevels.ts`, and `gates.ts`/`bannedRoom.ts` feed the
  region's own POIs — leave them in place when they are).

### Inputs (read-only)

- `AGENTS.md` (the whole file) — the stack, the folder-README rule, the gate.
- `TODO.md` — the `[Task-298]` entry and the `Batch 128` section, for the intent.
- `docs/region-spec.md`, `docs/routes-spec.md` — what the region does instead of floors.
- Any `src/**` file you need to read to prove a reader is dead.

## 🔒 Contract

The public surface that survives is the region's own. **Nothing new is exported**, and no
signature changes except the deletions below.

### TypeScript

```ts
// src/engine/run/floors.ts — survives
export function levelWindowForMap(mapIndex: number): Readonly<{ minLevel: number; maxLevel: number }>;
export function bandForMap(mapIndex: number): LevelBand;
export function runBand(seed: string, routeIndex: number): LevelBand; // only if a live reader keeps it

// src/engine/run/levelCap.ts — survives
export function clampToCap(level: number, cap: number): number;
export function reachedCap(level: number, cap: number): boolean;
```

- **Re-home rule (the only judgement this task allows).** A symbol may be deleted only
  when `grep -rn "<symbol>" src` finds **no non-test reader**. When a live reader remains,
  move the **smallest possible** piece to the module that already owns the concept — do not
  keep a floor module alive for it:
  - `RoomHost` / `RoomPanel` / `RoomDrop` / `RoomWildBattle` are the node room-panel
    *types*, still imported by `src/scenes/panels/**`, `src/scenes/CityScene.ts` and
    `src/ui/rocketPanel.ts`. Move them into the surviving `src/scenes/panels/types.ts`
    (which already declares the panel host shape) and point every importer there; then
    `src/scenes/rooms/` can go whole.
  - `MapEdge` / `MAP_EDGES` are the four compass doors, still needed by the save decoder.
    Inline or move them into `src/engine/save.ts` (or a surviving module there) and stop
    calling `planMap`/`arrivalEdgeFor`/`isArrivalEdge`; a stored edge is validated against
    the four names, with `'N'` as the fallback.
  - `runBand(seed, routeIndex)` is read by the free-standing carver preview in
    `RouteScene` (~698). A preview is not a region node, so it reads the band from its own
    params/node badge — never from `planMap`. If the preview is the only reader, keep the
    function and re-base it; do not delete a live call site.
- **Determinism:** this task **reads and draws no RNG**. Nothing here may change a fixed
  seed's output: no stream name, no draw order, no generator input. If a deletion would
  change a pinned seed, stop and report it instead.
- Rules: no new dependency, no Phaser import in `src/engine/`, `SAVE_VERSION` stays **28**,
  no new run field, no new file except a surviving module that receives a re-homed type.

### Data

- No key, default or balancing value changes. The tables this task may delete
  (`src/data/maps.ts`'s floor tuning, `mapSize.ts`, `gates.ts`, `noHeal.ts`,
  `bannedRoom.ts`) go **only** when the grep is empty; a table a region reader still holds
  stays exactly as it is.

## 🧩 Data and configuration

Nothing is introduced. What may disappear is the floor tuning a region reader no longer
reads; what may not is anything `src/data/trainerLevels.ts`, `src/data/wildLevels.ts`,
`src/engine/region/**` or the save still imports.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not read the
rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task keeps.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-298` audit against the exclusive paths list.
  - Every criterion is `[unit]`: this task changes no pixel and no beat, and the entry
    itself owes **no browser pass**, so QA runs none. Say so in the report.
- **Acceptance criteria:**
  - [ ] `[unit]` `grep -rn "planMap\|MapRoom\|routeIndexForRoom\|floorForRoute\|capForRoute" src`
        returns nothing, and `grep -rn "RoomHost" src` finds it **only** in its re-homed home
        (`src/scenes/panels/types.ts`, its declaration) and its importers — never under
        `src/scenes/rooms/`, which no longer exists.
  - [ ] `[unit]` `grep -rn "scenes/rooms\|ui/mapView\|StarterScene" src` finds only the
        re-homed type import paths if any survive, and **no** `StarterScene` reference.
  - [ ] `[unit]` The reset chord starts `'Lab'`: a unit test drives
        `RouteScene.restartRun()` (or reads the scene's start key) and asserts `'Lab'`,
        the same key `MainMenuScene` starts a new run with.
  - [ ] `[unit]` The room-panel types survive where the node scenes read them: importing
        `RoomHost`/`RoomPanel` from the new home typechecks and `src/scenes/rooms/` is gone.
  - [ ] `[unit]` A v28 save written before this change still loads and keeps its
        `nodeKey` and its `arrivalEdge` (the existing `save.test.ts` pins must stay green,
        updated only where a plan-derived expectation is replaced by the compass
        validation).
  - [ ] `[unit]` `npm test` and `npm run build` are green.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; every folder whose files
        changed has its `README.md` updated in the same diff (`src/engine/README.md`,
        `src/scenes/README.md`, `src/ui/README.md`, `src/data/README.md`,
        `src/engine/run/README.md`).

## 📣 Coordination

- For the Architect: `[Task-304]` (Batch 129) deletes the three deprecated fields
  (`mapIndex`, `routeIndex`, `routeInMap`) and its own readers. This task **keeps** those
  fields declared and writable — it only removes their floor derivation — so 304 starts
  from a v28 save that still loads.
- For the next batch: `src/engine/maps/**` and `src/scenes/rooms/**` no longer exist;
  the compass edges live where the save decoder reads them; the room-panel types live in
  `src/scenes/panels/types.ts`; `StarterScene` is gone and a reset lands on `'Lab'`.
  `bandForMap` is the band every badge-driven reader asks; `runBand` survives only if the
  carver preview keeps it.

## ⛔ Out of scope

- The three deprecated run fields and their readers' rewrites to the node — that is
  `[Task-304]`, the next batch. Do not remove a field it names.
- Any behaviour change in a region screen: `RouteScene` gets one line, `CityScene` only
  its type import.
- Reworking the region's route/POI/NPC generators, re-pinning a seed, or moving an RNG
  stream. If a deletion moves one, do not delete it — report it.
- Deleting `src/data/maps.ts`'s level-cap row, `bandForMap`'s `LEVEL_BANDS` supply, the
  region's POI/room panels or their fixtures.
- Touching `package.json`, `vite.config.ts`, `src/data/dex/**` or the packed atlases.
