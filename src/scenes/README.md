# `src/scenes/` — Phaser scenes

One `Scene` per file, each registered in `src/main.ts`'s `scene` array: `Boot`, `MainMenu`,
`Starter`, `Route`, `Battle`, `RunOver` and `Settings` — plus `WorldScene`, the abstract base the
node scenes extend, which is registered nowhere. A scene draws the game and routes input,
mounts its DOM card and decides nothing. **The DOM HUD is the HUD** (`D49` amended): every scene
mounts its panel into `#hud` on a clean boot, `?hud=dom` is only an alias, and no scene draws HUD
chrome in Phaser — `?hudFixture=<slug>` still pins a board frame. Rules come from `src/engine/`, panels and their pure helpers from
`src/ui/`, animation registries from `src/render/` and key handling from `src/input/`. The
dex is reached only through a typed accessor in `src/data/`, never by importing the JSON.

## Layout

- `BootScene.ts` — generates the placeholder textures and registers the animation tables
  before the first scene runs.
- `MainMenuScene.ts` — new run / continue, the run's seed and mode, and (on the DOM HUD) the
  STATS overlay over the run history.
- `StarterScene.ts` — picks the starter pool and opens the seed prompt.
- `StarterScene.test.ts` — the starter pick's headless test: a reroll draws its offer
  through the seed helper and resets the cursor.
- `WorldScene.ts` — the base every node scene extends: one map drawn as two culled tile
  layers, the world camera's bounds and zoom, the node preloaded off the worker and the one
  fade-and-swap transition that draws an already-preloaded node (`transitionToNode`,
  `WORLD_ARRIVED`, `arrival`). It owns no run, no plan and no HUD, and is not registered in
  `src/main.ts` (it is abstract and has no key).
- `RouteScene.ts` — the route itself: it extends `WorldScene` for the tile draw and the
  camera and keeps the player, tall grass, trainers, items, the room panel slot, the
  pointer dispatch, the run's battles and the touch controls. It also hosts the region's
  travel seam today (`travelToNode`, `onNodeArrived`, the dev-only `debugTravelState`). Its
  overlay chrome (HUD panels, notices, pause menu) is built by the panel layer below.
- `regionScenes.ts` — the region node scenes' folder registry: a scene module that exports
  `regionSceneKey` and `regionSceneClass` is collected for `main.ts`'s scene list, so a new
  city, gym or League needs no `main.ts` edit.
- `regionScenes.test.ts` — the registry's headless rules: a module with both markers is
  collected, one with one or none is skipped, a duplicate key throws naming both paths, and
  the folder itself holds no region node scene yet — plus the travel seam's single flight,
  where two `travelToNode` calls started inside the preload window commit exactly one.
- `panels/` — the route's overlay panels: one module per panel, discovered by the
  scene's registry, so a new panel is a new file.
- `rooms/` — the special-room descriptors: one module per room kind, discovered by `RouteScene`'s
  registry, so a new room is a new file.
- `BattleScene.ts` — the menu battle: fight / bag / switch / run, the message box, the HP
  bars and the capture sequence.
- `BattleScene.test.ts` — the battle scene's headless test of its sprite-animation
  frame selection.
- `RunOverScene.ts` — the run summary when the last Pokémon falls.
- `SettingsScene.ts` — text speed, volume, always-run, transparent HUD, reduced flashing and every key rebind.

## Rules

1. A new scene is registered in `src/main.ts`'s `scene` array with a unique key. A **region
   node scene** (city, gym, League, anything the travel seam may enter) registers itself
   instead by exporting `regionSceneKey` and `regionSceneClass` and is collected by
   `regionScenes.ts`; the base seven stay in `main.ts`.
2. A scene holds no game rule: it reads and writes the run state through `src/engine/run/`,
   never in the scene.
3. Draw panels through `src/ui/` and animations through `src/render/`; a scene that
   recomputes layout or timing inline is drift.
4. Rebindable keys go through `src/input/`; only a scene's own one-off dev key stays on
   Phaser directly.
5. Read the dex through a typed accessor in `src/data/dex`, never the raw JSON.
6. The dev-only hooks the debug overlay drives live on the route scene and nowhere else.
