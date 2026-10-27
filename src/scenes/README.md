# `src/scenes/` — Phaser scenes

One `Scene` per file, each registered in `src/main.ts`'s `scene` array: `Boot`, `MainMenu`,
`Starter`, `Route`, `Battle`, `RunOver` and `Settings`. A scene draws and routes input; it
decides nothing. Rules come from `src/engine/`, panels and their pure helpers from
`src/ui/`, animation registries from `src/render/` and key handling from `src/input/`. The
dex is reached only through a typed accessor in `src/data/`, never by importing the JSON.

## Layout

- `BootScene.ts` — generates the placeholder textures and registers the animation tables
  before the first scene runs.
- `MainMenuScene.ts` — new run / continue, the run's seed and mode, and (on the DOM HUD) the
  STATS overlay over the run history.
- `StarterScene.ts` — picks the starter pool and opens the seed prompt.
- `RouteScene.ts` — the route itself: the player, tall grass, trainers, items, the room
  panel slot, the pointer dispatch, the run's battles and the touch controls. Its
  overlay chrome (HUD panels, notices, pause menu) is built by the panel layer below.
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

1. A new scene is registered in `src/main.ts`'s `scene` array with a unique key.
2. A scene holds no game rule: it reads and writes the run state through `src/engine/run/`,
   never in the scene.
3. Draw panels through `src/ui/` and animations through `src/render/`; a scene that
   recomputes layout or timing inline is drift.
4. Rebindable keys go through `src/input/`; only a scene's own one-off dev key stays on
   Phaser directly.
5. Read the dex through a typed accessor in `src/data/dex`, never the raw JSON.
6. The dev-only hooks the debug overlay drives live on the route scene and nowhere else.
