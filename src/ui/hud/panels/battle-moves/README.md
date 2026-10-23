# `src/ui/hud/panels/battle-moves/` — the battle move menu (`05`)

The FIGHT command's card as Preact over the `#hud` layer (`D49`): four move slots with
their type chip, category and PP / PWR / ACC lines, each slot's ⓘ and the floating
description window it pins, the ◀ back control and the MEGA / G-MAX columns. The layout
is the **shipped** one — the same `moveGridCellRects` call the canvas makes, inside the
scene's own `menu` rect — painted with `05 Battle HUD`'s cell skin.

## Layout

- `view.ts` — the panel's value model: `battleMovesBox` (the battle square's menu rect in
  page coordinates), `battleMovesView` (the four slots, the ◀, the two forme columns and
  the description card from a `BattleMovesInput`) and the mirrored constants.
- `view.test.ts` — both QA viewports' cards, the slot rects derived from the same
  `moveGridCellRects` call, the ⓘ / ◀ / forme boxes, the stat tones, the clamping, the
  empty slot and the description card's height and above/below choice, headless.
- `battleMoves.tsx` — the card: one button per slot, the ⓘ buttons, the three controls and
  the floating description, each answering with a `BattleMovesIntent`.
- `battleMoves.css` — the board's cell skin (radius 8, the 12 % accent selected cell and
  the 4 % / 8 % row pair), the glass card and the description window.
- `mount.tsx` — `mountBattleMoves`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `fixture.test.ts` — `design/fixtures/05-battle-hud.json` is the frame's own copy: its
  four moves, their printed lines, the selected first cell and the MEGA column.
- `index.ts` — the barrel the scene imports.
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
