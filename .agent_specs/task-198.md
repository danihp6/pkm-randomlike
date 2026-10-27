# Spec: Task-198 — The main menu's route window shows a live route with Pokémon wandering in it

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (a pure preview model) + Phaser scene + DOM panel + docs.
- **Role:** Dev.
- **Objective:** the main menu’s 560×380 window (358×240 on the phone) stops being an
  empty frame. Behind it a real route is drawn with the forest tileset — one tile per
  24 px cell, floor under object — and two or three Pokémon wander it on a timer. The
  floor is built by one pure generator seam (`previewRoute`) and the walkers by
  another (`previewWalkers` / `stepPreviewWalkers`), both from a **freshly drawn
  random seed per boot**, so the screen is decoration and never touches the run’s
  seed, the save, encounters or input. The panel reads the same model the frame
  fixture reads, so the two renderings cannot drift.
- **Environment:** worktree `../wt-pkm-198` (a sibling of this repo, never a junction),
  branch `task-198` off `main`. The Orchestrator has already pushed the spec as
  `spec: task-198`; commit on that tip. When `npm test` and `npm run build` are green,
  leave an **empty** commit `dev: done task-198` on the tip and push `task-198` — the
  QA wave validates that tip. Never commit to `main`, never merge, never create another
  branch. `$ASSETS_ROOT` is `/home/runner/work/_temp/assets/store`: never symlink or
  junction it into the worktree, and pass absolute paths to any packer.
- **Dependencies:** none must be merged first. Builds on the shipped main-menu panel
  (`src/ui/hud/panels/main-menu/`, `docs/hud-fidelity.md` §9’s portrait seam), the
  shipped route generator (`src/engine/routes/sketch.ts`) and the tileset registry
  (`src/data/tilesets/`).

### Exclusive paths (single writer)

The list of paths this task creates or modifies. **Nothing outside this list.**
No other task in the batch may claim the same path. Deleting a stray `.gitkeep`
from a directory this task populates is always allowed.

- `src/engine/routes/preview.ts` (new)
- `src/engine/routes/preview.test.ts` (new)
- `src/engine/README.md` — one clause for `routes/preview.ts` (the folder map rule;
  the only line this task adds to that file)
- `src/ui/hud/panels/main-menu/**` — every file in the folder, including `view.ts`,
  `view.test.ts`, `mainMenuPanel.tsx`, `main-menu.css`, `mount.tsx`, `index.ts`,
  `preview.ts`, `preview.test.ts`, `fixture.test.ts`, `README.md`, plus the two new
  files `routeWindow.ts` and `routeWindow.test.ts`
- `src/scenes/MainMenuScene.ts`
- `src/scenes/MainMenuScene.test.ts` (new)
- `docs/design-spec.md` — **§2 only** (“The run”)
- `docs/tech-decisions.md` — one new decision, **D55** (the file’s next free number;
  D54 is the last one today), inserted after D54 and **before** `## Open questions`.
  No other batch-86 task touches this file

Do **not** edit `docs/hud-fidelity.md` in this task: §5 belongs to `Task-196` and §9 to
`Task-202` this batch. Do not edit `design/fixtures/**` (another task owns it).

### Inputs (read-only)

Files this task may read, and only these, beyond `AGENTS.md` itself.

- `docs/design-spec.md` — §2 is the run and the menu this task decorates.
- `docs/tech-decisions.md` — D11 (determinism), D43 (i18n), D49 (the DOM HUD), D50
  (the board’s rasters), and D54 as the numbering anchor.
- `docs/hud-fidelity.md` — §5’s window rects and §9’s portrait seam.
- `docs/agent-spec-template.md`
- `src/engine/routes/sketch.ts` — `sketchRoute`, `RouteRequest`, `ROUTE_WIDTH`,
  `ROUTE_HEIGHT`.
- `src/engine/routes/routeMap.ts` — `RouteMap`, `Facing`, `FACINGS`, `FACING_VECTORS`.
- `src/engine/routes/streams.ts` — `routeStreams` (the naming convention).
- `src/engine/map.ts` — `TileMap`, `FLOOR`, `isWalkable`, `tileAt`.
- `src/engine/rng.ts` — `randomSeed`, `rngFromSeed`, `Rng`.
- `src/engine/grid.ts` — `Tile`.
- `src/engine/tileset.ts` — `TilesetConfig`, `TILE_*`.
- `src/engine/tileFrames.ts` — `resolveTileFrame`, `resolveGroundFrame`, `TileFrame`.
- `src/data/tilesets/index.ts` — `TILESETS`, `COMMON_ATLAS_URL`, `BiomeTileset`.
- `src/data/biomes.ts` — `biomeForRoute`.
- `src/data/dex/species.ts` — `playableSpecies`.
- `src/ui/hud/portrait.ts` — `portraitCrop`, `portraitBackground`, `PortraitCrop`.
- `src/ui/hud/panels/main-menu/main-menu.css`, `mainMenuPanel.tsx`, `view.ts`,
  `mount.tsx`, `preview.ts` — the panel this task extends.

## 🔒 Contract

The public surface other tasks will be written against in parallel. It is a
promise, not a suggestion. Write the exact exported names and signatures.

### TypeScript

**1. The preview model, `src/engine/routes/preview.ts` (new).** Pure: no Phaser, no
DOM, no clock, no storage; the only entropy is the `seed` argument.

```ts
import type { Tile } from '../grid';
import type { TileMap } from '../map';
import type { Facing } from './routeMap';

/** The world tile a preview cell draws at, in px (the route’s own 24). */
export const PREVIEW_TILE = 24;
/** The biome the window always previews (the first map’s, `biomeForRoute(1)`). */
export const PREVIEW_BIOME_ID = 'forest';

export type PreviewRect = Readonly<{ x: number; y: number; w: number; h: number }>;

export type PreviewRoom = Readonly<{
  /** The seed the caller asked for; no other entropy is read. */
  seed: string;
  /** The window it was asked for, echoed unchanged. */
  rect: PreviewRect;
  cols: number;
  rows: number;
  /** Always `PREVIEW_TILE` (24). */
  tile: number;
  biomeId: string;
  /** Exactly `rows` rows of `cols` map values, row-major (`FLOOR`, `WALL`, …). */
  tiles: TileMap;
  /** Every walkable tile of `tiles`, row-major; empty never happens. */
  walkable: readonly Tile[];
}>;

export type PreviewWalker = Readonly<{
  /** 0-based and stable for the room. */
  id: number;
  /** A species `playableSpecies()` names, so the panel can draw its portrait cell. */
  speciesId: string;
  /** The walker’s tile inside the room (`0 … cols-1`, `0 … rows-1`). */
  tile: Tile;
  facing: Facing;
}>;

export function previewRoute(seed: string, window: PreviewRect): PreviewRoom;
export function previewWalkers(route: PreviewRoom): readonly PreviewWalker[];
export function stepPreviewWalkers(
  route: PreviewRoom,
  walkers: readonly PreviewWalker[],
  step: number,
): readonly PreviewWalker[];
```

- `cols = Math.max(1, Math.floor(window.w / PREVIEW_TILE))`,
  `rows = Math.max(1, Math.floor(window.h / PREVIEW_TILE))`.
- The room is generated by the shipped `sketchRoute` from a seed that cannot collide
  with a run’s own route streams — the request seed is `` `${seed}:preview` `` — with
  `routeIndex: 0`, `biomeId: PREVIEW_BIOME_ID`, `quiet: true`, `role: 'wild'`,
  `shape: 'corridor'`, `width: cols`, `height: rows`. If the generator throws for that
  size, build it once at the shipped `ROUTE_WIDTH × ROUTE_HEIGHT` and crop the
  **centre** to `cols × rows`. `tiles` is always exactly `rows × cols`, whatever the
  generator answered.
- `walkable` lists, row-major, every `Tile` of `tiles` for which
  `isWalkable(tiles, tile)` is true.
- `previewWalkers(route)`: reads `` rngFromSeed(`${route.seed}:preview:walkers`) ``;
  `count = rng.int(2, 3)`; each walker’s `speciesId` is a **distinct** id from
  `playableSpecies()` (`rng.int(0, list.length - 1)`, skipping ids already taken);
  its starting `tile` is `walkable[rng.int(0, walkable.length - 1)]`; its `facing` is
  `FACINGS[rng.int(0, FACINGS.length - 1)]`.
- `stepPreviewWalkers(route, walkers, step)` returns the next walkers: for each
  walker, a fresh `` rngFromSeed(`${route.seed}:preview:walker:${walker.id}:${step}`) ``;
  the candidates are the four `FACING_VECTORS` neighbours of the walker’s current tile
  that stay inside the room and are `isWalkable(route.tiles, tile)`; with no candidate
  the walker stays put; otherwise it moves to `candidates[rng.int(0, candidates.length - 1)]`
  and faces that direction. Pure and total: a negative or non-finite `step` is
  truncated to `0`.
- **Determinism:** the same `(seed, window)` gives a deep-equal room; the same
  `(route, walkers, step)` gives a deep-equal next list; folding `step = 0 … N` twice
  from the same start gives the same walk. No other `Rng` stream is read, and the
  preview never reads the run’s seed.

**2. The renderer’s geometry, `src/ui/hud/panels/main-menu/routeWindow.ts` (new).**
Pure apart from one module-level cache; no DOM calls in the exported functions:

```ts
import type { PreviewRoom, PreviewWalker, PreviewRect } from '../../../../engine/routes/preview';
import type { TilesetConfig } from '../../../../engine/tileset';

/** One timer step of the walkers, in ms. */
export const ROUTE_PREVIEW_STEP_MS = 600;

/** The preview room for `(seed, window)`, built once and reused across repaints. */
export function previewRoomFor(seed: string, window: PreviewRect): PreviewRoom;

/** The tile field’s centred origin inside the window, in the window’s own coordinates. */
export function previewOrigin(
  window: PreviewRect,
  room: PreviewRoom,
): Readonly<{ x: number; y: number }>;

/** One tile’s box in the window’s own coordinates: 24 × 24. */
export function previewTileBox(
  window: PreviewRect,
  room: PreviewRoom,
  tile: Readonly<{ x: number; y: number }>,
): PreviewRect;

/** One walker’s box in the window’s own coordinates: 24 × 24. */
export function previewWalkerBox(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
): PreviewRect;

export type PreviewTileset = Readonly<{
  config: TilesetConfig;
  atlasUrl: string;
  commonUrl: string;
}>;

export type TileBackground = Readonly<{
  /** Atlas URLs, object first (when it has a frame), ground last. */
  images: readonly string[];
  /** One `-<col × 24>px -<row × 24>px` per image. */
  positions: readonly string[];
  /** `"<cols × 24>px <rows × 24>px"`. */
  size: string;
}>;

/** A tile’s two CSS backgrounds, read off `resolveTileFrame` / `resolveGroundFrame`. */
export function tileBackground(
  room: PreviewRoom,
  tile: Readonly<{ x: number; y: number }>,
  tileset: PreviewTileset,
): TileBackground;
```

- `previewOrigin` is `{ x: Math.floor((w - cols * 24) / 2), y: Math.floor((h - rows * 24) / 2) }`.
- `previewTileBox` / `previewWalkerBox` add the origin to `tile.x * 24` / `tile.y * 24`.
- `previewRoomFor` keys its cache by `` `${seed}|${window.x},${window.y},${window.w},${window.h}` ``
  and calls `previewRoute` at most once per key (a repaint must not regenerate).
- `tileBackground` uses `resolveTileFrame(room.tiles, x, y, tileset.config)` for the
  object frame (an `atlas` frame draws `atlasUrl`, a `common` frame `commonUrl`) and
  `resolveGroundFrame(...)` for the ground frame; a `null` object frame yields one
  image only. Positions are computed from `tileset.config.image.cols` and the 24 px
  cell (`frame % cols`, `Math.floor(frame / cols)`).

**3. The panel, `src/ui/hud/panels/main-menu/`.**

- `MainMenuView` gains one required field:

```ts
export type MainMenuView = Readonly<{
  // …the shipped fields unchanged
  /** The decorative route preview’s seed: `randomSeed()` once per boot, or the slug’s own. */
  previewSeed: string;
}>;
```

- `liveMainMenuView` gains an optional third argument so every existing call site keeps
  compiling:
  `export function liveMainMenuView(run: RunState | null, index: number, previewSeed: string = MAIN_MENU_SLUG): MainMenuView;`
- `fixtureMainMenuView` reads `payload.menu.previewSeed` when it is a non-empty string
  and falls back to `MAIN_MENU_SLUG`, so `design/fixtures/01*.json` stay byte-identical.
- `mainMenuPanel.tsx` renders, inside the existing window node, one tile span per cell
  of the room at this layout’s window (`MAIN_MENU_BOARD.window` when
  `matchMedia` of `MAIN_MENU_NARROW_QUERY` is false, `MAIN_MENU_BOARD_NARROW.window`
  when true) and one span per walker. The walkers advance one
  `stepPreviewWalkers(room, walkers, step)` per `ROUTE_PREVIEW_STEP_MS` timer tick, and
  the timer is cleared on unmount. Nothing runs per animation frame.
- `main-menu.css`: `.main-menu__window` gains `overflow: hidden` (the tiles never spill
  past its rounded corners); `.main-menu__tiles`, `.main-menu__tile`,
  `.main-menu__walker` are `position: absolute`, the tile and walker spans 24 × 24.
  The panel builds its `PreviewTileset` once from
  `TILESETS[getBiome(room.biomeId).tilesetId]` and `COMMON_ATLAS_URL`, and each tile
  span paints `tileBackground(...)` as its `background-image` /
  `background-position` / `background-size` (multiple backgrounds, object first).
  A walker draws `portraitCrop(walker.speciesId)` + `portraitBackground(crop, 24)` as
  its inline background, and an empty 24 × 24 box (the §9 fallback) when the atlas
  names no cell. `image-rendering: pixelated` on both.
- The DOM hooks QA reads: the window keeps `data-hud-main-menu-window` and gains
  `data-hud-main-menu-preview={view.previewSeed}`; the tile layer carries
  `data-hud-main-menu-tiles`; every walker carries
  `data-hud-main-menu-walker={String(walker.id)}`.

**4. The scene, `src/scenes/MainMenuScene.ts`.**

- One field `private previewSeed = '';` drawn **once** in `create()`:
  `this.previewSeed = randomSeed();` (the same engine `randomSeed` the starter uses;
  no `Math.random`, no `Date.now`).
- One private seam both the mount and the repaint use:
  `private menuView(): MainMenuView { return liveMainMenuView(this.run, this.index, this.previewSeed); }`.
  `createDom`/`mountPanel` and `render` call it instead of `liveMainMenuView(...)`.
- Nothing else changes: the scene draws no Phaser route, reads no save, writes
  nothing, and the seed is never persisted.

### Data

No new JSON, no `SAVE_VERSION`, no i18n key. The preview reads `TILESETS[room.biomeId]`
and `COMMON_ATLAS_URL` as they ship.

### Docs (the two sections this task owns)

- `docs/design-spec.md` **§2**: add one clause to the opening main-menu bullet, after
  the CONTINUE/STATS sentence: the window behind the title is a **live route** — a
  route generated from a fresh random seed on every boot (never the run’s), drawn with
  the first map’s biome tileset, with two or three Pokémon wandering it — and it is
  **decoration**: no encounters, no player, no input and no save write.
- `docs/tech-decisions.md` **D55**, inserted after D54 and before `## Open questions`,
  titled
  `## D55 — The main menu's preview route is decorative, and its seed is random on purpose *(decided)*`,
  stating: `src/engine/routes/preview.ts` is the only seam (`previewRoute(seed, window)`,
  `previewWalkers(route)`, `stepPreviewWalkers(route, walkers, step)`), it reads no run
  state and no save; `D11` makes the **run** reproducible, and this screen is the one
  place allowed to differ per visit, so the seed is `randomSeed()` once per boot and is
  never persisted. Name the consequence: a fixture frame and the live panel render the
  same model, and no other screen may adopt a random seed by citing this decision.

## 🧩 Data and configuration

- The walker count is a draw, not a table: `2 … 3` per room (`rng.int(2, 3)`).
- The preview tile is the route’s own 24 px; the atlas cell is 16 px (`FRLG_TILE_SIZE`)
  and is scaled by the background size computed in `tileBackground`.
- No balancing value and no tuning constant lives outside the two exported constants
  above (`PREVIEW_TILE`, `ROUTE_PREVIEW_STEP_MS`).

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm ci --prefer-offline --no-audit --no-fund` once in the worktree.
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-198` audit against the exclusive paths list.
  - This task has `[live]` criteria, so QA owes a browser pass: `npm run dev --
    --port <free> --strictPort`, its own tab, Chromium over CDP, DOM rect arithmetic
    (`getBoundingClientRect`, `getAttribute`, `textContent`). Stop the server when done.
- **Acceptance criteria:** every one is tagged **`[unit]`** or **`[live]`**; a `[live]`
  one states its measurement.
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass (`npm test`): `preview.test.ts`,
        `routeWindow.test.ts`, the panel’s `view.test.ts`/`fixture.test.ts` and
        `MainMenuScene.test.ts`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched
        (`git diff --name-only main...task-198` lists only them).
  - [ ] `[unit]` `previewRoute(seed, window)` is deterministic for one seed: two calls
        deep-equal; `room.rect` deep-equals the window it was given at both QA rects
        (`{ x: 96, y: 150, w: 560, h: 380 }` → `23 × 15` and
        `{ x: 16, y: 126, w: 358, h: 240 }` → `14 × 10`), `room.tiles` has exactly
        `rows` rows of `cols` entries, and `PREVIEW_BIOME_ID` equals
        `biomeForRoute(1).id`.
  - [ ] `[unit]` Every tile in `room.walkable` satisfies `isWalkable(room.tiles, tile)`,
        and every walkable tile of `tiles` is listed once.
  - [ ] `[unit]` `previewWalkers(previewRoute(seed, window))` returns 2 or 3 walkers
        with distinct `speciesId`s, and every walker’s starting tile is in
        `room.walkable`.
  - [ ] `[unit]` A folded walk stays legal and replays: folding
        `stepPreviewWalkers` over steps `0 … 19` twice from the same start deep-equals,
        and at every step each walker’s tile is inside the room and in `room.walkable`.
  - [ ] `[unit]` `previewRoomFor` builds once per `(seed, window)`: the second call
        returns the same object identity (spy on `previewRoute` and assert one call).
  - [ ] `[unit]` `tileBackground` returns the object frame first and the ground last,
        with positions computed from `tileset.config.image.cols` and the 24 px cell;
        a `null` object frame returns one image.
  - [ ] `[unit]` `MainMenuScene.menuView()` passes `this.previewSeed` into
        `liveMainMenuView`, and the scene draws it once (mock `../engine/rng`’s
        `randomSeed` and assert one call for one `create`-path entry; then a second
        `menuView()` does not draw again).
  - [ ] `[unit]` `fixtureMainMenuView` falls back to `MAIN_MENU_SLUG` when the payload
        carries no `previewSeed`, so `fixture.test.ts` still reads
        `01-main-menu.json` unchanged.
  - [ ] `[live]` **The desk window is a route.** At 1280×800 with `/?hud=dom`, measure
        on `[data-hud-main-menu-window]`: `getBoundingClientRect()` is
        `{ x: 96, y: 150, w: 560, h: 380 }` (±1), `data-hud-main-menu-preview` is a
        non-empty string, `[data-hud-main-menu-tiles]` holds exactly `23 × 15 = 345`
        tile spans, there are 2 or 3 `[data-hud-main-menu-walker]` spans and every
        walker’s rect is inside the window’s rect on all four edges.
  - [ ] `[live]` **The walkers move, and the preview is per boot.** At 1280×800, read
        every walker’s `left`/`top` twice 1.5 s apart: at least two walkers changed
        position. Open Options from its row (or the settings key) and BACK, then read
        `data-hud-main-menu-preview` again: unchanged, and the walker count is the
        same. Reload the page: the attribute’s value differs from the pre-reload one.
  - [ ] `[live]` **The phone window holds them.** At 390×844 with `/?hud=dom`, the
        window rect is `{ x: 16, y: 126, w: 358, h: 240 }` (±1), the tile count is
        exactly `14 × 10 = 140`, and two samples 1.5 s apart show at least two walkers
        moved while every walker rect stays inside the window rect.

## 📣 Coordination

Facts another role needs to know, and the shape of them. Anything another task
depends on that is not in the Contract above.

- For the Architect: this task holds the batch’s only `src/scenes/MainMenuScene.ts`
  (serial chain `198 → 199 → 201 → 211`), the batch’s only `main-menu/**`, the only
  `src/engine/routes/**` and the batch’s only `docs/tech-decisions.md` (D55). It
  claims `docs/design-spec.md` **§2 only**; §3 belongs to `Task-202`.
- Deviation from the TODO’s naming, forced by the code: `previewRoute` takes the
  window **rect** as well as the seed, because the engine may not read a UI rect and
  the model has to know its `cols`/`rows`; `previewWalkers` takes the generated
  **room** (which carries `route.seed`) instead of the bare seed, because a walker
  cannot know what is walkable otherwise. The seed is still the only entropy.
- `src/engine/README.md` is added to the exclusive paths by the folder-map rule in
  `AGENTS.md` (the new `routes/preview.ts` needs its one-line role), not by the TODO’s
  `Claims` line.
- For the next batch: `Task-199`/`Task-201` rewrite the same panel and scene, so they
  build against `MainMenuView.previewSeed`, `liveMainMenuView`’s optional third
  argument, and the three DOM hooks above. `Task-200` deletes the canvas path; the
  preview lives in the DOM panel, so it survives that deletion.
- For QA on assets: the tile atlases fall back to `src/assets/placeholders/` when the
  store is absent, so the tiles always paint; the walkers use the gitignored portrait
  atlas and may be empty boxes in a clean checkout — the criteria measure their
  **rects and motion**, never their pixels. The asset store is at
  `$ASSETS_ROOT=/home/runner/work/_temp/assets/store`; never symlink it into the
  worktree and pass absolute paths only.

## ⛔ Out of scope

- No encounter, no player, no input, no save write, no portal, no trainer, no items:
  the preview is decoration and nothing else.
- The preview never reads `RunState.seed`, never writes `localStorage`, and never
  enters `save.run`.
- No new dependency, no `package.json`, no `vite.config.ts`, no `src/main.ts`, no dex
  regeneration and no fixture payload.
- Do not change the window’s rect, its title, its glow, the card’s rows or the footer;
  do not touch `docs/hud-fidelity.md`, `design/**`, `Task-197`’s harness or the stats
  panel.
- No second renderer: the fixture frame and the live panel read the same model; a
  canvas-only path for the preview is out of scope (`Task-200` deletes the canvas
  menu anyway).
