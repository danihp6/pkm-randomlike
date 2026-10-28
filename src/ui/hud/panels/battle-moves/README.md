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
  label boxes and the two atlas squares' boxes, the ◀, the two forme columns, the target
  step's prompt row and the card that describes the cursor's move, from a `BattleMovesInput`)
  and the mirrored constants, including the card's height (`INFO_CARD_H`) and the phone's
  clearance from its own HP box (`COMPACT_CARD_CLEARANCE`).
- `view.test.ts` — both QA viewports' cards, the card's clearance of the HP column, the slot
  rects derived from the same `moveGridCellRects` call, the wide cell's pinned boxes (the
  162 px name line, the 24 px glyph square on the right padding edge), the compact cell's six
  lines (inside the cell, disjoint and wide enough for their own text), the freed ⓘ column
  the name recovered, the glyph / ◀ / forme boxes, the stat tones, the clamping, the empty
  slot, the target step's prompt (null / name, its label, and the 22 px row ending 1 px above
  the first cell at both viewports) and the move card (the cursor's strings, the null cases,
  its two anchors and its clearance from both sides' lead boxes), headless.
- `battleMoves.tsx` — the card: one button per slot whose labels and both atlas squares are
  painted at the model's own boxes, the three controls, the target step's prompt row
  (`data-hud-move-target`, painted only while the step is open) and the one move card
  (`data-hud-move-card`, its title / `PP` / `PWR` / `ACC` / description on their own
  attributes), each control answering with a `BattleMovesIntent`. A press on a cell still
  chooses that move.
- `battleMoves.test.ts` — the slot button itself: its press emits that slot's `move` intent,
  the name, the stats and both icons land on the model's rects, one `.kit-move-type` and one
  `.kit-move-category` per filled cell and none in an empty one, an unpickable slot is
  disabled, the card carries its width class, the move card prints the cursor's move and
  nothing carries `data-hud-move-info`, one prompt row for a marked foe and none for a closed
  step, and the stylesheet keeps the card out of the pointer's way, headless.
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
  `battleMovesView`, `cellTextBoxes`, `compactCard`, `fitsInside`, the prompt row's two
  numbers, `INFO_CARD_H` / `COMPACT_CARD_CLEARANCE`, and the view's input, slot and card
  types.
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
   two labels side by side. The class is read off the card's height: `battleMovesBox` builds a
   236 px card in one branch and a 192 px one in the other, and their widths overlap.
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
    board's `attack detail`) and 20 px in from the menu's sides: anchored to the menu's top
    edge minus its 8 px gap at 1280×800 — `{460,414,524,160}`, its bottom 8 px above the menu
    — and to the phone's own HP box at 390×844 — `{36,336,318,160}`, its bottom 8 px above
    the player's box at 504. `05`'s own card sits at (664,372) because its menu starts at 664;
    this menu starts at 440, which is why the wide anchor is the menu's top edge. The card
    takes no pointer event, and its description scrolls inside the 160 px instead of growing
    the box.
11. **The phone card clears the lead boxes only.** `COMPACT_CARD_CLEARANCE` (88) is the
    distance from the menu's top edge to the player's lead box — the 80 px phone box and the
    8 px gutter above it — so the card ends 8 px above the lead. A doubles battle on the
    phone stacks the partner box 8 px above that lead, so the card paints over it; clearing
    the partner too belongs to the panel that owns the phone column.
