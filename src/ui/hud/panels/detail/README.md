# `src/ui/hud/panels/detail/` — the member detail card (`03m`)

The route's member detail window as Preact over the `#hud` layer (`D49`): the shipped
460 × 560 card — the name, level, status and type chips, the STATS / MOVES tabs, the six stats
with their nature tint, the evolution graph, the 2x2 move grid, the learnset search field and
pool, and the rename field — with the board's paint from `03m Panels · pokemon moves`. The scene
module `src/scenes/panels/detail.ts` keeps the shipped layout arithmetic, the panel record and the
run, and feeds this panel's view, so a turn of `?hud=dom` swaps the drawing and not the rules.

## Layout

- `view.ts` — the panel's value model: `detailPanelView` (a pure projection of the member, the learnset pool and the panel's cursor state), `detailPanelBox`, `initialDetailPanelUi` and the block of mirrored Phaser constants.
- `view.test.ts` — the mirrored constants against their literals, both panel boxes, the tabs, the six stats and their value inset, the four move cells with their ⓘ boxes, the learnset window and its page clamp, the cursor clamps, purity and the empty view, headless.
- `evolution.ts` — the evolution graph as SVG data: one row per family node at the shipped indent and pitch, one elbow path string per branch.
- `evolution.test.ts` — the row origins, the truncation at nine rows, the exact `d` strings of the `03m` family and of its Mega / Gmax branches, headless.
- `detailPanel.tsx` — the card itself: the header, the chips, the rename field, the tab strip, the stats, the info band with its ability ⓘ, the SVG evolution graph, the move grid with its ⓘ buttons, the search field with its page arrows and the pool.
- `detail.css` — the board's card and cell paint — radius 11, the 1 px highlight, the 26 px corner badge, the accent current/ready tones — over the `styles/root.css` tokens, plus the `#4ad15c` positive the token sheet does not carry.
- `mount.tsx` — `mountDetailPanel`: renders the card into a host element against the scene's view signal and returns its disposer.
- `fixture.test.ts` — the `design/fixtures/03m-panels-pokemon-moves.json` frame rebuilt headlessly: its `HudState` validates, the header and the four move cards, the learnset band and the pasted family graph.
- `index.ts` — the barrel the scene module imports.
- `README.md` — this map.

## Rules

1. The view is data, never the run: no scene, no engine, no save, no RNG, no clock. The fixture's `state` is the empty `HudState` because this panel reads a `MemberDetail`, not a `HudState` — exactly as `02-options` carries its own `panel` block.
2. The panel answers in `DetailIntent`s, its own command vocabulary, which does **not** extend `HudCommand`: the detail window's interaction set (a move slot's grab and drop, a learnset equip, a rename) has no equivalent in that union. `src/scenes/panels/detail.ts` is the only receiver and the only writer of the run; every write goes through the engine functions that module already imports and lands through `commitRun`.
3. The card is `position: fixed` at `detailPanelBox(viewport)` and every inner rect is panel-relative, so the shipped dock, its clamp on a phone and the 1 px gate all come from one arithmetic.
4. `open` and the search query are the scene's to stamp after the pure projection (the frame machinery owns the collapse, the scene owns the filter), so the model never carries a second copy of either.
5. The evolution graph is SVG: one `<path>` per edge, one `<text>` per known level and the names as HTML over it, so a press anywhere on a ready row lands on its `<g role="button">`. The portrait cell is a placeholder rect — the board's sprite is the canvas's.
6. Every control is a real button or input and carries the kit's 44 × 44 hit overlay; a press is a click. A move cell is `cursor` on one press and `grab` (or `drop` on an empty slot) on a double press.
7. A paused route (a battle over it, the Settings screen) hides the card: `src/scenes/panels/detail.ts` follows the scene's own `PAUSE`/`RESUME` beats and stamps `open: false`, so the card never floats over the battle, and the resume gives back the same rect and the same tab.
