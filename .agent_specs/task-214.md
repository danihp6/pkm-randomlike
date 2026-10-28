# Spec: Task-214 — The move's info is the board's card, and the ⓘ leaves the cells

> The task spec is the subagent's entire world. Anything not written here does not
> exist. Keep it executable by someone who has read nothing else.

## 🎯 Scope

- **Task type:** DOM HUD panel (Preact) + one shared document. No engine rule, no
  data table, no RNG, no snapshot change.
- **Role:** Dev.
- **Objective:** the battle's move menu stops drawing a 22 px ⓘ button in every cell
  and grows the board's own **move card**: one panel, above the command window, that
  always describes **the cell the cursor is on** — the move's name, its `PP`, `PWR`
  and `ACC`, its type badge and category glyph, and its description. The freed column
  goes back to the move's name, and a press still chooses the move. There is no
  per-cell button and no second popup: the cursor *is* the info intent.
- **Environment:** worktree `../wt-pkm-214`, branch `task-214`.
- **Dependencies (all merged on `main`, verified 2026-10-28):**
  - `[Task-193]` (Batch 85, merged) — the compact cell's six lines.
  - `[Task-196]` (Batch 86, merged) — the target step's prompt row.
  - `[Task-203]` (Batch 87, merged) — `MoveTypeBadge` / `MoveCategoryIcon` /
    `MOVE_ICON_BOX`, the two atlas squares this card reuses (**read-only**; the kit is
    claimed below only in case a size constant must move with them).

### Exclusive paths (single writer)

Create or modify **nothing** outside this list.

- `src/ui/hud/panels/battle-moves/view.ts`
- `src/ui/hud/panels/battle-moves/view.test.ts`
- `src/ui/hud/panels/battle-moves/battleMoves.test.ts`
- `src/ui/hud/panels/battle-moves/fixture.test.ts`
- `src/ui/hud/panels/battle-moves/battleMoves.tsx`
- `src/ui/hud/panels/battle-moves/battleMoves.css`
- `src/ui/hud/panels/battle-moves/mount.tsx`
- `src/ui/hud/panels/battle-moves/index.ts`
- `src/ui/hud/panels/battle-moves/README.md`
- `src/ui/hud/kit/**` — **conditional and expected to be empty**: claim it only if the
  card's two badges need a kit-level constant. Changing a kit public signature is out
  of scope (see ⛔).
- `docs/hud-fidelity.md` — **§5 only, two hunks**:
  1. the **contiguous region from the start of `**A cell's text is bounded by its own
     box.**` (line 131) through the end of `**The target step's prompt.**` (line 165)**,
     rewritten: the two cell blocks lose the ⓘ arithmetic, a new
     **`**The move card.**`** block is inserted **between
     `**A cell's text is bounded by its own box.**` and
     `**The compact battle has its own cell.**`**, and the prompt block's
     "(the ⓘ's own size)" parenthetical is corrected;
  2. the **last sentence of `**Battle zones.**` (lines 124-125)** — `The ⓘ answers the
     pointer: hover floats that move's description, and the click still pins it.` —
     replaced by one sentence saying the card describes the cursor's cell and no cell
     carries a button.

  Nothing else in the file (`[Task-205]`, `[Task-211]` and `[Task-213]` own other
  blocks of the same document, and §6 is not yours).

### Inputs (read-only)

- `docs/hud-fidelity.md` §5 and §6, `docs/tech-decisions.md` (D43, D49).
- `src/ui/hud/panels/battle-moves/README.md` — the rules list this task rewrites.
- `src/ui/moveGrid.ts` — `MoveGridCell`, `MoveGridSlot`, `moveGridCellRects`,
  `isEmptySlot`, `padMoveGridCells`. Untouched: the cells' rectangles are the scene's
  and stay exactly as they are.
- `src/ui/hud/kit/**` — `MoveTypeBadge`, `MoveCategoryIcon`, `MOVE_ICON_BOX`,
  `joinClasses`.
- `src/ui/hud/panels/battle-hp/view.ts` — `battleHpBox`, for the tests' clearance
  assertions against the phone's player box.
- `src/scenes/BattleScene.ts` — **read-only**. It builds `BattleMovesInput` and keeps
  passing `info: this.infoMove`; this task must stay source-compatible with it.
- `design/frames/05-battle-hud.json`, `design/frames/m05-battle-hud.json` — read only
  (`05`'s `attack detail` is 576×160 at (664,372), above its 576×216 menu at
  (664,544); `m05` draws **no** card at all).

## 🔒 Contract

Everything below is frozen.

### `src/ui/hud/panels/battle-moves/view.ts` — the cells lose the ⓘ, the card gains one

Measured on `main`: `INFO_SIZE = 22`, `INFO_OFFSET = 36`, `INFO_TOP = 8` (28-32) feed
`infoBoxOf(cell)` (280-283), which `categoryBoxOf` (262-266) and the compact
`compactCellTextBoxes` (341-360) use to place the category glyph; the floating card is
built by `infoCardOf` from the **pinned** slot (462-487); `BattleMoveSlotView.info` is
the per-cell button's box (200-201).

```ts
/** The cell's own rects: the ⓘ is gone, so nothing is reserved on its right. */
export type BattleMoveSlotView = Readonly<{
  // … every field unchanged …
  box: Rect;
  nameBox: Rect;
  categoryBox: Rect;
  boxes: BattleCellTextBoxes;
  typeBox: Rect;
  // NOTE: `info` is removed. There is no per-cell button any more.
}>;

/** The board's card: the cursor's move, laid out above the card. */
export type BattleMoveInfoView = Readonly<{
  title: string;      // the move's display name (`MoveGridCell.name`, unmodified)
  type: string;       // the atlas type the badge draws
  category: string;   // the atlas category the glyph draws
  pp: string;         // `ppLabel(cell)`, the same string the cell prints
  power: string;      // `powerLabel(cell)`
  accuracy: string;   // `accuracyLabel(cell)`
  text: string;       // `cell.desc` (may be '')
  box: Rect;          // viewport coordinates
}>;

export type BattleMovesView = Readonly<{
  // … unchanged …
  /** The cursor's move, or null while the menu is closed or the cursor is on an empty cell. */
  info: BattleMoveInfoView | null;
}>;

/** The board's card height, and the phone's clearance from its own HP box. */
export const INFO_CARD_H = 160;
export const COMPACT_CARD_CLEARANCE = 88;
```

- **The cells.** `infoBoxOf` stops being used by the cell layout and
  `BattleMoveSlotView.info` disappears. The category glyph takes the cell's own right
  padding edge:
  - wide: `right = box.x + box.w - CELL_PAD_X`, `left = Math.max(box.x + CELL_PAD_X,
    right - MOVE_ICON_BOX)`; `nameBoxOf` keeps its formula
    (`right = category.x - CELL_GAP`), so the name's width becomes
    **`cell.w - 60`** where it was `cell.w - 90` — the freed 22 px ⓘ plus its 8 px
    gap. `pp` / `power` / `accuracy` boxes are unchanged.
  - compact: `right = content.x + content.w`, `left = max(content.x, right -
    MOVE_ICON_BOX)`; the six stacked lines, including the name plane, are unchanged
    (the name already spans the content box).
  - `MOVE_INFO_SIZE = 22` **stays exported** (the canvas still draws its own ⓘ until
    `[Task-200]`, and `MOVE_TARGET_H` derives from it); `MOVE_CATEGORY_GAP = 8` stays
    exported and stops being used to anchor the category column.
- **The card follows the cursor.** `infoCardOf` reads `input.selected` instead of
  `input.info`: a card exists when `input.open` is true and
  `slots[selected]` is a filled cell (an **empty** cell yields `null`), whatever the
  cell's `desc` is. `BattleMovesInput.info` **stays in the type** so `BattleScene.ts`
  compiles unchanged, and the view **must not read it** (a test pins that).
- **The card's box** (its own `INFO_MARGIN = 20`, `INFO_GAP = 8` are reused):
  - wide (`compactCard(card) === false`):
    `{ x: card.x + 20, y: card.y - 8 - 160, w: card.w - 40, h: 160 }`;
  - compact: `{ x: card.x + 20, y: card.y - COMPACT_CARD_CLEARANCE - 8 - 160,
    w: card.w - 40, h: 160 }`.
- Numbers this pins, and why they are safe:
  - **1280×800** — the card is `{440, 582, 564, 192}` (`battleMovesBox`), so the move
    card is `{460, 414, 524, 160}`: its bottom is 574, 8 px above the menu, and it
    sits in the empty field between the foe's boxes (bottom 148) and the player's
    (top 660). The board's own card is at (664,372) because its menu starts at 664;
    ours starts at 440, so the card is anchored to the menu's **top edge** instead.
  - **390×844** — the card is `{16, 592, 358, 236}`, so the move card is
    `{36, 336, 318, 160}`: its bottom is 496, 8 px above the player's HP box
    (`{16,504,358,80}`). `m05` draws no card at all; this is the only band on the
    phone that meets nothing.
- `cellTextBoxes`, `compactCard`, `fitsInside`, `elideToWidth`, `drawnTextWidth`,
  `infoLineCount`, `battleMovesBox`, the back/mega/gmax controls and the target row
  keep their signatures.

### `battleMoves.tsx` — the paint

- `MoveSlot` no longer renders `slot.info`; the category glyph, the name, the stats
  and the type badge keep their boxes and their `data-` attributes.
- The `view.slots.map(slot => slot.info === null ? null : <button …>)` block and the
  `useState` pin (`opened` / `pinned` / `pressInfo`) are removed, together with
  `infoEnterIntent` / `infoLeaveIntent`. `BattleMovesIntent`'s `'info'` variant stays
  in `mount.tsx` (the scene still handles it), but the panel never emits it.
- The card is one node:
  `<div class="battle-moves__desc" data-hud-move-card style={insetStyle(view.info.box, card)}>`
  containing
  - `.battle-moves__desc-head`: `<MoveTypeBadge type>` , `<span class="battle-moves__desc-title" data-hud-move-card-title>{title}</span>`,
    `<span class="battle-moves__desc-category"><MoveCategoryIcon category></span>`;
  - a stats line: `<span class="battle-moves__desc-pp" data-hud-move-card-pp>{pp}</span>`,
    `<span class="battle-moves__desc-pwr" data-hud-move-card-pwr>{power}</span>`,
    `<span class="battle-moves__desc-acc" data-hud-move-card-acc>{accuracy}</span>`;
  - `<p class="battle-moves__desc-text" data-hud-move-desc>{text}</p>` (kept: the text
    node keeps the attribute it already has).
- The card must take **no pointer event** (`pointer-events: none`): it floats above
  the layer and must never eat a press on a cell.

### `battleMoves.css`

- Delete `.battle-moves__info` and `.battle-moves__info--active` (158-200 range) and
  their `:focus-visible` rule.
- `.battle-moves__desc` keeps the glass card and `overflow: hidden`, gains
  `pointer-events: none`, and lays out `.battle-moves__desc-title`,
  `.battle-moves__desc-category` and the three new stat spans on the head row. The
  card is 160 px tall, so `.battle-moves__desc-text` scrolls or clips inside it — the
  description is never allowed to grow the box.
- `.battle-moves` already has `overflow: visible` (line 23): keep it, because the card
  is painted at a negative offset from the layer's own box.

### `index.ts` and the README

- `index.ts` drops nothing from its export list except a symbol you actually removed;
  `BattleMoveInfoView` and `INFO_CARD_H` / `COMPACT_CARD_CLEARANCE` are added to it.
- `battle-moves/README.md` must stop describing "each slot's ⓘ" and "the floating
  description window it pins" (lines 4-5, 29, 36) and describe the cursor's card
  instead, including the two anchor rules above (lines 69, 75, 79, 91 mention the ⓘ).

### Determinism and rules

- Reads **no RNG**; nothing in `src/ui/hud/state.ts`, `src/engine/**` or
  `src/scenes/**` changes.
- No new dependency, no new file, no `src/data/**` change, no `SAVE_VERSION` step.
- The description text keeps its source: `MoveGridCell.desc` (`moveShortDescription`),
  never a literal in the component.

## 🧩 Data and configuration

Nothing new: no JSON, no balancing value. Two layout constants are added and frozen
above (`INFO_CARD_H = 160`, `COMPACT_CARD_CLEARANCE = 88`), and both are derived from
the board (`05`'s 576×160 card) and from `battleHpBox`'s phone geometry
(`PHONE_H` 80 + the 8 px gutter), which the tests assert against.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — full Vitest run, headless; targeted first:
    `npx vitest run src/ui/hud/panels/battle-moves`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run lint`.
  - `git diff --name-only main...task-214` — every path must be in the exclusive list
    (an empty `src/ui/hud/kit/**` diff is expected).
  - **This task owes a browser pass**: three `[live]` criteria below. `npm run dev`
    (the dev menu needs a dev build), `http://localhost:5173/?hud=dom`, continue a
    run, press `F` for the debug menu, launch a wild battle, press FIGHT. Read DOM
    boxes with `getBoundingClientRect()` and check presence with
    `document.querySelectorAll`.
- **Acceptance criteria:**
  - **The model (tests this task owes).**
    - [ ] `[unit]` The card follows the cursor: with `cells` of four distinct moves,
      `battleMovesView({…, selected: 2}).info` is slot 2's — its `title`, `pp`,
      `power` and `accuracy` equal `ppLabel` / `powerLabel` / `accuracyLabel`'s strings
      for that cell — and `battleMovesView({…, selected: 2, info: 0}).info` is the
      **same** object, i.e. `input.info` is not read.
    - [ ] `[unit]` `info` is `null` when the menu is closed (`open: false`), when the
      selected slot is empty (an `EMPTY` cell), and when `cells` is shorter than
      `selected + 1`; it is **not** null for a filled cell whose `desc` is `''` (the
      head still prints the name, `PP`, `PWR` and `ACC`, and `text` is `''`).
    - [ ] `[unit]` Card geometry: at 1280×800 `info.box` is `{460,414,524,160}` and
      its bottom (574) is ≤ `battleMovesBox(viewport).y - 8`; at 390×844 it is
      `{36,336,318,160}` and its bottom (496) is ≤
      `battleHpBox(viewport,'player',0).y - 8` (504 − 8); `info.box` never intersects
      `battleHpBox(viewport,'enemy',0)` or `battleHpBox(viewport,'player',0)` at
      either viewport; `COMPACT_CARD_CLEARANCE` equals
      `battleHpBox({width:390,height:844},'player',0).y - battleMovesBox({width:390,height:844}).y + 8`.
    - [ ] `[unit]` No cell carries a button: `BattleMoveSlotView` has no `info` field
      (typecheck), `slots.every(slot => !('info' in slot))`, and the rendered tree
      carries zero `[data-hud-move-info]` nodes for a four-move grid.
    - [ ] `[unit]` The freed column goes back to the name: at the wide cell,
      `slot.nameBox.w === slot.box.w - 60` and
      `slot.categoryBox.x + slot.categoryBox.w === slot.box.x + slot.box.w - 14`;
      at the compact cell the name line is unchanged (`boxes.name.w === box.w - 28`),
      and in both classes the category box never overlaps the name box
      (`nameBox.x + nameBox.w <= categoryBox.x`).
    - [ ] `[unit]` `elideToWidth` still cuts a long name to the new, wider box and the
      painted name equals the elided string.
    - [ ] `[unit]` It typechecks and builds clean, and **`src/scenes/BattleScene.ts`
      compiles with no edit** — `BattleMovesInput` still accepts `info`.
    - [ ] `[unit]` Nothing outside the exclusive paths was touched — in particular
      `src/scenes/BattleScene.ts`, `src/ui/hud/kit/**` (expected empty),
      `src/ui/moveGrid.ts`, `src/ui/hud/panels/battle-hp/**` and `design/frames/**`
      are byte-identical to `main`.
  - **Live.**
    - [ ] `[live]` At **1280×800**, FIGHT open in a wild battle:
      `document.querySelectorAll('[data-hud-move-info]').length === 0`, no element
      with class `battle-moves__info` exists, and `[data-hud-move-card]` is
      `{left:460, top:414, width:524, height:160}` ±1 with its bottom ≤
      `[data-hud-panel="battle-moves"]`'s `top - 8`; the card's
      `[data-hud-move-card-title]` text equals slot 0's move name; press `ArrowRight`
      once (the scene's own cursor walk) and the title, `[data-hud-move-card-pp]` and
      `[data-hud-move-card-pwr]` become slot 1's; clicking slot 1 still chooses that
      move (the battle's message prints `<name> used <move>!`).
    - [ ] `[live]` At **390×844**, same menu: no `[data-hud-move-info]`,
      `[data-hud-move-card]` is `{left:36, top:336, width:318, height:160}` ±1, its
      box intersects neither `[data-hud-hp="player-0"]` (`{16,504,358,80}`) nor
      `[data-hud-hp="enemy-0"]`, and a press still chooses the move.
    - [ ] `[live]` The card never eats a press: with the card painted, a click on the
      centre of `[data-hud-move-slot="2"]` selects and uses that move (the message
      names it), and the card's computed `pointer-events` is `none`.

## 📣 Coordination

- **For the Architect / Orchestrator:** the entry's claims line names `kit/**` "the
  card's icons"; the kit already ships both badges (`MoveTypeBadge`,
  `MoveCategoryIcon`), so this spec calls that claim **conditional and expected
  empty**. It also claims the panel's `mount.tsx`, `index.ts`, `battleMoves.css`, the
  two in-folder component tests and the `README.md`, all of which the one-folder claim
  already covered.
- **For `[Task-213]` (same batch):** the two tasks share `docs/hud-fidelity.md` §5 but
  no hunk — you own lines 124-165 (the `Battle zones.` tail and the three cell
  blocks), it appends a new **The stage grid.** block after line 174. Read its spec if
  you need its numbers; do not edit its block.
- **For `[Task-216]` (Batch 92):** it reworks the compact cell's columns and depends on
  this task. After this card, the phone cell has no ⓘ, so its 91 px content box gives
  the name the whole column — its own measure starts from `nameBox.w === box.w - 28`
  and the category glyph's right edge on the content box.
- **For `[Task-200]` (Batch 90):** the canvas move menu still draws its own ⓘ and
  still pins a canvas popup; that code retires with the canvas layer. Nothing about it
  is changed here, and the DOM panel is already the cursor-driven card.
- **The board's card is at (664,372) because its menu starts at 664; the shipped menu
  starts at 440** (`battleMovesBox`, kept by `[Task-206]`). That is why the card is
  anchored to the menu's top edge here and to the phone's HP box there, and
  `docs/hud-fidelity.md` §5's new **The move card.** block records both numbers.

## ⛔ Out of scope

- `src/scenes/BattleScene.ts` in any form — including `this.infoMove` / `this.infoPinned`
  and its `case 'info'` handler, which simply stop being reachable from the panel.
- The **canvas** move menu and its own ⓘ (`moveInfoButtons`, the canvas `InfoPopup`):
  `[Task-200]` retires that layer.
- The target step's prompt, the ◀ back control, the MEGA / G-MAX columns, the cell
  rectangles (`moveGridCellRects`), the type/category atlas data, the description
  text's source and the `↑` / `↓` accuracy marks.
- The phone cell's column split (that is `[Task-216]`), the stage grid
  (`[Task-213]`), the HP panels, `src/ui/hud/state.ts`, `design/frames/**`,
  `package.json`, `vite.config.ts`, `src/main.ts`, any `src/data/**` file, any
  `SAVE_VERSION` step.
- A new kit public signature: if the badges need a different box, add a constant
  inside `battle-moves` rather than changing `MOVE_ICON_BOX`.
