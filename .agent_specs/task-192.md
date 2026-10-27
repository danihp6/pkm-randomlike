# Spec: Task-192 — A move's name and category fit inside their cell, and the ⓘ stays clear

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD panel (view model + stylesheet + tests).
- **Role:** Dev.
- **Objective:** `[Task-189]` moved the moves window off the HP panel, but the text
  inside a cell still overflows. Measured on `main` @ `5b4629d`, `?hud=dom` at
  1280×800: in a 222×72 `battle-moves__slot` the name column is **68 px** and the
  category column **48 px**, while `MOFLETE ESTÁTICO` and `PHYSICAL` paint wider than
  both — the name runs into the category and the category runs under the 22-px ⓘ
  (`battle-moves__info` at x 710..732 beside a category box ending at 703). The boxes
  themselves do not intersect, which is why the shipped unit criterion passed; **the
  paint does**. After this task every label in a move cell is measured against the
  font the panel actually draws with, so each painted string is at most as wide as its
  own box: the name elides to fit its column (the ⓘ card still carries the full name),
  the category column is at least its widest label's measured width, and
  `category.right <= info.left` holds on those measured values at 1280 **and** at 390.
- **Environment:** worktree `../wt-pkm-192`, branch `task-192`.
- **Dependencies:** none — `[Task-189]` (the moves window's geometry and the `Rect`
  model) is merged on `main`.

### Exclusive paths (single writer)

- `src/ui/hud/panels/battle-moves/view.ts` and `view.test.ts`
- `src/ui/hud/panels/battle-moves/battleMoves.css`
- `src/ui/hud/panels/battle-moves/battleMoves.test.ts`, `fixture.test.ts`, `mount.tsx`,
  `battleMoves.tsx`, `index.ts` (only where a signature you change forces it)
- `src/ui/hud/panels/battle-moves/README.md` (only if you add, rename or delete a file)
- `docs/hud-fidelity.md` — **§5 only** ("Panel geometry"): append one rule saying a
  move cell's text is bounded by its own box. Do not touch §9 (another task of this
  batch holds it) and do not renumber.

`src/moveGrid.ts`, `src/ui/hud/panels/battle-hp/**`, `src/ui/hud/kit/**`,
`src/ui/hud/styles/root.css`, `src/data/ui/font.json`, `src/i18n/**` and
`src/scenes/**` are **not** yours.

### Inputs (read-only)

- `src/ui/hud/panels/battle-moves/view.ts`, `battleMoves.tsx`, `battleMoves.css`.
- `src/moveGrid.ts` (`moveGridCellRects`, `MoveGridCell`), `src/ui/hud/panels/battle-hp/view.ts`
  (`battleHpBox`).
- `src/data/ui/font.json` (the size-32 advances), `src/ui/hud/styles/root.css`
  (`--hud-type-body-size: 10px`, `--hud-type-tag-size`).
- `src/ui/evolutionGraph.test.ts` — the `drawnWidth` helper there is the precedent:
  sum the `xAdvance` of every code point from `font.json` and scale by
  `size / 32`. Your helper is the same arithmetic, in the panel, at the body size.
- `docs/hud-fidelity.md` §5.

## 🔒 Contract

### `view.ts` — measure before you paint

```ts
/** The drawn px of `text` at `size` (default: `--hud-type-body-size`, 10 px), from `font.json`. */
export function drawnTextWidth(text: string, size?: number): number;

/**
 * `text` reduced to the widest prefix that fits `width`, ending in `'…'` when a
 * glyph had to go; `text` itself when it already fits, `''` when nothing fits.
 * Total: a negative or zero width returns `''`.
 */
export function elideToWidth(text: string, width: number): string;
```

- `drawnTextWidth` must be computed from `src/data/ui/font.json`'s advances scaled by
  `size / 32` — **not** from a per-glyph constant. The `CATEGORY_CHAR_W = 6`
  approximation is what let the paint overflow; it goes.
- A filled slot's view grows the name column and prints an already-fitting name:

```ts
export type BattleMoveSlotView = Readonly<{
  // ... existing fields ...
  /** The name column: from the type chip's right edge to the category column, minus the gap. */
  nameBox: Rect;
  /** The name as painted: `elideToWidth(cell.name, nameBox.w)`, never wider than its box. */
  name: string;
}>;
```

  An empty slot's `nameBox` is a zero-width mark at the cell's right padding, the same
  rule its `categoryBox` already follows.
- The category column (`categoryBoxOf`) is sized from
  `Math.ceil(drawnTextWidth(<the widest category label>))` — `PHYSICAL` today, read the
  widest of the three labels rather than hardcoding eight glyphs — and stays
  right-aligned against the ⓘ's gap, clamped inside the cell's padding.
- **The invariant, true of every filled slot of every grid:**
  `drawnTextWidth(slot.name) <= slot.nameBox.w + 0.01`,
  `drawnTextWidth(slot.category) <= slot.categoryBox.w + 0.01`,
  `slot.nameBox.x >= slot.box.x + CELL_PAD_X`, and
  `slot.categoryBox.x + slot.categoryBox.w <= slot.info.x` (the ⓘ's 22 px stay clear).
- The floating card (`view.info`) keeps printing the **full** name — it is where a
  long move's name is still readable. Its own boxes must not regress.

### `battleMoves.css`

- The name's column, the category's absolute column and the 22-px ⓘ keep the same
  numbers as the model; where the stylesheet hardcodes a width or inset that the model
  now derives, the number and the model must agree (write the one comment that says
  which constant they mirror). `.battle-moves__name` keeps `overflow: hidden` and
  `text-overflow: ellipsis` as a belt-and-braces guard, but the model is what makes
  the string fit.
- No colour, radius, border or spacing change outside the cell's own box maths.

### Determinism

Pure functions only: no RNG, no clock, no DOM read, no `window`. `drawnTextWidth` and
`elideToWidth` must run headless in Vitest.

## 🧩 Data and configuration

No new data, no new i18n key, no new dependency. The body size is read from the
stylesheet's own value (`--hud-type-body-size`, 10 px today); if you pin it in the
module, one test must assert the pinned number and the CSS variable agree by parsing
`src/ui/hud/styles/root.css`.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; must be green, including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-192` audit against the exclusive paths
    (and `docs/hud-fidelity.md` must show one hunk, in §5).
  - One browser pass for the two `[live]` criteria: `npm run dev -- --port <free>
    --strictPort`, Chromium headless, `?hud=dom`, CDP `Runtime.evaluate` with
    `getBoundingClientRect()` and `scrollWidth`/`clientWidth`; no screenshot.
  - Reaching a battle: use the dev-only overlay (`src/dev/debugMenu.ts`, dev server
    only) to launch a wild battle, then press the FIGHT key (or click the first move
    cell) so the four-move grid is on screen. The party's first member must have four
    moves; the debug overlay can raise its level if its moveset is short.
- **Acceptance criteria:**
  - [ ] `[unit]` `npm run build` is clean and `npm test` is green.
  - [ ] `[unit]` `drawnTextWidth('PHYSICAL')` is greater than `8 * 6` (the retired
    approximation) and `drawnTextWidth('') === 0`; `drawnTextWidth(text, 20)` is twice
    `drawnTextWidth(text, 10)`.
  - [ ] `[unit]` `elideToWidth`: returns the input unchanged when it fits; otherwise a
    string ending in `'…'` whose `drawnTextWidth` is `<= width` and which is longer
    than the longest fitting prefix without the ellipsis; `elideToWidth('X', 0) === ''`.
  - [ ] `[unit]` for a four-slot grid at 1280×800 containing a long name
    (`MOFLETE ESTÁTICO`) and a `PHYSICAL` category, every filled slot satisfies the four
    invariants of the contract — computed from the model's own `drawnTextWidth`, not
    from the box numbers alone.
  - [ ] `[unit]` the same invariants hold on the compact grid (`BATTLE_COMPACT`, a
    square below 700) and on a fixture with an empty slot and a one-move party.
  - [ ] `[unit]` `git diff --name-only origin/main...task-192` lists only the exclusive
    paths; `src/moveGrid.ts`, `src/ui/hud/styles/root.css` and `src/scenes/**` are
    absent.
  - [ ] `[live]` **Nothing overflows at 1280×800.** With FIGHT open on a four-move
    grid, for every `.battle-moves__slot` non-empty: `.battle-moves__name` and
    `.battle-moves__category` each report `scrollWidth <= clientWidth + 1`, and
    `category.getBoundingClientRect().right <= info.getBoundingClientRect().left`.
    Method: CDP `Runtime.evaluate`.
  - [ ] `[live]` **The same holds at 390×844.** Reload at 390×844 (the stacked phone
    card), reopen FIGHT and re-read the same four numbers per slot. Method: same CDP
    read; the assertion is identical.
  - [ ] `[live]` **The ⓘ keeps its 22 px and its card.** On the same grid, each ⓘ's
    `getBoundingClientRect()` is 22×22 and the floating card that opens on it prints
    the **full** move name (compare it with the run's move list). Method: CDP
    `Runtime.evaluate` on the card's title node.

## 📣 Coordination

- For the Architect: the panel's text is now measured from `font.json` at the body
  size; `CATEGORY_CHAR_W` is retired, so any later label in this panel must go through
  `drawnTextWidth`.
- For the next batch: `drawnTextWidth` / `elideToWidth` live in this panel's `view.ts`
  and are reusable; they were deliberately not promoted to `src/ui/hud/` to keep this
  task's paths single-writer.
- For QA: the unit criterion that shipped with `[Task-189]` compared **model rects**
  only, which is exactly the hole this task closes; your check must use
  `drawnTextWidth` on the painted strings (unit) and the DOM's own `scrollWidth`
  (live), never the rects alone.

## ⛔ Out of scope

- The canvas (Phaser) battle HUD's own move cells.
- Changing the battle's layout, the HP panel, the Mega/◀ controls or the stage size.
- Re-wrapping the name onto two lines, shrinking the cell's font, or dropping the
  category label.
- `docs/hud-fidelity.md` §9, `src/i18n/**`, `src/moveGrid.ts`.
