# `src/ui/hud/panels/trade/` — the trade card (`03i` pick / `03j` result)

The trade room's counter as Preact over the `#hud` layer (`D49`), in the board's two
states: the **pick** sheet (`03i`) with the title, the `PARTY n/6 · PC m/16` meta line,
the room's opening line, six party tiles two a row, the sixteen-cell PC column and the
`GIVE AWAY` button, and the **result** card (`03j`) that a landed trade shows — a
centred 560 × 420 card with the portrait, the type chip, the received name and the
`ADDED TO YOUR PARTY` line over its `CLOSE` button. The rule never lives here:
`tradePokemon` (`src/engine/run/trade.ts`) is the only thing that changes the run, and
`src/scenes/panels/trade.ts` is the only caller.

## Layout

- `view.ts` — the panel's value model and the frames' own numbers: `tradePanelBox`, `tradePanelView`, the mirrored constant block (`TRADE_CARD_W`, `TRADE_PARTY_TILE_W`, `TRADE_PC_CELL`, `TRADE_GIVE_W`, …) and the `TradeInput` it reads.
- `view.test.ts` — every rect read out of `design/frames/03i` / `m03i` / `03j` / `m03j` and compared with the view, both QA viewports, the selection and affordability clamps and the purity check, headless.
- `fixture.test.ts` — `design/fixtures/03i-panels-trade-pick.json` and `03j-panels-trade-result.json`: the six tiles in party order, the selected index, the meta line, the box count, the spent room's disabled press and the result card's strings.
- `tradePanel.tsx` — the card itself: the scrim, the highlight, the header, the party and PC grids with their placeholder portraits, the footer button, the dismiss ✕ and the result card.
- `trade.css` — the board's paint for both states: the 74 % scrim, radius 11 (12 on the narrow frame), the 16 % hairline, the 14 % highlight, the 4 % tile pair with the accent selected edge and the one filled action.
- `mount.tsx` — `mountTradePanel`: renders the panel into a host element from a signals view and returns its disposer, plus the card's `TradeIntent` channel (`pick` / `give` / `close`).
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG, no dex and no `src/data/**`. The frame a portrait paints and every name arrive on the input, so a fixture pins the tiles the card prints and a test needs no atlas.
2. Every printed rect comes from `view.ts`; `trade.css` paints and positions nothing the model already measured. The one exception is the portrait cell inside a tile: it is centred by the stylesheet (64 px on the desk, 44 px on the narrow frame, 32 px in a PC cell), because the contract's tiles carry their own box and not their portrait's.
3. The pick card's border is a real 1 px edge (the fidelity gate reads it), so the content layer sits at `inset: -1px` and the model's panel-relative rects land on the card's outer box. The result state clears the panel's own surface: `03j`'s card is a smaller card centred inside the panel's box.
4. A press carries a party index, never a member: the PC column is **read-only**, because `TradeRequest` only accepts a party `memberId`. The scene module resolves the id and calls `tradePokemon` once.
5. The frames carry no dismiss control. The pick card therefore adds a 24 px ✕ — on the desk in the footer's empty right end, flush with the content inset and centred on the give-away button; on the narrow sheet in the header's right corner, with the meta line ending 8 px short of it so no string runs under a press target.
6. The narrow frame has room for twelve PC cells (three rows, from `y 254`), not sixteen, so the sheet paints what fits and the box's own count stays on the meta line.
7. A paused route (a battle over it, the Settings screen) hides the card: `src/scenes/panels/trade.ts` follows the scene's `pause`/`resume` beats and stamps `open: false`, so the card never floats over the battle and the resume gives back the same selection and line.
8. The frames darken the route under a 74 % veil, so the panel paints one (`position: fixed`, no pointer capture): the shipped Phaser window drew the same rectangle, and a card floating on an undimmed route reads as neither modal nor legible. The scrim is the root's child — the root's own rect stays the card's, which is what the live check measures.
