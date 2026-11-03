# Spec: Task-284 — A city is walkable: streets, doors and the Centre

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (+ a small reusable walker and the arrival hand-off).
- **Role:** Dev.
- **Objective:** a settlement node becomes a place you **walk**. `CityScene` extends
  `WorldScene`, draws the settlement's street grid, its buildings and their doors, its
  plaza, its grass corner and its exit bands, spawns the player at the plan's spawn and
  walks them with the run's own controls: a wall stops them, a door tile opens that
  building's interior (dispatched by the interior's own stable key; the interiors
  themselves are the next batch's), and an exit band tile walks to the neighbour through
  the shipped travel rule. `RouteScene` stops pretending to be a city: it hands an
  arrival — and a run that starts on a settlement — to the scene the node's kind names.
- **Environment:** worktree `../wt-pkm-284`, branch `task-284`.
- **Dependencies (already merged on `main`; read them, do not re-derive):**
  - `src/engine/region/travel.ts` — `travel`, `canTravel`, `TravelMode`, `TravelArrival`,
    `TravelRefusal` (the walk rule, the gate, the spawn).
  - `src/scenes/regionScenes.ts` — `collectRegionScenes`: a scene module exporting
    `regionSceneKey` and `regionSceneClass` is registered by `src/main.ts`.
  - `src/scenes/WorldScene.ts` — `applyWorld`, `transitionToNode`, `onNodeArrived`,
    `arrival()`, `preload`, `cachedWorld`, `followCamera`, `mapBounds`, `centerX/Y`.
  - `src/engine/region/city/plan.ts` — `planCity(plan, key)`: `tiles`, `spawn`,
    `buildings` (`{ kind, door, interiorKey, rect }`), `exits` (`{ edge, neighbourKey,
    tiles }`), `grass`, `width`, `height`.
  - `src/engine/region/preload.ts` — `NodeWorld` (`tiles`, `meshes`, `spawn`, `tilesetId`).
  - `src/engine/map.ts` — `TileMap`, `isWalkable`, `resolveMove`, `cutsCorner`,
    `mapSize`, `DOOR`, `TALL_GRASS`.
  - `src/scenes/RouteScene.ts` — the running world scene: its `run`, its player, its
    `persistRun`, its battle/HUD seams (all stay).
  - `src/data/playerSprite.ts` — `PLAYER_SPRITE_TEXTURE_KEY`, `playerSpriteFrame`,
    `playerWalkAnimKey`, `playerWalkTimeScale`.
  - `src/input/` — the keybind read the scenes already use for movement.

### Exclusive paths (single writer)

**Nothing outside this list.**

- `src/scenes/CityScene.ts`
- `src/scenes/walker.ts`
- `src/scenes/walker.test.ts`
- `src/scenes/RouteScene.ts`
- `src/scenes/README.md`
- `docs/region-spec.md` §7.5 only (create it under §7's stub list; do not touch §7.1-§7.4,
  §7.6 or any other section)

### Inputs (read-only)

- `AGENTS.md`.
- `docs/region-spec.md` §1, §4, §5, §6, §7.1, §7.2.
- `src/engine/region/**`, `src/engine/map.ts`, `src/engine/run/state.ts`,
  `src/engine/run/gates.ts`, `src/render/tilemapLayer.ts`, `src/scenes/BootScene.ts`
  (the atlases and the player sheet are loaded there), `src/audio/audio.ts`.
- `src/scenes/RouteScene.ts` is a write path, but its room/battle/HUD code is not yours:
  change only the arrival hand-off.

## 🔒 Contract

### `src/scenes/CityScene.ts` — the scene

```ts
/** What the debug/dev browser pass reads. */
export type CityDebugState = Readonly<{
  key: string;
  tile: { x: number; y: number };
  /** The interior key the last door step opened, or null. */
  interior: string | null;
  /** How many settle transitions this scene played. */
  travels: number;
}>;

export class CityScene extends WorldScene {
  /** `'City'` — the key `regionSceneKey` publishes. */
  constructor();
  init(data?: { run?: RunState }): void;
  create(): void;
  update(time: number, delta: number): void;
}

/** The building whose door is `tile`, or null. */
export function doorAt(plan: CityPlan, tile: Tile): CityBuilding | null;

/** The exit band `tile` belongs to, or null. */
export function exitBandAt(plan: CityPlan, tile: Tile): CityExitBand | null;

/** The scene key a city interior opens: `'centre' → 'Centre'`, `'gym' → 'Gym'`,
 *  `'lab' → 'Lab'`, `'casino' → 'Casino'`, `'house:2' → 'House'`. */
export function interiorSceneKey(interiorKey: string): string;

export const regionSceneKey = 'City';
export const regionSceneClass = CityScene;
```

Behaviour:

- `init` takes `{ run }`; `create` builds `planRegion(run.seed)`, the city plan of
  `run.nodeKey` (`planCity`), and draws it with the **cached/preloaded** node — never a
  rebuild of the generator: `this.cachedWorld(run.seed, run.nodeKey)` first, `preload`
  second, and a `null` world is a logged no-op (the scene stays on an empty camera, it
  must not throw).
- The player is a `PLAYER_SPRITE_TEXTURE_KEY` sprite placed on the city plan's `spawn`
  (or on `arrival()`'s spawn when this scene was entered through a travel), at the tile
  centre, with `actorDepth` sorting and `followCamera`. The camera is the world camera.
- Walking: the run's own movement keys (`src/input/`), one tile per step with the same
  walk/run timing and the player's walk animation the route uses. `isWalkable` +
  `cutsCorner` decide; a ledge is not part of a settlement's plan, so a solid cell (wall,
  roof, water) simply refuses the step.
- **A door step**: stepping onto a building's door tile fades the camera **once**
  (`WORLD_TRANSITION_MS`), records `interior = building.interiorKey`, and — if
  `this.scene.manager.getScene(interiorSceneKey(building.interiorKey))` exists — starts
  it with `{ run, cityKey, interiorKey }`; otherwise it fades back in and leaves the
  player on the door tile. The interiors ship in the next batch; this task owns the seam,
  not the rooms.
- **An exit band step**: stepping onto a band tile asks `travel(plan, run, band.neighbourKey, 'walk')`.
  An arrival commits the run (`persistRun`), and the scene re-draws the neighbour through
  `transitionToNode` when it is a settlement, or starts the scene its kind names
  (`'City'` for a settlement, `'Route'` for a route/lateral) when it is not — the same
  hand-off rule `RouteScene` gets below, so a forward walk into a gated exit is refused
  with the badge and **nothing moves**.
- Its `onNodeArrived(key, spawn)` places the player at `spawn` and plays the settlement's
  music bed (`menu-music`).
- It owns no rule: every decision comes from `travel.ts`, `planCity` or `map.ts`.
- It never writes a HUD panel of its own; the run's HUD keeps working through
  `mountHud`/`refreshHud` only if the scene already receives them — do **not** re-wire the
  HUD here (a later task does); it must simply not break it.
- `IS_DEVELOP`: expose `globalThis.__pkmCity = this` on `create` (deleted on shutdown) and
  a `debugCityState(): CityDebugState`, plus `placePlayer(tile: Tile): void` so a browser
  pass can stand the player on a named door/band without walking 40 tiles.

### `src/scenes/walker.ts` — the walker the next node scenes reuse

```ts
export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export type WalkerHooks = Readonly<{
  /** Called once the step's tween landed, with both tiles. */
  onStep?: (from: Tile, to: Tile, direction: MoveDirection) => void;
}>;

/** Whether a held direction moves `from` one tile: free and corner-cut aware. */
export function canWalkStep(map: TileMap, from: Tile, direction: MoveDirection): boolean;

export class WorldWalker {
  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.GameObjects.Sprite,
    map: TileMap,
    hooks?: WalkerHooks,
  );
  get tile(): Tile;
  /** Puts the sprite on `tile` with no tween; no map rule is read. */
  place(tile: Tile): void;
  /** One tile in `direction`; false when the map refuses or a step is in flight. */
  step(direction: MoveDirection): boolean;
  /** Reads the held direction(s) and starts a step when the timing allows it. */
  update(delta: number, running: boolean): void;
  /** True while a step's tween is running. */
  get stepping(): boolean;
}
```

- `canWalkStep` is pure and headless-testable: a wall/roof/water refuses, a floor/door/
  path/plaza/grass allows, and `cutsCorner` refuses the diagonal squeeze the map's own
  rule refuses.
- The walker draws nothing and decides no rule beyond `canWalkStep`; the scene hands it
  its sprite and its map, and the hook places grass/doors/exits. It must not allocate per
  frame in `update`.
- Both new scene modules publish `regionSceneKey`/`regionSceneClass` where they are scene
  classes; `walker.ts` publishes neither.

### `src/scenes/RouteScene.ts` — the hand-off (the only change there)

- Add a private `arrivalSceneFor(kind: RegionNodeKind): string | null` answering
  `'City'` for `town` and `city`, `'League'` for `league`, and `null` for every other
  kind (a route and a lateral stay in `RouteScene`; the Victory Road and the tower stay
  until their own scenes exist).
- In `create`, after the run is known, and in `onNodeArrived`, when
  `arrivalSceneFor(kind)` is a key and `this.scene.manager.getScene(key)` exists, start
  that scene with `{ run: this.run }` and **do not** keep drawing the old floor world.
  A missing scene (a city scene on an old save, the League today) keeps today's
  behaviour exactly.
- Nothing else in the file changes: the rooms, the battles, the HUD, the debug menu and
  the dev accessors stay byte-identical.

### Data

- No new table, no new balance number, no new key, no new asset. The walk/run timing
  comes from the values `RouteScene` already uses; if they live in another module, import
  them, never re-declare a second number.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test`, `npm run build`.
  - `git diff --name-only main...task-284` against the exclusive paths.
  - Browser: `npm run assets:pack` (`$ASSETS_ROOT`), `npm run dev -- --port <free>
    --strictPort --host 127.0.0.1`, headless Chromium over CDP at 1280×800, canvas read
    through `renderer.snapshotArea` + `getImageData`.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `doorAt` finds exactly the building whose `door` equals the tile, at
    every door of a fixed seed's `city:1`, and `null` on a street tile.
  - [ ] `[unit]` `exitBandAt` answers the band that holds the tile (every band tile of
    `city:1` maps back to its own `neighbourKey`) and `null` in the plaza.
  - [ ] `[unit]` `interiorSceneKey` maps `centre`, `gym`, `lab`, `casino` and `house:<n>`
    to `Centre`, `Gym`, `Lab`, `Casino`, `House`, and is stable for a repeated key.
  - [ ] `[unit]` `canWalkStep` refuses a wall cell and allows a door cell on a small
    hand-built map, and a corner-cut refusal is `false` while the two orthogonal steps it
    cuts are both `true`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` At 1280×800 the game boots a run into the **town** drawn by `CityScene`
    (the run starts on `town:1`): `__pkmCity.debugCityState().key === 'town:1'`, the scene
    holds two `TilemapLayer`s and zero per-cell `Image`s, and `mapBounds` equals
    `mapPixelSize(planCity(planRegion(seed),'town:1').tiles, TILE_SIZE)`. On `city:1`
    (walk `route:1` then `city:1`, or start the scene with that run):
    `reachableTiles(city.tiles, city.spawn)` contains the **Centre's** door tile (an exact
    engine equality, not a walk), `placePlayer(centreDoor)` fires the fade **once** and
    leaves `debugCityState().interior === 'centre'` with no scene start (no `Centre` scene
    yet), and `placePlayer(bandTile)` toward `route:1` travels while the band toward
    `route:2` is refused with badge 1 (read `travel(plan, run, 'route:2', 'walk')` on the
    page). A canvas `getImageData` sample at the spawn tile is opaque and the ground layer
    is drawn (layer frame count > 0).
- **A `[live]` that compares pixels is not a criterion** (`D57`).

## 📣 Coordination

- The next batch's gym and interior scenes: a city door starts the scene whose key
  `interiorSceneKey` names, passing `{ run, cityKey, interiorKey }`; publish
  `regionSceneKey`/`regionSceneClass` and nothing in `main.ts` needs editing.
- `WorldWalker` is the shared walker for the gym and the League's interior: reuse it, do
  not write a second one.
- For the Architect: `RouteScene` holds the arrival hand-off (`town`/`city` → `City`,
  `league` → `League`), so the gym and the League scenes are reached by their own keys.

## ⛔ Out of scope

- Interior scenes (Centre, laboratory, houses, casino, gym): the seam only.
- The gym, the League, the badge rules, the NPCs, the POIs, the encounters, the catch.
- Any HUD panel, notice, i18n key, asset, packer, data table or balance number.
- The old floor code in `RouteScene`: do not delete it (the sweep does).
