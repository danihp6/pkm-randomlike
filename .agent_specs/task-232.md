# Spec: Task-232 — the main menu's walkers take a stride and rest, over a lit tile that leaves a trail

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** engine rule (pure model + tests) plus a Phaser-side DOM panel (paint,
  component, CSS) and docs.
- **Role:** Dev.
- **Objective:** the decorative route behind the main menu stops metronoming one tile
  per tick. A tick now books a **stride** of 2–4 tiles along one heading from the
  walker's own stream, then the walker **rests** a drawn beat (900–1600 ms); the panel
  slides it over the whole stride at one tile per `WALK_STEP_MS` and holds the walk
  cycle's last frame while it stands. The tile a walker stands on gains a **ground
  plate**, and the tile it left keeps the same plate at half the alpha for `TRAIL_MS`,
  so a walk leaves a short trail — both computed by the pure paint, never by the
  component, so a fixture measures them.
- **Environment:** worktree `../wt-pkm-232`, branch `task-232`.
- **Dependencies:** `[Task-231]` — merged; it produced
  `src/data/overworldSize.ts` (`overworldScale` / `overworldCellHeight`), which
  `walkerPaint` already calls and this task reads **unchanged**. Also reads
  `src/render/pokemonFollower.ts`'s `followerFrame` / `followerDirRow` /
  `FOLLOWER_FRAME_RATE` and `src/ui/hud/portrait.ts`, both as they are.

### Exclusive paths (single writer)

Exactly the `Claims` of `TODO.md`'s `[Task-232]`, nothing else:

- `src/engine/routes/preview.ts`
- `src/engine/routes/preview.test.ts`
- `src/ui/hud/panels/main-menu/routeWindow.ts`
- `src/ui/hud/panels/main-menu/routeWindow.test.ts`
- `src/ui/hud/panels/main-menu/main-menu.css`
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`
- `src/ui/hud/panels/main-menu/README.md`
- `docs/design-spec.md` — **§2 only** (the run section, the main-menu bullet). Task-228
  holds the same file on **§4 only**; the two sections are disjoint and neither task
  may touch the other's. Change no line of §1, §3–§10.

### Inputs (read-only)

- `AGENTS.md`.
- `docs/design-spec.md` §2, the main-menu bullet, lines 39-48 (the sentence this task
  rewrites).
- `src/engine/routes/preview.ts`, `src/engine/grid.ts`, `src/engine/map.ts`
  (`isWalkable`), `src/engine/rng.ts` (`Rng.int` is inclusive), `src/engine/routes/routeMap.ts` (`FACINGS`, `FACING_VECTORS`).
- `src/render/pokemonFollower.ts` (`followerFrame`, `followerDirRow`, `FOLLOWER_FRAME_RATE`).
- `src/data/overworldSize.ts`, `src/data/pokemonOverworld.ts`, `src/data/tilesets.ts`,
  `src/engine/tileFrames.ts`, `src/engine/tileset.ts`, `src/ui/hud/portrait.ts`.
- `src/ui/hud/panels/main-menu/view.ts` (`MAIN_MENU_BOARD.window`,
  `MAIN_MENU_BOARD_NARROW.window`, `previewSeed`), `mount.tsx`, `preview.ts`,
  `src/ui/hud/panels/main-menu/palette`-free CSS as it is.
- `design/screens/01-main-menu.json` and `design/exports/01-main-menu.png` — **this
  pair does not exist in the tree yet**: `Task-223`'s import has not landed
  (`design/exports/` is absent and `design/screens/` holds only the old exporter's
  `.svg`/`.png`). The frame's caption is `01 Main menu` (mobile twin
  `M 01 Main menu`), from `design/import.json` and `design/board.json`. Until the
  import lands the geometry evidence is the old exporter's
  `design/screens/01-main-menu.png`, `design/screens/01-main-menu.svg` and
  `design/frames/01-main-menu.json` — read them, do not edit them. Nothing in this
  task depends on the frame: the plate/trail are new paint over the route's own
  tiles, and the walk's numbers are `TODO.md`'s own.

## 🔒 Contract

### TypeScript

**In `src/engine/routes/preview.ts`** — pure, no Phaser, no DOM, no clock:

```ts
/** The panel's tick: one model step, in ms. The window's only timer. */
export const PREVIEW_TICK_MS = 600;
/** The tiles one stride books: at least, and at most. */
export const STRIDE_MIN_TILES = 2;
export const STRIDE_MAX_TILES = 4;
/** The beat a walker stands after a stride, in ms, drawn from its own stream. */
export const STRIDE_REST_MIN_MS = 900;
export const STRIDE_REST_MAX_MS = 1600;

export type PreviewWalker = Readonly<{
  id: number;
  speciesId: string;
  /** The tile it now stands on: the last tile of `path`, or the one it never left. */
  tile: Tile;
  /** The heading of the last stride; unchanged on a resting tick. */
  facing: Facing;
  /** The tile the last stride started from. Absent until the first stride. */
  previous?: Tile;
  /** The tiles this tick's stride booked, in walk order; `[]` on a resting tick. */
  path: readonly Tile[];
  /** Ticks still to stand before the next stride; `0` = the next tick strides. */
  rest: number;
  /** The beat drawn for the rest that follows the last stride, in ms; absent before it. */
  restMs?: number;
}>;

export function previewWalkers(route: PreviewRoom): readonly PreviewWalker[];
export function stepPreviewWalkers(
  route: PreviewRoom,
  walkers: readonly PreviewWalker[],
  step: number,
): readonly PreviewWalker[];
```

`previewWalkers` is unchanged except that every walker it creates carries `path: []`
and `rest: 0` (same stream `${route.seed}:preview:walkers`, same species, tile and
facing draws — a fixed seed keeps the same *starting* walkers).

`stepPreviewWalkers` — the frozen algorithm, per walker, with `at` normalised exactly
as today (`Number.isFinite(step) ? Math.max(0, Math.trunc(step)) : 0`):

1. If `walker.rest > 0`: **draw nothing**, return
   `{ ...walker, path: [], rest: walker.rest - 1 }`. `tile`, `facing`, `previous` and
   `restMs` are copied through. This is the rest: a tick that books no move.
2. Otherwise build the walker's stream `rngFromSeed(`${route.seed}:preview:walker:${walker.id}:${at}`)`
   — the same key format as today, so a fold replays exactly — and make exactly three
   draws from it, in this order:
   - **draw 1:** `length = rng.int(STRIDE_MIN_TILES, STRIDE_MAX_TILES)` (2…4);
   - **compute the candidates** (no draw), exactly as today:
     `all = stepsFrom(route, walker.tile)`; `fresh` = `all` minus the step whose tile is
     `sameTile` to `previous` (only when `previous` is set); `forward` = those `fresh`
     steps for which `keepsGoing(route, step, walker.tile)`;
     `candidates` = `forward` if non-empty, else `fresh` if non-empty, else `all`.
     If `candidates` is empty the walker stays and makes no further draw: return
     `{ ...walker, tile: walker.tile, previous: walker.tile, path: [], rest: 0 }`;
   - **draw 2:** `chosen = candidates[rng.int(0, candidates.length - 1)]`;
     `facing = chosen.facing`.
3. Walk the stride: `path = [chosen.tile]`; while `path.length < length`, the next tile
   is `last + FACING_VECTORS[facing]`, and it joins `path` only if it is inside the room
   (`0 ≤ x < route.cols`, `0 ≤ y < route.rows`), `isWalkable(route.tiles, next)`, **not**
   `sameTile(next, previous)` and not already in `path`. The first refusal ends the
   stride. The stride is therefore straight (one `facing` for every leg), walkable, and
   never doubles back; its length is 1 only where the room allows nothing longer.
4. **draw 3:** `restMs = STRIDE_REST_MIN_MS + 100 * rng.int(0, 7)` (900, 1000, …, 1600)
   and `rest = Math.max(1, Math.round(restMs / PREVIEW_TICK_MS))` (2 or 3).
5. Return `{ id, speciesId, tile: path[path.length - 1], facing, previous: walker.tile,
   path, rest, restMs }`.

The result is pure and total: a negative or non-finite `step` folds to `0`, every
walker of the input appears once in the output, in order, and the same `(route,
walkers, step)` is deep-equal on every call. No `Rng` other than the three draws
above, no clock, no DOM, no Phaser.

**In `src/ui/hud/panels/main-menu/routeWindow.ts`**:

```ts
/** The window's model tick: the engine's own, so the two can never drift. */
export const ROUTE_PREVIEW_STEP_MS = PREVIEW_TICK_MS;   // 600
export const WALK_STEP_MS = 200;                        // unchanged
export const WALK_FRAME_MS = 1000 / FOLLOWER_FRAME_RATE; // unchanged
/** How long the tile a walker left keeps its half-alpha plate, in ms. */
export const TRAIL_MS = 400;

/** The walker's own tile: the route's ground lifted toward the accent. */
export const PLATE_COLOUR = 'rgba(125, 211, 252, 0.22)';
/** The same plate at half the alpha, for the tile it left. */
export const TRAIL_COLOUR = 'rgba(125, 211, 252, 0.11)';
/** No pair art: the board's `menu tab` plate (its panel fill, `#10161f`) instead. */
export const PLATE_TAB_COLOUR = 'rgba(16, 22, 31, 0.72)';
export const TRAIL_TAB_COLOUR = 'rgba(16, 22, 31, 0.36)';

export type WalkerPlate = Readonly<{
  /** 24 × 24, the window's own coordinates: `previewTileBox` of the tile. */
  box: PreviewRect;
  /** A complete CSS colour, alpha included, so a computed style and a fixture read the same string's alpha. */
  colour: string;
}>;

export type WalkerPaintState = Readonly<{
  moving: boolean;
  /** True while the walker stands between a stride and the next (`walker.rest > 0`). */
  resting: boolean;
  frameStep: number;
  instant: boolean;
  /** ms since this walker's last stride landed; `Number.POSITIVE_INFINITY` before the first. */
  sinceStrideMs: number;
}>;

export type WalkerPaint = Readonly<{
  box: Rect;
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
  transform: string;
  /** `path.length * WALK_STEP_MS` (0 on a first paint / room change). */
  transitionMs: number;
  frame: number | null;
  /** The tile the walker stands on, always present. */
  plate: WalkerPlate;
  /** The tile the last stride left, at half `plate`'s alpha; null once `TRAIL_MS` has passed. */
  trail: WalkerPlate | null;
}>;

export function walkerPaint(
  window: PreviewRect,
  room: PreviewRoom,
  walker: PreviewWalker,
  state: WalkerPaintState,
  sheet: PokemonOverworldSheet | null,
): WalkerPaint;
```

`walkerPaint`'s frozen rules (everything not named here is unchanged):

- `box` is still `previewWalkerBox(window, room, walker)` — the 24 × 24 cell of
  `walker.tile`, never the species' drawn size (`overworldCellHeight` still scales the
  sheet *inside* the box, feet at the bottom-centre).
- `transitionMs = state.instant ? 0 : Math.max(1, walker.path.length) * WALK_STEP_MS`
  — one tile per `WALK_STEP_MS`, however long the stride.
- Frame strip: `moving` → `followerFrame(sheet, pose.facing, 'walk', state.frameStep)`;
  else `resting` → `followerFrame(sheet, pose.facing, 'walk', sheet.anims.walk.count - 1)`
  (the walk cycle's **last** frame while it stands); else the idle strip's first frame
  (`followerFrame(sheet, pose.facing, 'idle', 0)`), exactly as today. `sheet === null`
  keeps `frame: null`.
- `plate = { box: previewTileBox(window, room, walker.tile), colour }` where `colour`
  is `PLATE_TAB_COLOUR` when the paint took the portrait branch (`sheet === null ||
  frame === null`) and `PLATE_COLOUR` otherwise.
- `trail = null` when `walker.previous === undefined` or
  `state.sinceStrideMs >= TRAIL_MS`; otherwise
  `{ box: previewTileBox(window, room, walker.previous), colour }` with
  `TRAIL_TAB_COLOUR` / `TRAIL_COLOUR` by the same branch rule.
- Pure and total: no clock, no `Rng`, no `document`; the same arguments deep-equal.

**In `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`** (the tick and the plates):

- `PreviewWalk` gains `strideMs: number` (the slide the last tick bought, in ms) and
  `trailUntil: number` (a paint-clock reading; `0` = no trail).
- The interval stays `ROUTE_PREVIEW_STEP_MS`; after `stepPreviewWalkers` the tick sets
  `moving = movedIds(...)`, `strideMs = Math.max(1, ...walkers.map((w) => w.path.length)) * WALK_STEP_MS`
  and `trailUntil = clock + TRAIL_MS`.
- The stand timer that clears `moving` waits `walk.strideMs`, not `WALK_STEP_MS`; a
  second `setTimeout(TRAIL_MS)` clears `trailUntil` and repaints.
- Every `walkerPaint` call passes `resting: walker.rest > 0` and
  `sinceStrideMs: walk.trailUntil === 0 ? Number.POSITIVE_INFINITY : nowMs() - (walk.trailUntil - TRAIL_MS)`.
- Between `.main-menu__tiles` and the walkers, one plate span per walker
  (`class="main-menu__plate"`, `data-hud-main-menu-plate={String(walker.id)}`,
  `style` = `left/top/width/height` from `plate.box` plus `backgroundColor: plate.colour`)
  and, while `paint.trail !== null`, one trail span before it
  (`class="main-menu__plate main-menu__plate--trail"`,
  `data-hud-main-menu-trail={String(walker.id)}`, same style from `trail.box`). The
  walkers still come last, so they paint above their plates. Nothing else in the
  component moves: the rows, the card, the footer and the portrait strip are untouched.

- **Determinism:** the model reads one stream per walker per stride tick,
  `rngFromSeed(`${route.seed}:preview:walker:${walker.id}:${step}`)`, and exactly three
  draws from it in the order fixed above; the room still reads
  `${seed}:preview` and the walkers `${seed}:preview:walkers`. A resting tick reads no
  RNG at all. The paint reads no RNG and no clock — `sinceStrideMs` is an argument.
- Rules: `src/engine/` imports no Phaser and touches no DOM; `routeWindow.ts` and the
  component own every style string; no `src/data/` change.

### Data

No new data table, JSON key or i18n key. The frozen numbers are the six engine
constants, `TRAIL_MS` and the four plate colours above. Nothing is balancing.

## 🧩 Data and configuration

None. The stride band (2–4 tiles), the rest band (900–1600 ms) and the plate alphas
are rule constants in the engine/panel, not tables: no content is added.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-232` audit against the exclusive paths list.
  - `npx vitest run src/engine/routes/preview.test.ts src/ui/hud/panels/main-menu/routeWindow.test.ts`.
  - Live pass: dev server + headless Chromium over CDP (`docs/agent-ci.md` §"The
    `[live]` criteria"), page loaded at 390×844 with `?hud=dom`, main menu visible
    (`[data-hud-panel="main-menu"]`). The inline `left`/`top` are the model's tick
    positions; the CSS transition is what slides the box, so poll the **inline style**,
    not `getBoundingClientRect`, for the stride.

Note for the Dev: three existing tests in `preview.test.ts` pin the old one-tile walk
and must be re-pinned to the new fold (`never walks straight back…`, `never comes back
to the same tile two ticks later…`, and the printed regression
`'buneary@4,8:N | …'`); the `walkerAt` / `foldWalk` helpers gain `path: []`, `rest: 0`
(and `tsconfig.json` has `exactOptionalPropertyTypes: true`, so an absent `previous`
must be omitted by conditional spread, never passed as `undefined`). Do not weaken an
assertion to a range where this spec pins an equality.

- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build` exits 0).
  - [ ] `[unit]` The declared tests exist and pass: `npm test` is green, including the
        new cases below.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched:
        `git diff --name-only main...task-232` lists only the eight paths above.
  - [ ] `[unit]` The constants are pinned: `PREVIEW_TICK_MS === 600`,
        `STRIDE_MIN_TILES === 2`, `STRIDE_MAX_TILES === 4`,
        `STRIDE_REST_MIN_MS === 900`, `STRIDE_REST_MAX_MS === 1600`,
        `ROUTE_PREVIEW_STEP_MS === PREVIEW_TICK_MS`, `TRAIL_MS === 400`,
        `WALK_STEP_MS === 200`.
  - [ ] `[unit]` A stride is 2–4 tiles, straight, walkable and never back onto the tile
        it came from: over 12 fixed seeds × 8 strides on the `PHONE` window, every
        booked `path` has length 2–4, each tile is the previous one plus
        `FACING_VECTORS[facing]`, is in bounds, `isWalkable`, appears once, is not
        `previous`; `tile` is the last path tile and `previous` is the tile the stride
        started from.
  - [ ] `[unit]` A walker boxed in still answers a legal stride or stays: in a
        synthetic 1-tile-wide corridor every stride has `path.length ≥ 1` and every
        tile is on the corridor; in a single-cell room `path` is `[]` and `tile` does
        not move.
  - [ ] `[unit]` The tick after a stride books no move and reports the rest:
        for the tick `t` that booked a stride of `rest` ticks, `step(t+1)` … `step(t+rest)`
        each return `path: []`, the same `tile` and a `rest` one lower, and `step(t+rest+1)`
        books at least one tile.
  - [ ] `[unit]` The rest is drawn in the band: `restMs` is a multiple of 100 in
        `[900, 1600]` and `rest === Math.max(1, Math.round(restMs / 600))` ∈ `{2, 3}`.
  - [ ] `[unit]` Two seeds yield different stride lengths: for the fixed seeds
        `'pkm-232-a'` and `'pkm-232-b'`, the first walker's stride lengths over its first
        six strides are not equal arrays (pin the two arrays once implemented).
  - [ ] `[unit]` Fold and purity: folding 20 ticks twice from the same start is
        deep-equal; the old printed regression is re-pinned to the new walk; a negative
        and a non-finite `step` fold to `0`.
  - [ ] `[unit]` `walkerPaint` slides the whole stride: `box` is 24 × 24 at
        `walker.tile`; `transitionMs === walker.path.length * WALK_STEP_MS` for a
        2-tile, 3-tile and 4-tile `path`, and `0` when `instant: true`.
  - [ ] `[unit]` The plate: `plate.box` equals `previewTileBox(window, room, walker.tile)`,
        `plate.colour === PLATE_COLOUR` with a sheet and `=== PLATE_TAB_COLOUR` with
        `sheet: null`; the parsed alphas are 0.22 and 0.72.
  - [ ] `[unit]` The trail names the left tile for `TRAIL_MS` and clears: with
        `previous: { x, y }`, `sinceStrideMs: 0` gives
        `trail.box === previewTileBox(window, room, previous)` and
        `trail.colour === TRAIL_COLOUR` (0.11) / `TRAIL_TAB_COLOUR` (0.36) by the same
        branch rule; `sinceStrideMs: TRAIL_MS - 1` keeps it; `TRAIL_MS` and
        `Number.POSITIVE_INFINITY` give `null`; no `previous` gives `null`.
  - [ ] `[unit]` A resting walker holds the walk strip's last frame:
        `walkerPaint(..., { moving: false, resting: true, frameStep: 5 })` returns
        `followerFrame(sheet, pose.facing, 'walk', sheet.anims.walk.count - 1)`, which
        differs from the idle strip's first frame.
  - [ ] `[unit]` No clock, no RNG in the paint: two calls with the same arguments are
        deep-equal, and `walkerPaint` runs in `node` with no `document`/`performance`
        (the existing purity test stays and is extended to the plate and the trail).
  - [ ] `[live]` **A walker crosses several tiles and then stands, at 390×844.** With
        `/?hud=dom` on the main menu, poll
        `document.querySelector('[data-hud-main-menu-walker="0"]').style.left` and
        `.style.top` every 100 ms for 6 s: at least one consecutive pair differs by
        ≥ 48 px along exactly one axis (a stride of ≥ 2 tiles), every observed
        displacement is a 24 px multiple along one axis only, and at least one run of
        ≥ 600 ms shows no change (the rest).
  - [ ] `[live]` **The stand is a plate on the walker's own tile.** In the same page,
        `[data-hud-main-menu-plate="0"]` exists, its rect is the same `x`,`y` as the
        walker's rect and 24 × 24, and its `getComputedStyle(...).backgroundColor`
        equals `rgba(125, 211, 252, 0.22)` when the walker's computed `backgroundImage`
        contains `pairs/`, or `rgba(16, 22, 31, 0.72)` when it contains the portrait
        atlas instead — i.e. never the field's own ground (`rgba(0, 0, 0, 0)`).
  - [ ] `[live]` **The tile it left keeps a half-alpha trail for 400 ms.** Within
        100 ms of a stride sample, `[data-hud-main-menu-trail="0"]` exists, its rect is
        the walker's rect *before* that stride (same `x`,`y`, 24 × 24), and its computed
        `backgroundColor` alpha is **exactly half** the plate's (0.11 or 0.36); 600 ms
        after that stride the element is gone
        (`document.querySelector('[data-hud-main-menu-trail="0"]') === null`).

## 📣 Coordination

- For the Orchestrator: both specs (`task-228.md`, `task-232.md`) touch
  `docs/design-spec.md` on **disjoint sections** (§4 and §2). Integration QA must
  check the combined file for lost lines.
- For the next batch: `PreviewWalker` now carries `path`, `rest` and `restMs`, and
  `previous` means "the tile the last stride started from" (it used to mean "the tile
  the last tick stepped off"). Any later walker/route code reads `path` for the slide
  and `rest > 0` for "standing". `ROUTE_PREVIEW_STEP_MS` is now an alias of the
  engine's `PREVIEW_TICK_MS`; do not re-declare the 600.
- Docs to update, exactly:
  - `docs/design-spec.md` §2, the words at lines 41-47 ("with two or three Pokémon
    wandering it: … its 600 ms tick a stand, … so a walker's box is never empty"),
    replaced by: "with two or three Pokémon wandering it: each one walks a **stride**
    of two to four tiles along one heading in a single **600 ms** tick, then stands a
    beat of 0.9–1.6 s drawn from its own stream while the panel slides it one tile per
    **200 ms** along that stride, drawn as its committed overworld pair playing the
    `walk` strip at 5 fps (holding the strip's last frame while it stands) at the
    species' own height inside its 24 px tile (`overworldScale`,
    `src/data/overworldSize.ts`: the tallest fills the cell and the smallest keeps
    headroom), and, where the pair's local art is absent, as its portrait cell, so a
    walker's box is never empty. The tile a walker stands on carries a **ground
    plate** — the route's ground lifted toward the accent, or the board's tab plate
    behind a portrait — and the tile it left keeps the same plate at half the alpha
    for **400 ms**, so a walk leaves a short trail —".
  - `src/ui/hud/panels/main-menu/README.md`: rule 6 (the two clocks) is rewritten to
    name the stride, the rest and the trail — the model clock is still the one
    `ROUTE_PREVIEW_STEP_MS` (600 ms) timer, a tick books a 2–4-tile stride and then
    `rest` ticks that book nothing, the paint clock still slides one tile per
    `WALK_STEP_MS` and holds the walk strip's last frame while it rests, and the plate
    and the trail are the paint's, never the component's. The Layout lines for
    `routeWindow.ts`, `routeWindow.test.ts`, `mainMenuPanel.tsx` and `main-menu.css`
    gain the plate/trail sentence (one role line each, no exported names).
- Nothing else in the batch reads `PreviewWalker`: `stepPreviewWalkers` and
  `previewWalkers` have exactly one caller (`mainMenuPanel.tsx`) and one test each.

## ⛔ Out of scope

- No change to `src/engine/routes/` other than `preview.ts` (+ its test): the room,
  the tile field, the walkers' species and start tiles stay.
- No change to `src/data/overworldSize.ts`, `src/render/pokemonFollower.ts`,
  `src/ui/hud/portrait.ts`, `src/ui/hud/panels/main-menu/view.ts`, `mount.tsx`,
  `preview.ts`, `index.ts`, the fixtures or the canvas main menu.
- No per-species cadence: `FOLLOWER_FRAME_RATE` and `WALK_FRAME_MS` stay 5 fps /
  200 ms for every species.
- No new art, no sprite sheet, no encounter, no player, no save write, no input.
  The plates are CSS colour over the existing tiles.
- No `docs/design-spec.md` section other than §2, and no `src/` README outside the
  four files listed.
