# Spec: Task-191 — The narrow CONTINUE row stops painting its portraits over the map label

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD panel (view model + stylesheet + tests).
- **Role:** Dev.
- **Objective:** at 390×844 the main menu's CONTINUE row paints **four 22-px
  portraits over the map label**: the row is 326×48 at (32, 402), the portraits occupy
  x 258..355 and `MAP 3 · FOREST` is drawn **under** them, so the word is unreadable
  (measured on `main` @ `5b4629d`). At 1280×800 the same row is 420 px wide with the
  portraits at x 922..1038 and the label clear to their right, so the defect is the
  **compact layout** alone. After this task the compact row carries **one** secondary
  datum — the portraits, which are the row's point (decision of `2026-10-27`) — and
  the map label is simply absent there; the desk layout keeps both, exactly as it
  ships. No two rects of the row intersect at either width.
- **Environment:** worktree `../wt-pkm-191`, branch `task-191`.
- **Dependencies:** none — `[Task-188]` (the portraits in the CONTINUE row and the
  compact footer) is already merged on `main`, as are `portraitCrop` /
  `portraitBackground` in `src/ui/hud/portrait.ts`.

### Exclusive paths (single writer)

- `src/ui/hud/panels/main-menu/view.ts` and `view.test.ts`
- `src/ui/hud/panels/main-menu/mainMenuPanel.tsx`
- `src/ui/hud/panels/main-menu/main-menu.css`
- `src/ui/hud/panels/main-menu/preview.ts`, `preview.test.ts`, `fixture.test.ts`,
  `index.ts` (only if a signature you change forces it — do not restructure them)
- `src/ui/hud/panels/main-menu/README.md` (only if you add, rename or delete a file)
- `docs/hud-fidelity.md` — **§9 only** ("Portraits in the DOM HUD"): append one
  paragraph about the narrow CONTINUE row's one datum. Do not renumber, do not touch
  §5 or any other section (another task of this batch holds §5).

`src/ui/hud/portrait.ts`, `src/i18n/**`, `src/scenes/**`, `src/ui/runSummary.ts` and
`docs/design-spec.md` are **not** yours.

### Inputs (read-only)

- `src/ui/hud/panels/main-menu/view.ts` (the board's two rect tables and
  `liveMainMenuView`), `mainMenuPanel.tsx`, `main-menu.css`.
- `src/ui/runSummary.ts` (`runPositionLabel`, which builds the label),
  `src/ui/hud/portrait.ts`, `src/ui/hud/styles/root.css`.
- `docs/hud-fidelity.md` §9, `docs/design-spec.md` §2's first bullet (it already says
  the narrow CONTINUE row shows the party).

## 🔒 Contract

### `view.ts` — a pure layout transform

```ts
/** The board's two layouts: the desk frame (`01`) and the phone frame (`m01`). */
export type MainMenuLayout = 'wide' | 'compact';

/**
 * The view as one layout draws it. `'compact'` drops the CONTINUE row's secondary
 * datum — the map/biome label — because the row's 326 px at 390×844 hold the
 * portraits and nothing else; every other field, every other row and the portrait
 * list itself are returned **unchanged**. `'wide'` returns the very same object.
 */
export function forLayout(view: MainMenuView, layout: MainMenuLayout): MainMenuView;
```

- `forLayout(view, 'wide')` must return `view` **identically** (`toBe`), so the desk
  path is provably untouched.
- `forLayout(view, 'compact')` returns a new view whose only difference is the row
  with `id === 'continue'` carrying `value: ''`; its `label`, `enabled` and its
  position in `rows` are unchanged, `portraits` is unchanged (and non-empty when it
  was), and `selected`, `title`, `stats` and `version` are the same values.
- Nothing in the transform removes the portraits, drops the row, or elides the label
  to fewer letters: the **label is absent** in compact, the portraits stay.
- `liveMainMenuView(run, index)` keeps its signature and its wide output.

### `mainMenuPanel.tsx`

- The panel already knows the breakpoint (`useCompactViewport()`, driven by
  `MAIN_MENU_NARROW_QUERY`). It renders `forLayout(view, compact ? 'compact' : 'wide')`
  — the transform is applied **in the panel**, so a resize flips the row without the
  scene re-mounting it.
- The existing empty-value rule (`row.value === '' ? null : …`) stays: an absent datum
  paints no element at all, so no glyph of the label can reach the screen.
- No new DOM node, no new class name, no i18n key.

### `main-menu.css`

- If, and only if, the compact block still sizes anything off the value
  (`.main-menu__value` inside the continue row), remove that rule so the compact row
  lays out for the portraits alone. The desk rules stay byte-for-byte.
- The portraits' compact geometry (`22` px, pitch `25`, from
  `MAIN_MENU_BOARD_NARROW.portrait`) and `MAIN_MENU_FOOTER_NARROW` do not move.

### Determinism

No RNG, no clock, no network. `forLayout` is pure and total (an unknown layout value
falls back to `'wide'`).

## 🧩 Data and configuration

No new data. No new i18n key. The label's own text stays
`runPositionLabel(run)` (`'MAP 3 · FOREST'`), which is data the STATS and route HUDs
still read.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-191` audit against the exclusive paths
    (and `docs/hud-fidelity.md` must show one hunk, in §9).
  - One browser pass for the `[live]` criteria: `npm run dev -- --port <free>
    --strictPort`, Chromium headless, CDP `Runtime.evaluate` for
    `getBoundingClientRect()`; no screenshot.
- **Building the fixture party for the pass (do this first):** open the game at
  1280×800, start **New run**, confirm the first starter with `E` (the run is
  persisted), then read `localStorage.getItem('pokerandomlike.save')` and, in
  `Runtime.evaluate`, parse it, **duplicate `run.party[0]` twice** with
  `fighter.id` set to `'p2'`/`'p3'` (and `'p1'` for the second copy), write the
  document back with `localStorage.setItem`, and reload. The menu now shows a
  four-member CONTINUE row.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `view.test.ts`: `forLayout(view, 'wide')` returns the same object and
    keeps the CONTINUE row's `value === 'MAP 3 · FOREST'`; `forLayout(view, 'compact')`
    returns that row with `value === ''` and **all four** portraits, with every other
    row, `selected`, `title` and `stats` deep-equal to the wide view's.
  - [ ] `[unit]` `view.test.ts`: a view with no run (`portraits: []`, no continue row)
    passes through both layouts unchanged.
  - [ ] `[unit]` `git diff --name-only origin/main...task-191` lists only the
    exclusive paths; `src/scenes/**` and `src/ui/runSummary.ts` are absent.
  - [ ] `[live]` **At 390×844 the label is gone and the portraits are whole.** With the
    four-member save, at 390×844, `Runtime.evaluate` returns
    `null` for
    `document.querySelector('[data-hud-main-menu-row="continue"] .main-menu__value')`
    and `4` for
    `document.querySelectorAll('[data-hud-main-menu-row="continue"] [data-hud-main-menu-portrait]').length`;
    every portrait's `getBoundingClientRect()` has `width === 22` and sits fully inside
    the row's rect (32..358), and **no** portrait rect intersects the row's label
    rect. Method: CDP `Runtime.evaluate` with `getBoundingClientRect()` arithmetic.
  - [ ] `[live]` **At 1280×800 both are there and clear.** Reload at 1280×800: the
    `.main-menu__value` node exists inside the CONTINUE row, its text is
    `/^MAP \d+ · /`, and its rect does not intersect any portrait rect (the portraits
    sit to its right). Method: same CDP read.
  - [ ] `[live]` **Nothing else on the menu moved.** At both widths the CONTINUE row's
    own rect is still 326×48 at (32, 402) on the phone and 420 px wide on the desk,
    and the three footer blocks still hold their `MAIN_MENU_FOOTER_NARROW` rects at
    390. Method: `getBoundingClientRect()` on `[data-hud-main-menu-row="continue"]`
    and `[data-hud-main-menu-footer]`'s blocks.

## 📣 Coordination

- For the Architect: the decision of `2026-10-27` is applied literally — the
  **portraits** are the datum that stays on the phone and the **map/biome label** is
  dropped there (not elided, not moved); the desk keeps both. `Task-188`'s compact
  footer and portrait geometry are untouched.
- For the next batch: `forLayout(view, layout)` is the seam any later compact rule
  uses; the fixture preview path keeps building both fields from the frames.
- For QA: the desktop path is provably unchanged (`'wide'` returns the same object),
  so a desk-only visual diff is not evidence of anything.

## ⛔ Out of scope

- The canvas (Phaser) main menu, which draws its own row.
- `docs/design-spec.md` §2's first bullet: it already states the narrow row shows the
  party; only `docs/hud-fidelity.md` §9 gains the sentence this task owes.
- Eliding the label to three letters, moving it into a tooltip, or adding a second
  compact row.
- Any change to the footer's blocks, the portrait atlas seam, or the STATS board.
