# Spec: Task-193 — A move cell keeps its name and its numbers at 390

## 🎯 Scope

- **Task type:** DOM HUD panel (preact) + its pure view model.
- **Role:** Dev.
- **Objective:** In the **compact** battle (a phone viewport, 390×844) the four move cells
  lose their text: the names vanish, fragments of the other rows paint over each other
  (`PHYSICAL` on top of `20/20`, `POT`/`PRE` jammed, the type badge over the stats) and the
  player's HP box ends up behind the menu again. After this task the compact battle has its
  **own cell geometry** — a name row across the cell's top and a two-column stat row under it,
  or a single column of four rows — so that at 390 every label of every cell is painted
  **inside its own box** and no HP box is drawn behind the menu. The wide layout Task-192
  shipped at 1280 is **not** touched.
- **Environment:** worktree `../wt-pkm-193`, branch `task-193`. Run
  `npm ci --prefer-offline --no-audit --no-fund` first. Never junction `node_modules` or the
  asset tree; `ASSETS_ROOT` is already set and lives outside this checkout.
- **Dependencies:** none — `[Task-189]` and `[Task-192]` are merged on `main`.

### Exclusive paths (single writer)

- `src/ui/hud/panels/battle-moves/**` (code, CSS, tests **and** its `README.md`)
- `src/ui/hud/panels/battle-hp/**` (code, CSS, tests, `README.md`) — only what the compact
  geometry actually needs; the wide boxes must not move
- `src/ui/moveGrid.ts`
- `src/ui/moveGrid.test.ts`
- `docs/hud-fidelity.md` **§5 only** — the paragraph that records the compact battle's zones,
  appended under the existing "A cell's text is bounded by its own box." block. Do not edit
  any other section of that file (other tasks in this batch hold §6/§9 and the new table).
- `src/ui/README.md` (only if a file is added/renamed/deleted under `src/ui/`)

### Inputs (read-only)

- `.agent_specs/task-193.md` (this file) and `AGENTS.md`.
- `docs/hud-fidelity.md` §5 (the geometry rules already shipped).
- `design/frames/05-battle-hud.json` and `design/screens/m05-battle-hud.png` (the board's
  phone battle) — read them, do not edit `design/`.
- `src/ui/hud/panels/battle-moves/{view.ts,battleMoves.tsx,battleMoves.css}` and its tests.
- `src/ui/hud/panels/battle-hp/view.ts` (`battleHpBox`).
- `src/ui/moveGrid.ts` (`moveGridCellRects`, `MoveGridSlot`).
- `src/data/ui/font.json` (the advances `drawnTextWidth` reads).

## 🔒 Contract

### The measured defect (the numbers to beat)

Measured on `main` @ `49aeb7b`, `?hud=dom`, 390×844, wild battle, FIGHT open: the four cells
are laid out by the **wide** 2×2 rule inside the phone card (358×236 at x 16, y 592), the name
and category strings overflow their boxes, and the player's HP card sits behind the menu. At
1280×800 the same cells are correct (name column 96 px, category column 60 px, 22 px ⓘ clear).

### Required surface

```ts
// src/ui/hud/panels/battle-moves/view.ts
export type BattleCellTextBoxes = Readonly<{
  name: Rect;
  category: Rect;
  pp: Rect;
  power: Rect;
  accuracy: Rect;
}>;

/** The text boxes of one cell, laid out for the card's width class. */
export function cellTextBoxes(cell: Rect, compact: boolean): BattleCellTextBoxes;

/** True when `inner` lies inside `outer` on all four edges (default 0.5 px tolerance). */
export function fitsInside(inner: Rect, outer: Rect, tolerance?: number): boolean;
```

- `BattleMoveSlotView` carries those boxes (`boxes: BattleCellTextBoxes`), so the JSX paints
  each label at the model's own rect instead of letting CSS place it, and a test can assert the
  invariant on the model. The **strings** it prints are unchanged (`slot.name` stays elided by
  `elideToWidth`; `category`, `pp`, `power`, `accuracy` keep their current text and tones).
- The **compact** class is decided by the same rule the panel already uses
  (`stageW < BATTLE_COMPACT`, i.e. `battleMovesBox(viewport)`'s own compact branch, or an
  equivalent width test the view owns); at 1280 the boxes are byte-identical to the values the
  shipped tests pin.
- Every box is measured against the panel's own font: a box's width must be at least
  `drawnTextWidth` of the string it holds (name: the elided string; nothing else may need
  eliding at 390 — if a label cannot fit, the cell geometry is wrong, not the string).
- Boxes inside one cell are pairwise disjoint; every box is inside the cell (`fitsInside`).
- No `battleHpBox(viewport, side, slot)` rect intersects `battleMovesBox(viewport)` at 390×844
  **or** at 1280×800 (today's wide invariant stays true).
- The 22 px ⓘ stays reserved in every cell (Task-214 removes it later; this task does not) and
  the category text never reaches it.

Determinism: the view reads no clock and no RNG (`D11`).

### Tests the panel must keep

`src/ui/hud/panels/battle-moves/view.test.ts` already pins the wide rects; keep those
assertions and add the compact ones. `moveGrid.test.ts` keeps `moveGridCellRects`' shipped
behaviour pinned (2×2, the reserves, the inset).

## 🧩 Data and configuration

No new data. The compact cell's metrics (a name row height, a stat row height, the two stat
columns) are constants in `battle-moves/view.ts` beside the existing `CELL_*` family, and the
CSS mirrors them. Balancing lives in `src/data/`; these are panel geometry numbers, not balance.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — Vitest, headless; green, including the new compact tests.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `git diff --name-only main...task-193` audited against the exclusive paths.
  - `[live]` in a browser: `npm run dev` on your own free port. This machine's Chromium is
    `/usr/bin/google-chrome` (set `CHROME_PATH` if needed). Read the **DOM** with CDP
    `Runtime.evaluate`; a game screenshot is not needed to prove a box's text is inside it.
- **Acceptance criteria:**
  - [ ] `[unit]` For `viewport = { width: 390, height: 844 }` and a four-move grid whose names
    include the longest shipped ones (`MOFLETE ESTÁTICO`, `LANZALLAMAS`, a status move), every
    slot's `boxes` lies inside the slot's rect (`fitsInside`), the boxes are pairwise disjoint,
    and each box's width is ≥ `drawnTextWidth` of the string it holds.
  - [ ] `[unit]` At 390×844 no slot rect and no text box intersects
    `battleHpBox({width:390,height:844}, 'player', 0)` nor `…, 'enemy', 0)`.
  - [ ] `[unit]` At 1280×800 the slot rects and the four text boxes equal the values the
    shipped wide layout produces (regression: pin them in the test).
  - [ ] `[unit]` A slot's category box's right edge is at least 22 px left of the cell's right
    padding edge (the ⓘ stays clear).
  - [ ] `[unit]` `battleMovesView` is total: an empty slot, a missing cell and an out-of-range
    selection still return the same shape, no throw.
  - [ ] `[unit]` Nothing outside the exclusive paths was touched; `src/engine/` untouched.
  - [ ] `[live]` In `npm run dev`, at **390×844**, `?hud=dom`, reach a wild battle with a
    four-move Pokémon and open FIGHT (the route's dev debug menu — `src/dev/debugMenu.ts` — has
    a wild-battle action once a run is on the route). Then, with `Runtime.evaluate`:
    for each `[data-hud-move-slot]`, take `getBoundingClientRect()` of the slot and of a
    `Range` over each of its text nodes (name, category, pp, pwr, acc); assert every text rect
    is inside the slot's rect (± 0.5 px) and that the name rect's text is the move's real
    name (not empty, not only `…`). Also assert no `[data-hud-battle-hp]` element's rect
    intersects `[data-hud-panel="battle-moves"]`'s rect. Report the four texts and their
    rectangles.
  - [ ] `[live]` The same battle at **1280×800** still shows the wide layout: the four cells in
    a 2×2 grid, each name non-empty, no HP box under the panel (the regression half).

## 📣 Coordination

- For the Architect: the compact cell is now a different geometry, so `[Task-196]` (the target
  prompt) and `[Task-214]` (the ⓘ leaves the cells) build on `cellTextBoxes`, not on CSS.
- For the next batch: the compact rule lives in `battle-moves/view.ts`; the battle-hp compact
  boxes moved (if at all) only to keep clear of the menu.

## ⛔ Out of scope

- Removing or moving the ⓘ button (Task-214), the target prompt (Task-196) and the move card.
- Renaming or restyling the wide cell.
- Touching `src/scenes/BattleScene.ts`, the canvas move grid's own drawing, or the HP values.
- Drawing the category as an icon (Task-203).
