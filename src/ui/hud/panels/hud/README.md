# `src/ui/hud/panels/hud/` — the route strip (`03`)

The edge chips of the route HUD under `?hud=dom` (`D49`): the 26×26 letter badges a collapsed
panel leaves behind, laid out by a pure module and painted by Preact over `#hud`. A collapsed DOM
card hides its whole root — its own accent chip included — so this strip is the only way back to a
collapsed bag, box or map. Everything else the route HUD shows in its cards (the party's level, XP
and Pokevial meter, the bag's money footer) is those panels' own and is never redrawn here.

## Layout

- `view.ts` — the strip's value model: `stripView` from the panel docks and the live keybinds, `STRIP_CHIP_ORDER`, the four panels' letters and quick-key actions, the board's phone slots and the `STRIP_NARROW` breakpoint.
- `view.test.ts` — the pinned constants, the phone rail and its exact boxes, the wide rail at each panel's own dock, the paused/all-open/all-collapsed rules, the label that follows a rebind while the letter does not, purity, and the scene module's flag contract (`hudDrawnObjectCount`), headless.
- `fixture.test.ts` — `design/fixtures/03-route-hud.json` validates as a `HudState`, and its three `narrow.chips` boxes deep-equal the frame's own `m chip` nodes.
- `strip.tsx` — the strip itself: one chip per view entry, the letter inside it and the press that becomes `{ type: 'panel', panel }`.
- `strip.css` — the board's badge paint (fill, 1 px inside border, radius 6, the 11/15 px bold ink) over the `styles/root.css` tokens, and the 44 px thumb overlay.
- `mount.tsx` — `mountHudStrip`: renders the strip into a host element behind a view signal and returns its disposer.
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
5. A phone (`< STRIP_NARROW`) takes the frame's own slots; a wider window takes each panel's dock,
   which is exactly where its Phaser collapse icon was.
