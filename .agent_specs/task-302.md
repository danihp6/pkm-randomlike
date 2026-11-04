# Spec: Task-302 — A route plays its own screens

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule + Phaser scene + docs.
- **Role:** Dev.
- **Objective:** the region's `route` and `lateral` nodes stop being played as a legacy
  floor room. A route node is walked as the 2-4 vertical **screens** its own region plan
  already generated: each screen has a spawn tile, the border bands that belong to it and
  its own content (the carver's tall grass, the trainers the node's content pass counts,
  the ground items of the node's loot band, and — on a lateral — the point of interest and
  its zone). Crossing a screen seam carries the walker onto the next screen at the seam
  column, and pressing outward while standing on a border band hands the run back to the
  region's travel seam. The scene reads no legacy floor module (`src/engine/maps/**`,
  `planMap`, `roomView`, `routeIndexForRoom`) and no longer reads the run's three
  deprecated floor-position fields.
- **Environment:** worktree `../wt-pkm-302`, branch `task-302`.
- **Dependencies (already merged; do not re-derive them):**
  - the route generator — `src/engine/region/route/map.ts` (`generateRoute`,
    `RegionRouteMap`, `RouteOpeningBand`), `src/engine/region/route/layout.ts`
    (`RouteScreen`, `RouteOpening`, `SCREEN_HEIGHT`), `src/engine/region/route/index.ts`.
  - the node seam — `src/engine/region/travel.ts` (`travel`, `walkSpawn`), and the node
    resolver `src/engine/region/preload.ts` (`NodeWorld`, `buildNodeMeshes`).
  - the node content — `src/engine/region/content.ts` (`planNodeContent`, `NodeContent`),
    `src/engine/region/pois.ts` (`nodePoi`, `poiRect`, `poiBattleRules`, `inPoiRect`,
    `NodePoi`), `src/engine/region/encounters.ts`.
  - the panel host — `src/scenes/panels/host.ts` (`PanelSceneSource`, `ScenePanels`,
    `createScenePanels`) and `src/scenes/WorldScene.ts` (`drawWorld`, `applyWorld`,
    `transitionToNode`, `arrival`, `actorDepth`).

### Exclusive paths (single writer)

Create or modify **only** these. Nothing outside this list — no `src/main.ts`, no
`src/dev/**`, no `src/ui/**`, no `src/engine/maps/**`, no `src/engine/routes/**`, no
`src/engine/region/route/**`, no `src/engine/region/preload.ts`, no `package.json`.

- `src/engine/region/routeScreens.ts` (new)
- `src/engine/region/routeScreens.test.ts` (new)
- `src/engine/region/README.md`
- `src/scenes/RouteScene.ts`
- `src/scenes/README.md`
- `docs/routes-spec.md` — **§1 and §4 only**, no other section.
- `docs/region-spec.md` — **§7 only**: the subsection list paragraph at the head of §7
  (currently lines 262-267) and one new `### 7.12 The route screen` placed after §7.11,
  before `## 8`. No other section.

> `src/scenes/RouteScene.test.ts` does **not** exist on `main` and is **not** created:
> the repo has no Phaser- or DOM-headless scene test, and the scene's own logic is
> verified `[live]` (see the plan). Do not add a new test harness or a new dependency.
>
> `src/i18n/en.ts` is **not** touched: see Coordination item 3 (the pruning gate pins the
> kept-key list, so no key may be deleted here).
>
> `src/engine/region/travel.ts`, `travel.test.ts`, `src/engine/run/state.ts` and
> `state.test.ts` are **not** touched: see Coordination item 4.

### Inputs (read-only)

Beyond `AGENTS.md` and this spec, read only:

- `src/engine/region/route/layout.ts`, `map.ts`, `index.ts`, `README.md`
- `src/engine/region/plan.ts`, `streams.ts`, `content.ts`, `pois.ts`, `encounters.ts`,
  `preload.ts`, `travel.ts`, `README.md`
- `src/engine/routes/routeMap.ts`, `doors.ts`, `encounters.ts` (`pickWeighted`,
  `RouteEncounters`), `sketch.ts` (`DEFAULT_TRAINER_SIGHT`)
- `src/engine/run/levelCurve.ts` (`bandForNode`), `src/engine/run/state.ts` (read only)
- `src/engine/map.ts` (`isWalkable`, `TileMap`), `src/engine/grid.ts` (`Tile`),
  `src/engine/tileset.ts` (`TILE_SIZE`), `src/engine/rng.ts` (`Rng`, `hashSeed`)
- `src/data/region.ts`, `src/data/loot.ts` (`ROUTE_LOOT`), `src/data/trainers.ts`
  (`TRAINER_ARCHETYPE_IDS`), `src/data/biomes.ts` (`getBiome`, `biomeForRoute`),
  `src/data/pois.ts`
- `src/scenes/WorldScene.ts`, `src/scenes/CityScene.ts` (the node-scene idiom),
  `src/scenes/walker.ts`, `src/scenes/pois.ts` (`drawPoi`), `src/scenes/panels/host.ts`,
  `src/scenes/README.md`, `src/scenes/RouteScene.ts`
- `src/dev/debugMenu.ts` (§ the `DebugRouteContext` / `DebugRouteInput` /
  `DebugGeneratorStep` types and `DebugMenuHandlers`) — **read only, never edit**
- `src/main.ts` (the route methods it calls) — **read only, never edit**
- `src/i18n/index.test.ts` and `src/i18n/README.md` (to confirm the key tables are not to
  be pruned)
- `docs/routes-spec.md`, `docs/region-spec.md`, `docs/agent-spec-template.md`
- `design/screens/03-route-hud.json` and `design/exports/03-route-hud.png` — the imported
  frame of the route screen, caption exactly `03 Route HUD`. The HUD itself does not
  change in this task; the frame is the read-only record of what the screen must keep
  drawing around the world.

## 🔒 Contract

### TypeScript — `src/engine/region/routeScreens.ts`

Pure: no Phaser, no DOM, no `localStorage`, no clock. Total for every key the plan holds
that is a `route` or a `lateral`. Deterministic: every draw comes off the node's own
streams (see "Draw order" below), never `Math.random()`.

Names are frozen because the scene, the tests and Batch 127 are written against them.
`routeScreens` is **taken** (it is exported by `src/engine/region/route/layout.ts` and
re-exported by the barrel), so this module's function is `planRouteScreens`.

```ts
import type { Tile } from '../grid';
import { generateRoute } from './route/map';
import type { RegionRouteMap, RouteOpeningBand } from './route/map';
import type { RegionPlan } from './plan';
import type { NodePoi } from './pois';
import type { RouteMap, RouteTrainer, RouteItem } from '../routes/routeMap';

/** One screen of a route, top to bottom in stitched rows. */
export type RouteScreenPlan = Readonly<{
  /** 0-based, top to bottom. */
  index: number;
  /** The screen's first row, inclusive (= `RouteScreen.top` of the layout). */
  top: number;
  /** The screen's last row, inclusive. The last screen absorbs the remainder. */
  bottom: number;
  /**
   * The tile a walker stands on when it enters this screen: the lane tile on the
   * screen's first row. Screen 0's spawn **is** the carver's `entry`
   * (`generateRoute(...).entry`), so `travel` and the scene agree on the tile.
   */
  spawn: Tile;
  /** The band a walk enters this screen by (the `N` band on screen 0), or `null`. */
  entry: RouteOpeningBand | null;
  /** The bands that leave the route from this screen, in `bands` order. */
  exits: readonly RouteOpeningBand[];
}>;

/** A route node resolved to everything the route screen draws and walks. */
export type RouteNodePlan = Readonly<{
  /** The node's key, e.g. `route:3` or `lateral:5`. */
  key: string;
  /** `node.id`, kept for the dev panel's numeric field only. */
  routeIndex: number;
  /**
   * The node's one carve and the content placed on it, in the shipped `RouteMap`
   * shape the scene's draw code and the shared panels already read, **and** in the
   * `RegionRouteMap` shape `src/scenes/pois.ts` takes (`drawPoi`, `poiRect`), so one
   * object serves both seams. The fields the region route has no concept of are
   * reported empty and documented below: `shape: 'straight'`, `branches: []`,
   * `pockets: []`.
   */
  route: RouteMap & RegionRouteMap;
  /** One descriptor per screen, top to bottom. */
  screens: readonly RouteScreenPlan[];
  /** The lateral's point of interest, or `null` on a main-chain route. */
  poi: NodePoi | null;
}>;

/**
 * The node's screens, its populated route and its terminus.
 * Throws `not a route node: <key>` for a key that is not a `route`/`lateral`
 * (the message `planRouteLayout` throws) and `bad screen count: <n>` for a bad
 * `screens` argument. `screens` forces the count, exactly as `generateRoute`'s third
 * argument does, and moves no other draw.
 */
export function planRouteScreens(
  plan: RegionPlan,
  key: string,
  screens?: 2 | 3 | 4,
): RouteNodePlan;

/** The screen a row belongs to: 0 above the stack, the last one below it. Never throws. */
export function screenIndexOf(screens: readonly RouteScreenPlan[], y: number): number;

/**
 * The band whose tiles hold `tile`, searched on **every** screen's bands (entry and
 * exits), or `null`. First match wins; bands never overlap.
 */
export function bandAt(screens: readonly RouteScreenPlan[], tile: Tile): RouteOpeningBand | null;
```

**What `planRouteScreens` builds, exactly.**

1. `const map = generateRoute(plan, key, screens)`; the tiles, `entry`, `exits`, `spine`,
   `screens` and `bands` come off that one carve and nothing re-carves for the geometry.
2. The layout's screens (`map.screens`, `index`/`top`/`bottom`) become `RouteScreenPlan[]`
   in the same order.
3. **`spawn`:** screen 0's is `{ ...map.entry }`. Screen `i > 0`'s is the **smallest `x`**
   tile on row `top` that is `isWalkable(map.tiles, { x, y: top })` **and** whose north
   neighbour `{ x, y: top - 1 }` is walkable (that neighbour is the previous screen's last
   row, so this is the column the seam can actually be crossed at), preferring a tile that
   is also on `map.spine`. If no such tile exists, fall back to the first spine tile with
   `y >= top`, else `{ x: 1, y: top }` — the function stays total.
4. **Bands:** each `map.bands` entry is assigned to `screenIndexOf(screens, band.tiles[0].y)`
   and appears **once** in that screen: `role === 'entry'` in `entry`, `role === 'exit'` in
   `exits` (in `map.bands` order). Every band appears exactly once across the whole stack.
5. **Content, per screen:** candidates are the tiles with `y` in
   `[max(1, top), min(height - 2, bottom)]` and `x` in `[1, width - 2]` (never the border
   ring) that are `isWalkable`, are **not** on `map.spine`, are **not** in any band's
   `tiles`, and — when the node has a POI — are **not** inside `poi.rect`. Candidates are
   taken deepest-first (`y` descending, then `x` ascending) and removed from a screen's
   pool once used.
   - **Trainers:** `content = planNodeContent(plan, key, node.tier ?? 1)`;
     `content.trainers` (2-4 on a route or a lateral) trainer `j` (0-based) belongs to
     screen `j % screens.length` and takes that screen's next free candidate. A trainer
     skipped for want of a candidate is **not** re-tried on another screen (the pair
     screen↔slot is the rule). Each placed trainer is
     `{ id: `trainer-${key}-${j}`, position: <tile>, facing: 'N', sight: DEFAULT_TRAINER_SIGHT, archetypeId: <drawn> }`
     — it looks up the route, at the walker coming down.
   - **Items:** for each screen `i >= 1`, one `next()` of the loot stream against
     `ROUTE_LOOT[bandForNode(node).id].itemChance`; on a hit take that screen's next free
     candidate and `{ id: `item-${key}-${i}`, position: <tile>, itemId: pickWeighted(pool, lootRng).itemId, hidden: lootRng.next() < hiddenChance }`.
     At most one item per screen, never on screen 0.
   - **POI:** `node.lateralOf !== null` → `poi = nodePoi(plan, key, content)`, else `poi = null`.
     `nodePoi` re-generates the **rolled** count internally (it takes no `screens`
     argument), so the `screens` override is a test-only hook and a forced geometry is
     never combined with a POI: the forced-3 test uses `route:1`, and the lateral test
     never forces a count. Say that in the module's doc comment.
6. **`route`:** `{ seed: plan.seed, key: map.key, routeIndex: node.id, biomeId: map.biomeId,
   shape: 'straight', width: map.width, height: map.height, tiles: map.tiles,
   entry: map.entry, exits: map.exits, spine: map.spine, branches: [], pockets: [],
   screens: map.screens, bands: map.bands, items, trainers }`. It is a `RouteMap &
   RegionRouteMap`, so `drawPoi(this, this.route, this.poi, TILE_SIZE)` typechecks
   without a cast. No `gate`, no `chamber`, no `signs`.

**Draw order (frozen, `D60`):** `planNodeContent` (its own `content` stream) → the
trainer archetypes, one `int(0, TRAINER_ARCHETYPE_IDS.length - 1)` per placed trainer in
placement order, off `nodeStreams(plan.seed, key).content.split('route-trainers')` → the
loot stream `nodeStreams(plan.seed, key).loot`: one `next()` per screen `i >= 1` in screen
order and, per hit, the pool pick then the hidden roll. Nothing else draws; a later task
may append a draw at the end of a stream but never before these.

Add a module doc comment stating the one deliberate non-obvious rule: *the lane is never a
content tile, so a trainer or an item can never block the walkable end-to-end lane the
carver guarantees.*

### TypeScript — `src/scenes/RouteScene.ts`

The scene keeps its class name, its scene key (`'Route'`) and every public method
`src/main.ts` calls with an **unchanged** signature. New frozen member:

```ts
/**
 * Dev only: the route node on screen, its screens and the screen the player stands on,
 * as plain data (`__pkmRoute.debugRouteScreen()` in the browser pass). Null when not
 * developing, when the scene is not active, or while a dev preview (generator step or
 * frame-map import) is on screen.
 */
debugRouteScreen(): Readonly<{
  nodeKey: string;
  index: number;
  tile: { x: number; y: number };
  screens: readonly Readonly<{
    index: number;
    top: number;
    bottom: number;
    spawn: { x: number; y: number };
    bands: readonly Readonly<{
      edge: 'N' | 'E' | 'S' | 'W';
      role: 'entry' | 'exit';
      neighbourKey: string;
      tiles: readonly { x: number; y: number }[];
    }>[];
  }>[];
}> | null;
```

`index` is `screenIndexOf(this.screens, this.player.y)`. `bands[].edge` is the `AccessEdge`
of `src/engine/routes/layout.ts`, spelled out as those four literals so the value survives
`JSON.stringify` unchanged. Every object is freshly built (no engine object leaks out) and
JSON-serialisable.

**The screen rules the scene implements.**

- **Build:** `planRouteScreens(planRegion(run.seed), run.nodeKey)` is the only source of
  `this.route`, `this.map`, `this.moveMap`, `this.encounters`, `this.screens`, `this.poi`
  and `this.tilesetId` (`getBiome(route.biomeId).tilesetId`). It also sets
  `this.routeParams = { seed: run.seed, routeIndex: node.id, shape: 'straight',
  width: route.width, height: route.height,
  grassPatches: biome.terrain.grassPatches, ledges: biome.terrain.ledges }`, so the dev
  panel's `debugRouteContext()` and `regenerateRoute()` keep answering for the node on
  screen. Tiles are drawn only by
  `drawTiles()` → `drawWorld({ tiles: this.renderTiles, meshes: buildNodeMeshes(...),
  tilesetId })`; the two layers are the world's (no per-screen draw, no third draw path).
  The encounter streams are keyed by the **node**, never the room:
  `` `${run.seed}:encounters:${node.key}` `` and `` `${run.seed}:shiny:${node.key}` ``.
- **Spawn:** on `create`, the player starts on `screens[0].spawn`, or on the arrival's own
  spawn when `arrival()?.key === run.nodeKey`; on `onNodeArrived(key, spawn)` it starts on
  `spawn`. Both equal `screens[0].spawn` for a real walk, because `travel`'s `walkSpawn`
  answers the same `generateRoute(...).entry` (pinned by a test).
- **Crossing:** a step that lands on row `screens[i].bottom + 1` is a step onto
  `screens[i + 1].top`; no teleport, no rebuild, no state: `screenIndexOf` derives the
  index from the player's row every time it is asked.
- **Leaving:** the scene holds `private bandArmed = false`. It is set **false** every time
  the player is placed (spawn after build, node arrival) and **true** by every landed step
  (`onTileEntered`) and by `teleportToTile`. While `bandArmed`, if the player stands on a
  band cell (`bandAt(this.screens, this.player)`) **and** the held direction is that band's
  own outward direction (`up` for `N`, `down` for `S`, `left` for `W`, `right` for `E`),
  `update` calls `void this.travelToNode(band.neighbourKey, 'walk')` and returns before any
  step is resolved. That is the whole exit rule: the `S`/`E`/`W` band of the last screen
  goes to the next region node, the `N` band of screen 0 goes back to the parent, and a
  lateral leaves through its `N` band because it has no exit band at all.
- **POI:** when `poi !== null`, `drawPoi(this, this.route, this.poi, TILE_SIZE)` is drawn
  with the other entities (so `clearRouteSprites` takes it down), and `startBattle` passes
  `noHeal: poiBattleRules(this.poi ? [this.poi] : [], this.player).noHeal` in the
  `BattleLaunch`.
- **No floor read left:** the scene imports nothing from `src/engine/maps`, calls no
  `planMap`/`roomView`/`routeIndexForRoom`, and reads no `run.mapIndex`, `run.routeIndex`
  or `run.routeInMap`. The values it must still report are node-derived:
  - `battleSeed(run.seed, hashSeed(node.key), key)` and `BattleLaunch.routeIndex =
    hashSeed(node.key)` (a stable per-node number, unique per node; `hashSeed` is already
    imported);
  - `catchLocation: { biomeId: route.biomeId, mapIndex: node.badge, routeInMap: <the
    screen index the catch happened on> }` (the detail card prints
    `Map <badge> · <biome> · Route <screen+1>`);
  - `bandForNode(node)` replaces `bandForMap(...)`/`runBand(...)` in `startTrainerBattle`,
    `rewardFor` and `debugRouteContext`, and the trainer roster key becomes
    `` `${run.seed}:trainer:${node.key}:${trainer.id}` ``;
  - `debugRouteContext()` keeps its `DebugRouteContext` shape and reports
    `{ seed: run.seed, routeIndex: node.id, mode: run.mode,
    biomeName: getBiome(route.biomeId).name, bandName: bandForNode(node).name,
    shape: 'straight', width: route.width, height: route.height,
    mapIndex: 0, roomInMap: <current screen index>, roomCount: screens.length,
    tile: {...}, passThrough, hoverInspect, ignoreEncounters, ignoreTrainers }` — the
    three deprecated numbers report node facts and are read by no panel.

**Delete (room-only machinery, now unreachable):** `buildRoom`, `sealEdge`, `bossLinkEdge`,
`bossTrainer`, `bossChamberTile`, `farthestRoomTile`,
`portalOpen`, `buildBattlefieldOverlay`, `drawRoomFixture`, `specialDescriptor`,
`placeSpecialTrainer`, `rollRoomNpc`, `roomHost`, `view`, `tryLeaveRoom`, `doorEdgeAt`,
`transitionTo`, `rebuildRoom`, `drawSigns` and `talkToSign` + the `signs` reads, `teleportToFloor`,
`teleportToRoom`, `debugBattlefieldOverlay`, the NPC card path (`npc`, `npcBattle`,
`talkToNpc`, `openNpcCard`, `openNpcCardView`, `chooseNpc`, `npcContext`,
`openTutorMoves`, `openMemberCard`, `chooseMember`, `openSlotCard`, `applyMemberEdit`,
`showNpcResult`, `commitNpcResult`, `commitNpcModifiers`, `memberEditParagraph`,
`memberById`, `typeName`, `startNpcBattle`, the `NPC_REFUSALS`/`CHEF_REFUSALS` tables),
`shopCounter` + `shopCounterAt`, `npcBlocks`, `signBlocks`, the `boss`/`miniBoss` reward
branches in `applyBattleResult` and their `finish` clauses, the `this.plan`/`this.room`
fields, `this.roomRegistry` + the `ROOM_MODULES` glob + the `./rooms/**` imports, and the
`battlefield`/`bossOpening`/`battlefieldOverlay` fields. Then delete every import that
loses its last use — `npm run build` enumerates them; do not silence an unused import.

**Rework, do not delete, the dev carver preview:** `buildRoute(params, attempt)` and
`applyRoute(route)` stay, because `regenerateRoute` and `importFrameMap` (called from
`src/main.ts`, out of scope) are written against them. Strip the `params.room` branch out of
`buildRoute` — no `openings`/`role`/`quiet`/`gate`/`chamber`/`signs`/`bossLinkEdge`, no
`room` in `RouteParams` — so it is the free-standing `sketchRoute` preview it already is for
the dev tools. Narrow `applyRoute(route: RouteMap)` to one job — adopt this map (`route`,
`map`, `renderTiles`, `moveMap`, `tilesetId`) — by **moving the `RouteEncounters`
construction out of it** into the node build (today it builds them off `route.routeIndex`,
which this task replaces with the node key) and by dropping its `showAreaPanel` call: the
banner is raised once per node entry by `create`/`onNodeArrived`. `buildNode` sets
`this.screens`, `this.poi`, `this.encounters` and `this.tilesetId` first and then calls
`applyRoute`. Both dev tools set `this.screens = []` and `this.poi = null` before their
draw, so no band rule can fire on a preview.

**Keep (this task must not change their behaviour):** battles and the battle return
(`startBattle`, `startTrainerBattle`, `applyBattleResult`, `resolveBattle`, capture,
`recordHpLost`, `bookTallies`, releases, level-up beats, `endRun`, ranking), the bag/items
(`collectItemAt`, `itemBlocks`, `drawItems`), tall grass and encounters (`onTileEntered`,
`refreshGrassStep`, `playGrassRustle`, `RouteEncounters`, `wildExclusions`), trainers
(`drawTrainers`, `refreshTrainerVisibility`, `trainerSpotted`, `beginChase`, `stepChase`,
`finishChase`, `removeTrainerSprite`), the player/follower/walker (`walkStep`,
`settleMovement`, `movePlayerTo`, `followStep`, `placeFollower`, `updateTrainerSpins`), the
HUD and panels (`panelSource`, `panelSelection` with all twelve ids, `openPanel`,
`closePanel`, `panelOpen`, `modalPanelOpen`, `refreshHud`, `commitRun`, `applyMapPassives`,
`showPassivePickups`, notices, pause, settings, touch, `handleAction`), the save
(`persistRun`), the travel seam (`travelToNode`, `onNodeArrived`, the settlement hand-off
in `arrivalSceneFor`), and every dev method `src/main.ts` calls unchanged:
`startDebugWildBattle`, `addDebugPokemon`, `addDebugItem`, `debugParty`,
`setDebugSquadLevel`, `editDebugPokemon`, `healDebugPokemon`, `debugRouteContext`,
`debugTravelState`, `regenerateRoute`, `setPassThrough`, `setHoverInspect`,
`generatorStepInfo`, `stepGenerator`, `resetGeneratorStep`, `exportFrameMap`,
`importFrameMap`, `setIgnoreEncounters`, `setIgnoreTrainers`, `debugTrainerSprites`,
`debugOverrideTrainer`, `debugWildState`, `debugRollWildEncounters`, `teleportToTile`,
`applyBattleResult`, `debugEndRun`, `travelToNode`. While a dev preview is on screen (
`generatorStepIndex !== null`, or after `importFrameMap`), `this.screens` is `[]` so
`debugRouteScreen()` answers `null` and no band rule can fire.

**Degradation, not a crash:** a node whose kind is not `route`/`lateral` (`victory-road`,
`league`, `tower`) is warned once (`console.warn('route: no screens for <key>')`) and the
scene draws nothing, exactly as `CityScene` degrades for a non-settlement. The settlement
hand-off in `create` stays first, so `town`/`city` never reach that branch.

### Data

No new table, key or default. The only balance numbers the seam reads are shipped data:
`ROUTE_LOOT[bandForNode(node).id]` (`itemChance`, `hiddenChance`, `pool`),
`TRAINER_ARCHETYPE_IDS`, `POI_ZONE_WIDTH`/`POI_ZONE_HEIGHT` (through `nodePoi`) and the
carver's own `grassPatches`/`ledges` (inside `generateRoute`).

## 🧩 Data and configuration

Nothing new. Do **not** add a field to `RouteMap`, `RunState`, the save schema, the i18n
tables or the HUD layout. `SAVE_VERSION` does not move.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including
    `src/engine/region/routeScreens.test.ts`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npx vitest run src/engine/region/routeScreens.test.ts` — the new module alone.
  - `git diff --name-only main...task-302` audit against the exclusive paths list.
  - The browser pass is **owed**: the criteria below include four `[live]` ones. Run it
    against `npm run dev`, a Chromium at **1280×800**, over CDP (`IS_DEVELOP` is on in dev,
    so `__pkmRoute` / `__pkmCity` exist). Recipe QA reuses for every `[live]` step:
    - evaluate with `Runtime.evaluate` and `awaitPromise: true`, `returnByValue: true`;
    - a key press is `Input.dispatchKeyEvent` twice — `{ type: 'keyDown', key: 'ArrowDown',
      code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40 }` then the
      same with `type: 'keyUp'` — after `Page.bringToFront` and one click on the canvas;
    - a wait is a poll (up to 3 s, every 100 ms) of the value being asserted, never a fixed
      sleep, so a slow worker preload cannot make the pass flaky.
- **The tests the new file must contain** (`src/engine/region/routeScreens.test.ts`,
  `planRegion('alpha')` as the fixed seed unless stated):
  1. `screens.length` equals `generateRoute(plan, 'route:1').screens.length`, is 2-4, and
     `screens[0].top === 0`, `screens.at(-1).bottom === route.height - 1`, and for every
     `i`: `screens[i].bottom + 1 === screens[i + 1].top`.
  2. Every `spawn` is walkable, `spawn.y === top`, and `screens[0].spawn` deep-equals
     `generateRoute(plan, 'route:1').entry`.
  3. Every seam is crossable at its spawn column: for `i >= 1`,
     `isWalkable(tiles, screens[i].spawn)`, `isWalkable(tiles, { x: screens[i].spawn.x,
     y: screens[i].top - 1 })`, and `screens[i].top - 1 === screens[i - 1].bottom` — i.e.
     one step down from the tile above lands exactly on `screens[i].spawn`.
  4. `screenIndexOf(screens, y)` is the screen holding `y` for every `top`/`bottom`, `0`
     for `-1` and the last index for `height + 3`.
  5. The stack carries every band exactly once: build a key per band
     (`` `${edge}:${neighbourKey}:${tiles.map(t => `${t.x},${t.y}`).join('.')}` ``) over
     `[...screens.flatMap(s => [s.entry, ...s.exits]).filter(b => b !== null)]` and over
     `generateRoute(plan, 'route:1').bands`, and assert the two sorted arrays are equal;
     also assert `entry` is non-null only on screen 0.
  6. Pinned geometry, forced to three screens: with
     `planRouteScreens(plan, 'route:1', 3)`, `screens[2].top === 80`,
     `screens[2].bottom === 159`, the `S` band (`neighbourKey: 'city:1'`) and the `E` band
     (`neighbourKey: 'lateral:1'`) both belong to screen 2, the `N` band
     (`neighbourKey: 'town:1'`) is screen 0's `entry`, and `screens[0].spawn` is
     `{ x: 51, y: 0 }` (the values the digest in
     `src/engine/region/route/map.test.ts:159-162` pins for that seed and count).
  7. `bandAt(screens, band.tiles[0])` answers that band for the `N`, `S` and `E` bands, and
     `bandAt(screens, { x: 0, y: 0 })` is `null`.
  8. A lateral (`plan.nodes.find(n => n.kind === 'lateral')`): `exits` is empty on every
     screen, `entry` is screen 0's, `poi !== null`, `inPoiRect(poi.rect, poi.marker)` is
     true, `poi.marker.y` is inside `screens.at(-1)`, and no trainer tile or item tile is
     inside `poi.rect`.
  9. Content invariants for `route:1`: `content = planNodeContent(plan, 'route:1',
     nodeOf(plan,'route:1')!.tier ?? 1)`; `route.trainers.length <= content.trainers`;
     every trainer tile is walkable, not on `route.spine`, not in any band, and its screen
     is `j % screens.length` (the `j`-th trainer's index); ids are unique; every item tile
     is walkable and on a screen `>= 1`; `route.items.length <= screens.length - 1`.
  10. Replay and cross-seed: two calls `toEqual` each other, and
      `planRouteScreens(planRegion('beta'), 'route:1')` does not equal the `alpha` one.
  11. `travel` agreement: build a run standing on `'town:1'` that may leave it
      (`createRun({ seed: 'alpha', starter })` from the shipped helpers, then
      `travel(plan, run, 'route:1', 'walk')`), and assert the accepted `spawn` deep-equals
      `planRouteScreens(plan, 'route:1').screens[0].spawn`. (Read `travel`; do not change
      it.)
  12. Invalid input: `planRouteScreens(plan, 'city:1')` throws
      `/^not a route node: city:1$/`; `planRouteScreens(plan, 'route:1', 5 as never)` throws
      `/^bad screen count: 5$/`.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean (typecheck + bundle).
  - [ ] `[unit]` `npm test` is green, and `npx vitest run src/engine/region/routeScreens.test.ts` passes the twelve groups above.
  - [ ] `[unit]` `git diff --name-only main...task-302` lists only the seven exclusive paths (plus `README` lines inside them); no other file.
  - [ ] `[unit]` No legacy floor read in the scene: `grep -nE "engine/maps|planMap|roomView|routeIndexForRoom|advanceRoute|advanceMap|isFinalMap|MapPlan|RoomView|roomRegistry|RoomDescriptor|RoomHost" src/scenes/RouteScene.ts` prints nothing.
  - [ ] `[unit]` No deprecated run field is read by the scene: `grep -nE "run\.(mapIndex|routeIndex|routeInMap)" src/scenes/RouteScene.ts` prints nothing.
  - [ ] `[unit]` The scene builds from the seam: `grep -n "planRouteScreens" src/scenes/RouteScene.ts` finds the call, and `grep -nE "from '\.\./engine/region/route" src/scenes/RouteScene.ts` prints nothing (the scene never imports the carver: `planRouteScreens` is its only map source).
  - [ ] `[unit]` The scene draws the POI through the shipped half: `grep -n "drawPoi(" src/scenes/RouteScene.ts` finds one call, and `grep -n "poiBattleRules(" src/scenes/RouteScene.ts` finds one call.
  - [ ] `[unit]` The dev surface `src/main.ts` calls still exists: `grep -nE "^\s+(debugRouteContext|debugTravelState|debugRouteScreen|regenerateRoute|generatorStepInfo|stepGenerator|resetGeneratorStep|exportFrameMap|importFrameMap|teleportToTile|startDebugWildBattle|addDebugPokemon|addDebugItem|debugParty|setDebugSquadLevel|editDebugPokemon|healDebugPokemon|setPassThrough|setHoverInspect|setIgnoreEncounters|setIgnoreTrainers)\(" src/scenes/RouteScene.ts` lists every one of the named methods.
  - [ ] `[unit]` The i18n tables are untouched and their gate passes: `git diff --name-only main...task-302 | grep -c "src/i18n/"` is `0`, and `npm test` covers `src/i18n/index.test.ts`.
  - [ ] `[unit]` The docs match the code: `grep -n "7.12 The route screen" docs/region-spec.md` finds the heading; `sed -n '/^## 1\. What a route is/,/^## 2\./p' docs/routes-spec.md | grep -c "screen"` is at least 1; and `sed -n '/^## 4\. Run structure/,/^## 5\./p' docs/routes-spec.md | grep -cE "infinite mode|portal|the final boss ends a finite run"` is `0`.
  - [ ] `[unit]` The two folder READMEs map the new files: `grep -n "routeScreens" src/engine/region/README.md` finds both lines, and `grep -n "debugRouteScreen" src/scenes/README.md` finds the route scene's role line.
  - [ ] `[live]` **The first screen plays.** At 1280×800 on a dev boot (the route scene hands
    the town to `City` at start), evaluate:
    `const c = window.__pkmCity; const b = c.city.exits.find(b => b.neighbourKey === 'route:1'); c.placePlayer({ x: b.tiles[0].x, y: b.tiles[0].y });`
    (`__pkmCity.city` is the live `CityPlan`), then poll until `window.__pkmRoute` is defined.
    Measurement: `window.__pkmRoute.debugRouteScreen()` is non-null, `nodeKey === 'route:1'`,
    `screens.length` is 2, 3 or 4, `index === 0`, `screens[0].top === 0`, and
    `window.__pkmRoute.groundLayer.tilemap.width === 60` while
    `window.__pkmRoute.groundLayer.tilemap.height >= 120`. (No pixel comparison.)
  - [ ] `[live]` **Crossing a screen seam lands on the next screen at the seam column.** From
    the state above: let `s = __pkmRoute.debugRouteScreen().screens`;
    `__pkmRoute.teleportToTile(s[1].spawn.x, s[0].bottom)`; press `ArrowDown`; poll until
    `__pkmRoute.debugRouteScreen().index === 1`. Measurement: that index reads `1`,
    `tile.y === screens[1].top` and `tile.x === screens[1].spawn.x`. (This is the real
    geometry: the screens are vertical slices, so the walk crosses downward, never eastward.)
  - [ ] `[live]` **The last screen's exit band hands the run back to the region.** Let
    `last = __pkmRoute.debugRouteScreen().screens.at(-1)` and
    `band = last.bands.find(b => b.role === 'exit')`;
    `__pkmRoute.teleportToTile(band.tiles[0].x, band.tiles[0].y)`; press `ArrowDown`; poll
    until `window.__pkmRoute === undefined`. Measurement: `window.__pkmRoute` is `undefined`
    (the Route scene shut down) and `window.__pkmCity.debugCityState().key ===
    band.neighbourKey` (for `route:1` that is `'city:1'`). If the plan's first route node is
    a lateral instead, the equivalent measurement is `__pkmRoute.debugRouteScreen().nodeKey`
    becoming the lateral's `entry.neighbourKey` (the parent route) after an `ArrowUp` on
    `screens[0].entry.tiles[0]`.
  - [ ] `[live]` **Nothing else regressed on the screen.** Same visit, still on `route:1`: `document.querySelector('#hud')` is non-null, `document.querySelector('[data-hud-panel="party"]')` is non-null, `__pkmRoute.debugWildState().nodeKey === 'route:1'`, and `__pkmRoute.debugTravelState()` reports `nodeKey === 'route:1'` with a `tile` equal to `__pkmRoute.debugRouteScreen().tile` (the scene's own position and the travel seam agree).

## 📣 Coordination

1. **The batch's "walks east" wording is wrong and this spec follows the code.**
   `src/engine/region/route/layout.ts:59-67` (`routeScreens`) makes the screens **contiguous
   vertical slices** of one tall map, `layout.ts:49` (`EXIT_EDGES`) fixes the exit order as
   `S`, `E`, `W`, and `map.ts:64-79` (`openingBands`) cuts one band per opening off that one
   carve. There is no horizontal screen boundary. The crossing rule is therefore on the **y axis**: a step from
   `screens[i].bottom` onto `screens[i + 1].top`, landing on `screens[i + 1].spawn` (the
   lane column at that row). No acceptance criterion mentions walking east. The
   `S`-band rule is the last screen's way out; an `E`/`W` band on whichever screen owns its
   first cell also returns to the region.
2. **`victory-road` is out of this task, and the acceptance must say so.** The generator
   refuses it (`isRouteKind` in `route/layout.ts:69-71` accepts only `route`/`lateral`, so
   `planRouteLayout` throws `not a route node: victory-road:1`), `preloadNode` answers
   `no generator for victory-road:1` (`src/engine/region/preload.ts:105`) and `walkSpawn`
   answers `{0,0}` for it (`src/engine/region/travel.ts:78-84`), so no screen can enter it
   today. Making it playable needs `route/layout.ts`, `route/map.ts` and `preload.ts`,
   which this task does not own: **it is a new backlog task**, not a gap in this one.
3. **No i18n key is deleted.** `src/i18n/index.test.ts:554-570` pins the README's lists —
   18 pruned keys and 31 keys "kept for Batch 125", and `dev.error.noFloorPlan` is one of
   the 31 — and asserts both tables still carry every kept key. Deleting it would turn the
   gate red and the only file that could re-balance the list
   (`src/i18n/README.md`) is outside this task's paths. So `en.ts`/`es.ts` stay byte-identical;
   the dead `dev.error.noFloorPlan` call site dies with `teleportToRoom` and the key is
   swept by the same task that re-cuts the pruning lists.
4. **The three deprecated fields keep their writer; only their route-screen reader dies.**
   `run.mapIndex`/`run.routeIndex`/`run.routeInMap` still have **live** readers outside this
   task — `src/ui/runSummary.ts:85` (the main menu's Continue row), `src/ui/hud/state.ts:228,235-237`,
   `src/ui/rocketPanel.ts:185` and `src/ui/casino.ts:148` (the casino's band) — and
   `src/engine/region/travel.ts:144` writes them through `compatForNode`. Removing that
   writer would freeze the label and the casino at map 1, i.e. a visible regression. The
   sweep that deletes the fields must therefore also claim `src/ui/runSummary.ts`,
   `src/ui/hud/state.ts`, `src/ui/rocketPanel.ts`, `src/ui/casino.ts` and
   `src/dev/debugMenu.ts`'s `routeIndex` field; Batch 127's current path list does not, and
   its plan must be re-cut with them. This task's contribution is precise and checkable:
   the route scene reads none of them, and nothing in the region scene path does.
5. **For Batch 127 (`Task-298`, the sweep):** `RouteScene` keeps its scene key `'Route'`
   and its full public dev surface, so deleting the scene also deletes
   `__pkmRoute.debugRouteScreen()` — the accessor is dev-only by construction
   (`IS_DEVELOP`), so no production path depends on it. `planRouteScreens`,
   `screenIndexOf` and `bandAt` are the frozen seam the region's route screen was built on;
   deleting the scene should delete this module with it, and with it the `routeScreens` line
   in `src/engine/region/README.md`.
6. **Determinism note.** The route's grass rolls moved from a room-derived key to a
   node-derived one (`` `${seed}:encounters:${nodeKey}` ``), and its content now comes off
   the node's `content`/`loot` streams, so a fixed seed's route grass sequence and its
   trainer/item placement differ from the pre-region build. No shipped test pins either;
   the node's encounter table, level rule and catch rule are unchanged.
7. **A route whose lanes are bare gets fewer trainers than its content count.** The seam
   never stands a trainer or an item on the lane or on a band, so a screen with no walkable
   off-lane tile loses its trainer slot (it is not re-tried elsewhere). That is the
   generator's terrain fact, recorded in `docs/region-spec.md` §7.12; widening it is a
   later content task, not a defect in this one.

## ⛔ Out of scope

- `victory-road` (no generator, see Coordination 2), the League, the tower and every
  settlement screen.
- The HUD, its panels, the DOM layer, the i18n tables, the region map panel, the pause
  menu and the save schema.
- `src/engine/region/travel.ts`, `src/engine/region/preload.ts`,
  `src/engine/region/route/**`, `src/engine/routes/**`, `src/engine/maps/**`,
  `src/ui/**`, `src/dev/**`, `src/main.ts`, `src/scenes/*.ts` other than `RouteScene.ts`.
- Adding a scene test harness, a headless Phaser stub, a new dependency or a new npm
  script.
- Reworking `advanceRoute`/`advanceMap`/`compatForNode` in `src/engine/run/state.ts`: they
  still ship and are deleted (with the last `src/ui` readers) by the sweep, see
  Coordination 4.
- Migrating the debug menu's generator step / frame-map tools off the legacy carver: they
  keep working as a free-standing preview of `sketchRoute`, and while one is on screen the
  seam's band rule is inert.
- Balancing: no new odds, no new data row, no change to `ROUTE_LOOT`,`POI_ZONE_*` or
  `TRAINER_ARCHETYPE_IDS`.
