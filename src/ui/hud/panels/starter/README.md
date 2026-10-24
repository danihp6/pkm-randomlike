# `src/ui/hud/panels/starter/` — the starter pick (`04` / `m04`)

The run opener as Preact over the `#hud` layer (`D49`): the title, the three cards with
their type badges, the share line and the controls hint. The rule never lives here:
`src/scenes/StarterScene.ts` keeps the seed roll, the cursor, the seed prompt and the run
it starts, and this panel paints the view it is handed.

## Layout

- `view.ts` — the panel's value model: `liveStarterView` (the pool's cards from the dex, the clamped cursor, the `encodeRunShare` share line and the scene's hint), `fixtureStarterView` (the frame's own copy and its structural guards), both boards' rects through `starterBoard`, the breakpoint and the two slugs.
- `view.test.ts` — the live cards in pool order, their dex names/numbers/types, the cursor clamp, the share line, the hint and the purity check, headless.
- `starterPanel.tsx` — the panel itself: the title, one button card per species with its kit `Panel` skin, placeholder portrait, name and `TypeBadge` row, the share line and the hint.
- `starter.css` — the frames' measured geometry and paint, one scoped custom property per board value, plus the phone column.
- `mount.tsx` — `mountStarter`: renders the panel into a host element, repaints it on `update`, and returns the handle the scene disposes; the `StarterIntent` union its gestures emit.
- `preview.ts` — `starterPreviewRequested` and `installStarterPreview`: the frame's panel behind `?hud=dom&hudFixture=<slug>`.
- `preview.test.ts` — `starterPreviewRequested`'s truth table, headless.
- `fixture.test.ts` — `design/fixtures/04-starter-pick.json` against `design/frames/04` and `m04`: the state, the copy, the dex agreement, both boards' rects and the payload guards.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no RNG, no clock and no Phaser. The scene owns the pool, the cursor and the seed; a gesture answers in a `StarterIntent` (`select` on a hover or a focus, `choose` on a click or Enter) and changes nothing here.
2. A card is a real `<button>`, so Enter and Space are the browser's own click and the scene's keybinds stay the only keyboard listener. Its wrapper is the measured node and carries the board's paint; the kit `Panel` it wraps is the skin.
3. The hairline is an inset outline, not a border: the wrapper's box is the card box and its children measure from the card's own corner (the options card and the main menu's rows draw their edge the same way).
4. The portrait cell is a placeholder — the body's sprite pixels are the canvas's, the rule the party, trade and detail panels already follow.
5. The desk board draws the type badges as a centred row (so its `badge.dx` is where a two-badge row starts) and the phone anchors the row at `dx`. The phone frame prints bulbasaur's second badge on top of the first, so the phone keeps the desk's 12 px gap.
6. `liveStarterView` prints the dex name and the stylesheet uppercases it; the hint is the shipped controls line the scene passes in, never the frame's "HOLD R FOR NEW SEED" (there is no R action: `S` opens the seed prompt).
7. The panel reads `starter` alone: the snapshot's `state` belongs to the HUD layer, and the fixture store has already refused a file whose state is not a `HudState`.
