# `src/ui/hud/panels/battle-moves/` — the battle move menu (`05`)

The FIGHT command's card as Preact over the `#hud` layer (`D49`): four move slots with
their type badge and category glyph, their PP / PWR / ACC lines, the board's own **move
card** above the command window — the cursor's move, its type, category, `PP`, `PWR`,
`ACC` and its description — the ◀ back control, the MEGA / G-MAX columns and the target
step's prompt row. The slot rects are the **shipped** ones — the same `moveGridCellRects`
call the canvas makes, inside the scene's own `menu` rect — painted with `05 Battle HUD`'s
cell skin, and each label sits at the box the view measures for it (`cellTextBoxes`):
three lines in the wide cell, six stacked ones in the compact (phone) cell, with the two
atlas squares at their own `typeBox` / `categoryBox`. No cell carries a button: the cursor
_is_ the info intent.

## Layout

- `view.ts` — the panel's value model: `battleMovesBox` (the battle square's menu rect in
  page coordinates, starting where the HP column ends on the wide layout), `compactCard` (the
  card's width class), `cellTextBoxes` and `fitsInside` (a cell's five label boxes and the
  containment test the panel and QA share), `battleMovesView` (the four slots with their own
  label boxes, their `categoryLabel` word and the two atlas squares' boxes, the ◀, the two
  forme columns, the target step's prompt row and the card that describes the cursor's move,
  from a `BattleMovesInput`), `CATEGORY_LABELS` (the three category words a wide cell carries)
  and the mirrored constants, including the card's height (`INFO_CARD_H`), the phone's
  clearance from its own HP box (`COMPACT_CARD_CLEARANCE`) and the rail it cedes to the
  stage grid (`COMPACT_CARD_RAIL_W`).
- `view.test.ts` — both QA viewports' cards, the card's clearance of the HP column, the slot
  rects derived from the same `moveGridCellRects` call, the wide cell's pinned boxes (the
  162 px name line, the 24 px glyph square on the right padding edge), the compact cell's six
  lines pinned on the measured 119×94 cell (a 91 px name line, the five boxes disjoint and
  inside the padding box, the badge's 24 px square on its first row) and the name it paints
  whole or cut, the freed ⓘ column the name recovered, the category word (the wide cell's
  `PHYSICAL` / `SPECIAL` / `STATUS`, the compact cell's `''`), the glyph / ◀ / forme boxes,
  the stat tones, the clamping, the empty slot, the target step's prompt (null / name, its
  label, and the 22 px row ending 1 px above the first cell at both viewports) and the move
  card (the cursor's strings, the null cases, its two anchors and its clearance from both
  sides' lead boxes), headless.
- `battleMoves.tsx` — the card: one button per slot whose labels and both atlas squares are
  painted at the model's own boxes, the category word painted only where its own column is
  wide enough to hold it, the name node marked `data-hud-move-name` so a measurement can find
  it, the three controls, the target step's prompt row (`data-hud-move-target`, painted only
  while the step is open) and the one move card (`data-hud-move-card`, its title / `PP` /
  `PWR` / `ACC` / description on their own attributes), each control answering with a
  `BattleMovesIntent`. A press on a cell still chooses that move.
- `battleMoves.test.ts` — the slot button itself: its press emits that slot's `move` intent,
  the name, the stats and both icons land on the model's rects, one `.kit-move-type` and one
  `.kit-move-category` per filled cell and none in an empty one, the category word painted only
  in a column that holds it (never on a shipped cell), the name node's `data-hud-move-name`
  hook, an unpickable slot is disabled, the card carries its width class, the move card prints
  the cursor's move and nothing carries `data-hud-move-info`, one prompt row for a marked foe
  and none for a closed step, and the stylesheet keeps the card out of the pointer's way,
  headless.
- `battleMoves.css` — the board's cell skin (radius 8, the 12 % accent selected cell and
  the 4 % / 8 % row pair), the glass card and the move card (one head row of readouts that
  wraps on the phone, a description that scrolls inside the fixed height, `pointer-events:
none`), the target step's prompt (one line, body type, centred in the card's 22 px top
  band), the absolutely placed labels the model positions (the accuracy right in the wide
  cell and left in the compact one) and the two wrappers that place the type badge and the
  category glyph.
- `mount.tsx` — `mountBattleMoves`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union (its `info`
  variant stays for the scene's canvas handler, and this panel never emits it).
- `fixture.test.ts` — `design/fixtures/05-battle-hud.json` is the frame's own copy: its
  four moves, their printed lines, the selected first cell, the MEGA column and the 160 px
  card its `attack detail` measures; its card is the frame's measurement, pinned against the
  shipped card's right edge and height.
- `index.ts` — the barrel the scene imports: the card and its mount, `battleMovesBox`,
  `battleMovesView`, `cellTextBoxes`, `compactCard`, `fitsInside`, `CATEGORY_LABELS`, the prompt
  row's two numbers, `INFO_CARD_H` / `COMPACT_CARD_CLEARANCE` / `COMPACT_CARD_RAIL_W`, and the
  view's input, slot and card types.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene builds `BattleMovesInput` from its own
   `menuItems`, and the panel paints it. The panel reads **no** `HudState` — the battle
   snapshot feeds the HP boxes only — and nothing here imports the engine, an `Rng` or a
   clock.
2. The slots come from `moveGridCellRects` with the canvas's own `leftReserve` /
   `rightReserve`, so the DOM card and the canvas grid cannot diverge; a press becomes the
   `{ type: 'fight', moveIndex, … }` the key path already submits.
3. `BattleMovesIntent` is this panel's own channel: `src/ui/hud/commands.ts` has no
   battle-menu variant and the scene is the only receiver.
4. The card is `position: fixed` at the model's rect, and only its controls take a press
   (`pointer-events: none` on the layer), so the canvas's pads and keys keep every other
   press.
5. The card starts where the HP column ends (`battleHpBox`), so the FIGHT window never
   covers an HP box, and each slot's `categoryBox` — the glyph's own 24 px square — ends on
   the cell's own right padding edge, with nothing reserved for a button.
6. **Every label is painted at its own model box.** `cellTextBoxes` lays a cell out by its
   width class and the stylesheet only paints: the cell keeps no grid, so nothing can reflow a
   label out of the rect a test measured. The wide class is the shipped three-line cell (the
   name and the category glyph on the first line, PP under them, power and accuracy on the
   third past the type badge's 24 px column); the compact class is six stacked lines — badge,
   glyph, name, PP, power, accuracy — because the phone cell's 91 px content box cannot hold
   two labels side by side: `PP 15/15` (55 px) and `PWR 90` (42.5 px) are 105 px with their
   gap, and the widest hit chance (`ACC 300 ↑`, 67.5 px) with its 8 px gap would leave the
   name 15 of those 91 px, so the accuracy keeps its own line instead of taking the name's.
   The class is read off the card's height: `battleMovesBox` builds a 236 px card in one
   branch and a 192 px one in the other, and their widths overlap.
7. **The freed ⓘ column is the name's.** No cell draws a button any more, so the glyph takes
   the cell's right padding edge and the wide name line grows from `cell.w − 90` to
   `cell.w − 60` — 132 → 162 px in the 222 px cell at 1280×800. The compact name already
   spanned its whole content box and is unchanged. `MOVE_INFO_SIZE` stays exported only
   because the canvas grid still draws its own ⓘ and `MOVE_TARGET_H` derives from it, and a
   compact cell now needs its 14 px paddings plus the glyph's 24 px column — 52 px — for the
   six lines to hold.
8. **Known residue: the 600–699 px band.** `battle-hp` leaves the phone column at
   `BATTLE_HP_BREAKPOINT` (600: it keeps the phone column while `width < 600`) and this card
   leaves its compact form at `BATTLE_COMPACT` (700: it keeps the compact card while
   `stageW < 700`), so a viewport 600–699 px wide whose stage is under 700 takes the desktop
   HP column and the compact card at once and the card can sit above the player box's bottom
   (640×480: card y 228 against the player 340..440; 800×600: card y 348 against 460..560).
   It predates this panel — `main` at `0d6deea` measures the same two rect pairs, the same
   overlaps — and making the two breakpoints agree belongs to a separate task.
9. **The target step's prompt is a row of the card, not of a slot.** The scene hands the marked
   foe's name in `BattleMovesInput.target` and the view answers a row only for a non-empty name;
   the row is the card's top band — 20 px in from its sides, 1 px under its top edge, 22 px tall
   (`MOVE_TARGET_H`) — so it ends 1 px above the four cells at 1280×800 and at 390×844, and it
   never changes a slot rect.
10. **The move card belongs to the cursor.** A card exists while the menu is open and the
    cursor's slot is filled; `BattleMovesInput.info` is still accepted, because the scene's
    canvas ⓘ still feeds it, and this panel never reads it. The card is 160 px tall (the
    board's `attack detail`) and 20 px in from the menu's left edge: anchored to the menu's top
    edge minus its 8 px gap at 1280×800 — `{460,414,524,160}`, its bottom 8 px above the menu
    — and to the phone's own HP box at 390×844 — `{36,336,216,160}`, its bottom 8 px above
    the player's box at 504. `05`'s own card sits at (664,372) because its menu starts at 664;
    this menu starts at 440, which is why the wide anchor is the menu's top edge. The card
    takes no pointer event, and its description scrolls inside the 160 px instead of growing
    the box.
11. **The phone card cedes its right rail to the stage grid.** Its width is
    `card.w − INFO_MARGIN − COMPACT_CARD_RAIL_W` — 358 − 20 − 122 = **216**, right edge 252 —
    because the right 122 px of that band are `[Task-213]`'s grid: three 34 px chips, their two
    6 px gaps and the 8 px the grid keeps beside anything else. `COMPACT_CARD_RAIL_W` is built
    from `STAGE_CHIP` / `STAGE_GAP` / `STAGE_COLS` / `STAGE_CLEARANCE` in `battle-hp/view.ts`,
    so the rail follows that grid and the two panels cannot drift apart. The grid is
    right-aligned to the player's column (374 at 390×844), so its widest box starts at 260 and
    the card's 252 leaves exactly its 8 px clearance; that holds for one chip, two, three, six
    and seven, because the alignment is horizontal — a phone double anchors the grid above the
    partner box but not further left. No floor is applied to this width: a floor would re-open
    the collision. The narrower head row is why
    `.battle-moves--compact .battle-moves__desc-title` carries `min-width: 0` and an ellipsis:
    the two 24 px glyphs and their 8 px gaps leave the title 126 px of the 190 px content box,
    so a long name ellipsizes instead of pushing the readouts to another line.
12. **The phone card clears the lead boxes only.** `COMPACT_CARD_CLEARANCE` (88) is the
    distance from the menu's top edge to the player's lead box — the 80 px phone box and the
    8 px gutter above it — so the card ends 8 px above the lead. A doubles battle on the
    phone stacks the partner box 8 px above that lead, so the card paints over it; clearing
    the partner too belongs to the panel that owns the phone column.
13. **A cell never reserves a column it cannot paint.** `BattleMoveSlotView.categoryLabel` is
    the category word a layout carries — the wide cell's `PHYSICAL` / `SPECIAL` / `STATUS`, from
    `CATEGORY_LABELS`, and `''` on the compact cell, whose category is the atlas glyph alone —
    and `categoryWord` in `battleMoves.tsx` paints it only while the cell's own `categoryBox`
    is wide enough for the string. No shipped cell is: the wide square is 24 px against
    `SPECIAL`'s 52.5 px, so the glyph stays the whole column in both width classes (§5's own
    rule) and a phone cell paints no word at all. `categoryLabel` is model data a later compact
    layout reads instead of re-deriving it, never a second copy of `category`, which stays the
    atlas key the glyph resolves.
