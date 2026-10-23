# `src/ui/hud/panels/shop/` — the Mart (`03d` buy / `03e` sell)

The floor's merchant counter as Preact over the `#hud` layer (`D49`): the title, the
money line, the BUY / SELL tabs, the seven-row stock list with its icon, name, price and
owned count, the message line and the empty-stock label. The card is the **shipped**
one — `src/scenes/rooms/shop.ts`'s 640 × 540 floating window, seven 44 px rows — painted
with the board's tokens (radius 11, the 16 % hairline, the 4 % / 8 % row pair, 10 px
body). The board's own `03d` shell (a search field, category chips and a 16-cell grid) is
a different design and not this migration: the shipped card is the one that ships.

## Layout

- `view.ts` — the panel's value model and its mirror constants: `shopPanelBox`, `shopContentRect`, `shopPanelView` (the scroll and selection clamps, the seven visible rows, the tabs, the money, the message and the empty label) and the `ShopInput` it reads.
- `view.test.ts` — the shipped rects at both QA viewports, the row window and its numbering, the scroll and selection clamps, the empty label, the affordability rule and the mirrored constant block, headless.
- `fixture.test.ts` — `design/fixtures/03d-route-shop-buy.json`: the snapshot state and the buy/sell blocks reproduced through the model.
- `shopPanel.tsx` — the panel itself: the card, the header title, the drawn ✕, the money line, the tabs, the rows with their icon and counts, the message, the hint and the empty label.
- `shop.css` — the board's card and row paint, one scoped custom property per board value.
- `mount.tsx` — `mountShopPanel`: renders the panel into a host element from a signals view and returns its disposer, plus the card's `ShopIntent` channel.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG, no `HudState` and no `src/data/**`. This panel reads `ShopRow`s, a title and a money figure — never the snapshot — so a fixture only pins the rows the card prints, and the atlas URL and the sprite offsets arrive through `ShopRowView.icon`, so a test passes a stub.
2. Every printed rect comes from the view, never from the stylesheet: `shop.css` paints and positions nothing the model already measured. The title is the one exception: the contract's view carries no title rect, so the header band is built from `SHOP_HEADER_H` and `SHOP_PAD_X`.
3. The card's border is a real 1 px edge (the fidelity gate reads it), so the content layer sits at `inset: -1px` and the model's panel-relative rects land on the card's outer box.
4. A press carries the row's `itemId`, never the row: the scene module resolves the stock row, calls `buyItem` / `sellItem` once and commits once.
5. The list pages rows (the wheel steps `scroll` by one); the `<ol>`'s native scroll is never used, exactly as the shipped card pages rather than scrolls pixels.
6. A paused route (a battle over it, the Settings screen) hides the card: `src/scenes/panels/shop.ts` follows the scene's own `pause`/`resume` beats and stamps `open: false`, so the card never floats over the battle, and the resume gives back the same mode, rows and money.
