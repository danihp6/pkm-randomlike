# Spec: Task-240 — The title screen is wired to its spec (`01-main-menu`)

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** HUD panel (Preact over the `#hud` layer) — DOM only: no engine rule,
  no Phaser scene, no data table, no asset.
- **Role:** Dev.
- **Objective:** after this task the frame `01 Main menu` is **measured** instead of
  `pending`: a new adapter `src/ui/hud/specGap.views/main-menu.ts` builds the main
  menu's `PanelView` from the panel's own view model over
  `design/fixtures/01-main-menu.json` at 1280×800, narrows it to the boxes and
  strings the frame actually draws, and every fact it does not claim is written down
  in the adapter's comment with its measured delta and the shipped decision behind it.
  `gapFor(buildView(spec), spec)` reports nothing. No game behaviour and no pixel of
  the running menu changes.
- **Environment:** worktree `../wt-pkm-240`, branch `task-240`.
- **Dependencies:** none. The adapter contract (`src/ui/hud/specGap.views/README.md`,
  `specGap.ts`, `specGap.walk.test.ts`) and the worked precedent
  `src/ui/hud/specGap.views/notices.ts` are already merged.

### Exclusive paths (single writer)

- `src/ui/hud/specGap.views/main-menu.ts` — new.
- `src/ui/hud/panels/main-menu/specGap.test.ts` — new.
- `src/ui/hud/panels/main-menu/README.md` — one new line in its `## Layout` list.

**Nothing outside this list.** In particular, these two are **the Orchestrator's at
merge, not yours** — do not touch them, and do not "fix" the red they cause:

- `src/ui/hud/specGap.walk.test.ts` — its `PENDING` line for `01-main-menu` is deleted
  at merge. While it is still there, the walker **fails on purpose**: its case
  `accounts for every screen: mapped, or a named reason` reports
  `screens both mapped and pending: 01-main-menu`. That single red is the expected
  state of your branch.
- `docs/hud-fidelity.md` — its `01-main-menu` row flips from `pending` to `wired` at
  merge, in the same push.

Also do not touch `design/screens/**`, `design/exports/**`, `design/fixtures/**`,
`src/ui/hud/specGap.ts`, `src/ui/hud/specGap.views/notices.ts`, `src/scenes/**`,
`src/engine/**` or `package.json`.

### Inputs (read-only)

- `AGENTS.md`, `docs/agent-spec-template.md`, `docs/hud-fidelity.md` (§9 and the
  `The spec gap, measured (D57)` table), `design/README.md`.
- `design/screens/01-main-menu.json` and `design/exports/01-main-menu.png` — frame
  **`01 Main menu`** (`design/board.json` node `1:1556`, viewport 1280×800). The frame
  carries **16 boxes, 16 strings, 13 colours**. Frame `01b Main menu · no save` is
  **not** this task (Batch 115).
- `design/fixtures/01-main-menu.json` — the panel's own copy: a `state` block (party,
  bag, money, route…) and a `menu` block (`title`, `version`, `selected`, five `rows`,
  three `stats`).
- `src/ui/hud/panels/main-menu/` — the whole folder, especially `view.ts`
  (`fixtureMainMenuView`, `MainMenuView`, `MAIN_MENU_BOARD`,
  `MAIN_MENU_CARD_H`, `mainMenuPortraitsBox`, `MAIN_MENU_GLOW`) and its `README.md`.
- `src/ui/hud/specGap.ts`, `src/ui/hud/specGap.test.ts`,
  `src/ui/hud/specGap.walk.test.ts`, `src/ui/hud/specGap.views/README.md`,
  `src/ui/hud/specGap.views/notices.ts`.

## 🔒 Contract

`src/ui/hud/specGap.views/main-menu.ts` exports exactly two names, like every adapter:

```ts
export const slug = '01-main-menu';
export function buildView(spec: ScreenSpec): PanelView;
```

- `buildView` imports `design/fixtures/01-main-menu.json` as a module default and calls
  `fixtureMainMenuView(fixture)` (module `src/ui/hud/panels/main-menu`). That is the
  same projection the running panel paints; never read a run, a scene, a store, the
  clock or the RNG.
- The desktop viewport is a local `const DESKTOP = { width: 1280, height: 800 }`.
- **Boxes** (page coordinates, named exactly as the frame names them) — exactly these
  nine, taken from the panel's own geometry:

| name | source | expected rect |
| --- | --- | --- |
| `glow` | `view.glow.box` (`MAIN_MENU_GLOW.box`) | `-180, -140, 1000, 720` |
| `accent rule` | `MAIN_MENU_BOARD.rule` | `724, 204, 88, 3` |
| `route window` | `MAIN_MENU_BOARD.window` | `96, 150, 560, 380` |
| `stats rule` | `MAIN_MENU_BOARD.footerRule` | `96, 592, 520, 1` |
| `version` | `MAIN_MENU_BOARD.version` | `1065, 750, 122, 15` |
| `row sel CONTINUE` | row `continue` at `MAIN_MENU_BOARD.row` | `744, 300, 420, 54` |
| `row NEW RUN` | row `new` | `744, 362, 420, 54` |
| `row OPTIONS` | row `options` | `744, 424, 420, 54` |
| `row STATS` | row `stats` | `744, 486, 420, 54` |

  The row rects are `{ x: row.x, y: row.top + index * row.pitch, w: row.w, h: row.h }`
  (`MAIN_MENU_BOARD.row`), which is the pitch `main-menu.css` draws
  (`padding-top 63px`, `gap 8px`, `54px` rows).
- **Strings** — the view's copy, in this order: `view.title`, `view.version` (skip
  when `null`), the four row labels (`CONTINUE`, `NEW RUN`, `OPTIONS`, `STATS`), the
  rows' non-empty painted `value`s (the fixture paints `MAP 3 · FOREST` and
  `NEW SEED`), the three stat `label`s (`WINS`, `MAX ELITE STRIKE`,
  `MONTHLY MAX STRIKE`), the three stat `value`s (`23`, `2`, `7`) and the non-null
  stat `name` (`NOVA`). `gapFor` folds case, so caps are the frame's business.
- **Colours:** `[]`. The panel paints its fills and borders from the stylesheet's
  `styles/root.css` tokens, so its view model carries no colour literal.
- **Determinism:** reads no `Rng`, no clock, no store. `mainMenuRecords` is **not**
  called (it reads the run history and the calendar); the footer comes from the
  fixture's `menu.stats`.
- You may read `spec` only as a **structural selector** (as `notices.ts` does: is this
  box in the frame at all). Never filter strings or colours by the spec's content —
  that would make the comparison tautological.

### The boxes and strings this view does **not** claim

Put this list, with the measured delta and the reason, in a doc comment above
`buildView` (this is the record the frame exists for):

- `menu card` — the frame draws `724, 236, 460, 362`; the panel draws
  `460 × MAIN_MENU_CARD_H[5] = 372` because the shipped card has **five** rows
  (`docs/hud-fidelity.md` §5, "The menu card's five rows"; the board has no node for
  the fifth). Delta `dh = +10`. Claiming it would report a `moved` gap that only a
  behaviour change could close.
- `card highlight` — the kit `Panel`'s 1 px inset highlight, painted by CSS
  (`(x+12, y+12, w-24, 1)`), not carried by the view.
- `slot 0` … `slot 3` — the four party cells. The view carries one block
  (`view.portraitsBox`), right-aligned at `1042 … 1158`; the frame draws the four
  separate cells at `922 … 1038`. The panel keeps the board's cell size and pitch, and
  the block position is `docs/hud-fidelity.md` §9's decision. Not claimable.
- `window base` — the route preview's clipped tile layer, a stylesheet node.
- the cursor `>` of `row sel CONTINUE` — the `.main-menu__cursor` node, painted by the
  panel, not carried by the view.
- the fifth row (`RANKING`) — neither a box nor the string `RANKING` exists in frame
  `01`; it is in `01b`'s family and the board's card predates the row. Do **not** emit
  `RANKING`; the fixture's fifth row is projected away by naming only the four rows
  above.

If the walker's `strings` list reports the CONTINUE row's value, the painted value was
elided to its 124 px box (`elideValue`, four portraits) and the frame's `row value
CONTINUE` is not elided: drop that string, and record the delta and the reason in the
same comment. Do not change `view.ts` to make it fit.

## 🧩 Data and configuration

None. No new key, no new default, no balancing value, no run field, no save version
step. The fixture is read-only.

## 🧪 Test and Validation Plan (for QA)

- **Method:** run from the task's worktree. `npm test` — Vitest, headless.
  `npm run build` — `tsc --noEmit && vite build`.
  `git diff --name-only main...task-240` — audit against the exclusive paths.
  One `[live]` pass, in the browser, below.
- **Acceptance criteria:**
  - [ ] `[unit]` `npx vitest run src/ui/hud/panels/main-menu/specGap.test.ts` is green.
    That file asserts: `slug === '01-main-menu'`; the emitted box names are exactly the
    nine in the Contract table, each with its rect; every emitted name exists in
    `design/screens/01-main-menu.json`'s named boxes; the emitted string list equals
    the pinned literal list in the test; `gapIsEmpty(gapFor(buildView(spec), spec))` is
    `true`.
  - [ ] `[unit]` `npm test` fails **only** in
    `src/ui/hud/specGap.walk.test.ts` → `accounts for every screen: mapped, or a named
    reason`, with the message `screens both mapped and pending: 01-main-menu`. That red
    is the Orchestrator's `PENDING` flip at merge. No other test fails — quote the
    summary line in the report.
  - [ ] `[unit]` `npm run build` exits 0.
  - [ ] `[unit]` `git diff --name-only main...task-240` lists exactly
    `src/ui/hud/specGap.views/main-menu.ts`,
    `src/ui/hud/panels/main-menu/specGap.test.ts` and
    `src/ui/hud/panels/main-menu/README.md`. Nothing under `design/`, `src/scenes/`,
    `src/engine/` or `.agent_specs/`.
  - [ ] `[unit]` `grep -c "pending" docs/hud-fidelity.md` is unchanged (the row is the
    Orchestrator's) and `git diff` shows no change to
    `src/ui/hud/specGap.walk.test.ts`.
  - [ ] `[live]` At **1280×800** on `?hud=dom&hudFixture=01-main-menu`, measured over
    CDP with `getBoundingClientRect()`: `[data-hud-main-menu-window]` is
    `96, 150, 560, 380`; `[data-hud-main-menu-row="stats"]` is `744, 486, 420, 54`;
    `[data-hud-main-menu-card]` is `724, 236, 460, 372` (the shipped five-row card, so
    ±1 px against 372 — the 10 px against the frame is the recorded delta);
    `[data-hud-main-menu-version]` is `1065, 750, 122, 15`. `[data-hud-panel="main-menu"]`
    must be the mounted root.
- **A `[live]` that compares pixels is not a criterion** (`D57`): fidelity is read from
  `design/screens/01-main-menu.json`, never from a screenshot diff.

## 📣 Coordination

- **For the Orchestrator:** at merge, delete `'01-main-menu'` from the `PENDING` map in
  `src/ui/hud/specGap.walk.test.ts` **and** flip the `01-main-menu` row of
  `docs/hud-fidelity.md`'s `The spec gap, measured (D57)` table to `wired` — one push,
  and the walker's "both mapped and pending" red clears. `01b-main-menu-no-save` stays
  `pending` (Batch 115) and shares the same panel folder; do not touch its row.
- **For the next batch:** the adapter for `01b-main-menu-no-save` must reuse
  `fixtureMainMenuView` and the same nine claimed boxes against `01b`'s spec; the two
  adapters live in different files, so they can ride the same batch.
- **Do not** put a test file inside `src/ui/hud/specGap.views/`: the walker globs
  `./specGap.views/*.ts` and treats **every** module there as an adapter, so a
  `*.test.ts` beside an adapter registers an adapter with an `undefined` slug and
  breaks the walker. The test belongs under the panel's folder, as specified above.

## ⛔ Out of scope

- Changing `main-menu/view.ts`, `main-menu.css`, `mainMenuPanel.tsx` or the scene to
  make a box or string match the frame. The nine claimed facts are the panel's own
  geometry and copy; everything else is a recorded delta.
- The `01b` frame, the phone layout (`m01`), the fifth row's layout, the route
  preview's animation, the footer's live figures, the version line's build stamp.
- Touching `specGap.ts`, the walker, `docs/hud-fidelity.md`, `design/**` or any test
  other than the one this task adds.
- New dependencies, refactors of `notices.ts`, prettier sweeps of unrelated files.
