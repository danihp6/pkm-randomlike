# `src/ui/hud/panels/battle-moves/` — the battle move menu (`05`)

The FIGHT command's card as Preact over the `#hud` layer (`D49`): four move slots with
their type chip, category and PP / PWR / ACC lines, each slot's ⓘ and the floating
description window it pins, the ◀ back control and the MEGA / G-MAX columns. The layout
is the **shipped** one — the same `moveGridCellRects` call the canvas makes, inside the
scene's own `menu` rect — painted with `05 Battle HUD`'s cell skin.

## Layout

- `view.ts` — the panel's value model: `battleMovesBox` (the battle square's menu rect in
  page coordinates, starting where the HP column ends on the wide layout), `battleMovesView`
  (the four slots with their own category column, the ◀, the two forme columns and the
  description card from a `BattleMovesInput`) and the mirrored constants.
- `view.test.ts` — both QA viewports' cards, the card's clearance of the HP column, the slot
  rects derived from the same `moveGridCellRects` call, the ⓘ / category / ◀ / forme boxes,
  the stat tones, the clamping, the empty slot and the description card's height and
  above/below choice, headless.
- `battleMoves.tsx` — the card: one button per slot, the ⓘ buttons (a press pins the
  description, the pointer asks for it while it is over), the three controls and the floating
  description, each answering with a `BattleMovesIntent`.
- `battleMoves.test.ts` — the slot button itself: its press emits that slot's `move` intent,
  its category column lands on the model's rect, the ⓘ's enter/leave intents, an unpickable
  slot is disabled and an empty one paints no interior, headless.
- `battleMoves.css` — the board's cell skin (radius 8, the 12 % accent selected cell and
  the 4 % / 8 % row pair), the glass card and the description window, and the category's
  44 px right edge with its right-aligned text.
- `mount.tsx` — `mountBattleMoves`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `fixture.test.ts` — `design/fixtures/05-battle-hud.json` is the frame's own copy: its
  four moves, their printed lines, the selected first cell and the MEGA column; its card is
  the frame's measurement, pinned against the shipped card's right edge and height.
- `index.ts` — the barrel the scene imports: the card and its mount, `battleMovesBox` and
  `battleMovesView`, and the view's input and slot types.
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
   covers an HP box, and each slot's `categoryBox` ends `MOVE_CATEGORY_GAP` left of its ⓘ —
   the model and the stylesheet's 44 px `right` are the same rule.
6. **Known residue: the 600–699 px band.** `battle-hp` leaves the phone column at
   `BATTLE_HP_BREAKPOINT` (600: it keeps the phone column while `width < 600`) and this card
   leaves its compact form at `BATTLE_COMPACT` (700: it keeps the compact card while
   `stageW < 700`), so a viewport 600–699 px wide whose stage is under 700 takes the desktop
   HP column and the compact card at once and the card can sit above the player box's bottom
   (640×480: card y 228 against the player 340..440; 800×600: card y 348 against 460..560).
   It predates this panel — `main` at `0d6deaa` measures the same two rect pairs, the same
   overlaps — and making the two breakpoints agree belongs to a separate task.
