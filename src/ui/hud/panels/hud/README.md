# `src/ui/hud/panels/hud/` — the route strip (`03`) and its panel frame

The edge chips of the route HUD under `?hud=dom` (`D49`): the 26×26 letter badges a collapsed
panel leaves behind, laid out by a pure module and painted by Preact over `#hud`. A collapsed DOM
card hides its whole root — its own accent chip included — so this strip is the only way back to a
collapsed bag, box or map. Everything else the route HUD shows in its cards (the party's level, XP
and Pokevial meter, the bag's money footer) is those panels' own and is never redrawn here.

The folder also owns the **frame** each card mounts in: the one implementation of the chip, the
drag with its clamp and the saved offset, so a new card inherits all three by mounting inside it.

## Layout

- `view.ts` — the strip's value model: `stripView` from the panel docks, their saved drag offsets and the live keybinds, `STRIP_CHIP_ORDER`, the four panels' letters and quick-key actions, the board's phone slots and the `STRIP_NARROW` breakpoint.
- `view.test.ts` — the pinned constants, the phone rail at its slot plus the saved offset, the wide rail at each panel's own dock, a restored offset, the paused/all-open/all-collapsed rules, the label that follows a rebind while the letter does not, purity, and the scene module's flag contract (`hudDrawnObjectCount`), headless.
- `drag.ts` — the one drag rule the HUD has: `DRAG_SLOP`, `badgeDrag` (the slop, the travel added to the saved offset and the clamp that keeps a badge inside the window less its 26 px) and `badgeLayout` (the record a drag commits, the collapsed flag untouched). Pure, no DOM.
- `drag.test.ts` — the press under the slop on both axes, the slop itself counting as a drag, a phone drag at (390 × 844) and the same gesture on a desk, both clamps, a window too small to clamp against and purity, headless.
- `fixture.test.ts` — `design/fixtures/03-route-hud.json` validates as a `HudState`, and its three `narrow.chips` boxes deep-equal the frame's own `m chip` nodes.
- `strip.tsx` — the strip itself: one chip per view entry, the letter inside it, the card's own gesture through `badgeDrag` (a press toggles, a drag commits through `onLayout`) and the `HudStripCallbacks` the mount hands it.
- `strip.css` — the board's badge paint (fill, 1 px inside border, radius 6, the 11/15 px bold ink) over the `styles/root.css` tokens, the 44 px thumb overlay and the drag handle's no-scroll `touch-action`.
- `mount.tsx` — `mountHudStrip`: renders the strip into a host element behind a view signal with the scene's callbacks and returns its disposer.
- `panelFrameView.ts` — the frame's pure geometry: `clampPanelOffset` (the nearest offset that keeps a card inside the window) and `frameLabel` (the chip's accessible name, or `null` for the detail card the board draws no chip for).
- `panelFrameView.test.ts` — the clamp at 1280 × 800 and at 390 × 844, a card wider or taller than the window, a card that fills it, non-finite junk, and the label against the live keybinds, headless.
- `panelFrame.tsx` — `PanelFrame`: the shell every route card mounts in, with the 26 px chip that collapses and drags it, the clamped commit through `onLayout`, the shared `DRAG_SLOP` and the root `transform` that moves the card, its chip and nothing else.
- `panelFrame.css` — the frame's own geometry over the `styles/root.css` tokens: the overlay root that paints no position, the chip's badge paint, the 44 px thumb overlay and the no-scroll `touch-action`.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never Phaser: the scene hands over the panel records' docks (plus their drag
   offsets) and the settings' keybinds, and paints what comes back. A collapse, a drag, the stored
   layout and a resize all reach the rail through the same `refresh`.
2. Only a **collapsed** panel gets a chip. An open panel is drawn by its own card's chip, so a panel
   never appears twice; a panel the scene has not built yet gets none.
3. The letter is the panel's initial (`M`/`C`/`P`/`I`), never the bound key's: the live binding goes
   in the accessible label, so a rebind stays discoverable and the badge stays the board's.
4. A press is `{ type: 'panel', panel }` and nothing else — the scene runs `toggleHudPanel`, the same
   function a quick key runs. No new `HudCommand` variant and no new i18n key.
5. A phone (`< STRIP_NARROW`) takes the frame's own slots as the **origin** the saved offset is
   added to; a wider window takes each panel's dock, which already carries the offset.
6. A badge drags, and it drags by the card's own rule: `badgeDrag` decides press-or-drag, the clamp
   is the frame's, and the commit goes through the frame host the card writes. A drag never toggles
   and a tap never commits; the view never invents a position.
