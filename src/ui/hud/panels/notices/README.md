# `src/ui/hud/panels/notices/` — the route's passive cards (`03k` / `m03k`)

The route's three transient cards as Preact over the `#hud` layer (`D49`): the notice
strip, the floor's mission line and the area-entry banner. They are the board's `03k`
strip (720 × 56 at (280,24) on the desktop board; 374 × 56 at (8,47) on the phone), the
mission card under it and the boxed accent banner below that. The phone stack starts at
the `design/tokens.json` safe area — 47 px top, 810 bottom — which the canvas never
respected. No card takes input: the route keeps walking under them.

The board's `03l` (the level-up strip with its learned-move rows) is not this migration:
`Notice` carries text and a hold only, so every notice, level-up included, is the `03k`
shape until that variant's data exists.

## Layout

- `view.ts` — the panel's value model: `noticeBox`, `missionBox`, `areaBox`,
  `noticesPanelView`, the safe-area constants and the three rects per viewport.
- `view.test.ts` — the board's rects at both viewports (asserted against the exported
  frames `03k` and `m03k`), the safe-area source, the viewport edges, the narrow-window
  clamps and the purity of the view, headless.
- `fixture.test.ts` — `design/fixtures/03k-panels-notice-item.json`: its snapshot state,
  the frame's own line and the strip's rect, with no mission and no area banner.
- `noticesPanel.tsx` — the panel itself: the three cards, each one line, each hidden
  rather than absent while it is down.
- `notices.css` — the board's card paint: radius 11, the 16 % hairline, the 12 px
  highlight, the readout on the strip and the mission, the title on the area banner.
- `mount.tsx` — `mountNoticesPanel`: renders the panel into a host element from a
  signals view and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no engine, no RNG, no i18n and no `src/data/**`.
   The scene resolves the copy and hands over the lines; the panel prints them.
2. Every rect comes from the view, never from the stylesheet: `notices.css` paints only.
3. The cards are `pointer-events: none` and hold no handler, so the canvas under the
   `#hud` layer keeps the route's keys and taps.
4. A card that is not up stays in the tree, hidden, so its rect is zero and the panel
   never re-mounts between notices.
5. The safe area lives once, as `SAFE_AREA_TOP` / `SAFE_AREA_BOTTOM` in `view.ts`, and
   `view.test.ts` pins them against `design/tokens.json`.
