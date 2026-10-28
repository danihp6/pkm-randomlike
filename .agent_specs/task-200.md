# Spec: Task-200 — The DOM HUD is the HUD, and the canvas panel layer retires

> Read `AGENTS.md` first. This file is your whole world; anything not written here
> does not exist. Work only inside the worktree `../wt-pkm-200` on branch `task-200`.

## 🎯 Scope

- **Task type:** Phaser scenes + DOM HUD (TypeScript).
- **Role:** Dev.
- **Objective:** today the board's DOM HUD only mounts when the URL carries
  `?hud=dom`; every scene otherwise draws a Phaser HUD of its own (FRLG bitmap
  font, its own SETTINGS screen, canvas route panels, no records in the menu). After
  this task **the DOM HUD mounts unconditionally** and **every scene's canvas chrome
  path is deleted** rather than hidden behind a branch: `MainMenuScene`,
  `StarterScene`, `RouteScene`, `BattleScene`, `RunOverScene`, `SettingsScene` and the
  stats screen mount their DOM panel on a clean boot, draw no chrome text object of
  their own, and keep working with `?hud=dom` / `?hudFixture=<slug>` as the debug
  aliases they become.
- **Environment:** worktree `../wt-pkm-200`, branch `task-200`, base `origin/main`.
- **Dependencies:** `[Task-198]` and `[Task-199]` (merged): they rewrote
  `src/ui/hud/panels/main-menu/**` and its live view; this task deletes the canvas
  path they left alone and must not rewrite that panel.

### Exclusive paths (single writer)

Nothing outside this list. No other task in this batch touches any of it.

- `src/main.ts`
- `src/ui/hud/mount.ts`, `src/ui/hud/shell.tsx` (+ `mount.test.ts`)
- `src/ui/hud/fixtures/**` (+ tests)
- `src/scenes/MainMenuScene.ts`, `StarterScene.ts`, `RouteScene.ts`, `BattleScene.ts`,
  `RunOverScene.ts`, `SettingsScene.ts`, `BootScene.ts` (+ their `*.test.ts`)
- `src/scenes/panels/**` (every file, including its tests and `types.ts`/`registry.ts`)
- `src/scenes/rooms/**` **only** where a room calls into `src/scenes/panels/**`
- `src/data/hudLayout.ts` + test — **read/keep**, delete only what the retired drag
  leaves unreferenced; do not change the stored shape
- the test files that a retired canvas module or the flag inversion makes stale:
  `src/ui/hud/panels/pause/view.test.ts`, `src/ui/hud/panels/hud/view.test.ts`,
  `src/ui/hud/panels/rewards/view.test.ts`, `src/ui/hud/panels/detail/evolution.test.ts`
  — **only** their `src/scenes/panels` import/cases — and the eight preview-flag tests
  `src/ui/hud/panels/{main-menu,starter,options,run-over,stats,pause,battle-log,battle-switch}/preview.test.ts`
  — **only** the `true`/`false` search lists, because a bare `?hudFixture=<slug>` now
  resolves without `?hud=dom`. **Scope extension, round 1:** these eight and
  `src/ui/hud/README.md` were edited by the dev in round 1 and the Orchestrator accepts
  them (no batch-mate claims them and the change is the flag inversion's consequence);
  any other file outside this list is still a red audit.
- `docs/tech-decisions.md` (`D49` amended), `docs/hud-dom-proposal.md` §13,
  `src/scenes/README.md`, `src/ui/README.md`, `src/ui/hud/README.md`,
  `src/scenes/panels/README.md` if it exists

### Inputs (read-only)

- `src/ui/hud/panels/**` — the shipped DOM panels and their `mount*` functions. You
  mount them; you do not restyle or rewrite their views.
- `src/ui/hud/commands.ts`, `src/ui/hud/state.ts`
- `docs/hud-dom-proposal.md`, `docs/tech-decisions.md` `D49`, `docs/design-spec.md`

## 🔒 Contract

### TypeScript

```ts
// src/ui/hud/mount.ts
/** The DOM HUD is the HUD: always true. The field stays so call sites compile. */
export function hudRequested(search: string): boolean; // always true
export function mountHud(search: string): HudHandle | null; // mounts on a clean boot
```

```ts
// src/ui/hud/fixtures/flags.ts — shape unchanged
export type HudFlags = Readonly<{ dom: boolean; fixture: string | null }>;
export function parseHudFlags(search: string): HudFlags;
// parseHudFlags('')            -> { dom: true,  fixture: null }
// parseHudFlags('?hud=dom')    -> { dom: true,  fixture: null }
// parseHudFlags('?hudFixture=02-options') -> { dom: true, fixture: '02-options' }
```

- The `DOM_HUD` module constant disappears from every scene and from every route
  panel module. `?hud=dom` keeps parsing (it is a no-op alias); `?hudFixture=<slug>`
  keeps resolving to the same slug.
- **The canvas chrome path is deleted, not branched.** For each scene, the
  `if (DOM_HUD) { this.createDom(); } else { … }` collapses to the DOM path, and the
  `else` body's chrome drawing is removed. The dev-read counters the tests use
  (`hudDrawnObjects`, `shippedDrawnObjects`, `detailDrawnObjects`, …) stay exported and
  report **0** because nothing is drawn; keep their names and their read functions so
  the tests can assert `0` on a clean boot.
- **Not chrome — keep it:** the route's map, tiles, grass, fog, trainers, actors, the
  player's sprite, the battle's fighters/sprites and their animations, the camera.
  Only the HUD — panels, the strip, the bitmap-font chrome, SETTINGS' own canvas page,
  the menu's canvas rows — goes.
- The route's panel modules may survive as **render-free controllers** (they mount a
  DOM panel into `#hud` and forward intents; `src/scenes/panels/party.ts` is the shape).
  What must not survive is any `if (DOM_HUD) … else <draw>` branch: after this task
  `src/scenes/panels/**` draws **no** Phaser object at all. Delete a module whose only
  job was drawing and whose DOM panel already has a `mount*` of its own.
- No `?hud=dom`-only behaviour may remain: a clean boot is the DOM boot.
- No Phaser import in the DOM HUD modules.

### Data

- No new key. `src/data/hudLayout.ts`'s stored shape is unchanged (the collapse chip,
  the drag and the saved slot are inventoried as consequence, not reimplemented).

- **The DOM panels' own attributes are the board's, not the spec's invention:** a
  panel is `[data-hud-panel="<id>"]` (`main-menu`, `options`, …) and a party row is
  `[data-hud-party-member]`. `[data-hud-main-menu]` / `[data-hud-options]` do not
  exist and a live check must use the canonical selectors.

## 🧩 Data and configuration

- The inventoried consequence, written into `docs/hud-dom-proposal.md` §13 and
  `D49`: the canvas layer was the only carrier of the collapse chip, the header drag
  with clamp and the saved slot (`src/data/hudLayout.ts`,
  `src/scenes/panels/hud.ts`), so those three leave with the canvas layer and the
  DOM parity is cut as its own task (`[Task-208]`, Batch 91 — already in the backlog).
  Name them, do not hide them.

## 🧪 Test and Validation Plan (for QA)

- **Method**
  - `npm test` — Vitest, headless, green including the tests this task adds/updates.
    The suite must not shrink by more than the tests of modules this task deletes;
    every deleted module's coverage is replaced by a scene test that asserts the DOM
    path (see the criteria).
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-200` audited against the exclusive paths.
  - **Live pass:** `npm run dev -- --port 5199 --strictPort` in the worktree, then
    `google-chrome --headless=new --no-sandbox --remote-debugging-port=9222
    --window-size=1280,800 about:blank` and CDP over `http://localhost:9222/json`
    (`Runtime.evaluate` on the page target; Node 22 has a global `WebSocket`). Read the
    DOM (`document.querySelectorAll`) — this task's evidence is DOM, and a
    `renderer.snapshotArea` read of the canvas is only used to prove the canvas no
    longer carries the chrome.
- **Acceptance criteria**
  - [ ] `[unit]` It typechecks and builds clean (`npm run build`).
  - [ ] `[unit]` `parseHudFlags('')` returns `dom: true, fixture: null`;
        `parseHudFlags('?hud=dom')` returns `dom: true`; `parseHudFlags('?hudFixture=02-options')`
        returns that slug; an invalid slug still returns `null`.
  - [ ] `[unit]` `mountHud('')` mounts a `#hud` root (jsdom) and `mountHud('?hud=dom')`
        returns the same handle; `dispose()` removes it.
  - [ ] `[unit]` each scene's `create()` with no query string mounts its DOM panel —
        `MainMenuScene`, `StarterScene`, `RunOverScene`, `SettingsScene` and the route's
        panel mounts are asserted through their `mount*` mock being called — and its
        chrome counter reads `0`; the tests that today stub
        `window.location.search = '?hud=dom'` are flipped to no query string.
  - [ ] `[unit]` `grep -rn "DOM_HUD" src` returns nothing, and no scene module contains
        an `else` chrome branch (the two are asserted by a source-reading test, the
        pattern `src/ui/hud/panels/detail/evolution.test.ts` already uses).
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 1280×800 and at 390×844, a clean boot of `/` (no query string):
        `document.querySelector('#hud [data-hud-main-menu]')` is non-null and its
        computed `font-family` names **Silkscreen**; `/` with `?hud=dom` yields the same
        node. Navigating to the settings screen yields the DOM `[data-hud-options]`
        page with its KEYBINDS column and **no** canvas SETTINGS page (a
        `renderer.snapshotArea` read of the canvas region the old page occupied shows
        no chrome text).
  - [ ] `[live]` on a fresh run at 1280×800, the route draws its map with `#hud`
        mounted and pressing `p` opens the DOM party panel
        (`document.querySelector('[data-hud-party]')` non-null, its rows equal the
        party's length); the same key closes it. At 390×844 the same holds.

## 📣 Coordination

- For the Architect: `[Task-208]` (Batch 91) is the DOM parity of the chip, the drag
  and the slot this task retires; nothing in it may be assumed shipped here.
- For the next batch: after this task the DOM HUD mounts on a clean boot, so any new
  scene mounts a panel and never a canvas chrome object; `parseHudFlags(search).dom`
  is always `true` and `?hudFixture=<slug>` still pins a frame.

## ⛔ Out of scope

- Reimplementing the collapse chip, the drag with clamp or the saved slot in the DOM
  (that is `[Task-208]`).
- Restyling any DOM panel, changing a frame's geometry, or rewriting a `view.ts`
  outside the four test files named above.
- Touching `src/data/dex/**`, `package.json`, `vite.config.ts`, `src/assets/**`.
- Deleting the game's own drawing (map, actors, battle sprites, animations).
