# `src/ui/hud/panels/map/` — the route header card (`03o`)

The floor minimap of `D49` (`docs/maps-spec.md` §8, `D32`): the shipped 216 × 250 header card as a
Preact panel over the `#hud` layer, painting a `MapPanelView` the route scene builds from the pure
`buildMapView` output. `src/ui/mapView.ts` stays the only owner of the reveal rules and of every
position it emits; this folder only scales what it returns and paints it. The route scene keeps the
panel record (so the saved layout and the collapse still work) and draws no Phaser object at all
while the flag is on.

## Layout

- `view.ts` — the panel's value model: `mapPanelBox` and `mapPanelView`, the mirrored block of every Phaser constant the card reproduces (`MAP_PANEL_W`, `MAP_TITLE_H`, `MAP_LINK_STROKE`, …), the current-room gold and `MAP_SPECIAL_TONES`, one content colour per special room kind.
- `view.test.ts` — the docked rect at both window sizes, the title and grid-band geometry, the `min(band / extent)` scale and its centring, the room/link/opening arithmetic, every marker rule, purity, and the pinned constants, headless.
- `fixture.test.ts` — `design/fixtures/03o-panels-map-routes.json` validates as a `HudState` and paints the frame: its title, its one room and one link, the current room, its one opening and its capture ball, headless.
- `mapPanel.tsx` — the card itself: the highlight, the title line, the one SVG that holds the links, the room cells, the opening ticks and the markers, and the "no map" label.
- `map.css` — the board's paint for the card (radius 11, hairline, the 1 px highlight) over the `styles/root.css` tokens; the room, link and marker colours come from `view.ts`, never retyped here.
- `mount.tsx` — `mountMapPanel`: renders the card into a host element behind a view signal and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never the plan: the scene calls `buildMapView` with the run's five inputs and pushes the resulting `MapPanelView`.
2. The panel paints one SVG for the whole minimap, so a viewport change is one re-render; there is no per-room DOM box and no canvas `Graphics` under the flag.
3. The card sends no command: the shipped header has nothing interactive and `MapPanelView` carries no chip of its own. `mountMapPanel` keeps the `onCommand` seam for the strip that will own one (`[Task-139]`).
4. A special room's dot is the kind's documented tone; the canvas glyphs (`src/scenes/rooms/*`'s `drawMarker`) are artwork no DOM panel can call, and no task owns porting them.
5. `design/fixtures/03o-panels-map-routes.json` carries the empty `HudState` — this panel reads a title and a `MapView`, not `HudState` — plus a `map` block holding the frame's own title and its `MapView` verbatim, grid units as `buildMapView` emits them.
