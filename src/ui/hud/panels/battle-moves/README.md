# `src/ui/hud/panels/battle-moves/` — the battle move menu (`05`)

The FIGHT command's card as Preact over the `#hud` layer (`D49`): four move slots with
their type chip, category and PP / PWR / ACC lines, each slot's ⓘ and the floating
description window it pins, the ◀ back control, the MEGA / G-MAX columns and the target
step's prompt row. The slot rects are the **shipped** ones — the same `moveGridCellRects`
call the canvas makes, inside the scene's own `menu` rect — painted with `05 Battle HUD`'s
cell skin, and each label sits at the box the view measures for it (`cellTextBoxes`): three
lines in the wide cell, six stacked ones in the compact (phone) cell.

## Layout

- `view.ts` — the panel's value model: `battleMovesBox` (the battle square's menu rect in
  page coordinates, starting where the HP column ends on the wide layout), `compactCard` (the
  card's width class), `cellTextBoxes` and `fitsInside` (a cell's five label boxes and the
  containment test the panel and QA share), `battleMovesView` (the four slots with their own
  label boxes and type chip box, the ◀, the two forme columns, the target step's prompt row
  and the description card from a `BattleMovesInput`) and the mirrored constants.
- `view.test.ts` — both QA viewports' cards, the card's clearance of the HP column, the slot
  rects derived from the same `moveGridCellRects` call, the wide cell's pinned boxes, the
  compact cell's six lines (inside the cell, disjoint and wide enough for their own text),
  the ⓘ / category / ◀ / forme boxes, the stat tones, the clamping, the empty slot, the
  target step's prompt (null / name, its label, and the 22 px row ending 1 px above the first
  cell at both viewports) and the description card's height and above/below choice, headless.
- `battleMoves.tsx` — the card: one button per slot whose labels are painted at the model's
  own boxes, the ⓘ buttons (a press pins the description, the pointer asks for it while it is
  over), the three controls, the target step's prompt row (`data-hud-move-target`, painted
  only while the step is open) and the floating description, each answering with a
  `BattleMovesIntent`.
- `battleMoves.test.ts` — the slot button itself: its press emits that slot's `move` intent,
  every label and the type chip land on the model's rects, the ⓘ's enter/leave intents, an
  unpickable slot is disabled, an empty one paints no interior, the card carries its width
  class and paints one prompt row for a marked foe and none for a closed step, headless.
- `battleMoves.css` — the board's cell skin (radius 8, the 12 % accent selected cell and
  the 4 % / 8 % row pair), the glass card and the description window, the target step's
  prompt (one line, body type, centred in the card's 22 px top band), and the absolutely
  placed labels the model positions (the category right-aligned, the accuracy right in the
  wide cell and left in the compact one).
- `mount.tsx` — `mountBattleMoves`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `fixture.test.ts` — `design/fixtures/05-battle-hud.json` is the frame's own copy: its
  four moves, their printed lines, the selected first cell and the MEGA column; its card is
  the frame's measurement, pinned against the shipped card's right edge and height.
- `index.ts` — the barrel the scene imports: the card and its mount, `battleMovesBox`,
  `battleMovesView`, `cellTextBoxes`, `compactCard`, `fitsInside` and the prompt row's two
  numbers, and the view's input, slot and box types.
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
   covers an HP box, and each slot's `categoryBox` ends `MOVE_CATEGORY_GAP` left of its ⓘ.
6. **Every label is painted at its own model box.** `cellTextBoxes` lays a cell out by its
   width class and the stylesheet only paints: the cell keeps no grid, so nothing can reflow a
   label out of the rect a test measured. The wide class is the shipped three-line cell (the
   name and the category on the first line, PP under them, power and accuracy on the third
   past the type chip's measured column); the compact class is six stacked lines — chip and ⓘ,
   category, name, PP, power, accuracy — because the phone cell's 91 px content box cannot
   hold two labels side by side. The class is read off the card's height: `battleMovesBox`
   builds a 236 px card in one branch and a 192 px one in the other, and their widths overlap.
7. **The compact stack needs a 118 px cell** (14 px of padding, the 60 px category, its 8 px
   gap and the 22 px ⓘ, twice), which a 388 px stage is the first to give; 390×844, the board's
   phone, clears it by one pixel. A narrower compact card is below what this panel draws.
8. **Known residue: the 600–699 px band.** `battle-hp` leaves the phone column at
   `BATTLE_HP_BREAKPOINT` (600: it keeps the phone column while `width < 600`) and this card
   leaves its compact form at `BATTLE_COMPACT` (700: it keeps the compact card while
   `stageW < 700`), so a viewport 600–699 px wide whose stage is under 700 takes the desktop
   HP column and the compact card at once and the card can sit above the player box's bottom
   (640×480: card y 228 against the player 340..440; 800×600: card y 348 against 460..560).
   It predates this panel — `main` at `0d6deaa` measures the same two rect pairs, the same
   overlaps — and making the two breakpoints agree belongs to a separate task.
9. **The target step's prompt is a row of the card, not of a slot.** The scene hands the marked
   foe's name in `BattleMovesInput.target` and the view answers a row only for a non-empty name;
   the row is the card's top band — 20 px in from its sides, 1 px under its top edge, one ⓘ tall
   (22 px) — so it ends 1 px above the four cells at 1280×800 and at 390×844, and it never
   changes a slot rect.
