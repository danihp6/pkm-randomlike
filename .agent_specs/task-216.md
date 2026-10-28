# Spec: Task-216 — A phone move cell paints the move's name

> Read `AGENTS.md` first. This file is your whole world. Work only inside the
> worktree `../wt-pkm-216` on branch `task-216`, base `origin/main`.

## 🎯 Scope

- **Task type:** DOM HUD panel (TypeScript + CSS), pure view model + Preact paint.
- **Role:** Dev.
- **Objective:** at 390×844 with FIGHT open, issue #76 measured the move card at
  358×236 in (16, 592) and each `.battle-moves__slot` at **119×94**, a 91-px content
  box, and every filled slot's name column came out at `clientWidth: 0` with an empty
  `textContent` — a phone player chooses between four **unnamed** moves. At 1280 the
  same grid gives the name 96 px and paints it. After this task the compact cell
  **drops what it cannot show** — the category column becomes the type chip alone
  (icon, no word) and the accuracy moves to the second row — so the name keeps a real
  column in all four filled slots at both widths, while the wide layout is untouched.
- **Environment:** worktree `../wt-pkm-216`, branch `task-216`.
- **Dependencies:** `[Task-214]` (merged) — it removed the per-cell ⓘ and its 22-px
  reserve and made the cursor's move the card, so the column you are re-flowing is the
  post-214 one. `[Task-193]`, `[Task-196]` and `[Task-203]` are merged too (same view,
  the icon badges). **Re-measure before you change anything:** the ⓘ is already gone,
  so if a compact slot already paints its name at 390×844, say so in the report and
  close the remaining gaps the criteria name rather than "fixing" a shipped behaviour.

### Exclusive paths (single writer)

- `src/ui/hud/panels/battle-moves/**` (view model, tests, `battleMoves.tsx`,
  its CSS, `README.md`)
- `docs/hud-fidelity.md` §5 — **only** the block that states a phone cell's columns.
  No other section of that file.

### Inputs (read-only)

- `src/ui/hud/panels/battle-moves/view.ts` (`cellTextBoxes`, `compactCellTextBoxes`,
  `wideCellTextBoxes`, `slotView`, `CATEGORY_LABELS`), `battleMoves.tsx`, its CSS,
  `view.test.ts`
- `src/ui/hud/panels/battle-moves`'s sibling panels for the card's geometry only
- `src/ui/hud/kit/**` (the type badge and the category glyph, read-only)
- `docs/hud-fidelity.md` §5, `docs/battle-spec.md` §4

## 🔒 Contract

### TypeScript (`src/ui/hud/panels/battle-moves/view.ts`)

```ts
export type BattleMoveSlotView = Readonly<{
  // …unchanged fields…
  /** The category **word** as painted; '' when the layout draws the chip alone. */
  categoryLabel: string;
}>;
```

- **Compact (`compact: true`)**
  - The category column paints the **type chip alone** (the category glyph, no word):
    `categoryLabel === ''` for every non-empty slot; `category` stays the atlas key
    the glyph reads.
  - The accuracy leaves its own full-width line and joins the second row, so the name
    keeps a real column: **every filled slot's `nameBox.w > 40` px** at the measured
    390×844 card (119×94 slot, 91-px content box), and `elideToWidth` has more than
    the wasted `…` to elide to.
  - No two boxes of one slot intersect (`fitsInside`/`overlaps` — the folder's own
    helpers), the six rows still fit the cell's padding box, and the type badge keeps
    its 24-px square on the first row.
  - `slotView`'s `name` is the move's name cut to `nameBox.w`; when the name fits it is
    returned verbatim (uppercased), with no ellipsis.
- **Wide (`compact: false`)** is **byte-identical** to today's boxes and labels:
  `wideCellTextBoxes` and its `categoryLabel` (the `CATEGORY_LABELS` word) do not
  change; an existing wide snapshot/expectation must still pass unmodified.
- The empty slot (`empty: true`) still returns no name and no stats.
- Rects are plain `{ x, y, w, h }`, in the same coordinate space as `card`.

### Paint

- `battleMoves.tsx` paints the slot's `categoryLabel` only when it is non-empty (so the
  compact cell draws no word) and keeps `data-hud-battle-moves="name"` (or the folder's
  existing attribute) on the name node, so a measurement can find it.
- The card still fits the window at 390×844 (its box is `fitsInside` the viewport).

### Determinism

- Reads no RNG; no new allocation in the paint of a slot beyond what already exists.

## 🧪 Test and Validation Plan (for QA)

- **Method**
  - `npm test` — Vitest, headless; green including the tests this task adds.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only origin/main...task-216` audited against the exclusive paths.
  - **Live pass:** `npm run dev -- --port 5199 --strictPort`,
    `google-chrome --headless=new --no-sandbox --remote-debugging-port=9222
    --window-size=390,844 about:blank`, CDP `Runtime.evaluate` over
    `http://localhost:9222/json` (Node 22's global `WebSocket`). Reach a battle with a
    four-move Pokémon (the route's tall grass / a trainer), open FIGHT, then read the
    four slots' name nodes with `getBoundingClientRect()` and `textContent`.
- **Acceptance criteria**
  - [ ] `[unit]` It typechecks and builds clean.
  - [ ] `[unit]` `cellTextBoxes(cell, true)` on the measured compact cell (119×94)
        returns a `name` box wider than 40 px, and the compact layout's five text boxes
        of one slot pairwise do not intersect.
  - [ ] `[unit]` a filled compact slot's `categoryLabel` is `''` and its `category` is
        still the atlas key; the same slot at `compact: false` returns the word.
  - [ ] `[unit]` `cellTextBoxes(cell, false)` and its labels equal today's values for
        the same cell (the wide grid is pinned, not changed).
  - [ ] `[unit]` a move whose name fits `nameBox.w` is painted verbatim; one that does
        not ends in `…` and its measured width is `<= nameBox.w`.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched.
  - [ ] `[live]` at 390×844 with a four-move Pokémon and FIGHT open, for **all four**
        filled slots: the name node's `getBoundingClientRect().width > 40` and its
        `textContent` is non-empty and ends in `…` only when cut; the card's rect is
        inside 390×844.
  - [ ] `[live]` at 1280×800 the same four slots still paint the category **word** and
        their name nodes' widths equal the pre-change wide widths (read the CSS class
        and the rect; report both numbers).

## 📣 Coordination

- For the Architect: the compact cell's label set is now type chip · name + accuracy ·
  PP · PWR; a later compact-layout task reads `categoryLabel` and the boxes instead of
  re-deriving them.
- For the next batch: `docs/hud-fidelity.md` §5's phone-cell block is the rule — a
  cell never reserves a column it cannot paint.

## ⛔ Out of scope

- The wide cell's grid, the ⓘ (already gone), the card's contents, the target step.
- The battle-hp, battle-command, battle-bag panels or any other battle panel.
- `src/scenes/BattleScene.ts`.
