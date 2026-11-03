# `src/ui/hud/panels/map/` — the region header card (`03o`)

The region map of `D64` (`docs/region-spec.md` §5): the shipped 216 × 250 header card as a Preact
panel over the `#hud` layer, painting the plan's node graph — every settlement visible from the
first frame, the visited ones marked, the node the run stands on ringed and blinking, the run's
badge count in the title band. The graph itself is the pure `regionMapView` in
`src/ui/regionMap.ts`; this folder only scales what it returns and paints it. The card **is** the
panel and the canvas draws none of it; the route scene keeps the panel record (the saved layout
and the collapse), and `src/main.ts` calls `mountHud` on every boot, `?hud=dom` being an inert
alias kept only so old links still boot.

## Layout

- `view.ts` — the panel's value model: `mapPanelBox` and `mapPanelView`, the mirrored block of every Phaser constant the card reproduces (`MAP_PANEL_W`, `MAP_TITLE_H`, `MAP_LINK_STROKE`, …), the three dot tones (current / visited / unvisited) and the node-radius floor and ceiling.
- `view.test.ts` — the docked rect at both window sizes, the title, badge and grid-band geometry, the `min(band / extent)` scale and its centring, `dx + x·scale`, the edge endpoints, the badge line, the empty card, purity, and the pinned constants, headless.
- `fixture.test.ts` — `design/fixtures/03o-panels-map-routes.json` validates as a `HudState`, headless. The card no longer paints the fixture's floor: the region comes from the plan.
- `specGap.test.ts` — the `03o Panels · map routes` frame measured against this card through `specGap.views/map.ts`: the empty box, string and colour claims, the frame's own region card, chip and ROUTE/MAP toggle, the 216 × 250 card's −920 / −16 / −88 / +52 delta from the board's 304 × 198 rect, and the region the card really draws.
- `mapPanel.tsx` — the card itself: the highlight, the title line, the badge count, the one SVG that holds the edges and one `<g data-hud-region-node>` per plan node, and the "no map" label.
- `map.css` — the board's paint for the card (radius 11, hairline, the 1 px highlight), the node, edge and badge rules, and the current node's blink with its `prefers-reduced-motion` opt-out; every dot and edge colour comes from `view.ts`, never retyped here.
- `mount.tsx` — `mountMapPanel`: renders the card into a host element behind a view signal, inside the panel frame that carries its chip and drag, and returns its disposer.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never the plan: `src/scenes/panels/map.ts` calls `regionMapView(plan, run)` and then `mapPanelView`, and pushes the resulting `MapPanelView`. The card holds no `RegionPlan` and reads no node itself.
2. The panel paints one SVG for the whole graph, so a viewport change is one re-render; there is no per-node DOM box and no canvas `Graphics` under the flag.
3. A press on a node marker dispatches `{ type: 'node', key }` through `onCommand`;
   `src/scenes/panels/map.ts` folds it and asks the route to fly there, so the card never
   reads the plan and never decides a travel.
4. Every plan node is exactly one `[data-hud-region-node="<key>"]` element and every edge one
   `[data-hud-region-edge="<from>-<to>"]` line; the card's click reads the key off that
   attribute and changes no view.
5. The card prints `badges/badgeTotal` as a bare figure and reads one i18n key (`hud.noMap`); the title is the current node's own name, so no new string is owed to `src/i18n/**`.
6. The blink is a CSS affordance and is never measured: nothing in a test or a browser pass reads its opacity.
