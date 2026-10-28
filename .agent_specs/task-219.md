# Spec: Task-219 — the main menu's walkers walk: the route's own step and the pair's walk strip

> Batch 91 fill, cut in Batch 93. It shares no path with `[Task-208]`
> (`src/ui/hud/panels/hud/**`, the styles, `src/data/hudLayout.ts`, the scene seam,
> `docs/hud-fidelity.md`, `D49`, `docs/design-spec.md` §3) or with `[Task-218]`
> (`src/ui/hud/panels/run-over/README.md`). `docs/design-spec.md` is **§2 here and §3
> there**, and `docs/tech-decisions.md` is **`D55` here and `D49` there** — a block each.

## 🎯 Scope

- **Task type:** DOM HUD (Preact) — the main menu's live-route preview.
- **Role:** Dev.
- **Objective:** after this task a walker in the main menu's preview route **walks**: one
  tile's move takes the route scene's own `WALK_STEP_MS` (**200 ms**, linear) instead of
  teleporting, the rest of the 600 ms tick is a stand, the sprite is the committed
  overworld **pair** (`pokemonOverworldSheet`) drawn at `24 / sheet.size` in the same
  24 px box, playing the pair's `walk` strip at `FOLLOWER_FRAME_RATE` (**5 fps**) while it
  moves and its `idle` strip while it stands, with the `side` row flipped for `E`/`W`.
  A species whose pair is absent — the pair PNGs are gitignored, so a clone without the
  asset store has none — keeps today's **portrait crop**. The **model does not move**: the
  step counter still advances once per 600 ms tick, so the per-walker stream and every
  fixed-seed fold replay exactly as today.
- **Environment:** worktree `../wt-pkm-219`, branch `task-219`. Run
  `npm ci --prefer-offline --no-audit --no-fund` once. **No asset tree is linked in and
  none is needed at build time**; the pair PNGs under `src/assets/pokemon/` are gitignored
  and stay so.
- **Dependencies (merged on `main`):** `[Task-198]` — the panel, `preview.ts` and its
  model; `[Task-201]`, `[Task-211]` and `[Task-215]` — the folder's last three holders
  (`Batch 88`, `89`, `92`, all merged). No task in this batch produces a file this one
  reads.

### Exclusive paths (single writer)

- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`
- `src/ui/hud/panels/main-menu/routeWindow.ts`
- `src/ui/hud/panels/main-menu/routeWindow.test.ts`
- `src/ui/hud/panels/main-menu/main-menu.css`
- `src/ui/hud/panels/main-menu/README.md` (rule 6's two clocks; one line per new export)
- `docs/design-spec.md` §2's **live-route sentence only** (lines 39-44, "The window behind
  the title is a **live route** …")
- `docs/tech-decisions.md` `D55`'s block only

### Inputs (read-only)

- `src/engine/routes/preview.ts` (`PreviewWalker` with its `speciesId`, `tile` and
  `facing`; `PREVIEW_TILE` = 24), `src/ui/hud/panels/main-menu/preview.ts` (the model and
  `stepPreviewWalkers`), `src/ui/hud/panels/main-menu/view.ts`.
- `src/data/pokemonOverworld.ts` (`pokemonOverworldSheet`, `pokemonOverworldFrame`,
  `PokemonOverworldSheet`), `src/render/pokemonFollower.ts` (`followerFrame`,
  `followerDirRow`, `FOLLOWER_FRAME_RATE`, `FOLLOWER_ANIMS`) — both are Phaser-free and
  importable from the panel.
- `src/ui/hud/portrait.ts` (`portraitCrop`, `portraitBackground`) — the fallback paint.
- `src/scenes/RouteScene.ts` (`WALK_STEP_MS`, 399; the follower tween 2520-2525 and the
  pair paint 2478-2480) — **read** for the constants, never imported.
- `docs/hud-fidelity.md` §9, `design/tokens.json`.

## 🔒 Contract

### TypeScript — `src/ui/hud/panels/main-menu/routeWindow.ts`

```ts
/** One tile's move in the preview: the route scene's own WALK_STEP_MS. */
export const WALK_STEP_MS = 200;
/** The walker's frame clock: the route follower's FOLLOWER_FRAME_RATE, as a period. */
export const WALK_FRAME_MS = 1000 / FOLLOWER_FRAME_RATE;

export type WalkerPaint = Readonly<{
  /** The 24 px box, already at the model tile it is walking to. */
  box: Rect;
  /** Inline style pieces: the pair's background (image, position, size) or the portrait's. */
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  /** `scaleX(-1)` for `W`, otherwise none — the side row is one drawing. */
  transform: string;
  /** `WALK_STEP_MS` while the walker is in flight, `0` on a first paint / room change. */
  transitionMs: number;
  /** The frame the paint names, for the test and the live probe. */
  frame: number | null;
}>;

export function walkerPaint(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
  state: Readonly<{ moving: boolean; frameStep: number; instant: boolean }>,
  sheet: PokemonOverworldSheet | null,
): WalkerPaint;
```

- `WALK_STEP_MS` is declared **once**, here, beside `ROUTE_PREVIEW_STEP_MS` (600, which
  does not change), and written into the box's inline `transition-duration` — never
  repeated as a literal in CSS.
- `frame` is `followerFrame(sheet, walker.facing, moving ? 'walk' : 'idle', moving ? frameStep : 0)`
  for a sheet, `null` for the portrait fallback.
- `backgroundSize` is `"<cols × size × 24 / size>px <rows × size × 24 / size>px"` — the
  pair drawn `24 / sheet.size` inside the 24 px box (the route's own scale) — and
  `backgroundPosition` is `-<col × 24>px -<row × 24>px` with `row = followerDirRow(...)` and
  `col = frame % sheet.cols`.
- The fallback (no sheet, **or** a sheet whose image failed to load) returns the portrait
  crop exactly as `walkerStyle` does today.

### Behaviour — `mainMenuPanel.tsx`

1. The tile tick stays `ROUTE_PREVIEW_STEP_MS` and still calls `stepPreviewWalkers` once
   per tick: the model's fold and the step counter are untouched, so `preview.test.ts`'s
   fixed-seed replay does not move. **`preview.ts` is not edited.**
2. A tick that changes a walker's tile paints the walker `moving` for `WALK_STEP_MS` with
   the `walk` strip's frame following `WALK_FRAME_MS`, then paints it standing (idle frame
   0). The paint clock reads elapsed time only and never draws a number (D11).
3. A walker's **first** paint and a **room change** set their box with `transitionMs: 0`,
   so a mount never slides in from the window's corner.
4. A species whose pair image is missing or fails to load falls back to the portrait crop
   (an `Image` preload per species id, held in a failed-set; a load failure flips the
   paint and nothing throws into the panel). The pair DNS/404 must never leave an empty
   box.
5. No Phaser import, no scene read, no run or save write, no new i18n key, no RNG draw and
   no `SAVE_VERSION` step.

## 🧩 Data and configuration

- Two new constants only (`WALK_STEP_MS`, `WALK_FRAME_MS`); no key, no table, no save
  field, no balance value.
- No draw of any kind: the walk's clock is paint only, which is why no fixed-seed fold
  re-pins.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-219` audited against the exclusive paths above.
  - The task has one `[live]` criterion, so a browser pass **is** owed. On this machine
    `src/assets/pokemon/*.png` are absent (gitignored): the live pass measures the **pair**
    path after writing a throwaway pair PNG into that gitignored path from the committed
    manifest (below), and the **fallback** path with it removed. Neither file is
    committed — `git status --porcelain` must not list them at the end.
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `routeWindow.test.ts` pins `ROUTE_PREVIEW_STEP_MS === 600`,
        `WALK_STEP_MS === 200` and `WALK_STEP_MS < ROUTE_PREVIEW_STEP_MS`.
  - [ ] `[unit]` `walkerPaint` for a species with a sheet and `moving: true, frameStep: 1`
        returns that sheet's `walk` frame index (`row × cols + start + 1`), the pair's URL
        and a `backgroundSize` whose width is `cols × 24`; with `moving: false` it returns
        the idle frame 0; with `facing: 'W'` it returns `transform: 'scaleX(-1)'` and with
        `'E'` no flip; with `instant: true` it returns `transitionMs: 0` and otherwise
        `WALK_STEP_MS`.
  - [ ] `[unit]` `walkerPaint` with `sheet: null` returns the portrait crop's background
        (the portrait atlas, not the pair's URL) and `frame: null`.
  - [ ] `[unit]` `preview.test.ts` still replays its fixed-seed walk unchanged (a tile is a
        function of the tick count alone) and `git diff main...task-219 -- src/ui/hud/panels/main-menu/preview.ts src/engine/routes/preview.ts`
        is empty.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched (and
        `git status --porcelain` lists no `src/assets/pokemon/*.png`).
  - [ ] `[live]` **Measured with `?hud=dom` at 1280 × 800 and at 390 × 844**, via CDP
        `Runtime.evaluate`, on the main menu with a live route:
        (a) sample one walker's `getBoundingClientRect().left` every 50 ms for 1.3 s across
        a tick: no two consecutive samples differ by ≥ 24 px, and the samples of the moving
        stretch show the linear 200 ms slide over the 24 px cell;
        (b) its inline `background-position` changes at least once **inside** that 200 ms
        stretch and its `transition-duration` reads `200ms`;
        (c) with the throwaway pair PNG in place the same walker's `background-image`
        names `src/assets/pokemon/<fileId>.png`; with it removed the walker paints the
        portrait atlas and its box is still 24 × 24 (no empty box, no console error);
        (d) after `location.reload()` the first paint of a walker is at its own tile with
        `transition-duration: 0ms` (no slide in from the corner).

## 📣 Coordination

- For the Architect: the panel gains two constants and one pure paint function; the model
  and its seed stream do not move, so no fold re-pins.
- For the next batch: `walkerPaint` is the one place a preview sprite is painted; a later
  screen that wants the same cadence reuses `WALK_STEP_MS`, it does not declare a second
  one (`D55`'s amendment).

## ⛔ Out of scope

- Any other screen adopting the cadence; the starter screen, the run-over board and the
  battle's own animations.
- The route scene's follower (its 200 ms tween already ships) and `src/render/`.
- Packing or committing art: no packer runs, no `src/assets/**` file is added or modified.
- `preview.ts`, the model, the seed streams and any save field.
