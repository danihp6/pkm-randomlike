# `src/ui/hud/panels/main-menu/` — the main menu (`01` with a save, `01b` without)

The landing screen as Preact over the `#hud` layer (`D49`): the title block with its accent
rule, the route window's chrome and its live route, the card with its CONTINUE / NEW RUN /
OPTIONS / STATS rows and the stats footer. The rule never lives here:
`src/scenes/MainMenuScene.ts` keeps the save read, the keyboard cursor, the preview seed and
every navigation, and this panel paints the view it is handed.

## Layout

- `view.ts` — the panel's value model: `liveMainMenuView` (the navigable rows, the CONTINUE row's `runPositionLabel` value, the party portraits, the decorative route's `previewSeed` and the footer's three figures and version line), the live footer's records (`mainMenuRecords` / `mainMenuStats`), `fixtureMainMenuView` (the frame's own copy and its structural guards), both boards' rects, the compact footer's two-row rects (`MAIN_MENU_FOOTER_NARROW`), the breakpoint and the two slugs.
- `view.test.ts` — the live rows with and without a run, the labels and values, the portrait strip and its atlas cells, the preview seed and its slug fallback, the footer's live figures and month, the compact footer's geometry, the cursor clamp and the purity checks, headless.
- `version.ts` — the build stamp: the package version and the roadmap phase as constants and `menuVersionLabel`, the `v<version> · PHASE <phase>` line the panel prints.
- `version.test.ts` — the board's own string, this build's defaults, the separator and the phase, headless.
- `routeWindow.ts` — the route window's geometry over the engine's preview model: `previewRoomFor` (one room per `(seed, window)`), `previewOrigin` / `previewTileBox` / `previewWalkerBox` (centred 24 px cells) and `tileBackground` (a tile's object-over-ground CSS backgrounds), plus the walkers' one timer step.
- `routeWindow.test.ts` — the room cache and its key, the centred origin and every tile and walker box inside the window, and the object-first / ground-last background arithmetic, headless.
- `mainMenuPanel.tsx` — the panel itself: the glow, the window with its tile field and wandering Pokémon, the title and its rule, the card with its rows, bars, cursor, portrait cells drawn from the view's crops, the footer figures and the version line.
- `main-menu.css` — the frame's measured geometry and paint, one scoped custom property per board value, the window's clipped tile layer, the phone column and the compact footer's two rows.
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
6. The window's route is decoration (`D55`): the panel reads the model from `routeWindow.ts`,
   paints one span per cell at the layout's window and steps the walkers on a single
   `ROUTE_PREVIEW_STEP_MS` timer that unmount clears. A walker never steps straight back onto
   the tile it just left while another card is open (the model carries `previous`), so two
   samples always catch it somewhere new. It starts no encounter, draws no player and writes
   nothing; the seed rides in the view, so a fixture frame and the live panel draw the same
   room.
