# Spec: Task-300 — The panels survive the region

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scenes / UI host (no engine rules).
- **Role:** Dev.
- **Objective:** The HUD panel layer stops belonging to `RouteScene`. One shared
  host module builds a `RoutePanelHost` over **any** node scene and mounts the
  registry's cards there, so a city, a gym, an interior, the Centre and the League
  draw the party, bag, missions, rewards, trade, detail and pause cards from the
  run they already carry. `RouteScene` delegates to the same host and keeps all
  twelve cards it mounts today. `src/main.ts` stops looking the live scene up by
  the hard-coded key `'Route'`.
- **Environment:** worktree `../wt-pkm-300`, branch `task-300`, base `main`
  (save v28, `SAVE_VERSION = 28`).
- **Dependencies:** merged on `main` today — the node scenes (`CityScene`,
  `GymScene`, `InteriorScene`, `ServicesScene`/Centre, `LeagueScene`, all
  `WorldScene` subclasses or siblings), the panel registry (`D47`, `D49`), the
  region plan (`planRegion`) and the DOM HUD mount (`src/ui/hud/mount.ts`).

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/panels/host.ts` (new)
- `src/scenes/panels/host.test.ts` (new)
- `src/scenes/panels/registry.ts` (only if the collection needs a small change)
- `src/scenes/panels/registry.test.ts` (the folder's `SHARED_PATHS` now names `./host.ts`)
- `src/scenes/panels/types.ts`
- `src/scenes/panels/trade.ts` (nullable `route()` in `roomOf`)
- `src/scenes/WorldScene.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/CityScene.ts`
- `src/scenes/GymScene.ts`
- `src/scenes/LeagueScene.ts`
- `src/scenes/InteriorScene.ts`
- `src/scenes/services.ts`
- `src/scenes/SettingsScene.ts`
- `src/main.ts`
- `src/scenes/README.md`
- `src/scenes/panels/README.md`

No other test, panel, engine or data file may change. A headless test that
pins the old shape and is not listed above means the change is out of scope:
report it instead of editing it.

### Inputs (read-only)

- `AGENTS.md`.
- `src/scenes/panels/registry.ts`, `types.ts`, every `src/scenes/panels/*.ts`
  panel and `src/scenes/rooms/registry.ts` — the surface being lifted.
- `src/ui/hud/mount.ts` (`mountHud`, the `#hud` root), `src/ui/hud/state.ts`,
  `src/data/hudLayout.ts`, `src/settings.ts` (`loadSettings`, `saveSettings`).
- `src/engine/run/state.ts` (`RunState`), `src/engine/save.ts` (`Settings`).
- `src/scenes/WorldScene.ts`, `RouteScene.ts`, `CityScene.ts`, `GymScene.ts`,
  `InteriorScene.ts`, `services.ts`, `LeagueScene.ts`, `SettingsScene.ts`.
- `docs/region-spec.md` §7 (what a node scene owns), `docs/tech-decisions.md`
  `D47`, `D49`, `D57`.

## 🔒 Contract

### TypeScript — `src/scenes/panels/host.ts` (new)

`Phaser` is a **type-only** import here; the module is testable headless.

```ts
import type Phaser from 'phaser';

export type PanelEncounter = Readonly<{ speciesId: string; level: number; key: string }>;

/** The scene's room-panel slot; absent means the scene has none. */
export type PanelRoomSlot = Readonly<{
  open(panel: RoomPanel): void;
  close(): void;
  isOpen(): boolean;
}>;

export type PanelActions = Readonly<{
  showNotice(notice: Notice): void;
  startWildBattle(encounter: PanelEncounter): void;
  startTrainerBattle(trainer: RouteTrainer): void;
  openSettings(): void;
  restartRun(): void;
  flyToNode(key: string): void;
  commitRun(run: RunState): void;
  persistRun(): void;
}>;

/** Everything a scene hands the host. Only `scene`, `run` and `settings` are required. */
export type PanelSceneSource = Readonly<{
  scene: Phaser.Scene;
  run(): RunState;
  settings(): Settings;
  route?(): RouteMap | null;
  plan?(): MapPlan | null;
  rooms?(): RoomRegistry;
  slot?: PanelRoomSlot;
  actions?: Partial<PanelActions>;
  /** The panel ids this scene mounts; omitted means all twelve, in registry order. */
  panels?: readonly RoutePanelId[];
}>;

export type ScenePanels = Readonly<{
  host: RoutePanelHost;
  registry: PanelRegistry;
  panels: readonly RoutePanelDescriptor[];
  /** Mounts every selected card into `#hud`, in `order`; registers the scene's shutdown. */
  build(): void;
  /** Repaints every selected card once, in `order`. */
  refresh(): void;
  /** Unmounts every card, in reverse `order`. */
  close(): void;
}>;

/** Collects the folder's descriptors (`import.meta.glob('./*.ts',
 *  '!./*.test.ts')` lives here, not in a scene). */
export function createPanels(): PanelRegistry;

/** Builds a `RoutePanelHost` over any scene. Never mounts by itself. */
export function createScenePanels(source: PanelSceneSource): ScenePanels;

/** The node scenes' seven cards, in registry order: the ones a settlement produces. */
export const NODE_PANEL_IDS: readonly RoutePanelId[];
```

Behaviour the host **must** guarantee:

- `host.scene === source.scene`, `host.run()` and `host.settings()` delegate live.
- `host.hud()` is `hudMetrics(source.scene.scale.width)` computed on read (a window
  resize needs no rebuild).
- The host **owns** the transient HUD state: `ui()/setUi` (initial
  `initialPartyUi()`), `hudCardOpen(id)/setHudCardOpen(id, open)` (initial state
  from `source.settings().hudLayout`, open = `!collapsed`), and `setHudLayout`
  persists through `saveSettings` then calls `refresh()`.
- Every optional source member has a total default: no slot →
  `openPanel` is a no-op, `closePanel` a no-op, `panelOpen() === false`; no
  `route` → `() => null`; no `plan` → `() => null`; no `rooms` → an empty
  `RoomRegistry` (`{ byKind: new Map(), byMarker: new Map() }`); no action →
  a no-op of that action's signature.
- `createPanels()` returns exactly the twelve shipped descriptors, in the frozen
  `order` sequence `map, party, hud, bag, pc, notices, missions, rewards, shop,
  trade, pause, detail` (10…110).
- `panels` on the returned `ScenePanels` is the selected subset in `order`;
  an unknown id throws (the registry already forbids duplicate ids/orders).
- `build()` mounts each selected `build(host)` in `order` and registers exactly
  one `Phaser.Scenes.Events.SHUTDOWN` listener that calls `close()`. `close()`
  is idempotent.
- Nothing here imports `RouteScene` and nothing here touches the engine.

### TypeScript — `src/scenes/panels/types.ts`

`RoutePanelHost.route()` becomes `route(): RouteMap | null` (the same shape the
`notices` panel already guards). Every other member is unchanged.

### TypeScript — `src/scenes/WorldScene.ts`

```ts
/** The shared panel layer this scene mounted, or null (and nothing is drawn). */
protected panelLayer: ScenePanels | null;

/** The panels a node scene mounts; `NODE_PANEL_IDS` unless overridden. */
protected panelSelection(): readonly RoutePanelId[];

/** The source the host answers from; null (the base default) mounts nothing. */
protected panelSource(): PanelSceneSource | null;

/** Builds the layer from `panelSource()`, mounts it, wires resize + shutdown. */
create(): void;

/** `panelLayer?.host ?? null`. */
protected get panelHost(): RoutePanelHost | null;
```

`create()` builds `createScenePanels({ ...source, panels: this.panelSelection() })`,
calls `build()`, registers one `scale.on('resize')` → `panelLayer.refresh()` and
one shutdown that removes both listeners and calls `close()`. A subclass whose
`panelSource()` is null gets `panelLayer === null` and no listener.

Every existing `WorldScene` subclass (`CityScene`, `GymScene`,
`InteriorScene`, `ServicesScene`) calls `super.create()` **after** it has resolved
its run (the first line where it returns early on a null run is before it).
`RouteScene` calls `super.create()` right after `this.settings = loadSettings()`
and before `this.buildRoom()`.

`LeagueScene` (a `Phaser.Scene`, not a `WorldScene`) builds the same layer
directly with `createScenePanels`/`build` once its run is healed, using
`loadSettings()`.

Each node scene passes `NODE_PANEL_IDS` and the actions it owns; a node that
cannot fly or restart passes no action for it and the no-op default applies.
`RouteScene` passes all twelve, its own room slot (`openPanel`/`closePanel`/
`panelOpen`), and its full action set. `RouteScene` deletes its private
`panels: PanelRegistry` field, its `buildPanelHost()` and its `PANEL_MODULES`
glob; `this.panelHost` becomes non-null after `super.create()` (keep the typed
field assigned from `panelLayer.host` so the existing call sites compile).

### TypeScript — `src/main.ts`

The debug menu reaches the live scene through the **active** scene, never the
key `'Route'`: a `liveScene()` helper over `game.scene.getScenes(true)[0]`, and a
`liveHost()` returning that scene's `ScenePanels['host']` when it is a
`WorldScene`/`LeagueScene` with a panel layer. Route-only dev methods
(`startDebugWildBattle`, `addDebugPokemon`, the frame map, the generator) narrow
the same active scene with `instanceof RouteScene`. The string `'Route'` may
survive only inside an `instanceof`-free routing constant that SettingsScene
already knows; no `getScene('Route')` and no `routeScene()` helper remain.

### TypeScript — `src/scenes/SettingsScene.ts`

`type Opener` widens to `string` (the scene key that opened it). `close()` still
calls `applySettings()` only when the opener is `'Route'`, and resumes whichever
key it was handed. Nothing else changes.

## 🧩 Data and configuration

- No new data file, no new key, no `SAVE_VERSION` step, no `src/data/dex/**`.
- `NODE_PANEL_IDS = ['party', 'bag', 'missions', 'rewards', 'trade', 'detail',
  'pause']` — the seven cards the region's nodes produce. `RouteScene` keeps the
  full twelve (`NODE_PANEL_IDS` is not a filter it uses).
- The panels are DOM singletons: mounting the same card from a second scene is
  safe only because a scene's shutdown unmounts it first; `build()` must not
  assume `#hud` is empty.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund`, then `npm test` (Vitest,
    headless, green) and `npm run build` (`tsc --noEmit && vite build`).
  - `git diff --name-only main...task-300` against **Exclusive paths** above.
  - `grep -rn "panels/registry" src/scenes --include=*.ts --exclude=*.test.ts`
    must list `src/scenes/panels/host.ts` only.
  - `grep -rn "getScene('Route')\|routeScene" src/main.ts` must be empty.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm test` and `npm run build` are green, including
        `src/scenes/panels/host.test.ts`.
  - [ ] `[unit]` A host built with `createScenePanels({ scene: stub, run: () => run,
        settings: () => settings })` over a stub scene defines every member of
        `RoutePanelHost` (`Object.keys` equals the frozen member list), and
        `panelOpen() === false`, `openPanel(panel)` and `closePanel()` are total
        no-ops; `route()` and `plan()` answer `null`; `rooms()` answers empty maps.
  - [ ] `[unit]` `createPanels()` yields the twelve shipped ids in `order` order
        (10, 20, 30, 40, 50, 60, 65, 70, 80, 90, 100, 110), and a source with
        `panels: NODE_PANEL_IDS` yields those seven in that same relative order.
  - [ ] `[unit]` The registry grep above lists the shared host and no node scene;
        no node scene imports `./panels/registry` or holds a `PANEL_MODULES` glob.
  - [ ] `[unit]` `git diff --name-only main...task-300` is a subset of the
        exclusive paths; no `src/engine/` or `src/data/` file changed.
  - [ ] `[live]` At 1280×800, with a **v28 save whose `run.nodeKey` is `city:2`**
        (verify `loadSave(...).run.nodeKey === 'city:2'` before measuring), the
        City scene is on screen and
        `document.querySelector('[data-hud-panel="missions"]')` is non-null and
        its text contains the city's mission row; opening the party card
        (its own control or the party key) makes
        `document.querySelector('[data-hud-panel="party"]')` non-null. Navigate to
        `route:1` and both queries still answer there. Evidence is the DOM queries
        read over CDP on the running dev server (`npm run dev`), not a screenshot;
        a `null` on either node is a failure.

    Reproducing the save: on the dev server page,
    `await import('/src/engine/run/state.ts')` gives `createRun` and
    `compatForNode`; `createRun({ seed: 'qa-300', starter })` then
    `{ ...run, nodeKey: 'city:2', visitedNodes: [..., 'city:2'], ...compatForNode(seed, 'city:2') }`
    written with `storeRun(browserStorage())` from `/src/engine/save.ts` and
    `/src/storage.ts`. Starting a run through the UI and reaching `city:2` with
    the debug overlay's node teleport is equally valid; the measurement begins
    once `run.nodeKey` reads `city:2`.
  - **Browser budget:** the one `[live]` criterion above (city:2 and route:1 on
    the same server, one port owned by QA).

## 📣 Coordination

- For the next batch (`[Task-302]`): `RouteScene` keeps its exclusive path and
  its twelve panels; the route screen rewrite must not re-add a registry glob.
- For the sweep (`[Task-298]`): after this task the panel layer is scene-agnostic,
  so deleting `RouteScene` no longer deletes the only HUD host.
- For the Architect: `NODE_PANEL_IDS` is the frozen seven-card set of a node
  scene; a later task that needs an eighth card edits `host.ts` only.

## ⛔ Out of scope

- No new panel, no panel redesign, no CSS, no `src/ui/**` change.
- No region travel/flight rule change (`flyToNode`, if a node supplies it, may be
  a no-op).
- No battle scene, no `src/data/**`, no `src/engine/**`, no dex regeneration.
- No fix of the level-line copy defect (that is Task-301, in this same batch).
