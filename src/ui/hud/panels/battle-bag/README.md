# `src/ui/hud/panels/battle-bag/` — the battle's bag (`05c`)

The BAG command's card as Preact over the `#hud` layer (`D49`): the pocket chips, the
filter field, the 5×2 stack grid with its ×N badges and its dim empty tail, the selected
stack's line, the floating item card and the ◀ back control. The card **is** the battle's
menu box — `battleBagBox`, the shipped `battleMovesBox` re-exported — so the bag lands on
the same window the canvas laid out, at 1280×800 and on the compact phone layout alike.

## Layout

- `view.ts` — the panel's value model: `battleBagBox` (the battle square's menu rect in
  page coordinates), `battleBagView` (the chips, the field, the grid band, the ten cell
  boxes from `bagGridLayout`, the selected line, the item card and the ◀) and the mirrored
  constants.
- `view.test.ts` — both QA viewports' cards, the card-relative arithmetic pinned (chips at
  y 16 of 120×26, the field at y 50 of height 24, the band at y 82 of height 76, the line at
  y 164, 35 px cells at a 41 px pitch, the 320 px item card), the `bagGridLayout` equality
  and the clamping, headless.
- `battleBagPanel.tsx` — the card: one button per pocket chip, the native filter input, one
  button per stack (or the dim outline of a tail cell), the ◀, and the item card; each
  control answers with a `BattleBagIntent`. `cellPressIntent` is the arm/use rule: a press
  picks the stack, a press on the picked one spends it.
- `battleBag.css` — the hidden canvas window's glass, the chip/field/cell skins and the dim
  tail outline.
- `mount.tsx` — `mountBattleBag`: renders the card into a host element, returns the
  controller the scene pushes through, and carries the panel's own intent union.
- `index.ts` — the barrel the scene imports.
- `fixture.test.ts` — `design/fixtures/05c-battle-bag.json` is the frame's own copy: its
  two pocket labels, the `SEARCH ITEMS` placeholder, its eight stacks and quantities, the
  selected first stack and the `Potion` card.
- `README.md` — this map.

## Rules

1. The view is data, never the battle: the scene builds `BattleBagInput` from its own
   `bagCategories`, `bagStacks`, `bagQuery` and `menuIndex`. The panel reads **no**
   `HudState`, and nothing here imports the engine, a random stream or a clock.
2. The card is `battleMovesBox`, the grid is the same `bagGridLayout` call the canvas makes
   (`{ rows: 2, gap: BAG_GRID_GAP, maxCell: 56 }`), and the pocket filtering stays in
   `src/ui/bag.ts` — the panel never re-fits or re-filters anything.
3. Every intent lands on the call the canvas already made: `tab` on `selectBagTab`'s effect,
   `select` on `selectBagCell`, `use` on the `{ type: 'bag', itemId }` a confirm press
   submits, `search`/`focus` on the field's own fields, `scroll` on the wrapped cursor step
   and `back` on `onBack`. No rules, no RNG and no save field move here.
4. The card is `position: fixed` at the model's rect and only its controls take a press
   (`pointer-events: none` on the layer), so the canvas's pads and keys keep every other
   press; under `?hud=dom` the scene draws none of its own bag chrome.
