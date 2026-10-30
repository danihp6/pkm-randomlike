# Spec: Task-235 — a viewport change re-lays out the mounted DOM HUD

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** Phaser scenes + DOM HUD panel (presentation; no engine rule, no data).
- **Role:** Dev.
- **Objective:** after this task a window whose size changes **while the game runs**
  lays the mounted DOM HUD out again: the battle's HP boxes and command card and the
  route's every card (party card, the panels' chips) take the rects the new viewport
  gives them, without a reload and without a second mount. The rule that makes it
  hold: **the viewport is an argument of the push, never of the mount.** Today
  `mountBattleHp` bakes the geometry it is handed at mount time, and `RouteScene`
  never listens to `scale`'s `resize`, so a 1280×800 window dragged narrow keeps its
  desk layout (`?hud=dom` at 1280×800 resized to 390×844: the party card keeps
  `{x 928, y 8, w 250, h 406}` where a fresh boot at that size draws `{x 38, …}`, and
  an open battle's HP boxes keep their desk rects while the command card reflows).
- **Environment:** worktree `../wt-pkm-235`, branch `task-235`.
- **Dependencies:** none.

### Exclusive paths (single writer)

- `src/ui/hud/panels/battle-hp/mount.tsx`
- `src/ui/hud/panels/battle-hp/mount.test.ts` (new)
- `src/ui/hud/panels/battle-hp/README.md`
- `src/ui/hud/panels/battle-hp/index.ts` *(only if the barrel's re-exported type must follow the change; the names above stay the ones it exports)*
- `src/scenes/BattleScene.ts`
- `src/scenes/RouteScene.ts`
- `src/ui/hud/README.md`
- `docs/hud-fidelity.md` — **§5 only** (Panel geometry). No other section, and no
  other `docs/*.md`.

Nothing outside this list. Deleting a stray `.gitkeep` is always allowed.

### Inputs (read-only)

- `design/import.json` — the board's hand-authored map: frame `05-battle-hud`,
  caption **`05 Battle HUD`**, panel `battle-hp`, mobile twin `m05-battle-hud`; and
  frame `03-route-hud`, caption **`03 Route HUD`**, mobile twin `m03-route-hud`.
- `design/frames/05-battle-hud.json` and `design/frames/03-route-hud.json` — the old
  exporter's geometry-and-text dump for those two frames (read-only; the committed
  `design/screens/<slug>.png`/`.svg` are the same export as raster and vector).
- **Note on `design/screens/<slug>.json` / `design/exports/<slug>.png`:** those two
  families do **not** exist in this tree (0 of 33 JSON, no `exports/`): they arrive
  with `[Task-223]`, which is blocked on the operator's Figma import (issues #83 and
  #86). While they have not landed, the frames' geometry is the entry's own and the
  constants this spec names — `battleHpBox`, `battleCommandBox`, `partyPanelBox`,
  `hudMetrics`, `STRIP_PHONE_SLOTS` — are the reference. Do not invent new numbers.
- `docs/hud-fidelity.md`, `src/ui/hud/README.md`,
  `src/ui/hud/panels/battle-hp/README.md`.
- `src/ui/hud/panels/battle-hp/view.ts` and `view.test.ts` (the rects and the
  viewport type), `battleHp.tsx`, `src/ui/hud/state.ts` (the snapshot and `syncHud`),
  `src/ui/hud/mount.ts` and `src/ui/hud/mount.test.ts` (the Preact-mock precedent),
  `src/scenes/panels/hud.ts` (the metrics and the strip), `src/scenes/panels/types.ts`
  (`RoutePanelHost`), `src/scenes/panels/party.ts` and
  `src/scenes/panels/party/view.ts`, `src/scenes/BattleScene.ts`.

## 🔒 Contract

### TypeScript

`src/ui/hud/panels/battle-hp/mount.tsx`:

```ts
export type BattleHpDoubles = Readonly<{ enemy: boolean; player: boolean }>;

export type BattleHpController = Readonly<{
  /** Pushes a snapshot and the viewport it must paint in; a changed `fraction` starts that box's fill transition. */
  update(state: HudState, viewport: Viewport, doubles: BattleHpDoubles): void;
  dispose(): void;
}>;

export function mountBattleHp(host: Element): BattleHpController;
```

- `Viewport` is the one already exported by `./view` (`{ width: number; height: number }`).
  Reuse the scene's existing `doublesInPlay()` shape; do not declare a second one if
  `src/scenes/BattleScene.ts` can import this type instead — but the field names are
  `{ enemy, player }` either way.
- `mountBattleHp` takes **no** geometry: it renders the empty view once (so
  `[data-hud-battle-hp]` exists from the mount), and every `update` recomputes the
  view with `battleHpView(state, viewport, doubles)` and re-renders. The controller
  keeps **no** stored viewport and no stored `doubles`.
- Determinism: reads no RNG, mounts once, imports no Phaser and no scene. No DOM
  global is touched outside the `host` it is given.

`src/scenes/BattleScene.ts`:

- `mountHpPanel()` calls `mountBattleHp(host)` (nothing else changes: same host,
  same dispose-first guard).
- The push in `refreshHud()`'s `syncHud` sink becomes
  `(next) => this.hpController?.update(next, { width: this.scale.width, height: this.scale.height }, this.doublesInPlay())`
  — the same two inputs `battleStage` and `battleCommandInput` already read from the
  live scale, never a number captured at mount.
- The scene's existing `scale.on('resize', this.onResize, this)` and its `shutdown`
  `off` stay as they are: `onResize` already calls `refreshHud()`.

`src/scenes/RouteScene.ts`:

- In `create()`, beside the existing listeners, register
  `this.scale.on('resize', this.onResize, this)` and drop it on
  `Phaser.Scenes.Events.SHUTDOWN` with `this.scale.off('resize', this.onResize, this)`
  (add it to one of the existing `events.once(SHUTDOWN, …)` blocks, or a new one —
  one registration, one teardown, no leak across restarts).
- New private handler:

  ```ts
  private onResize(): void {
    this.hud = hudMetrics(this.scale.width);
    this.refreshHud();
  }
  ```

  `refreshHud()` then repaints every card: each panel's `refresh` rebuilds its view
  from `host.scene.scale` (`src/scenes/panels/party.ts` 60-66, `panels/hud.ts`
  282-292), so no card needs a hook of its own.
- **Rejected, do not implement:** a `window.resize` / `ResizeObserver` inside
  `src/ui/hud/mount.ts` that re-mounts the panels. It measures `window.innerWidth`
  while the scenes lay out from `scale.width` (two sources for one number), and a
  re-mount throws away each card's signal, its drag offset, its fill transition and
  the strip's `routePaused` flag. The per-scene listener is one line where the number
  already lives.

### Data

- No key, no table, no balancing value. `SAVE_VERSION` does not move (this task adds
  no run field); `src/engine/**` is untouched.

## 🧩 Data and configuration

None. The task writes no data file, packs no atlas and regenerates nothing (`npm run
data:ui` and `npm run data:dex` are not run).

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim. A criterion that cannot be executed by someone who has not
read the rest of the spec is not a criterion.

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-235` audit against the exclusive-paths list
    (and `git diff main...task-235 -- docs/hud-fidelity.md` must touch §5 only).
  - Browser pass: **required** — two `[live]` criteria below. Serve with `npm run
    dev`, drive a headless Chromium over CDP, and read `getBoundingClientRect()`;
    **no screenshot and no pixel diff** (`D57`).
- **Acceptance criteria:**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` The declared tests exist and pass (`npm test`): the four below in
        `src/ui/hud/panels/battle-hp/mount.test.ts` (mock `preact` the way
        `src/ui/hud/mount.test.ts` does, capture the props the mocked `h` receives
        from `BattleHp`, and assert the `box.x/y/w/h` the view derives):
    - [ ] `[unit]` **the push, not the mount, decides**: `mountBattleHp(host)` is
          called once; the first `update(state, { width: 1280, height: 800 }, { enemy: false, player: false })`
          paints the player's lead box at `battleHpBox({ width: 1280, height: 800 }, 'player', 0)`,
          and a second `update` of the same state with `{ width: 390, height: 844 }`
          paints it at `battleHpBox({ width: 390, height: 844 }, 'player', 0)`
          (`{x 16, y 504, w 358, h 80}`), with no second container and exactly one
          `render(null, …)` (the mount's only render of the empty view) before them.
    - [ ] `[unit]` **the boxes are the pushed state's**: the mount paints no box at
          all (its one paint is the empty view); a push of a state that fields two
          actives per side paints `enemy-0`, `enemy-1`, `player-0` and `player-1`;
          a push of a state that fields one active on the player's side paints
          `enemy-0` (plus `enemy-1` if that state fields it), `player-0` and no
          `player-1`. *Amended by the Orchestrator after the Dev measured the
          shipped `view.ts`: `boxes` come from `battle.sides[side].actives`
          (`battleHpView`, `view.ts` 296-345) while `doubles` only selects the
          second slot's **rects** (`battleHpLayout`, 197-208), so the earlier
          wording — the same two-active state pushed with `player: false` painting
          one player box — is unreachable without changing `view.ts`'s semantics,
          which this task must not do. The invariant is unchanged: neither the box
          count nor the rects come from the mount.*
    - [ ] `[unit]` **a resize storm cannot stack cards**: two consecutive pushes of
          the same state and the same viewport produce equal rects.
    - [ ] `[unit]` **the route's recompute keeps the clamp**: `hudMetrics(320).panelW`
          is `304` (the clamp to `width − 16`) where `hudMetrics(1280).panelW` is
          `344`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` **battle reflow**: with `npm run dev`, `?hud=dom` at 1280×800, a
        battle open, resize the viewport to 390×844 **without a reload**
        (`Emulation.setDeviceMetricsOverride` or `Browser.setWindowBounds` over CDP)
        and, on the next frame, read `document.querySelector('[data-hud-hp="player-0"]').getBoundingClientRect()`:
        it equals `battleHpBox({ width: 390, height: 844 }, 'player', 0)`
        (`{x 16, y 504, w 358, h 80}`, ±1 px per edge), and
        `document.querySelector('[data-hud-panel="battle-command"]')`'s rect still
        equals `battleCommandBox({ width: 390, height: 844 })` (±1 px per edge; the
        command card already reflowed before this task — this is the regression that
        proves the HP boxes now follow it). Same state, no reload, one mount.
  - [ ] `[live]` **route reflow**: a fresh route boot at 1280×800 with PARTY open,
        resized the same way to 390×844 without a reload, leaves
        `[data-hud-panel="party"]`'s rect equal to the rect a fresh boot at 390×844
        draws — `partyPanelBox({ width: 390, height: 844 })` = `{x 38, y 8, w 250,
        h 406}` (±1 px per edge) — where before the fix it kept the desk `x 928`;
        and each collapsed card's chip sits at `STRIP_PHONE_SLOTS[id] + {dx, dy}`
        (no offset saved in that boot, so at the slot itself) inside the window.
- **No `[live]` compares pixels** (`D57`): every one above is a rect read.

## 📣 Coordination

- For the Architect: `mountBattleHp`'s signature changes (`mount` loses its geometry,
  `update` gains viewport + doubles). Any later task written against the battle HP
  panel must push the viewport with the state; the barrel keeps the same names.
- For the next batch: `src/scenes/RouteScene.ts` now owns a `scale` `resize`
  listener, so a later task that adds a route card gets its reflow for free by
  rebuilding its view from `host.scene.scale`; `src/scenes/BattleScene.ts` keeps its
  one `onResize` → `refreshHud()` path.
- Folder maps: `src/ui/hud/panels/battle-hp/README.md` gains `mount.test.ts` in its
  Layout list and the new clause in rule 1; `src/ui/hud/README.md` gains rule 4;
  `docs/hud-fidelity.md` §5 gains one panel-geometry rule. The `src/scenes/README.md`
  and `src/ui/README.md` maps change **only** if a file is added, renamed or deleted
  there — this task adds one test file under `battle-hp/`, already inside a mapped
  folder, so those two stay untouched.

## ⛔ Out of scope

- No `ResizeObserver`, no `window.resize`, no re-mount of the HUD, no viewport field
  in `HudState`.
- No new panel, no new card, no new colour, no canvas draw: the canvas keeps drawing
  none of the HUD.
- No change to `battleHpBox`, `battleCommandBox`, `partyPanelBox`,
  `hudMetrics`, `stripView` or any measured constant — the task makes the shipped
  rects answer the live viewport, it does not re-tune them.
- No `?hud=dom` removal, no i18n string, no `SAVE_VERSION` step, no `src/engine/`
  file, no packer, no dex regeneration, no `package.json`.
