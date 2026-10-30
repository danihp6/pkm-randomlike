# `src/ui/hud/panels/main-menu/` — the main menu (`01` with a save, `01b` without)

The landing screen as Preact over the `#hud` layer (`D49`): the title block with its accent
rule, the route window's chrome and its live route, the card with its CONTINUE / NEW RUN /
OPTIONS / STATS rows and the stats footer. The rule never lives here:
`src/scenes/MainMenuScene.ts` keeps the save read, the keyboard cursor, the preview seed and
every navigation, and this panel paints the view it is handed.

## Layout

- `view.ts` — the panel's value model: `liveMainMenuView` (the navigable rows, the CONTINUE row's `runPositionLabel` value and the box it is elided into, the party portraits and their reserved block, the decorative route's `previewSeed` and the footer's three figures and version line), the live footer's records (`mainMenuRecords` / `mainMenuStats`), `fixtureMainMenuView` (the frame's own copy and its structural guards), both boards' rects, the compact footer's two-row rects (`MAIN_MENU_FOOTER_NARROW`), the breakpoint and the two slugs.
- `view.test.ts` — the live rows with and without a run, the labels and values, the CONTINUE row's value box against the portraits' block, the elision, the portrait strip and its atlas cells, the preview seed and its slug fallback, the footer's live figures and month, the compact footer's geometry, the cursor clamp and the purity checks, headless.
- `version.ts` — the build stamp: the package version and the roadmap phase as constants and `menuVersionLabel`, the `v<version> · PHASE <phase>` line the panel prints.
- `version.test.ts` — the board's own string, this build's defaults, the separator and the phase, headless.
- `routeWindow.ts` — the route window's geometry over the engine's preview model: `previewRoomFor` (one room per `(seed, window)`), `previewOrigin` / `previewTileBox` / `previewWalkerBox` (centred 24 px cells) and `tileBackground` (a tile's object-over-ground CSS backgrounds), plus the walkers' one timer step (`ROUTE_PREVIEW_STEP_MS`, the engine's own `PREVIEW_TICK_MS`), their one walk cadence (`WALK_STEP_MS`, one tile's slide, and `WALK_FRAME_MS`, the pair strip's frame period), the trail's `TRAIL_MS` and its four plate colours, and `walkerPaint`, the one function that turns a walker, its motion and its pair sheet into a box, the pair's (or the portrait's) backgrounds, a flip, a transition length one `WALK_STEP_MS` per stride tile, and the plate of the tile it stands on with the half-alpha one the tile it left keeps. The cell a walker draws is the species' own height inside its 24 px box (`overworldScale`, `src/data/overworldSize.ts`), bottom-centred, so a taller species draws bigger and the box never moves.
- `routeWindow.test.ts` — the room cache and its key, the centred origin and every tile and walker box inside the window, the object-first / ground-last background arithmetic, the tick, the walk and the trail constants, and `walkerPaint`'s pair frames (walk / idle, the walk strip's last frame while it rests, the side row for E and W), its transition over a two-, three- and four-tile stride and on a first paint, its portrait fallback, its plate and trail boxes and their alphas, and its purity, headless.
- `mainMenuPanel.tsx` — the panel itself: the glow, the window with its tile field and the Pokémon walking it (each one booking a 2–4-tile stride per model tick, sliding the whole stride over one `WALK_STEP_MS` per tile, standing its drawn rest on the walk strip's last frame, and carrying a ground plate plus the 400 ms trail of the tile it left, its pair strip or its portrait crop, the pair preloaded per species and swapped for the portrait when its PNG refuses), the title and its rule, the card with its rows, bars, cursor, portrait cells drawn from the view's crops, the footer figures and the version line.
- `main-menu.css` — the frame's measured geometry and paint, one scoped custom property per board value, the window's clipped tile layer, the walker's box-only linear transition (its frame cut never smears), the plate and trail spans the paint colours inline, the phone column and the compact footer's two rows.
- `mount.tsx` — `mountMainMenu`: renders the panel into a host element, repaints it on `update`, and returns the handle the scene disposes.
- `preview.ts` — `mainMenuPreviewRequested` and `installMainMenuPreview`: the frame's panel behind `?hud=dom&hudFixture=<slug>`, one payload per slug.
- `preview.test.ts` — `mainMenuPreviewRequested`'s truth table, headless.
- `fixture.test.ts` — both fixtures against `design/frames/01`, `01b`, `m01` and `m01b`: the states, the rows, the selected row, the portraits and their atlas cells, the figures, the boards, the preview seed's slug fallback and the payload guards.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no RNG, no clock and no Phaser. The scene owns the save, the cursor and the one preview seed it draws per boot; a row press answers in a `MainMenuIntent` and changes nothing here.
2. The card wrapper and the row wrappers are the measured nodes; the kit `Panel` and `Row` they wrap are the skins. That is why the paint and the board's 1 px edges sit on the wrapper and the row box is the same box as its button within 1 px.
3. `portraits` is read from the payload's `state.party`, never from `rows`: the frame, not the payload, decides whether a CONTINUE row is drawn.
4. The portrait cells draw the party member's own atlas cell through `src/ui/hud/portrait.ts` (`portraitBackground`), in party order; the empty 4 % box is only the fallback for a species the atlas does not name.
5. The footer's figures are **live data**: `mainMenuRecords` reads the save's history (every
   finished run won; the deepest floor of a finite run; the deepest floor of a finite run in
   the current UTC month) and `mainMenuStats` prints the three labels with zeroes on an empty
   store, never a blank. The monthly figure carries the month's label under it, because the
   store has no player name; `version` is the build's `v<version> · PHASE <phase>` line. The
   STATS row opens the stats panel (`src/ui/hud/panels/stats/`) in the scene; the canvas
   fallback keeps three rows (or two without a run). On the phone the three figures wrap into
   two rows (`MAIN_MENU_FOOTER_NARROW`), because the desk's single row collides at 390 px, and
   the version line is hidden in CSS because neither phone frame draws one.
6. The window's route is decoration (`D55`) and it has **two clocks**, never one. The **model**
   clock is the single `ROUTE_PREVIEW_STEP_MS` timer (600 ms, the engine's own `PREVIEW_TICK_MS`)
   that calls `stepPreviewWalkers` once and that unmount clears: a tick books a **stride** of two
   to four tiles along one heading, drawn from the walker's own stream together with the beat it
   then stands, and the `rest` ticks that follow book no move at all; the heading is itself drawn
   among the candidate headings whose straight line can book at least two tiles — every candidate
   only when none can, so a boxed-in walker still answers the longest legal stride — which is what
   keeps an open room from metronoming one tile at a time; a tile is still a function of the tick
   count alone, so every per-walker stream and every fixed-seed fold replays exactly. The
   **paint** clock is `WALK_STEP_MS` (200 ms, the route scene's own step) and `WALK_FRAME_MS` (the
   pair strip's frame at `FOLLOWER_FRAME_RATE`): a stride slides the box one 24 px cell per
   `WALK_STEP_MS` for as many tiles as it booked, and the walker plays the pair's `walk` strip
   while it moves and holds that strip's **last frame** while it rests; the cell it draws is the
   species' own height inside the 24 px box (`overworldCellHeight`), so a Wailord fills the tile
   and a Diglett keeps headroom; a first paint and a room change set the box with no transition,
   so nothing slides in from the corner. The **plate** and the **trail** are the paint's, never the
   component's: `walkerPaint` returns the 24 px box of the tile the walker stands on and, while the
   last stride is under `TRAIL_MS` (400 ms) old, the same box on the tile it left at half the
   alpha — the route's ground lifted toward the accent, or the board's tab plate behind a portrait
   — so the panel only styles them and a fixture measures them. The paint clock reads **elapsed
   time only** — no RNG draw, no save field, no `SAVE_VERSION` step — and a species with no pair
   art (or a pair whose PNG refuses) keeps its portrait crop, so a box is never empty. A stride
   never walks back over the tile the last one started from while another card is open (the model
   carries `previous`), so two samples always catch it somewhere new. It starts no encounter, draws
   no player and writes nothing; the seed rides in the view, so a fixture frame and the live panel
   draw the same room.
7. The CONTINUE row's portraits are a **reserved block**, not a floating strip: `mainMenuPortraitsBox` puts the party's cells on the row's 6 px right inset, and the map/biome label owns the strip to their left — `valueBox` on the row, from the label's measured end plus the kit's 8 px gutter to one gutter before the block. The view elides the label to that box with `…` (`elideValue`, the Silkscreen advance at the value's 12 px) instead of letting it slide under the last cell, so a row paints no glyph of a value outside its own box; the phone row keeps the frame's own slot and draws no value at all (`forLayout(view, 'compact')` empties both fields).
