# Spec: Task-215 — The desk CONTINUE row elides its map label before the portraits

> Read `AGENTS.md` first. This file is your whole world. Work only inside the
> worktree `../wt-pkm-215` on branch `task-215`, base `origin/main`.

## 🎯 Scope

- **Task type:** DOM HUD panel (TypeScript + CSS), pure view model + Preact paint.
- **Role:** Dev.
- **Objective:** at 1280×800 the main menu's CONTINUE row prints its right-aligned
  value (`MAP 1 · DEEP FOREST`) and the fourth party portrait is painted **on top of
  its last glyphs**: measured on the merged `[Task-191]` tree, `.main-menu__value` is
  `{x: 1010.98, y: 322, w: 147.02, h: 15}` and the fourth portrait is
  `{1012, 314, 26, 26}`, so 26 × 15 px of the label sits under the portrait. The
  frame's own short label (`MAP 3 · FOREST`, 109.5 px) clears by 10.48 px, which is
  why the board never showed it. After this task the row **reserves the portraits'
  block and the label takes what is left, elided** (`MAP 1 · DEEP FO…`); the wide
  layout keeps both, the compact row is untouched.
- **Environment:** worktree `../wt-pkm-215`, branch `task-215`.
- **Dependencies:** `[Task-211]` (merged) — it added the fifth row (`ranking`) and
  recomputed the card and the compact footer; the row you bound is that row.

### Exclusive paths (single writer)

- `src/ui/hud/panels/main-menu/**` (view model, tests, `mainMenuPanel.tsx`,
  `main-menu.css`, `README.md`)
- `docs/hud-fidelity.md` §9 — **only** the block that states the desk row's label is
  bounded by the portraits. Do not edit any other section of that file.

`src/scenes/MainMenuScene.ts` is **not** yours: the scene builds the view through
`liveMainMenuView`, and you change the view's shape, not the scene's. If the scene's
own test breaks because a row field moved, change **only** the assertion that reads
that field, and say so in the report.

### Inputs (read-only)

- `src/ui/hud/panels/main-menu/view.ts`, `mainMenuPanel.tsx`, `main-menu.css`,
  `view.test.ts`, `main-menu.test.ts` (the folder's tests)
- `src/ui/hud/portrait.ts` (`portraitBackground`, `portraitCrop`)
- `design/fixtures/01-main-menu.json`, `design/screens/01-main-menu.png`
- `docs/hud-fidelity.md` §9, `docs/design-spec.md` §2
- `src/i18n/en.ts` (`menu.continue`)

## 🔒 Contract

### TypeScript (`src/ui/hud/panels/main-menu/view.ts`)

```ts
export type MainMenuView = Readonly<{
  // …unchanged fields…
  /** The CONTINUE row's portraits' block, in the view's own px space; null with no portraits. */
  portraitsBox: Rect | null;
}>;

export type MainMenuRowView = Readonly<{
  id: MainMenuRowId;
  label: string;
  /** The value as painted: already elided to `valueBox.w` when it did not fit. '' = no node. */
  value: string;
  /** The box the value is painted in; null exactly when `value` is ''. */
  valueBox: Rect | null;
  enabled: boolean;
}>;
```

- **The wide layout**: the CONTINUE row's `valueBox` ends at the portraits' block's
  left edge minus the row's own gap — `valueBox.x + valueBox.w <= portraitsBox.x`
  for any number of portraits (1 to 4) and any label length. `portraitsBox` is the
  strip the panel paints (the `.main-menu__portraits` box), computed from the same
  layout constants the card already uses, not from a DOM read.
- The label is **elided** with `…` to `valueBox.w` by the view (the same
  "cut to the box width" rule `src/ui/hud/panels/battle-moves/view.ts` uses for a
  move's name: uppercase measuring against the Silkscreen advance). A value that
  already fits is returned verbatim — no ellipsis, no padding.
- **The compact layout** is untouched: `forLayout(view, 'compact')` still drops the
  CONTINUE row's value (`value: ''`), so `valueBox` is `null` there and no compact CSS
  rule may size a value node. `portraitsBox` is still returned (the phone row carries
  the portraits alone).
- A run with **no** portraits (`portraits: []`): `portraitsBox` is `null` and the value
  box ends at the row's own right edge (today's behaviour).
- The locale table is read through `t('menu.continue')`; nothing is hard-coded.
- Rects are plain `{ x, y, w, h }` numbers in the frame's px space, like every other
  rect in the view.

### Paint (`mainMenuPanel.tsx` + `main-menu.css`)

- The value keeps its class `main-menu__value` and gains its width from the view: when
  `valueBox` is non-null the span is bounded by `valueBox.w` (`white-space: nowrap;
  overflow: hidden` is **not** the fix — the text is already elided; the bound exists so
  a font fallback cannot re-open the overlap) and the portraits block keeps its own
  slot to the row's right.
- No glyph of the value may be painted outside `valueBox`.

### Determinism

- Reads no RNG; the preview seed's behaviour is unchanged.

## 🧪 Test and Validation Plan (for QA)

- **Method**
  - `npm test` — Vitest, headless; must be green including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-215` audited against the exclusive paths.
  - **Live pass:** `npm run dev -- --port 5199 --strictPort`,
    `google-chrome --headless=new --no-sandbox --remote-debugging-port=9222
    --window-size=1280,800 about:blank`, CDP `Runtime.evaluate` over
    `http://localhost:9222/json` (Node 22's global `WebSocket`). Seed a save with four
    members and a long map name in `localStorage`, reload `/`, then read rects.
- **Acceptance criteria**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `liveMainMenuView(...)` on a run at map 1 in the deep-forest biome
        with four party members, wide layout: the CONTINUE row's `valueBox` is non-null,
        `valueBox.x + valueBox.w <= portraitsBox.x`, and `portraitsBox` is non-null.
  - [ ] `[unit]` the same view with **no** run returns `portraitsBox === null`, no
        CONTINUE row and every other row's `valueBox === null`.
  - [ ] `[unit]` a label that does not fit is returned with a trailing `…` and a label
        that fits is returned verbatim; the elided string's measured width is `<=`
        `valueBox.w` (Silkscreen advance).
  - [ ] `[unit]` `forLayout(view, 'compact')` still returns the CONTINUE row's `value: ''`
        and `valueBox: null`, and every other field and row unchanged.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 1280×800 with four members and a long map name: read
        `document.querySelector('.main-menu__row[data-hud-main-menu-row="continue"] .main-menu__value').getBoundingClientRect()`
        and the **last** `.main-menu__portrait`'s rect; assert
        `value.right <= portrait.left` (tolerance 1 px) — the case that today overlaps
        by 26 px — and the value's own text ends in `…`.
  - [ ] `[live]` at 390×844 the compact menu still shows the CONTINUE row with its
        portraits and **no** value node
        (`document.querySelectorAll('.main-menu__value').length === 0`).

## 📣 Coordination

- For the Architect: the row view now carries `valueBox` and the view `portraitsBox`;
  a later row-level task (for example a footer or records change) can read the same
  geometry instead of re-deriving it.
- For the next batch: `docs/hud-fidelity.md` §9's new sentence is the rule — a desk
  row's value never reaches under its portraits.

## ⛔ Out of scope

- The compact row's layout, the footer, the glow, the route preview, the walkers
  (`[Task-219]` owns those).
- Changing `MAIN_MENU_ROW_IDS`, the number of rows, or `src/scenes/MainMenuScene.ts`'s
  behaviour.
- Re-styling the portrait cells or their scale.
