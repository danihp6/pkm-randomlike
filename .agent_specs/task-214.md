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
  per-cell button and no second popup: the cursor *is* the info intent. On the phone
  the card is **narrower** than the menu: its right 122 px are `[Task-213]`'s stage
  grid's rail, so the two panels never paint over each other at 390×844.
- **Environment:** worktree `../wt-pkm-214`, branch `task-214`. **This task's branch is
  rebased onto `task-213`'s merge before the Batch 89 integration fix is applied**
  (`git merge origin/task-213`, or the `main` that already carries it): the fix below
  imports `[Task-213]`'s `STAGE_*` constants, and `[Task-213]` merges first, so the
  213-then-214 order is what makes the import compile.
- **Dependencies (all merged on `main`, verified 2026-10-28):**
  - `[Task-193]` (Batch 85, merged) — the compact cell's six lines.
  - `[Task-196]` (Batch 86, merged) — the target step's prompt row.
  - `[Task-203]` (Batch 87, merged) — `MoveTypeBadge` / `MoveCategoryIcon` /
    `MOVE_ICON_BOX`, the two atlas squares this card reuses (**read-only**; the kit is
    claimed below only in case a size constant must move with them).
  - `[Task-213]` (Batch 89, same batch, **merges first**) — its `STAGE_CHIP` (34),
    `STAGE_GAP` (6), `STAGE_COLS` (3) and `STAGE_CLEARANCE` (8) in
    `src/ui/hud/panels/battle-hp/view.ts` are **read-only** inputs: the phone card's
    right rail is built from them, and its stage grid's worst-case phone box
    `{260, 422, 114, 74}` is the box this card must never paint over.

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

  And **inside hunk 1, the `**The move card.**` block must already record the corrected
  phone number**: the card is `{36, 336, 216, 160}` at 390×844, its right edge is 252,
  and the 122 px rail on its right is what `[Task-213]`'s stage grid occupies (three
  34 px chips a row plus its 8 px clearance). The 1280×800 numbers (`{460,414,524,160}`,
  bottom 574) are unchanged.

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
- `src/ui/hud/panels/battle-hp/view.ts` — `battleHpBox`, for the card's own placement and
  for the tests' clearance assertions against the phone's player box, plus
  **`STAGE_CHIP` (34), `STAGE_GAP` (6), `STAGE_COLS` (3) and `STAGE_CLEARANCE` (8)**,
  which `COMPACT_CARD_RAIL_W` is built from. All of it is **read-only**: the file is
  `[Task-213]`'s and this task never edits it.
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

/** The board's card height, the phone's clearance from its own HP box, and its right rail. */
export const INFO_CARD_H = 160;
export const COMPACT_CARD_CLEARANCE = 88;
/**
 * The width the phone card gives back on its right: the widest the play-side stage grid
 * can get — three `STAGE_CHIP` columns, `STAGE_GAP` apart — plus the `STAGE_CLEARANCE`
 * that grid keeps from anything beside it. 34 * 3 + 6 * 2 + 8 = 122.
 */
export const COMPACT_CARD_RAIL_W = 122;
```

`COMPACT_CARD_RAIL_W` is **derived, not typed**: it is
`STAGE_CHIP * STAGE_COLS + STAGE_GAP * (STAGE_COLS - 1) + STAGE_CLEARANCE`, read from
`src/ui/hud/panels/battle-hp/view.ts` (a **read-only** import, the same module
`battleHpBox` already comes from). `[Task-213]` freezes those four constants at
34 / 3 / 6 / 8; if they ever move, this card follows them without a second edit.
**Nothing else in `battle-hp/**` is touched** — the file stays `[Task-213]`'s.

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
  - compact:
    `{ x: card.x + INFO_MARGIN, y: card.y - COMPACT_CARD_CLEARANCE - INFO_GAP - INFO_CARD_H,
    w: card.w - INFO_MARGIN - COMPACT_CARD_RAIL_W, h: INFO_CARD_H }` — the phone card
    keeps its 20 px **left** margin, its bottom 8 px above the player's box, and gives
    its right edge to the stage grid's rail. **No floor on this width** (`CARD_MIN_W`
    is the wide card's): a floor would re-open the collision.
- Numbers this pins, and why they are safe:
  - **1280×800** — the card is `{440, 582, 564, 192}` (`battleMovesBox`), so the move
    card is `{460, 414, 524, 160}`: its bottom is 574, 8 px above the menu, and it
    sits in the empty field between the foe's boxes (bottom 148) and the player's
    (top 660). The board's own card is at (664,372) because its menu starts at 664;
    ours starts at 440, so the card is anchored to the menu's **top edge** instead.
    The wide branch is unchanged: 564 − 40 = 524.
  - **390×844** — the card is `{16, 592, 358, 236}`, so the move card is
    `{36, 336, 216, 160}`: `x = 16 + 20`, `y = 592 - 88 - 8 - 160`,
    `w = 358 - 20 - 122`. Its bottom is 496, 8 px above the player's HP box
    (`{16,504,358,80}`); its **right edge is 252**.
  - **The phone clearance, and why the phone card is narrow.** `[Task-213]`'s grid is
    right-aligned to the player's HP column (right edge `16 + 358 = 374`) and 8 px above
    it, so at 390×844 the grid occupies `x 260…374` for any three-or-more-chip set
    (`{260,422,114,74}` for six chips; `{340,462,34,34}` for one). A 318 px card ends at
    **354** and paints over the right 14 px of a one-chip grid and the whole 94 px of the
    six-chip box — the Batch 89 integration failure. With `w = 216` the card ends at
    **252**, and the arithmetic is chip-count and row-count independent, because it is
    horizontal: `374 - 114 (three columns) - 8 (clearance) = 252`. That also holds in a
    phone double, where the grid's `top` drops to the partner box (416) and its `y`
    becomes 334: the two boxes still differ on `x`.
  - **The board backs the rail.** `05` draws its six 34×34 chips in a rail
    `448…562` and starts its card at 664, i.e. the chips sit left of the card, never
    under it. `m05` draws **no card at all** on the phone (its `m menu panel` is
    `{16,592,358,236}` and its four cells 163×80 at x 28 / 199), so the phone card's
    width is this task's invention with no board number to honour — which is why the
    card yields the rail and `[Task-213]`'s 8 px-above-the-column anchor is kept.
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
- **One compact-only rule**, so the narrower phone card cannot grow its head row: the
  root already carries `battle-moves--compact` (`cardClass`), so add
  `.battle-moves--compact .battle-moves__desc-title { min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; }`. At 390×844 the card's content box is
  190 px (`216 - 2 * 12 padding - 2 * 1 border`), the head row spends
  `(MOVE_ICON_BOX 24 + 8) * 2 = 64`, so the title keeps 126 px on one line and a long
  name ellipsizes instead of wrapping onto the stats line. Nothing else about the head
  row, the two badges or the stats line changes, and the wide card is untouched.
- `.battle-moves` already has `overflow: visible` (line 23): keep it, because the card
  is painted at a negative offset from the layer's own box.

### `index.ts` and the README

- `index.ts` drops nothing from its export list except a symbol you actually removed;
  `BattleMoveInfoView`, `INFO_CARD_H`, `COMPACT_CARD_CLEARANCE` and
  `COMPACT_CARD_RAIL_W` are added to it.
- `battle-moves/README.md` must stop describing "each slot's ⓘ" and "the floating
  description window it pins" (lines 4-5, 29, 36) and describe the cursor's card
  instead, including the two anchor rules above (lines 69, 75, 79, 91 mention the ⓘ).
  Any phone width it quotes becomes **216**, and it must say **why**: the right 122 px
  of the phone card's band belong to `[Task-213]`'s stage grid.

### Determinism and rules

- Reads **no RNG**; nothing in `src/ui/hud/state.ts`, `src/engine/**` or
  `src/scenes/**` changes.
- No new dependency, no new file, no `src/data/**` change, no `SAVE_VERSION` step.
- The description text keeps its source: `MoveGridCell.desc` (`moveShortDescription`),
  never a literal in the component.

## 🧩 Data and configuration

Nothing new: no JSON, no balancing value. Three layout constants are added and frozen
above (`INFO_CARD_H = 160`, `COMPACT_CARD_CLEARANCE = 88`, `COMPACT_CARD_RAIL_W = 122`),
and each is derived from something outside this task: the board (`05`'s 576×160 card),
`battleHpBox`'s phone geometry (`PHONE_H` 80 + the 8 px gutter) and, for the rail,
`[Task-213]`'s `STAGE_CHIP` / `STAGE_GAP` / `STAGE_COLS` / `STAGE_CLEARANCE`. The tests
assert all three against their sources.

## 🧪 Test and Validation Plan (for QA)

- **Method:**
  - `npm test` — full Vitest run, headless; targeted first:
    `npx vitest run src/ui/hud/panels/battle-moves`.
  - `npm run build` — `tsc --noEmit && vite build`.
  - `npm run lint`.
  - `git diff --name-only main...task-214` — every path must be in the exclusive list
    (an empty `src/ui/hud/kit/**` diff is expected). With the branch rebased on
    `task-213`'s merge, diff against that base (`git diff --name-only
    origin/task-213...task-214`) and confirm **`src/ui/hud/panels/battle-hp/**` does not
    appear** — the `STAGE_*` import is a read, never an edit.
  - `grep -rn '318' src/ui/hud/panels/battle-moves docs/hud-fidelity.md` — the old phone
    width is gone from every file this task owns. The wide branch's `card.w - 40`
    **stays** (564 − 40 = 524); only the compact branch gains the rail.
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
      `{36,336,216,160}` — `x = card.x + 20`, `w = card.w - 20 - COMPACT_CARD_RAIL_W`
      — its right edge is **252**, and its bottom (496) is ≤
      `battleHpBox(viewport,'player',0).y - 8` (504 − 8); `info.box` never intersects
      `battleHpBox(viewport,'enemy',0)` or `battleHpBox(viewport,'player',0)` at
      either viewport; `COMPACT_CARD_CLEARANCE` equals
      `battleMovesBox({width:390,height:844}).y - battleHpBox({width:390,height:844},'player',0).y`
      (88 — this fix does not move it).
    - [ ] `[unit]` **The card clears the stage grid at 390×844** (this is the Batch 89
      integration fix). Build the grid's worst-case box from `[Task-213]`'s own
      constants and `battleHpBox(phone,'player',0)` —
      `w = STAGE_CHIP * STAGE_COLS + STAGE_GAP * (STAGE_COLS - 1)` (114),
      `h = STAGE_CHIP * 2 + STAGE_GAP` (74),
      `box = {x: column.x + column.w - w, y: column.y - STAGE_CLEARANCE - h, w, h}`
      (`{260,422,114,74}`) — and assert `info.box.x + info.box.w + STAGE_CLEARANCE <=
      box.x` (252 + 8 ≤ 260) **for the one-, two-, three-, six- and seven-chip cases**,
      each built with the same formula and its own `cols` / `rows`. Also assert
      `COMPACT_CARD_RAIL_W === STAGE_CHIP * STAGE_COLS + STAGE_GAP * (STAGE_COLS - 1) + STAGE_CLEARANCE`
      (122), so the rail cannot drift from the grid it reserves space for.
    - [ ] `[unit]` The narrow phone card still holds its own content: at 390×844 the
      card's content box is 190 px (`216 - 24 padding - 2 border`) and the three stat
      spans (`PP 12/15`, `PWR 90`, `ACC 100`) plus their gaps fit inside it on one line;
      the head row keeps 126 px for the title after its two 24 px glyphs and their 8 px
      gaps; and the description's box stays inside the card, which never grows past its
      frozen 160 px.
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
      `src/ui/moveGrid.ts` and `design/frames/**` are byte-identical to `main`, and
      `src/ui/hud/panels/battle-hp/**` is byte-identical to **`origin/task-213`** (the
      213 merge this branch sits on): the four `STAGE_*` names are imported, never
      edited, re-exported or copied.
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
      `[data-hud-move-card]` is `{left:36, top:336, width:216, height:160}` ±1, and
      **two clearance bounds hold against the other panel's box**:
      (a) its right edge (`getBoundingClientRect().right`, 252) is ≤
      `[data-hud-hp="player-0"]`.right − `COMPACT_CARD_RAIL_W` (374 − 122 = 252) — the
      `[Task-213]` stage grid's 114 px three-column box plus its 8 px clearance is free,
      whatever the chip count; and (b) with the grid actually on screen (press `F`,
      give the lead `swords-dance`, use it, then reopen FIGHT),
      `[data-hud-battle-stages]`.left − `[data-hud-move-card]`.right ≥ 8 (measured: 340 −
      252 = 88 with one chip; the bound is what matters), i.e. the two boxes do not
      intersect. Its box still intersects neither `[data-hud-hp="player-0"]`
      (`{16,504,358,80}`) nor `[data-hud-hp="enemy-0"]`, and a press still chooses the
      move.
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
- **The box this card must clear is `[Task-213]`'s stage grid** — its worst case at
  390×844 is `{260, 422, 114, 74}` (three 34 px chips a row, `STAGE_COLS = 3`,
  right-aligned to the player HP column at 374 and `STAGE_CLEARANCE = 8` above it), the
  measured one-chip box is `{340, 462, 34, 34}`, and the phone card's right edge is
  therefore capped at **252** (`374 − COMPACT_CARD_RAIL_W`). A 318 px phone card ends at
  354 and paints over the `+` and the `ATK` of a chip (`battle-hp-mount` precedes
  `battle-moves-mount`, both at `z-index: 1`) — the Batch 89 integration failure this
  spec now forbids. Leave `[Task-213]`'s placement and its four constants exactly as
  they are: the card yields, not the grid.
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
  `docs/hud-fidelity.md` §5's new **The move card.** block records both numbers — plus
  the phone's 122 px right rail, which is the stage grid's, not the card's. On `05` the
  board does the same: its chips sit at `448…562` and its card starts at 664.

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
