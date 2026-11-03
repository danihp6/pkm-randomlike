# Spec: Task-280 — `WorldScene` draws the region: one tilemap, culled, generated off the main thread

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scene (a new base scene + the route scene's draw), a render
  helper, a web worker, and one pure engine module.
- **Role:** Dev.
- **Objective:** after this task the route's ground is drawn **once per map** instead of
  once per cell: a new `src/render/tilemapLayer.ts` turns the precomputed frame mesh
  (`buildFrameMesh`, Batch 117) into Phaser tile layers, a new
  `src/engine/region/preload.ts` resolves a whole region node (`{seed, key}` → its tile
  map + its two meshes) purely, a new `src/workers/nodeWorker.ts` answers that request
  off the main thread, and a new `src/scenes/WorldScene.ts` is the base scene every node
  scene (route, city, gym, League) will extend: it owns the tile draw, the camera and
  the node preload. `RouteScene` becomes a subclass of it and keeps all of its room,
  battle, item, trainer and HUD logic.
- **Environment:** worktree `../wt-pkm-280`, branch `task-280`.
- **Dependencies (already merged on `main`):**
  - the frame mesh — `src/engine/frameMap.ts` (`FrameMesh`, `buildFrameMesh`) and
    `src/engine/tileFrames.ts` (`resolveTileFrame`, `resolveGroundFrame`,
    `treeTipKeys`), from the region-contract batch;
  - the region plan — `src/engine/region/plan.ts` (`planRegion`, `nodeOf`,
    `RegionNode`, `RegionNodeKind`, `RegionPlan`), same batch;
  - the generators — `src/engine/region/route/map.ts` (`generateRoute`,
    `RegionRouteMap`) and `src/engine/region/city/plan.ts` (`planCity`, `CityPlan`),
    from the generators batch.

### Exclusive paths (single writer)

Nothing outside this list. Deleting a stray `.gitkeep` from a directory this task
populates is allowed.

- `src/scenes/WorldScene.ts` — **new**: the base scene (the draw, the camera, the
  preload).
- `src/scenes/RouteScene.ts` — the subclass: its tile draw and camera go through the
  base.
- `src/scenes/README.md` — the `WorldScene.ts` line and the corrected `RouteScene.ts`
  line.
- `src/main.ts` — **claimed as a hot file; no edit is expected.** `WorldScene` is a base
  class and is **not** registered in the `scene` array, and `RouteScene` stays
  registered under the key `Route`. Touch this file only if a typecheck forces it, and
  then only to keep the scene list as it is.
- `vite.config.ts` — `worker: { format: 'es' }` and nothing else.
- `src/render/tilemapLayer.ts` — **new**: the mesh → Phaser layers builder, plus the
  pure `tilemapData`/`groundMesh` helpers.
- `src/render/tilemapLayer.test.ts` — **new**: the pure helpers only.
- `src/render/README.md` — the `tilemapLayer.ts` and `tilemapLayer.test.ts` lines, and
  rule 1 amended (that folder's rule 1 says "no Phaser import"; this module imports
  Phaser **type-only** and builds a game object, so the rule becomes: a module here
  either **tabulates** (frames, keys, measurements — no Phaser at all) or **builds a
  Phaser object from a scene and a table**, and a builder carries no game rule).
- `src/workers/nodeWorker.ts` — **new**: the worker's message handler.
- `src/workers/README.md` — **new** (`AGENTS.md`'s folder-map rule: every code folder
  carries a README).
- `src/engine/region/preload.ts` — **new**: the pure node resolver.
- `src/engine/region/preload.test.ts` — **new**.
- `src/engine/region/README.md` — the `preload.ts` and `preload.test.ts` lines **and**
  the `gym/` folder line written for `[Task-282]` (exact text in *Coordination*).

**Not** claimed, deliberately: `docs/tech-decisions.md`. The phase's opening paragraph
assigns a `D63` to this item, but the item's own *Claims* line does not name that file,
`D65`/`D66` from the already-merged batch were never written, and two tasks appending to
the same end of one file would collide on the merge. See *Coordination*.

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/region-spec.md` §1, §2 (the node kinds, the streams) — the vocabulary the
  contract uses.
- `docs/tech-decisions.md` — read `D59`–`D62` only, to keep the new vocabulary
  consistent. Do not write it.
- `docs/tileset-spec.md` §1, §6 (the map values, the FRLG atlas cell size, the wall
  pattern and the transparent tree ground).
- `src/engine/frameMap.ts`, `src/engine/tileFrames.ts`, `src/engine/tileset.ts`,
  `src/engine/map.ts`, `src/engine/grid.ts`, `src/engine/rng.ts`.
- `src/engine/region/plan.ts`, `src/engine/region/streams.ts`,
  `src/engine/region/route/map.ts`, `src/engine/region/city/plan.ts`.
- `src/data/tilesets/ids.ts`, `src/data/tilesets/index.ts`,
  `src/data/tilesets/frlg.ts`, `src/data/tilesets/city.ts`,
  `src/data/tilesets/interior.ts`, `src/data/region.ts`.
- `src/scenes/RouteScene.ts` (the file being changed), `src/scenes/BootScene.ts` (the
  texture keys), `src/scenes/panels/` (how a panel is built — read only).
- `src/dev/env.ts` (`IS_DEVELOP`), `src/dev/debugMenu.ts` (the handlers `main.ts`
  wires).
- `vite.config.ts`, `package.json`, `tsconfig.json`.

## 🔒 Contract

This is what Batch 121 and every later batch writes against. Names, kinds and
signatures are frozen; the bodies are yours.

### `src/engine/region/preload.ts` (pure — no Phaser, no DOM, no clock)

```ts
import type { Tile } from '../grid';
import type { FrameMesh } from '../frameMap';
import type { TileMap } from '../map';
import type { TilesetConfig } from '../tileset';
import type { RegionNodeKind, RegionPlan } from './plan';
import type { TilesetId } from '../../data/tilesets/ids';

/** The two meshes one map draws: the floor under every cell, and the tile over it. */
export type NodeMeshes = Readonly<{ ground: FrameMesh; overlay: FrameMesh }>;

/** One region node resolved to everything a scene needs to draw and walk it. */
export type NodeWorld = Readonly<{
  /** The node's `nodeKey`. */
  key: string;
  kind: RegionNodeKind;
  /** The atlas the node draws from: `forest` on a route, `city` on a settlement. */
  tilesetId: TilesetId;
  width: number;
  height: number;
  /** The map in the engine's own values (`src/engine/map.ts`). */
  tiles: TileMap;
  meshes: NodeMeshes;
  /** Where a walk in through an exit band lands: `planCity().spawn`, or the carver's entry. */
  spawn: Tile;
}>;

/** The two meshes of one map, resolved exactly as `RouteScene` frames them today. */
export function buildNodeMeshes(tiles: TileMap, tileset: TilesetConfig, pad?: number): NodeMeshes;

/** One node resolved off the run seed, or `null` when the plan holds no such drawable node. */
export function preloadNode(seed: string, key: string): NodeWorld | null;

/** The worker's request and reply, both structured-cloneable. */
export type NodeRequest = Readonly<{ seed: string; key: string }>;
export type NodeReply =
  | Readonly<{ ok: true; key: string; world: NodeWorld }>
  | Readonly<{ ok: false; key: string; error: string }>;

/** Answers one request without throwing: an unknown key is `{ ok: false }`. */
export function answerNodeRequest(request: NodeRequest): NodeReply;
```

Rules for these four:

- **Determinism:** `preloadNode` reads no new RNG of its own. It calls
  `planRegion(seed)`, then `generateRoute(plan, key)` for a `route`/`lateral` and
  `planCity(plan, key)` for a `town`/`city`, then `buildNodeMeshes` — so the map is the
  generator's own and replays for a fixed seed (`D11`).
- `tilesetId` is `'city'` for `town` and `city`, `'forest'` for `route` and `lateral`.
  `victory-road`, `league` and `tower` have no generator yet: `preloadNode` returns
  `null` for them, and `answerNodeRequest` reports
  `{ ok: false, key, error: 'no generator for <key>' }`.
- `preloadNode` returns `null` for a key `planRegion(seed)` does not hold, and for a key
  `parseNodeKey` does not accept.
- `buildNodeMeshes` returns `{ ground, overlay }` where
  `overlay` is `buildFrameMesh(tiles, tileset, pad ?? 0)` — the tile each cell draws —
  and `ground` is **the same shape** with every cell's frame set to
  `resolveGroundFrame(tiles, x, y, tileset).frame`, in the same row-major order. The
  underlay exists because the FRLG tree frame keeps a transparent ground
  (`src/scenes/RouteScene.ts`, the `tileFrames` comment): a cell must never draw over
  the void. It lives here, in the engine and not in `src/render/`, because the worker
  calls it and because the ground arithmetic must exist exactly once.
- No Phaser, no DOM, no `localStorage`, no `Date`, no `Math.random()`.
- Imports it needs and no more: `./plan` (`planRegion`, `nodeOf`, `parseNodeKey`),
  `./route` (`generateRoute`), `./city` (`planCity`), `../frameMap`
  (`buildFrameMesh`, `type FrameMesh`), `../tileFrames` (`resolveGroundFrame`),
  `../../data/tilesets/frlg` and `../../data/tilesets/city` (the two configs) and
  `../../data/tilesets/ids` (the `TilesetId` type). It must **not** import
  `src/data/tilesets/index.ts` (that module imports the packed `.png` URLs and would drag
  asset URLs into the worker bundle), and it must not import anything from
  `src/render/` or `src/scenes/` (the dependency arrow runs the other way).

### `src/workers/nodeWorker.ts` (the worker entry)

```ts
import type { NodeRequest } from '../engine/region/preload';

/**
 * Answers every `NodeRequest` with `answerNodeRequest`. Not imported by value from
 * anywhere: the base scene reaches it through
 * `new Worker(new URL('../workers/nodeWorker.ts', import.meta.url), { type: 'module' })`.
 */
export {};
```

- The message scope must be reached through a **local structural type**, because
  `tsconfig.json` has no `WebWorker` lib and this task may not edit `tsconfig.json`:

  ```ts
  const scope = globalThis as unknown as Readonly<{
    addEventListener: (type: 'message', listener: (event: MessageEvent<NodeRequest>) => void) => void;
    postMessage: (message: unknown) => void;
  }>;
  ```
- The file is imported by `URL` only. Never `import` it by value from a scene: Vite
  then inlines it and the `[unit]` criterion on the emitted chunk fails.

### `src/render/tilemapLayer.ts` (Phaser **type-only** import)

`import type Phaser from 'phaser'` — a value import is forbidden here, so the module
stays importable by a headless test and by the worker.

```ts
import type Phaser from 'phaser';
import type { FrameMesh } from '../engine/frameMap';
import type { TileMap } from '../engine/map';
import type { TilesetConfig } from '../engine/tileset';
import type { NodeMeshes } from '../engine/region/preload';

/** The underlay's depth: below every actor, item and overlay the route draws. */
export const WORLD_GROUND_DEPTH = -1;
/** The tiles' depth: over the underlay, under the items (`5`) and the actors (`8`). */
export const WORLD_OVERLAY_DEPTH = 0;

/** Phaser's 2-D tile data for one mesh: `height` rows of `width` indices, `-1` kept as empty. */
export function tilemapData(mesh: FrameMesh): number[][];

export type WorldLayers = Readonly<{
  tilemap: Phaser.Tilemaps.Tilemap;
  ground: Phaser.Tilemaps.TilemapLayer;
  overlay: Phaser.Tilemaps.TilemapLayer;
}>;

/** One tilemap, two culled layers, at a whole-cell scale of `TILE_SIZE`. */
export function buildWorldLayers(
  scene: Phaser.Scene,
  meshes: NodeMeshes,
  tileset: TilesetConfig,
  textureKey: string,
): WorldLayers;

/** Destroys both layers and the tilemap; idempotent. */
export function destroyWorldLayers(layers: WorldLayers): void;
```

- `tilemapData` is total: an empty mesh (`width === 0 || height === 0`) answers `[]`,
  and `-1` in the mesh is `-1` in the array.
- **This module never resolves a frame.** The two meshes come from the engine's
  `buildNodeMeshes` (below) — that is the single implementation of the underlay, and it
  is Phaser-free so the worker can call it. A scene calls
  `buildNodeMeshes(this.renderTiles, TILESETS[id].config)` and hands the result here; a
  second copy of the ground arithmetic in `src/render/` is drift.
- `buildWorldLayers`:
  - `scene.make.tilemap({ data: tilemapData(meshes.overlay), tileWidth, tileHeight })`
    with `tileWidth = tileHeight = tileset.atlas.tileSize`;
  - one `addTilesetImage('tileset', textureKey, tileWidth, tileHeight, 0, 0, 0)` and two
    layers created on that one tilemap — `ground` filled from `meshes.ground`,
    `overlay` from `meshes.overlay`;
  - both layers `setScale(TILE_SIZE / tileWidth)` (the FRLG atlases are 16 px cells in a
    24 px world, exactly what `RouteScene.tileScale` does today), `setDepth` to
    `WORLD_GROUND_DEPTH` / `WORLD_OVERLAY_DEPTH`, and **culling left on**
    (`layer.cullCallback` must stay non-null; if the installed Phaser leaves it null, set
    it from `Phaser.Tilemaps.Components.CullTiles` — that is the one case in which a
    value import of Phaser is allowed in this file, and then a *second* module
    `src/render/tilemapData.ts` holds `tilemapData`/`groundMesh` untouched so the worker
    and the tests keep importing the Phaser-free half; say which you did in the commit
    message);
  - one frame index in the mesh is one tile index in the atlas: `BootScene` loads every
    tileset as a plain `frameWidth = frameHeight = atlas.tileSize` spritesheet, so
    spritesheet frame *n* is tileset index *n*.
- `TILE_SIZE` comes from `src/engine/tileset.ts` (24). No literal 24 in this file.

### `src/scenes/WorldScene.ts`

```ts
import Phaser from 'phaser';
import type { Tile } from '../engine/grid';
import type { FrameMesh } from '../engine/frameMap';
import type { TileMap } from '../engine/map';
import type { TilesetId } from '../data/tilesets';
import type { NodeMeshes, NodeWorld } from '../engine/region/preload';

/** The render depth of a ground actor standing with its feet at `footY`. */
export function actorDepth(footY: number): number;

/** The world camera's zoom: 2, pulled back a quarter on a touch screen. */
export function worldCameraZoom(): number;

/** One map to draw: its tiles and the two meshes resolved from them. */
export type WorldDraw = Readonly<{
  tiles: TileMap;
  meshes: NodeMeshes;
  tilesetId: TilesetId;
}>;

export abstract class WorldScene extends Phaser.Scene {
  constructor(key: string);

  /** The underlay layer of the map on screen, or null before the first draw. */
  protected get groundLayer(): Phaser.Tilemaps.TilemapLayer | null;
  /** The tiles layer of the map on screen, or null before the first draw. */
  protected get overlayLayer(): Phaser.Tilemaps.TilemapLayer | null;
  /** The meshes the two layers were filled from, or null before the first draw. */
  protected get worldMeshes(): NodeMeshes | null;
  /** The map's size in pixels; `{ width: 0, height: 0 }` before the first draw. */
  protected get mapBounds(): Readonly<{ width: number; height: number }>;

  /** Draws one map (replacing whatever was drawn) and puts the camera's bounds on it. */
  protected drawWorld(draw: WorldDraw): void;
  /** Draws a whole node + its scene-visible camera setup; the caller places the player. */
  protected applyWorld(world: NodeWorld): void;
  /** Starts the camera on `target` at `worldCameraZoom()`. */
  protected followCamera(target: Phaser.GameObjects.Sprite): void;
  /** A tile's centre in world pixels: `x * TILE_SIZE + TILE_SIZE / 2`. */
  protected centerX(tileX: number): number;
  protected centerY(tileY: number): number;

  /** The node for `key`, asked of the worker once and cached per `${seed}:${key}`. */
  protected preload(seed: string, key: string): Promise<NodeWorld | null>;
  /** The cached node for `key`, or null. Synchronous: what a transition reads. */
  protected cachedWorld(seed: string, key: string): NodeWorld | null;
  /** Destroys the layers, terminates the worker and drops every cached node. */
  protected forgetWorlds(): void;
}
```

Rules:

- `drawWorld` **destroys the previous layers first** (`destroyWorldLayers`), so a
  rebuild never leaks a layer; a second `drawWorld` on the same scene leaves exactly two
  layers.
- `drawWorld` sets `this.cameras.main.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE)`
  from the drawn map (what `mapPixelSize` computes today).
- `applyWorld(world)` is `drawWorld({ tiles, meshes, tilesetId })` + caching that world
  under `${world.key}` for the seed it was asked with.
- `preload` never rejects: a worker error, a `{ ok: false }` reply or a worker that is
  not available (a `Worker` that throws on construction, a headless test) resolves
  `null`. It answers from the cache **synchronously** when the node is already there.
- `actorDepth` and `worldCameraZoom` are **moved** out of `RouteScene.ts` verbatim
  (`ACTOR_DEPTH = 8`, `ACTOR_DEPTH_STEP = 0.0001`; `ROUTE_CAMERA_ZOOM = 2`,
  `ROUTE_TOUCH_ZOOM_OUT = 0.75`, `prefersTouchControls()`), so there is one definition
  each. `RouteScene` imports them.
- The base holds no run, no plan and no HUD: it draws, it points the camera, it caches
  nodes. Everything else stays in the subclass.
- The base publishes nothing on `globalThis`; the dev handle stays `__pkmRoute`
  (`IS_DEVELOP`, set in `RouteScene.create` as today).

### `src/scenes/RouteScene.ts` (the migration, bounded)

- `export class RouteScene extends WorldScene` and `super('Route')` unchanged.
- `drawTiles()` keeps its name and its call sites, and becomes: resolve
  `buildNodeMeshes(this.renderTiles, TILESETS[this.tilesetId].config)` and call
  `this.drawWorld({ tiles: this.renderTiles, meshes, tilesetId: this.tilesetId })`.
  Every caller (`create`, `transitionTo`, `rebuildRoom`, `importFrameMap`, the dev
  generator step) keeps working untouched.
- Delete `tileSprites`, `tileImage`, `tileFrames`, `tileScale`, the `tileSprites = []`
  reset in `create` and the `tileSprites` loop in `clearRouteSprites` — the base's
  `drawWorld` owns and destroys the layers.
- **Known visual trade, recorded as such:** the walkable tree tip
  (`treeTipKeys` → `TREE_TIP_DEPTH` per image) cannot interleave with a tile layer, so
  the player now draws **above** a walkable tree crown instead of behind it. `drawTiles`
  no longer sets that depth; `TREE_TIP_DEPTH` and the tip image creation go with it.
  Do **not** invent a third layer for it (see *Out of scope*).
- `this.cameras.main.setBounds(...)` + `setZoom(routeCameraZoom())` +
  `startFollow(...)` become `this.followCamera(this.playerSprite)` in `create`; the two
  `setBounds` calls in `transitionTo`/`importFrameMap` become the ones `drawWorld` sets.
- `movePlayerTo`, `placeFollower`, `refreshGrassStep`, the walk tween, the rooms, the
  battles, the trainers, the items, the HUD: **not touched**. `movePlayerTo` keeps
  calling `this.centerX`/`this.centerY`, now inherited.
- `routeCameraZoom` and `actorDepth` (the private copies) are deleted; the imports come
  from `./WorldScene`.
- Everything else in the file stays byte-identical. This task does not port the room
  logic into the base — the sweep task deletes it later (`Coordination`).

## 🧩 Data and configuration

- `vite.config.ts` gains exactly:

  ```ts
  worker: {
    format: 'es',
  },
  ```

  next to `build`. Nothing else changes in that file.
- Nothing else in `src/data/` is touched: no new table, no new key, no balancing value.
  `preload.ts` derives every size from `src/data/region.ts` through the generators.

## 🧪 Test and Validation Plan (for QA)

### Method

- `npm test` — Vitest, headless; must be green, including the two test files this task
  adds.
- `npm run build` — `tsc --noEmit && vite build`.
- `git diff --name-only main...task-280` audited against the exclusive paths list.
- Browser pass (for the `[live]` criteria): `npm run dev` on the worktree, headless
  Chromium over CDP at `1280×800`, a run started from the main menu (main menu → starter
  → route; the seed on screen is the run's). `?debug` is not needed; the dev handle
  `globalThis.__pkmRoute` exists in a `vite dev` build (`IS_DEVELOP`).
- Evidence, not gates: record `__pkmRoute.game.loop.actualFps` after 10 s of held
  movement at the map's bottom in the report. It is **not** a criterion — `TODO.md`
  records that a wall-clock probe is defeated by the headless frame rate — so it can
  never fail this task.

### Acceptance criteria

- [ ] `[unit]` `npm run build` is green (`tsc --noEmit` + `vite build`).
- [ ] `[unit]` `npm test` is green, and `src/engine/region/preload.test.ts` +
      `src/render/tilemapLayer.test.ts` exist and pass.
- [ ] `[unit]` `preload.test.ts` pins, on a fixed seed: `preloadNode(seed, 'route:1')`
      equals `buildFrameMesh(generateRoute(planRegion(seed), 'route:1').tiles, FRLG_FOREST_TILESET)`
      for its `meshes.overlay` cell for cell, its `width`/`height` are
      `60 × (120|160|200)`, and two calls are deep-equal (the fixed-seed regression
      `AGENTS.md` owes the generator seam).
- [ ] `[unit]` `preload.test.ts` pins: `preloadNode(seed, key)` is `null` for a key the
      plan does not hold (`'city:99'`), for a malformed key (`'city:'`), and for a node
      with no generator yet (`'league:1'`); `answerNodeRequest({ seed, key: 'nope:1' })`
      answers `{ ok: false, key: 'nope:1', error }` and never throws.
- [ ] `[unit]` `preload.test.ts` pins `buildNodeMeshes`: same `width`/`height` on both
      meshes, `overlay` equals `buildFrameMesh`, and every `ground` frame equals
      `resolveGroundFrame(tiles, x, y, tileset).frame` for the same cell.
- [ ] `[unit]` `tilemapLayer.test.ts` pins `tilemapData`: `height` rows of `width`
      indices, `frames[y * width + x]` copied verbatim, `-1` preserved, `[]` for an
      empty mesh.
- [ ] `[unit]` `npm run build` writes a separate worker chunk: after the build,
      `node -e "const f=require('fs').readdirSync('dist/assets');if(!f.some(n=>n.includes('nodeWorker')))process.exit(1)"`
      exits 0.
- [ ] `[unit]` Nothing outside the exclusive paths was touched:
      `git diff --name-only main...task-280` lists only files from that list.
- [ ] `[live]` At `1280×800`, on the first route, the scene draws the world with tile
      layers and no per-cell ground image. Measured over CDP `Runtime.evaluate`:
      `__pkmRoute.children.list.filter(o => o.type === 'TilemapLayer').length === 2`
      **and** `__pkmRoute.children.list.filter(o => o.type === 'Image' && String(o.texture?.key ?? '').startsWith('tiles:')).length === 0`.
- [ ] `[live]` The layers hold the mesh, cell for cell. Measured over CDP: for every
      cell, `__pkmRoute.overlayLayer.layer.data[y][x].index` equals
      `__pkmRoute.worldMeshes.overlay.frames[y * width + x]` and the `ground` layer
      equals `__pkmRoute.worldMeshes.ground.frames` the same way (`width` from
      `__pkmRoute.worldMeshes.overlay.width`); the count of mismatches is `0`.
- [ ] `[live]` The two layers are culled: `__pkmRoute.groundLayer.cullCallback` and
      `__pkmRoute.overlayLayer.cullCallback` are both non-null.
- [ ] `[live]` The map still draws at its far end. Measured over CDP: hold `ArrowDown`
      until `__pkmRoute.cameras.main.scrollY` stops growing, then take
      `renderer.snapshotArea(590, 350, 100, 100)` on the game renderer, decode the PNG
      with `pngjs`, and require that the 100 × 100 patch holds **at least three distinct
      `#rrggbb` values** and that the scene's background `#10161f` covers **less than
      20 %** of it.
- [ ] `[live]` The dev Map tool still describes every cell. Measured over CDP:
      `const e = JSON.parse(__pkmRoute.exportFrameMap())` is non-null, its
      `frameMap.width`/`height` equal the drawn map's, `frameMap.cells.length ===
      frameMap.width * frameMap.height`, and the number of cells with a non-null `frame`
      is **more than 90 %** of `cells.length` on the first route.

## 📣 Coordination

- **For the Architect — what this spec narrowed, and why:**
  1. The item says "*`RouteScene` becomes a thin subclass*". It does not: the subclass
     keeps its room registry, the battles, the items, the trainers, the walk and the
     HUD, because all of that is the old floor model that the sweep task deletes
     (`src/scenes/rooms/**`, `RouteScene.ts`). What moves into the base is the seam every
     node scene shares — the tile draw, the camera, the preload (`actorDepth`,
     `centerX`/`centerY`, `worldCameraZoom` included). A 3 900-line scene becomes "the
     route's room logic + a draw inherited from the base"; shrinking it further is the
     sweep's job, not a rendering task's.
  2. The plan says **one `TilemapLayer`**. It is one `Tilemap` with **two culled
     layers**: an underlay and the tiles. A single layer cannot draw the FRLG tree,
     whose frame is transparent over the ground it stands on — `RouteScene.tileFrames`
     exists for exactly that reason, and dropping it paints the scene's background
     through every tree. Both layers are culled and neither is a per-cell `Image`, which
     is what the item is really after.
  3. The item's `≥ 55 fps` figure is **not** a criterion: the dev overlay has no frame
     counter (`grep -rn 'actualFps' src` is empty) and `TODO.md` records that a
     wall-clock probe is defeated by the headless frame rate. It is replaced by the
     structural facts (two culled layers, tile data equal to the mesh, the map drawing at
     its far end) and `actualFps` is recorded as evidence only.  4. `src/engine/region/README.md` gains the `gym/` line for `[Task-282]`. Write it
     verbatim: ``- `gym/` — the gym's puzzle stack and the rooms it fills; its README
     holds the folder.`` Do **not** create `src/engine/region/gym/README.md`; that folder
     and its README are `[Task-282]`'s.
  5. `src/main.ts` is claimed as a hot file but needs no edit. Do not register
     `WorldScene`: it is abstract and has no key.
  6. `src/engine/region/index.ts` is **not** claimed by anyone this batch: `preload` is
     imported by its path (`../engine/region/preload`), never through the barrel.
  7. **The `D##` record is left open on purpose.** The phase's opening paragraph says
     this item "takes `D63`", but the item's own *Claims* line does not name
     `docs/tech-decisions.md`, `D65`/`D66` assigned to the already-merged previous batch
     were never written (the file stops at `D62`), and this batch has two items that
     would both append to the same end of that one file. The spec therefore writes no
     `D63`; the decision text a later docs task needs is the three facts below — a
     precomputed `FrameMesh` per node, one `Tilemap` with two culled layers (underlay +
     tiles) instead of one `Image` per cell, and the map generated by a worker through
     the pure `preloadNode`. **Flagged to the Orchestrator/human.**
- **For the next batch — what it may assume:**
  - `WorldScene` exists with the surface above; `CityScene`, `GymScene`, `LeagueScene`
    and the route's encounter rewrite extend it and call `super(key)`.
  - `preloadNode(seed, key)` answers `town`, `city`, `route` and `lateral` today and
    `null` for `victory-road`, `league`, `tower`; the travel task lifts that last limit
    when those generators land.
  - `WorldScene.preload(seed, key)` is the only way a scene asks for the next node: it
    is answered by a worker, cached per `${seed}:${key}` and never rejects. A transition
    reads `cachedWorld(seed, key)` synchronously and falls back to generating on the main
    thread only if that returns `null`.
  - `actorDepth`, `worldCameraZoom`, `centerX`, `centerY` live in `src/scenes/WorldScene.ts`
    from now on; a second scene uses them instead of pasting a copy.
  - `src/render/tilemapLayer.ts` (`tilemapData`, `buildWorldLayers`,
    `destroyWorldLayers`, `WorldLayers`, `WORLD_GROUND_DEPTH`, `WORLD_OVERLAY_DEPTH`)
    and `src/engine/region/preload.ts` (`NodeWorld`, `NodeMeshes`, `buildNodeMeshes`)
    are the frozen seam for drawing any node: no later task re-derives a mesh in a
    scene, and every map's two meshes come from `buildNodeMeshes`.
  - Two known, deliberate gaps a later task may pick up, neither owned here: the
    walkable tree tip no longer draws over the player (a third depth-sorted layer or a
    per-tile depth trick), and `FrameMesh` carries frame indices only — so a
    `commonFrames` value (the `CARPET` cell) cannot be drawn by a layer. No route or
    region map stamps one (`grep -rn CARPET src/engine/routes src/engine/region` is
    empty); a legacy room that does keeps drawing it as a single `Image` on top.
- **For `[Task-282]`:** `src/engine/region/README.md` gets your `gym/` folder line from
  this task; your own `gym/README.md` maps the files inside the folder.

## ⛔ Out of scope

- No travel, no flying, no arrival, no gates: leaving a node and landing on another is
  the next batch's travel task. `WorldScene` preloads and caches; it never transitions.
- No `CityScene`, `GymScene`, `LeagueScene`, `InteriorScene` and no interior draw.
- No room → node port, no room deletion, no `RunState` change, no `src/engine/map.ts`
  change, no `src/engine/frameMap.ts` change.
- No change to `src/scenes/panels/**` (`src/scenes/panels/map.ts` belongs to the region
  map task), to `src/ui/**`, to `src/data/**` or to any `src/engine/region/*` module
  other than the two files listed.
- No third tile layer, no tree-tip depth trick, no second tileset texture in one layer.
- No new dependency, no `tsconfig.json` edit, no `package.json` edit.
- No `WorldScene.test.ts`: the class is Phaser, its pure halves live in
  `preload.ts`/`tilemapLayer.ts` and are covered there; its own behaviour is the
  `[live]` list.
