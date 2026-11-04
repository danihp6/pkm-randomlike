# `src/scenes/` — Phaser scenes

One `Scene` per file, each registered in `src/main.ts`'s `scene` array: `Boot`, `MainMenu`,
`Starter`, `Route`, `Battle`, `RunOver` and `Settings` — plus `WorldScene`, the abstract base the
node scenes extend, which is registered nowhere, and the region node scenes, which register
themselves through `regionScenes.ts`. A scene draws the game and routes input,
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
- `WorldScene.ts` — the base every node scene extends: one map drawn as two culled tile
  layers, the world camera's bounds and zoom, the node preloaded off the worker and the one
  fade-and-swap transition that draws an already-preloaded node (`transitionToNode`,
  `WORLD_ARRIVED`, `arrival`). Its `create` mounts the shared panel layer from the
  subclass's `panelSource()` (a resize repaint and the unmount on shutdown), and it wires
  nothing at all for a scene that answers `null`. It owns no run and no plan, and is not
  registered in `src/main.ts` (it is abstract and has no key).
- `RouteScene.ts` — the route itself: it extends `WorldScene` for the tile draw and the
  camera and keeps the player, tall grass, trainers, items, the panel slot, the pointer
  dispatch, the run's battles and the touch controls. It builds the node on screen from one
  seam — `planRouteScreens` cuts the node's carve into its two-to-four vertical screens, each
  with its spawn, its border bands and its content — so a seam is a plain step and pressing
  outward on a band hands the run to the region's travel seam (`travelToNode`,
  `onNodeArrived`, the dev-only `debugTravelState` and `debugRouteScreen`). It also hands a
  run that stands on a settlement to the city screen. Its overlay chrome (HUD panels,
  notices, pause menu) is the shared layer from `panels/host.ts`; the route is the one screen
  that mounts all twelve cards.
- `CityScene.ts` — a settlement as a place you walk: the street grid, the buildings, their
  doors, the plaza, the grass corner and the exit bands drawn from the cached/preloaded
  node, the player spawned on the plan's own spawn and walked with the shared walker, a
  door starting the interior scene its key names and an exit band travelling through the
  pure travel rule (a settlement re-drawn in place, any other node handed to the scene its
  kind names). Its dev-only surface is `__pkmCity` with `debugCityState` and `placePlayer`.
- `InteriorScene.ts` — the town's laboratory, the prologue's one room: the interior drawn
  from `planInterior` on the interior tileset, the player on the shared walker, the free
  entry heal the town has instead of a Centre (`serviceHeal`), the professor's starter pick
  mounted as the shipped `starter` panel, the run it leaves in the save and the door back
  to the town. Its dev-only surface is `__pkmInterior` with `debugInteriorState` and
  `placePlayer`.
- `services.ts` — a city's **Pokémon Centre** (scene key `Centre`, `docs/region-spec.md`
  §6): the same walked interior as the laboratory, with the counter that heals party and
  box on entry (and again at its healing station), the PC that opens the shipped box card,
  and the merchant that opens the shipped shop card stocked from the city's own shelf
  (`shopBandForTier`). Its dev-only surface is `__pkmCentre` with `debugServicesState`,
  `placePlayer`, `openCounter`, `openPc` and `openShop`.
- `interior.test.ts` — the laboratory's headless half: the offer before and after the pick,
  the intent that takes it, and the scene's own registration.
- `npcs.ts` — a node's NPCs drawn and opened.
- `pois.ts` — a route's POI drawn and triggered.
- `walker.ts` — the one tile walker the node scenes share: `canWalkStep` (walkable and
  corner-cut aware), the shared `WALK_STEP_MS` / `RUN_STEP_MS` cadence and `WorldWalker`,
  which slides a scene's own sprite one cell per step on the run's movement keys, plays the
  player's walk cycle and reports each landed step through its hook. It draws nothing and
  owns no rule.
- `walker.test.ts` — the walking seam's headless test: the walker's step rule on a
  hand-built map, and the city's own pure lookups (`doorAt`, `exitBandAt`,
  `interiorSceneKey`) over a fixed seed's `city:1`.
- `regionScenes.ts` — the region node scenes' folder registry: a scene module that exports
  `regionSceneKey` and `regionSceneClass` is collected for `main.ts`'s scene list, so a new
  city, gym or League needs no `main.ts` edit. Its glob names `services.ts` as well as the
  `*Scene.ts` files, so a room named for what it is (the Centre) is collected too.
- `regionScenes.test.ts` — the registry's headless rules: a module with both markers is
  collected, one with one or none is skipped, a duplicate key throws naming both paths, and
  the folder itself collects the city screen and the Centre — plus the travel seam's single
  flight, where two `travelToNode` calls started inside the preload window commit exactly
  one.
- `panels/` — the node screens' overlay panels: one module per panel, discovered by the
  folder's `host.ts`, so a new panel is a new file. `host.ts` builds the same
  `RoutePanelHost` over any node scene, so the route's twelve cards and a node's seven
  (`NODE_PANEL_IDS`) need no scene code of their own.
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
6. The dev-only hooks the debug overlay drives live on the route scene, and the browser
   pass's own hooks (`__pkmCity`) on the node scene they drive, nowhere else.
