# Spec: Task-255 — the pause menu is wired to its spec

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** tooling / HUD spec-gap adapter (pure TypeScript + Vitest; no Phaser, no DOM).
- **Role:** Dev.
- **Objective:** the pause card `ESC` opens on the route gains its spec-gap adapter, so the game's
  **two**-row card is measured against the board's **four**-row frame `03n Panels · pause menu`:
  the one box both sides share is claimed at a zero delta, the card's five other candidates are
  declared and honestly unclaimed, and the `MENU` title is claimed as a string. After this task
  `src/ui/hud/specGap.walk.test.ts` discovers an adapter for `03n-panels-pause-menu`, and
  `gapFor(buildView(spec), spec)` is empty for that slug.
- **Environment:** worktree `../wt-pkm-255` (sibling of the repo checkout), branch `task-255`,
  which already carries the commit `spec: task-255`. `node_modules` may be absent: install once
  with `npm ci --prefer-offline --no-audit --no-fund` (never a network-only `npm ci`, never a
  junction or symlink of another tree's `node_modules`). Work only inside that worktree.
- **Dependencies:** none. `pausePanelView`, `fixturePausePanelView`, the fixture preview and the
  fixture itself already exist on `main`.

### Exclusive paths (single writer)

Nothing outside this list.

- `src/ui/hud/specGap.views/pause.ts` — **new**: the adapter.
- `src/ui/hud/panels/pause/specGap.test.ts` — **new**: its test.
- `src/ui/hud/panels/pause/README.md` — **one edit**: one new map line for
  `specGap.test.ts`, in the `## Layout` list. No other line changes.

**Do not touch** `src/ui/hud/panels/pause/view.ts`, `pausePanel.tsx`, `pause.css`, `mount.tsx`,
`preview.ts`, `src/ui/hud/specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`, `CHANGELOG.md`
or `design/**`. The Orchestrator removes this slug's `PENDING` line and flips its table row in the
merge commit (see *Coordination*).

### Inputs (read-only)

- `AGENTS.md` (the whole file).
- `design/screens/03n-panels-pause-menu.json` and `design/exports/03n-panels-pause-menu.png` —
  the frame `03n Panels · pause menu` (board node `6:2217`), **9 boxes, 5 strings, 11 colours**.
- `design/fixtures/03n-panels-pause-menu.json` — its `menu` block: `title: 'MENU'`,
  `selected: 0`, `armed: false`, rows `Settings` / `Reset run`.
- `src/ui/hud/specGap.ts` — `GAP_TOLERANCE`, `PanelView`, `GapBox`, `ScreenSpec`, `gapFor`.
- `src/ui/hud/specGap.views/README.md` and the shipped patterns
  `src/ui/hud/specGap.views/notice-level-up.ts` (declared-but-unclaimed boxes) and
  `rewards-pokemon.ts` (`at`, `claim`, `stringClaims`).
- `src/ui/hud/specGap.walk.test.ts` — how the walker discovers an adapter.
- `src/ui/hud/panels/pause/view.ts` — `fixturePausePanelView`, `PausePanelView`, `Rect`. Note
  `scrim` and `box` are **viewport** coordinates while `highlight`, `divider` and the rows are
  **card-relative**.
- `src/ui/hud/panels/pause/preview.ts` — `?hud=dom&hudFixture=03n-panels-pause-menu` mounts this
  pinned fixture; that is the tree QA measures live (below).

## 🔒 Contract

```ts
import type { PanelView, ScreenSpec } from '../specGap';

export const slug = '03n-panels-pause-menu';

export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` builds the view **exactly as the preview and the running card build it**:
  `fixturePausePanelView(FIXTURE, { width: 1280, height: 800 })` — the payload is the whole
  fixture module, the function reads its `menu` block and returns `PausePanelView | null`; throw
  if it returns `null` (it never does for this fixture, and a null is the harness's own bug, not a
  view to paper over).
- `spec` is read only as a structural selector — *does the frame draw this box name*, *is this
  line the board's text*. The shipped numbers come from `view.ts`.
- **Determinism:** no `Rng`, no clock, no DOM, no store, no Phaser. The fixture is a module
  constant and `panelView` is pure, so the same spec always yields the same view.
- No `src/engine/`, no `src/data/**`, no `src/scenes/**`, no `src/main.ts`.

### The one box claimed — `pause scrim`, delta 0

`view.scrim` is `{ x: 0, y: 0, w: 1280, h: 800 }` — the viewport's own rect, **not** the card's —
and the frame draws `pause scrim` at `0, 0, 1280, 800`. It is claimed as-is, with **no** `at()`
lift: the scrim is the one rect the two sides share.

### The five candidates declared and not claimed

The card is the board's 360 px card with the game's **two** rows, so its height is the board's own
formula `88 + 56 × rows` at two rows = **200** against the frame's four-row **312**:
`dy +56, dh −112`. Every card-relative rect follows it by exactly 56 px.

| frame box | frame rect | shipped (`1280×800`) | delta |
| --- | --- | --- | --- |
| `pause panel` | `460, 244, 360, 312` | `view.box` = `460, 300, 360, 200` | dy **+56**, dh **−112** |
| `pause panel highlight` | `472, 256, 336, 1` | `at(view.box, view.highlight)` = `472, 312, 336, 1` | dy **+56** |
| `pause divider` | `484, 304, 312, 1` | `at(view.box, view.divider)` = `484, 360, 312, 1` | dy **+56** |
| `pause row 0` | `484, 320, 312, 48` | `at(view.box, view.rows[0].box)` = `484, 376` | dy **+56** |
| `pause row 1` | `484, 376, 312, 48` | `at(view.box, view.rows[1].box)` = `484, 432` | dy **+56** |

**The trap this table exists to stop.** The shipped `rows[1]` lands on the frame's `pause row 2`
rect (`484, 432, 312, 48`) to the pixel — by the 56 px pitch, not because it is the board's third
row. **Name the two row candidates `pause row 0` and `pause row 1`** (the row's index in the card's
own order, which is what `PauseRowView.index` carries), never `pause row 1` / `pause row 2`
positionally: a candidate named after the rect it lands on would be claimed at delta 0 and would
assert that the card's `Reset run` is the board's `OPTIONS`. The same reasoning applies to the
`pause label 1…3` nodes, which are not claimed at all (below).

**Declared in prose and not claimed:**

- `pause title` (`484, 264, 200, 30`): a **text node**, and its rect equals `view.title.box` +
  `view.box` to the pixel — declaring it as a box would report `missing`; it is claimed as the
  string `MENU`.
- `pause label 0…3` (`CONTINUE` / `OPTIONS` / `NEW RUN` / `EXIT`): the card's two labels are
  `Settings` and `Reset run`, so three of the board's four rows do not ship and the two the card
  draws are different words. None is claimed.
- `route screenshot` (`0, 0, 1280, 800`): the frame's painted scene; the route behind the card is
  the canvas and the dimming layer is the view's own `scrim` (already claimed under its own name).

### The one string claimed — `MENU`

The card prints, in draw order: `view.title.text` (`t('hud.menu')` = `MENU`), `Settings`,
`Reset run`. Implement `stringClaims` as a **filter** over those three lines against the spec's
text set (trim + upper-case both sides), never a literal list. Only `MENU` survives the fold;
`SETTINGS` and `RESET RUN` are not the board's `OPTIONS`/`NEW RUN` and are dropped.

`colours: []` — the card's fills, strokes and the selected row's accent wash are `pause.css`'s
tokens, not view literals.

## 🧩 Data and configuration

None. No new key, no new data table, no balancing value.

## 🧪 Test and Validation Plan (for QA)

QA runs this verbatim, on a clean integration worktree (this branch merged onto the batch base).

- **Method:**
  - `npm test` — Vitest, headless.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-255` against the exclusive-path list above.
  - The `[live]` criterion below needs its **own** `npm run dev -- --port <free> --strictPort`
    (own that port and tab) and the machine's headless Chromium over CDP; stop the server when
    done. Vite binds to `localhost` (IPv6 `::1`) — address it as `http://localhost:<port>`.
- **Expected state of the suite on this branch.** The adapter lands while its slug is still in
  `specGap.walk.test.ts`'s `PENDING` map, which the Orchestrator deletes in the merge commit. So
  `npm test` is expected to fail **exactly one** assertion:

  ```
  the spec gap, walked > accounts for every screen: mapped, or a named reason
  screens both mapped and pending: 03n-panels-pause-menu
  ```

  Every other test must pass and `npm run build` must be fully green. A second failing test file
  or a build error is a failure of this task.

- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is green.
  - [ ] `[unit]` `npm test` shows no failure other than the single documented
        `screens both mapped and pending: 03n-panels-pause-menu` assertion.
  - [ ] `[unit]` `src/ui/hud/panels/pause/specGap.test.ts` exists and passes, and it pins:
        `slug === '03n-panels-pause-menu'`; `gapFor(buildView(SPEC), SPEC)` is
        `{ missing: [], moved: [], strings: [], colours: [] }`; `buildView` twice is deep-equal.
  - [ ] `[unit]` It proves the one claim and the five empty ones: `boxes` is exactly
        `[{ name: 'pause scrim', x: 0, y: 0, w: 1280, h: 800 }]`; each of `pause panel`,
        `pause panel highlight`, `pause divider`, `pause row 0`, `pause row 1` is at the shipped
        rect above, outside `GAP_TOLERANCE` on `y`, and is **not** claimed.
  - [ ] `[unit]` It proves the naming trap: the shipped `rows[1]` rect equals the frame's
        `pause row 2` rect to the pixel, and no candidate is named `pause row 2`
        (`buildView(SPEC).boxes` carries no such name).
  - [ ] `[unit]` It proves the copy: `strings` is exactly `['MENU']`; `SETTINGS` and `RESET RUN`
        are not claimed, and the frame's `OPTIONS` / `NEW RUN` / `CONTINUE` / `EXIT` are not
        printed.
  - [ ] `[unit]` Nothing outside the three exclusive paths was touched.
  - [ ] `[unit]` The adapter imports no `phaser`, no DOM global and no `Math.random()`/`Date.now()`.
  - [ ] `[live]` **At a 1280×800 viewport**, on `http://localhost:<port>/?hud=dom&hudFixture=03n-panels-pause-menu`,
    the fixture card is mounted (`[data-hud-panel="pause"]` is present and not `hidden`) and the
    **measured** rects, read over CDP with `getBoundingClientRect()` and rounded, are exactly:
        - `[data-hud-pause="scrim"]` → `x 0, y 0, w 1280, h 800`
        - `[data-hud-panel="pause"]` → `x 460, y 300, w 360, h 200`
        - `[data-hud-pause-row="0"]` → `x 484, y 376, w 312, h 48`
        - `[data-hud-pause-row="1"]` → `x 484, y 432, w 312, h 48`
        - `[data-hud-pause="title"]`.textContent → `MENU`

    (Verified attainable on `main` before this task: the four rects and the title read exactly
    those values, so a red means the page was not the fixture card.) A `[live]` that compares
    **pixels** is not a criterion (`D57`); these are DOM rects and their text, and the canvas is
    not read.

## 📣 Coordination

- **For the Orchestrator:** at merge, delete the line
  `'03n-panels-pause-menu': 'the pause menu; no view builder is wired',` from
  `src/ui/hud/specGap.walk.test.ts`'s `PENDING` map and flip the row
  `| pause | 03n Panels · pause menu | \`03n-panels-pause-menu\` | 9 | 5 | 11 | pending |` to
  `wired` in `docs/hud-fidelity.md`.
- **For the next batch:** the pause card is then measured, and its 112 px shortfall against the
  board's four-row card is recorded rather than fixed. Shipping the board's `OPTIONS` / `NEW RUN`
  / `EXIT` rows is a separate product decision, not a fidelity fix.
- Commit with a subject in the house style (`hud: wire the pause menu to its 03n spec-gap
  adapter`), then leave the marker: an **empty** commit `dev: done task-255` on the tip of
  `task-255`, pushed to `origin`. Do not amend or rebase after the marker.

## ⛔ Out of scope

- Changing the card: `view.ts` keeps its two rows and its 200 px height; `pausePanel.tsx`,
  `pause.css` and `mount.tsx` are not touched.
- The frame's four-row card, its `CONTINUE` / `OPTIONS` / `NEW RUN` / `EXIT` labels, and any
  decision to ship them.
- Any other slug, any scene work, any new `?hudFixture=` preview.
- `specGap.walk.test.ts`, `docs/hud-fidelity.md`, `TODO.md`, `CHANGELOG.md`.
- New dependencies or a shared adapter base class.
