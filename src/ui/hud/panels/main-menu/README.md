# `src/ui/hud/panels/main-menu/` — the main menu (`01` with a save, `01b` without)

The landing screen as Preact over the `#hud` layer (`D49`): the title block with its accent
rule, the route window's chrome, the card with its CONTINUE / NEW RUN / OPTIONS / STATS rows
and the stats footer. The rule never lives here: `src/scenes/MainMenuScene.ts` keeps the save
read, the keyboard cursor and every navigation, and this panel paints the view it is handed.

## Layout

- `view.ts` — the panel's value model: `liveMainMenuView` (the navigable rows, the CONTINUE row's `runPositionLabel` value and the party portraits), `fixtureMainMenuView` (the frame's own copy and its structural guards), both boards' rects, the compact footer's two-row rects (`MAIN_MENU_FOOTER_NARROW`), the breakpoint and the two slugs.
- `view.test.ts` — the live rows with and without a run, the labels and values, the portrait strip and its atlas cells, the compact footer's geometry, the cursor clamp and the purity check, headless.
- `mainMenuPanel.tsx` — the panel itself: the glow, the window, the title and its rule, the card with its rows, bars, cursor, portrait cells drawn from the view's crops, the footer figures and the version line.
- `main-menu.css` — the frame's measured geometry and paint, one scoped custom property per board value, plus the phone column and the compact footer's two rows.
- `mount.tsx` — `mountMainMenu`: renders the panel into a host element, repaints it on `update`, and returns the handle the scene disposes.
- `preview.ts` — `mainMenuPreviewRequested` and `installMainMenuPreview`: the frame's panel behind `?hud=dom&hudFixture=<slug>`, one payload per slug.
- `preview.test.ts` — `mainMenuPreviewRequested`'s truth table, headless.
- `fixture.test.ts` — both fixtures against `design/frames/01`, `01b`, `m01` and `m01b`: the states, the rows, the selected row, the portraits and their atlas cells, the figures, the boards and the payload guards.
- `index.ts` — the barrel the scene and the preview import.
- `README.md` — this map.

## Rules

1. The view is data: no scene, no run, no RNG, no clock and no Phaser. The scene owns the save and the cursor; a row press answers in a `MainMenuIntent` and changes nothing here.
2. The card wrapper and the row wrappers are the measured nodes; the kit `Panel` and `Row` they wrap are the skins. That is why the paint and the board's 1 px edges sit on the wrapper and the row box is the same box as its button within 1 px.
3. `portraits` is read from the payload's `state.party`, never from `rows`: the frame, not the payload, decides whether a CONTINUE row is drawn.
4. The portrait cells draw the party member's own atlas cell through `src/ui/hud/portrait.ts` (`portraitBackground`), in party order; the empty 4 % box is only the fallback for a species the atlas does not name.
5. The footer's figures and the version line are the frame's own copy: the live menu draws
   the four rows of `MAIN_MENU_ACTIONS` — CONTINUE (with a run), NEW RUN, OPTIONS and STATS —
   and `stats: []` and `version: null` until a footer figure exists. The STATS row opens the
   stats panel (`src/ui/hud/panels/stats/`) in the scene; the canvas fallback keeps three rows
   (or two without a run). On the phone the three figures wrap into two rows
   (`MAIN_MENU_FOOTER_NARROW`), because the desk's single row collides at 390 px.
