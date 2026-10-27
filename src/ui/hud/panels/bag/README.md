# `src/ui/hud/panels/bag/` — the route bag (`03b`)

The route's bag window as Preact over the `#hud` layer (`D49`): the card, the five pocket
tabs, the filter field, the five-column stack grid, the money footer and the floating
description card the scene module used to draw in Phaser. The layout is the **shipped**
one, mirrored from `src/scenes/panels/bag.ts`; the paint is the board's bag group
(`design/frames/03b-panels-row-view.json`).

## Layout

- `view.ts` — the panel's value model and its mirror constants: `bagPanelBox`, `bagPanelView` (pocket and query filtering, the grid layout, the money row and the card's rect and selected stack's text) and the initial cursor state.
- `view.test.ts` — the shipped rects and internals at both QA viewports, the tile icons, the pocket and query filters, the 15-stack cap, the description card's body and its 13 px growth per wrapped line, and the mirrored constant block, headless.
- `bagPanel.tsx` — the panel itself: the card, the highlight, the key chip, the tabs, the search input, the tiles with their icon and count, the footer and the description card.
- `bag.css` — the board's bag paint (radius 11, the hairline, the 14 % highlight, the key chip, the search field, the 8/4 % tile and the 9 px count) scoped to `.bag`.
- `mount.tsx` — `mountBagPanel`: renders the panel into a host element from a signals view and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG, no save and no `src/data/**`. The prose arrives through `itemText` (`src/i18n/content.ts`), the same seam `t` is; the route scene module finalises the drawn card's body from the run (`bagInfoFor`, which prints a discovered candy's treat), so that override is what the screen shows. The atlas URL and the sprite offsets arrive through `BagTileView.icon`, so a test passes a stub.
2. Every rect comes from the view, never from the stylesheet: `bag.css` paints and positions nothing the model already measured.
3. The card's border is a real 1 px edge (the fidelity gate reads it), so the content layer sits at `inset: -1px` and the model's panel-relative rects land on the card's outer box.
4. The description card is `position: fixed` and floats outside the card, exactly where the Phaser `InfoPopup` rides the HUD root; its height is its wrapped text with the model's box as the floor.
5. A press the panel owns itself is the key chip only, answered as `{ type: 'panel', panel: 'bag' }`; the tabs, the tiles and the search field are the scene module's cursor state.
