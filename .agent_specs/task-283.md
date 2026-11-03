# Spec: Task-283 — Walking, flying and arriving are one seam (the world-scene kernel)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene + wiring (no data, no art, no asset).
- **Role:** Dev.
- **Objective:** after this task the region has **one** travel seam. A pure engine
  module, `src/engine/region/travel.ts`, answers whether a run may leave its node —
  on foot through an exit band, or by flying from the region map to a settlement it
  has already visited — and what its new run state and spawn tile are. `WorldScene`
  owns the **one** transition the game plays: fade out once, swap the already
  preloaded node's map, fade in and hand the spawn to the subclass, with no rebuild
  and no re-roll. The route header card's node markers dispatch that flight, and the
  game's scene list is fed by a **folder registry**, so a later node scene (city,
  gym, League) registers itself by existing and `src/main.ts` is never edited twice.
  A battle also comes back to the scene that launched it, so those later scenes can
  host fights without editing `BattleScene.ts` again.
- **Environment:** worktree `../wt-pkm-283`, branch `task-283`.
- **Dependencies (already merged on `main`; read them, do not re-derive):**
  - `src/engine/region/plan.ts` — `planRegion`, `nodeOf`, `RegionPlan`, `RegionNode`,
    `RegionNodeKind`, `nodeKey`.
  - `src/engine/region/city/plan.ts` — `planCity(plan, key)`: `spawn`, `buildings`
    (`{ kind, door, interiorKey, rect }`), `exits`, `tiles`.
  - `src/engine/region/route/index.ts` — `generateRoute(plan, key)`: `entry`, `tiles`.
  - `src/engine/region/preload.ts` — `preloadNode`, `NodeWorld`, `NodeMeshes`.
  - `src/engine/run/gates.ts` — `exitGate(plan, fromKey, toKey, badges)`.
  - `src/engine/run/state.ts` — `RunState` (`nodeKey`, `visitedNodes`, `badges`),
    `compatForNode(seed, key)` (`RunNodeCompat`).
  - `src/scenes/WorldScene.ts` — the base scene (`applyWorld`, `cachedWorld`,
    `preload`, `followCamera`, `mapBounds`, `centerX`, `centerY`).
  - `src/scenes/RouteScene.ts` — the running world scene today: `run`, `player`
    (`Tile`), `movePlayerTo`, `persistRun`, `pendingBattle`, `pauseMenuOpenNow()`.
  - `src/scenes/BattleScene.ts` + `src/engine/run/battleLink.ts` — `BattleLaunch`,
    `BattleReturn`, `returnToRoute`.
  - `src/ui/hud/commands.ts` — `HudCommand`, `HudIntent`, `reduceHudCommand`.
  - `src/ui/hud/panels/map/mapPanel.tsx` — the card's nodes carry
    `data-hud-region-node={key}` and the module already declares `onCommand` as
    "the seam the travel task will use".
  - `src/scenes/panels/map.ts` + `src/scenes/panels/types.ts` — the panel descriptor
    and the `RoutePanelHost` it is handed (its `mountMapPanel` call passes
    `onCommand` as `undefined` today).

### Exclusive paths (single writer)

**Nothing outside this list. No other file is edited, deleted or created.**

- `src/engine/region/travel.ts`
- `src/engine/region/travel.test.ts`
- `src/engine/region/index.ts`
- `src/engine/region/README.md`
- `src/engine/run/battleLink.ts`
- `src/engine/run/battleLink.test.ts`
- `src/scenes/WorldScene.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/BattleScene.ts`
- `src/scenes/regionScenes.ts`
- `src/scenes/regionScenes.test.ts`
- `src/scenes/README.md`
- `src/main.ts`
- `src/ui/hud/commands.ts`
- `src/ui/hud/commands.test.ts`
- `src/ui/hud/panels/map/mapPanel.tsx`
- `src/ui/hud/panels/map/README.md`
- `src/scenes/panels/map.ts`
- `src/scenes/panels/types.ts`
- `docs/region-spec.md` §5 only (do not touch any other section)

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1, §4, §5 and §6 — the node kinds, the guard rule and the
  flight rule (`D67`).
- `design/screens/03o-panels-map-routes.json` and
  `design/exports/03o-panels-map-routes.png` — the region header card's imported
  spec, caption `03o Panels · map routes` (`D57`). The card's boxes and strings are
  the board's; this task only makes a marker clickable, it does not move a pixel.
- `src/engine/region/**`, `src/engine/run/**`, `src/engine/map.ts`,
  `src/render/tilemapLayer.ts`, `src/audio/audio.ts`, `src/i18n/**`,
  `src/ui/hud/panels/map/view.ts`, `src/ui/regionMap.ts`.

## 🔒 Contract

### TypeScript — `src/engine/region/travel.ts` (new, pure, no Phaser)

```ts
import type { Tile } from '../grid';
import type { RunState } from '../run/state';
import type { RegionPlan } from './plan';

/** How the run arrives at the node it is entering. */
export type TravelMode = 'walk' | 'fly';

/** Why a travel was refused. */
export type TravelRefusalReason =
  | 'same-node'
  | 'no-such-node'
  | 'not-neighbour'
  | 'gate'
  | 'unvisited'
  | 'not-settlement';

export type TravelRefusal = Readonly<{
  ok: false;
  reason: TravelRefusalReason;
  /** The badge the closed gate asks for, or null when the refusal is not a gate. */
  badge: number | null;
}>;

export type TravelArrival = Readonly<{
  ok: true;
  /** The run, standing on `key`, with its compat floor fields refreshed. */
  run: RunState;
  /** The node entered (`nodeKey`). */
  key: string;
  /** Where the player is placed: the settlement's/route's own entry, or a door on a flight. */
  spawn: Tile;
  mode: TravelMode;
}>;

/** Whether `run` may enter `toKey` this way, and where it lands. Never throws. */
export function canTravel(
  plan: RegionPlan,
  run: RunState,
  toKey: string,
  mode: TravelMode,
): TravelRefusal | Readonly<{ ok: true; spawn: Tile }>;

/** `canTravel`, committed: the next run state and the spawn. Pure; a refusal mutates nothing. */
export function travel(
  plan: RegionPlan,
  run: RunState,
  toKey: string,
  mode: TravelMode,
): TravelRefusal | TravelArrival;
```

Rules, all of them tested:

- `'walk'`: `toKey` must be one of the current node's `edges` (`RegionNode.edges`),
  otherwise `not-neighbour`. The edge is passed through `exitGate(plan, run.nodeKey,
  toKey, run.badges)`: when it answers `{ open: false }` the travel is refused with
  `reason: 'gate'` and that `badge`. A lateral and a step **back** are never gates
  (`exitGate` already says so) — walking back always works.
- `'fly'`: the target must be a **settlement** (`kind` `'town'` or `'city'`) and must
  be in `run.visitedNodes`, otherwise `not-settlement` / `unvisited`. A flight
  **ignores the badge gate** (free, `D67`): a visited settlement behind a closed gate
  is still a legal target. Flying is out of battle by construction — the caller only
  offers it outside a battle.
- `toKey === run.nodeKey` is `same-node` in both modes, and `travel` returns the run
  **as the same object** (no new state, no dirty save).
- A key the plan does not hold is `no-such-node`.
- The **walk spawn** is the target's own entry: `planCity(plan, key).spawn` for a
  settlement, `generateRoute(plan, key).entry` for a `route`/`lateral`. This is the
  same value `preloadNode` reports as `NodeWorld.spawn`.
- The **fly spawn** is that settlement's **Centre door** — in the town, the
  **laboratory**'s door (`buildings.find((b) => b.kind === 'centre' | 'lab').door`);
  in a city, `kind === 'centre'`. §5 says so and this task is what makes it true. A
  settlement plan that holds no such building is a spec bug: return the settlement's
  `spawn` rather than throwing, and say so in a comment.
- On arrival the run is
  `{ ...run, nodeKey: toKey, visitedNodes: <appended once>, ...compatForNode(seed, toKey) }`.
  `visitedNodes` keeps its first-entry order and never repeats a key.
- **Determinism:** no RNG, no clock, no DOM, no Phaser, no `localStorage`. Same
  inputs, same output (`D11`).
- `src/engine/region/index.ts` re-exports the module (`export * from './travel';`).

### TypeScript — `src/scenes/WorldScene.ts` (the one transition)

Add, and use nothing else:

```ts
/** Emitted after a transition swapped the drawn node; the payload is the arrival. */
export const WORLD_ARRIVED = 'world:arrived';
export const WORLD_TRANSITION_MS = 200;

/** The node and spawn of the last transition, or null before the first one. */
protected arrival(): Readonly<{ key: string; spawn: Tile }> | null;

/** The one transition: fade out **once**, draw `world`, fade in, then `onNodeArrived`. */
protected transitionToNode(world: NodeWorld, spawn: Tile): void;

/** Hook a subclass implements to place its own actor; the base does nothing. */
protected onNodeArrived(key: string, spawn: Tile): void;
```

- `transitionToNode` must call `cameras.main.fadeOut(WORLD_TRANSITION_MS)` **once**,
  and inside its `FADE_OUT_COMPLETE` listener call `applyWorld(world)` (which already
  destroys the old layers), store the arrival, `cameras.main.fadeIn(...)` and call
  `onNodeArrived(key, spawn)`, then emit `WORLD_ARRIVED` with the arrival.
- A second call while a fade is in flight must be ignored (guard with a private
  `transitioning` flag), so a double click cannot draw two maps.
- It never touches the run, the HUD or the music: the subclass does.
- Keep the class's existing depth/zoom helpers and its documented "holds no run, no
  plan and no HUD" rule intact.

### TypeScript — `src/scenes/RouteScene.ts` (today's host of the seam)

- `async travelToNode(toKey: string, mode: TravelMode = 'walk'): Promise<boolean>`:
  refuses (returns `false`) while `pendingBattle`, `releaseRoot`, `gameOver`, the
  pause menu is open, or the scene is not active; otherwise asks `travel(planRegion(
  this.run.seed), this.run, toKey, mode)`, takes the node from `cachedWorld(seed,
  toKey)` or `preload(seed, toKey)` (a `null` world is a `false`, no partial move),
  commits `this.run = result.run`, `persistRun()`, calls `transitionToNode(world,
  result.spawn)` and returns `true`.
- `onNodeArrived(key, spawn)`: `movePlayerTo(spawn.x, spawn.y)` and play the node's
  music bed — `route-music` for `route`/`lateral`, `menu-music` for any settlement.
  This is the only place the two cues are chosen.
- A `debugTravelState()` dev-only accessor (`IS_DEVELOP` guarded like the existing
  `debugRouteContext`), returning
  `{ nodeKey: string; tile: { x: number; y: number }; fades: number; travels: number }`,
  where `fades` counts the transitions started and `travels` the committed travels.
  It exists so a browser pass can measure "the screen fades once".
- Keep every existing behaviour: the room build, the battle seam, the HUD, the debug
  menu hooks. Do **not** delete anything.

### TypeScript — `src/ui/hud/commands.ts`

- `HudCommand` gains `Readonly<{ type: 'node'; key: string }>` and `HudIntent` gains
  `Readonly<{ kind: 'node'; key: string }>`.
- `reduceHudCommand` maps it, refusing an empty/whitespace key (`null`) with the same
  `trimmedId` rule the `item` and `member` variants use.
- `HUD_COMMAND_TYPES` gains `'node'`.

### TypeScript — `src/scenes/regionScenes.ts` (new, the folder registry)

```ts
/** What the registry reads off a scene module: both exports or neither. */
export type RegionSceneEntry = Readonly<{ key: string; Scene: unknown }>;

/** Collects every module that exports both markers; throws on a duplicate key. */
export function collectRegionScenes(modules: Readonly<Record<string, unknown>>): readonly RegionSceneEntry[];
```

- A module participates by exporting **both** `regionSceneKey: string` and
  `regionSceneClass` (a Phaser scene class). Every other module is skipped silently,
  the way `src/scenes/panels/registry.ts` skips non-descriptors.
- A duplicate key throws with both paths named.
- The module itself holds the Vite map:
  `import.meta.glob(['./*Scene.ts', '!./*.test.ts'], { eager: true })` and exports
  `REGION_SCENES` (the collected entries) for `main.ts`. It imports Phaser **not at
  all** (the collection function is headless-testable and takes the module map).
- `src/main.ts`: keep the seven base scenes in the `scene` array and append
  `...REGION_SCENES.map((entry) => entry.Scene)`. Nothing else in `main.ts` changes.
- `src/scenes/README.md`: amend rule 1 — a **region node scene** (city, gym, League,
  anything the travel seam may enter) registers itself by exporting the two markers
  and is collected by `regionScenes.ts`; the base seven stay in `main.ts`. Add the
  `regionScenes.ts` line to the file list.

### TypeScript — battle return (`BattleScene.ts` + `battleLink.ts`)

- `BattleLaunch` gains
  `/** The scene key that receives the result; absent means the route ('Route'). */ returnScene?: string;`
- `battleLink.ts` exports
  `export function returnSceneOf(launch: { returnScene?: string }): string;`
  answering `launch.returnScene` when it is a non-empty string after `trim()`, else
  `'Route'`.
- `BattleScene`: every `'Route'` it names for the return path (`setVisible`,
  `resume`, `scene.get(...)`, the `RouteScene` cast) reads the key from
  `returnSceneOf(this.launch ?? {})`. The result is handed to that scene through an
  `applyBattleResult(result: BattleReturn): void` call, so the receiving scene must
  expose it. Do not rename `returnToRoute`'s behaviour for the route: a launch with
  no `returnScene` is byte-for-byte today's flow.
- `RouteScene.startBattle` passes no `returnScene` (the default is correct).

### Data

- No table, no JSON, no balance value. The only numbers this task introduces are the
  transition's `200 ms` and the registry's own shape; both live beside their code.

## 🧩 Data and configuration

Nothing is generated, packed or re-pinned. The store's atlases are read only if you
run the game (see the plan), never committed.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless, green including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-283` audited against the exclusive paths above;
    every name must be on the list (a `.prettierignore` or `package.json` line is a
    failure).
  - The `[live]` criterion needs the browser: `npm run assets:pack` (it reads
    `$ASSETS_ROOT`, never a path inside the worktree), `npm run dev`, and a headless
    Chromium over CDP at 1280×800.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `travel.ts` is pure: two calls with the same plan/run/key/mode are
    `toEqual`, and a refusal returns the run unchanged (`toBe` for `same-node`).
  - [ ] `[unit]` A **walk** along an open edge lands the run on that neighbour with
    that node's own spawn: `planCity(plan, 'city:1').spawn` for a city,
    `generateRoute(plan, 'route:1').entry` for a route; `visitedNodes` gains the key
    exactly once and keeps its order on a second visit.
  - [ ] `[unit]` A **walk** into a closed gate is refused with `reason: 'gate'` and
    the badge `exitGate` names; a walk back from the gate city is refused with
    `not-neighbour` only when the edge does not exist, never with a gate.
  - [ ] `[unit]` A **flight** lands on the target settlement's Centre door — the
    **laboratory** in the town — and equals
    `planCity(plan, key).buildings.find((b) => b.kind === 'centre' || b.kind === 'lab')!.door`.
  - [ ] `[unit]` A flight to a node the run has not visited is refused (`unvisited`),
    a flight to a route is refused (`not-settlement`), and a flight to a visited
    settlement behind a **closed** gate is **allowed** (`D67`).
  - [ ] `[unit]` `regionScenes.ts` collects a module exporting both markers, skips a
    module exporting one or none, and throws on two modules claiming one key.
  - [ ] `[unit]` `returnSceneOf({})` is `'Route'`, `returnSceneOf({ returnScene: 'Gym' })`
    is `'Gym'`, and a blank/whitespace key falls back to `'Route'`.
  - [ ] `[unit]` `reduceHudCommand({ type: 'node', key: 'city:1' })` is
    `{ kind: 'node', key: 'city:1' }` and a blank key is `null`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800 with the dev server up: boot a run, call
    `__pkmRoute.travelToNode('route:1', 'walk')` then
    `__pkmRoute.travelToNode('city:1', 'walk')`; then `__pkmRoute.debugTravelState()`
    reports `nodeKey === 'city:1'` and `fades === travels === 2`. Open the header card
    (`M` or its keybind) and click `[data-hud-region-node="town:1"]` in the DOM: within
    one transition `debugTravelState()` reports `nodeKey === 'town:1'`,
    `fades === travels === 3`, and `tile` equals the town laboratory's `door` from
    `planCity(planRegion(seed), 'town:1')` — an exact equality with the repository's
    own function. Clicking `[data-hud-region-node="route:1"]` leaves `nodeKey`,
    `fades` and `travels` unchanged. Read the canvas through
    `renderer.snapshotArea` + `getImageData` and report the camera's fade state, not a
    screenshot.
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- For the next batch (city, gym, League scenes): a node scene is registered by
  exporting `regionSceneKey` / `regionSceneClass`; it is started by key
  (`'City'`, `'Gym'`, `'League'`) and receives `{ run }` in `init`; it places its
  actor in `onNodeArrived`; and a battle it launches passes `returnScene: <its key>`
  and implements `applyBattleResult(result: BattleReturn)`. `main.ts` needs no edit.
- For the Architect: Batch 121's four tasks could not share `main.ts`,
  `BattleScene.ts` and `RouteScene.ts`, so this task took them and the batch was
  built as its kernel; the city, gym and League tasks are now path-disjoint and are
  cut next.
- `travel.ts` must stay pure: the scenes read it, it never reads them.

## ⛔ Out of scope

- The city, gym and League scenes, their doors and their battles.
- Any interior scene, the prologue, the badge rules, `league.ts`.
- The debug menu's node teleports (`Task-296`), the tower, the missions.
- Any new tile, sprite, atlas, packer, i18n key (the flight adds no string) or
  balance number.
- Reformatting, re-indenting or "cleaning up" `RouteScene.ts` beyond the lines this
  task needs; do not delete the old floor code (the sweep does that).
